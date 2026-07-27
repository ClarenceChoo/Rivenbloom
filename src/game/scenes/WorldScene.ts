import Phaser from 'phaser';
import { CameraDirector } from '../camera/CameraDirector';
import {
  CombatSceneAdapter,
  type CombatWorldPort,
  type EnemyRuntimeEntry,
  type PlayerHitOutcome
} from '../combat/CombatSceneAdapter';
import type { CombatRuntimeTarget } from '../combat/CombatAbilityRuntime';
import { resolveDamage } from '../combat/DamageResolver';
import { damageTypeId } from '../combat/CombatTypes';
import { PLAYER_CAMERA_TUNING, PLAYER_MOVEMENT_TUNING } from '../config/traversal';
import { maxHealthFor } from '../config/balance';
import type { AccessibilitySettingsState } from '../config/accessibility';
import {
  AccessibilitySettingsToken,
  GAME_SERVICES_REGISTRY_KEY,
  GameEventsToken,
  InputServiceToken,
  SaveServiceToken
} from '../core/GameServices';
import { SceneScope } from '../core/SceneScope';
import type { ServiceRegistry } from '../core/ServiceRegistry';
import { EncounterDirector } from '../ai/EncounterDirector';
import { EnemyFactory } from '../entities/enemies/EnemyFactory';
import { createVillageNpcs, type NpcController } from '../entities/npcs/NpcController';
import { actorDefinitions } from '../data/actors';
import { getAreaDefinition, INITIAL_WORLD_AREA_ID } from '../data/areas';
import type { GameEvents } from '../core/GameEvents';
import type {
  ActorDefinition,
  ActorSpawnDefinition,
  AreaDefinition,
  AttackDefinition,
  LayerDefinition,
  LoadedArea,
  MechanismDefinition,
  PlayerSpawnDefinition,
  PointDefinition,
  RectDefinition,
  RenderDefinition,
  TriggerDefinition
} from '../data/types';
import { PlayerController } from '../entities/player/PlayerController';
import type { PlayerStateName } from '../entities/player/PlayerState';
import { PlayerView } from '../entities/player/PlayerView';
import type { Facing } from '../physics/MovementModel';
import { PlatformRules } from '../physics/PlatformRules';
import type { InputService } from '../input/InputService';
import { createDefaultSave, type SaveSlotId, type SaveV1 } from '../saves/SaveSchema';
import type { SaveService } from '../saves/SaveService';
import type { QuestStore } from '../quests/QuestStore';
import { installTestBridge } from '../testing/TestBridge';
import { formatAreaName } from '../ui/title/TitleMenuModel';
import { AreaLoader } from '../world/AreaLoader';
import { BreakableSystem } from '../world/BreakableSystem';
import { CheckpointSystem } from '../world/CheckpointSystem';
import { horizontalLayerTiles } from '../world/LayerTiling';
import { PuzzleSystem, type PuzzleActivation } from '../world/PuzzleSystem';
import { TriggerSystem } from '../world/TriggerSystem';
import {
  advanceQuests,
  applyPuzzleResult,
  awardEnemyDefeat,
  claimDiscovery,
  discoverRoom,
  recordBrokenBreakable,
  seedQuestStore,
  type QuestSignal
} from '../world/WorldProgress';
import { SceneKeys } from './SceneKeys';

type WorldPayload = {
  readonly areaId?: string;
  readonly spawnId?: string;
  readonly slotId?: SaveSlotId;
  readonly save?: SaveV1;
};

const NPC_INTERACT_RANGE = 96;
const FLOOR_PROBE_OFFSET = 26;
const FLOOR_PROBE_DEPTH = 10;
// Mercy invulnerability after an applied hit so overlapping enemies cannot
// chain the player into a permanent hurt-lock.
const PLAYER_HIT_MERCY_MS = 700;

const rectContains = (bounds: RectDefinition, point: PointDefinition): boolean =>
  point.x >= bounds.x &&
  point.x <= bounds.x + bounds.width &&
  point.y >= bounds.y &&
  point.y <= bounds.y + bounds.height;

export class WorldScene extends Phaser.Scene {
  private scope = new SceneScope();
  private payload: WorldPayload = {};
  private player: PlayerController | undefined;
  private cameraDirector: CameraDirector | undefined;
  private definition: AreaDefinition | undefined;
  private settings: AccessibilitySettingsState | undefined;
  private combat: CombatSceneAdapter | undefined;
  private inputService: InputService | undefined;
  private gameEvents: GameEvents | undefined;
  private saveService: SaveService | undefined;
  private previousPlayerState: PlayerStateName | undefined;
  private landingCount = 0;
  private comboMaxStage = 0;
  private slotId: SaveSlotId | undefined;
  private save: SaveV1 = createDefaultSave('slot-1', 0);
  private sessionHealth = 0;
  private questStore: QuestStore | undefined;
  private triggers: TriggerSystem | undefined;
  private checkpoints: CheckpointSystem | undefined;
  private puzzles: PuzzleSystem | undefined;
  private npcs: readonly NpcController[] = [];
  private breakables: BreakableSystem | undefined;
  private activeSurfaces: readonly AreaDefinition['surfaces'][number][] = [];
  private readonly propImages = new Map<string, Phaser.GameObjects.Image>();
  private solidSurfaces: readonly RectDefinition[] = [];
  private dialogueOpen = false;
  private dying = false;
  private lastPersistMs = 0;
  private lastQuestStage: string | undefined;
  private lastPlayerHitMs = 0;

  public constructor() {
    super(SceneKeys.World);
  }

  public init(payload: WorldPayload): void {
    this.scope = new SceneScope();
    this.payload = payload;
    this.player = undefined;
    this.cameraDirector = undefined;
    this.definition = undefined;
    this.settings = undefined;
    this.combat = undefined;
    this.inputService = undefined;
    this.gameEvents = undefined;
    this.saveService = undefined;
    this.previousPlayerState = undefined;
    this.landingCount = 0;
    this.comboMaxStage = 0;
    this.slotId = payload.slotId;
    this.questStore = undefined;
    this.triggers = undefined;
    this.checkpoints = undefined;
    this.puzzles = undefined;
    this.npcs = [];
    this.breakables = undefined;
    this.activeSurfaces = [];
    this.propImages.clear();
    this.solidSurfaces = [];
    this.dialogueOpen = false;
    this.dying = false;
    this.lastPersistMs = Date.now();
    this.lastQuestStage = undefined;
    this.lastPlayerHitMs = 0;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.scope.add(() => this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this));
  }

  public create(): void {
    const areaId =
      this.payload.save?.metadata.areaId ?? this.payload.areaId ?? INITIAL_WORLD_AREA_ID;
    const requestedArea = this.payload.areaId ?? areaId;
    const definition = getAreaDefinition(requestedArea);
    if (definition === undefined) throw new Error(`Unknown world area "${requestedArea}".`);
    const loaded = new AreaLoader().load(definition);
    const services = this.registry.get(GAME_SERVICES_REGISTRY_KEY) as ServiceRegistry;
    this.inputService = services.get(InputServiceToken);
    const events = services.get(GameEventsToken);
    this.gameEvents = events;
    this.saveService = services.get(SaveServiceToken);
    this.settings = services.get(AccessibilitySettingsToken);
    this.definition = definition;
    this.save = this.payload.save ?? {
      ...createDefaultSave(this.slotId ?? 'slot-1'),
      metadata: {
        ...createDefaultSave(this.slotId ?? 'slot-1').metadata,
        areaId: definition.id
      }
    };
    this.questStore = seedQuestStore(this.save);
    this.triggers = new TriggerSystem(definition.triggers);
    this.checkpoints = new CheckpointSystem(definition);
    this.puzzles = new PuzzleSystem(definition.mechanisms);
    this.npcs = createVillageNpcs();
    this.breakables = new BreakableSystem(definition.breakables ?? [], this.save.solvedPuzzleIds);
    const brokenSurfaceIds = new Set(
      (definition.breakables ?? [])
        .filter(({ id }) => this.breakables?.isBroken(id) === true)
        .map(({ surfaceId }) => surfaceId)
        .filter((id): id is string => id !== undefined)
    );
    this.activeSurfaces = definition.surfaces.filter(({ id }) => !brokenSurfaceIds.has(id));
    this.refreshSolidSurfaces();

    const spawn = this.resolveSpawn(definition);
    this.sessionHealth = Math.max(
      1,
      Math.min(this.save.player.health, maxHealthFor(this.save.player.healthUpgrades))
    );

    this.cameras.main.setBackgroundColor('#171325');
    this.cameras.main.setBounds(
      loaded.bounds.x,
      loaded.bounds.y,
      loaded.bounds.width,
      loaded.bounds.height
    );
    this.cameras.main.centerOn(spawn.position.x, loaded.bounds.height / 2);

    this.renderLayers(loaded);
    this.renderProps(definition);
    this.renderNpcs(definition);
    const mara = actorDefinitions.find(({ id }) => id === 'mara-vey');
    if (mara === undefined) throw new Error('Player actor "mara-vey" is not registered.');
    const view = new PlayerView(this, mara, spawn.position);
    this.player = new PlayerController({
      input: this.inputService,
      platforms: new PlatformRules(this.activeSurfaces, definition.bounds, mara.collisionBody),
      view,
      tuning: PLAYER_MOVEMENT_TUNING,
      spawn,
      unlockedAbilityIds: this.save.unlockedAbilities
    });
    this.scope.add(() => this.player?.dispose());
    this.scope.add(
      installTestBridge({
        unlockAbility: (abilityId) => this.player?.unlockAbility(abilityId) ?? false
      })
    );
    this.createCombatRuntime(mara, definition, this.settings, events);
    this.cameraDirector = new CameraDirector(this.cameras.main, PLAYER_CAMERA_TUNING);
    this.scope.add(() => this.cameraDirector?.dispose());
    this.subscribeWorldEvents(events);
    this.exposeSemanticState(loaded);
    this.updateSemanticState();
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('world-debug')) {
      this.renderDebugOverlay(definition);
    }
  }

  private resolveSpawn(definition: AreaDefinition): PlayerSpawnDefinition {
    if (this.payload.spawnId !== undefined) {
      const authored = definition.playerSpawns.find(({ id }) => id === this.payload.spawnId);
      if (authored !== undefined) return authored;
    }
    if (this.checkpoints !== undefined && this.save.metadata.areaId === definition.id) {
      const restored = this.checkpoints.restore(this.save);
      return restored.spawn;
    }
    const fallback = definition.playerSpawns.find(({ id }) => id === definition.defaultSpawnId);
    if (fallback === undefined) {
      throw new Error(`Area "${definition.id}" is missing its default spawn.`);
    }
    return fallback;
  }

  private createCombatRuntime(
    mara: ActorDefinition,
    definition: AreaDefinition,
    settings: AccessibilitySettingsState,
    events: GameEvents
  ): void {
    const director = new EncounterDirector();
    const factory = new EnemyFactory(director);
    const entries: EnemyRuntimeEntry[] = [];
    for (const spawn of definition.actorSpawns) {
      const actor = actorDefinitions.find(({ id }) => id === spawn.actorId);
      if (actor === undefined) continue;
      if (actor.kind !== 'enemy' && actor.kind !== 'elite') continue;
      entries.push({ spawn, actor, controller: factory.create(spawn) });
    }
    const runtimeTargets: CombatRuntimeTarget[] = [
      ...entries.map(
        (entry): CombatRuntimeTarget => ({
          id: entry.spawn.id,
          kind: 'enemy',
          tags: ['rootglass'],
          position: entry.spawn.position
        })
      ),
      ...definition.mechanisms.map(
        (mechanism): CombatRuntimeTarget => ({
          id: mechanism.id,
          kind: 'mechanism',
          tags: ['resonant'],
          position: mechanism.position
        })
      )
    ];
    const world: CombatWorldPort = {
      obstacles: () => this.solidSurfaces,
      cameraBounds: () => ({
        x: this.cameras.main.worldView.x,
        y: this.cameras.main.worldView.y,
        width: this.cameras.main.worldView.width,
        height: this.cameras.main.worldView.height
      }),
      floorAhead: (position) => this.probeFloor(position),
      receivePlayerHit: (damage, travelDirection) => this.receivePlayerHit(damage, travelDirection),
      onEnemyDefeated: (entry, drops) => this.handleEnemyDefeated(entry, drops),
      onBreakableHit: (breakableId, damage) => this.handleBreakableHit(breakableId, damage),
      rollDrops: (count) => Array.from({ length: count }, () => Math.random())
    };
    const breakableTargets = (definition.breakables ?? [])
      .filter(({ id }) => this.breakables?.isBroken(id) !== true)
      .map(({ id, bounds }) => ({ id, bounds }));
    this.combat = new CombatSceneAdapter(
      this,
      mara,
      this.player?.snapshot.position ?? { x: 0, y: 0 },
      entries,
      breakableTargets,
      runtimeTargets,
      {
        interceptProjectile: (projectile) => {
          if (this.player === undefined) {
            throw new Error('Player combat runtime is unavailable.');
          }
          return this.player.interceptProjectile(projectile);
        }
      },
      settings,
      events,
      director,
      world
    );
    this.scope.add(() => this.combat?.dispose());
  }

  private subscribeWorldEvents(events: GameEvents): void {
    this.scope.add(
      events.subscribe('dialogue:completed', ({ questSignals }) => {
        this.dialogueOpen = false;
        this.inputService?.clearTransient();
        if (questSignals.length > 0) {
          this.applyQuestSignals(questSignals);
          this.persist(true);
        }
      })
    );
    this.scope.add(
      events.subscribe('combat:mechanism-requested', ({ mechanismId }) => {
        this.applyMechanism(mechanismId, { kind: 'ability', abilityId: 'resonant-pulse' });
      })
    );
  }

  private probeFloor(position: PointDefinition): { left: boolean; right: boolean } {
    const probe = (x: number): boolean => {
      const point = { x, y: position.y + FLOOR_PROBE_DEPTH };
      return this.definition !== undefined
        ? this.definition.surfaces.some(
            ({ kind, collision }) =>
              (kind === 'solid' || kind === 'one-way') && rectContains(collision, point)
          )
        : false;
    };
    return {
      left: probe(position.x - FLOOR_PROBE_OFFSET),
      right: probe(position.x + FLOOR_PROBE_OFFSET)
    };
  }

  private receivePlayerHit(
    damage: AttackDefinition['damage'],
    travelDirection: Facing
  ): PlayerHitOutcome {
    if (this.time.now - this.lastPlayerHitMs < PLAYER_HIT_MERCY_MS) {
      return { healthDamage: 0, blocked: false, parried: false, invulnerable: true, knockback: 0 };
    }
    const step = this.player?.latestCombatStep;
    const mara = actorDefinitions.find(({ id }) => id === 'mara-vey');
    const result = resolveDamage(
      {
        amount: damage.amount,
        damageType: damageTypeId(damage.type),
        criticalMultiplier: 1,
        poiseDamage: damage.poise,
        knockback: Math.abs(damage.knockback.x)
      },
      {
        armor: mara?.stats.defence ?? 0,
        resistances: {},
        guard: step?.guard ?? { kind: 'none' },
        invulnerable: step?.invulnerable ?? false
      }
    );
    const outcome: PlayerHitOutcome = {
      healthDamage: result.healthDamage,
      blocked: result.blocked,
      parried: result.parried,
      invulnerable: result.invulnerable,
      knockback: result.knockback
    };
    if (result.invulnerable || result.parried) return outcome;
    this.lastPlayerHitMs = this.time.now;
    if (result.healthDamage > 0) {
      this.sessionHealth = Math.max(0, this.sessionHealth - result.healthDamage);
      this.gameEvents?.emit('combat:damage-resolved', {
        targetId: 'mara-vey',
        amount: result.healthDamage,
        remainingHealth: this.sessionHealth,
        critical: false
      });
    }
    if (result.knockback > 0 && !result.blocked) {
      const direction = travelDirection === 'right' ? 1 : -1;
      this.player?.applyKnockback({
        x: direction * Math.min(320, Math.max(140, result.knockback)),
        y: -90
      });
    }
    if (this.sessionHealth === 0) this.beginDeath();
    return outcome;
  }

  private handleBreakableHit(
    breakableId: string,
    damage: AttackDefinition['damage']
  ): { removed: boolean } {
    if (this.breakables === undefined || this.definition === undefined) {
      return { removed: false };
    }
    const result = this.breakables.applyHit(breakableId, {
      amount: damage.amount,
      damageType: damage.type
    });
    if (result.kind !== 'broken') return { removed: false };
    const change = recordBrokenBreakable(this.save, result.persistentFlagId);
    this.save = change.save;
    const breakable = (this.definition.breakables ?? []).find(({ id }) => id === breakableId);
    if (breakable?.surfaceId !== undefined) {
      this.activeSurfaces = this.activeSurfaces.filter(({ id }) => id !== breakable.surfaceId);
      this.refreshSolidSurfaces();
      const mara = actorDefinitions.find(({ id }) => id === 'mara-vey');
      if (mara !== undefined) {
        this.player?.replacePlatforms(
          new PlatformRules(this.activeSurfaces, this.definition.bounds, mara.collisionBody)
        );
      }
    }
    if (breakable?.propId !== undefined) {
      this.propImages.get(breakable.propId)?.destroy();
      this.propImages.delete(breakable.propId);
    }
    this.gameEvents?.emit('ui:notification-requested', {
      message: 'The cracked seal gives way.',
      tone: 'success'
    });
    if (change.first) this.persist(true);
    return { removed: true };
  }

  private handleEnemyDefeated(
    entry: EnemyRuntimeEntry,
    drops: readonly { readonly itemId: string; readonly quantity: number }[]
  ): void {
    const award = awardEnemyDefeat(this.save, entry.actor.id, drops);
    this.save = award.save;
    if (award.xpAwarded > 0) {
      this.gameEvents?.emit('ui:notification-requested', {
        message: `${entry.actor.displayName} felled — ${award.xpAwarded} XP`,
        tone: 'success'
      });
    }
    this.persist();
  }

  private beginDeath(): void {
    if (this.dying || this.checkpoints === undefined) return;
    this.dying = true;
    const { save } = this.checkpoints.respawnAfterDeath(this.save, Date.now());
    this.save = save;
    this.sessionHealth = save.player.health;
    this.persist(true);
    const reducedMotion = this.settings?.current.reducedMotion === true;
    const restart = (): void => {
      this.scene.restart({
        areaId: this.save.metadata.areaId,
        ...(this.slotId === undefined ? {} : { slotId: this.slotId }),
        save: this.save
      } satisfies WorldPayload);
    };
    if (reducedMotion) {
      restart();
      return;
    }
    this.cameras.main.fadeOut(420, 23, 19, 37);
    const handle = this.time.delayedCall(460, restart);
    this.scope.add(() => handle.remove(false));
  }

  public update(time: number, delta: number): void {
    if (
      this.player === undefined ||
      this.cameraDirector === undefined ||
      this.definition === undefined ||
      this.settings === undefined ||
      this.inputService === undefined ||
      this.dying
    ) {
      return;
    }
    if (this.dialogueOpen) {
      this.updateSemanticState();
      return;
    }
    if (this.combat?.consumeHitStop(delta) === true) {
      this.updateSemanticState();
      return;
    }
    const frame = this.inputService.sample(time);
    this.player.update(time, delta, frame);
    const snapshot = this.player.snapshot;
    this.combat?.accept(
      this.player.drainCombatDirectives(),
      snapshot.position,
      snapshot.facing,
      this.player.combatSnapshot
    );
    this.combat?.update(delta, snapshot.position, this.playerNoiseLevel());
    this.routeTriggers(snapshot.position);
    if (frame.pressed.includes('interact')) this.handleInteract(snapshot.position);
    this.cameraDirector.follow(snapshot.position, this.definition.bounds, {
      facing: snapshot.facing,
      reducedMotion: this.settings.current.reducedMotion,
      deltaSeconds: delta / 1000
    });
    this.combat?.applyCameraFeedback(this.cameras.main);
    this.updateSemanticState();
  }

  private playerNoiseLevel(): number {
    const state = this.player?.snapshot.machine.value;
    if (state === undefined) return 0.15;
    if (
      state === 'attackLight' ||
      state === 'attackHeavy' ||
      state === 'airAttack' ||
      state === 'cast'
    ) {
      return 1;
    }
    if (state === 'dash') return 0.8;
    if (state === 'run') return 0.55;
    return 0.15;
  }

  private routeTriggers(position: PointDefinition): void {
    if (this.triggers === undefined) return;
    for (const trigger of this.triggers.advance(position)) {
      this.routeTrigger(trigger);
      if (this.dying) return;
    }
  }

  private routeTrigger(trigger: TriggerDefinition): void {
    switch (trigger.kind) {
      case 'room-entry': {
        const change = discoverRoom(this.save, trigger.targetId);
        this.save = change.save;
        return;
      }
      case 'discovery': {
        const change = claimDiscovery(this.save, trigger.targetId);
        this.save = change.save;
        if (change.first) {
          this.gameEvents?.emit('ui:notification-requested', {
            message: 'Discovery recorded in the journal.',
            tone: 'success'
          });
          this.persist();
        }
        return;
      }
      case 'quest': {
        this.applyQuestSignals([{ questId: trigger.targetId }]);
        this.persist();
        return;
      }
      case 'checkpoint':
        this.activateCheckpoint(trigger.targetId);
        return;
      case 'transition':
        this.beginTransition(trigger.targetId);
        return;
      case 'interaction':
        return;
    }
  }

  private activateCheckpoint(checkpointId: string): void {
    if (this.checkpoints === undefined) return;
    const activation = this.checkpoints.activate(this.save, checkpointId, Date.now());
    this.save = activation.save;
    this.sessionHealth = this.save.player.health;
    if (activation.firstActivation) {
      this.gameEvents?.emit('ui:notification-requested', {
        message: 'Seed-lantern kindled. Progress rooted here.',
        tone: 'success'
      });
    }
    this.persist(true);
  }

  private beginTransition(transitionId: string): void {
    if (this.definition === undefined) return;
    const transition = this.definition.transitions.find(({ id }) => id === transitionId);
    if (transition === undefined) return;
    const destination = getAreaDefinition(transition.destinationAreaId);
    if (destination === undefined) return;
    this.save = {
      ...this.save,
      metadata: { ...this.save.metadata, areaId: destination.id }
    };
    this.persist(true);
    this.gameEvents?.emit('area:changed', {
      areaId: destination.id,
      previousAreaId: this.definition.id
    });
    this.scene.start(SceneKeys.Transition, {
      destinationId: destination.id,
      destinationName: formatAreaName(destination.id),
      slotId: this.slotId,
      save: this.save,
      spawnId: transition.destinationSpawnId,
      reducedMotion: this.settings?.current.reducedMotion === true
    });
  }

  private handleInteract(position: PointDefinition): void {
    if (this.definition === undefined) return;
    // Interaction triggers stay re-usable: solved mechanisms already replay
    // idempotently, so the trigger's own once-flag is not consumed here.
    const interaction = this.definition.triggers.find(
      (trigger) => trigger.kind === 'interaction' && rectContains(trigger.bounds, position)
    );
    if (interaction !== undefined) {
      const mechanism = this.definition.mechanisms.find(({ id }) => id === interaction.targetId);
      if (mechanism !== undefined) {
        this.applyMechanism(mechanism.id, { kind: 'interact' });
        return;
      }
    }
    const npcSpawn = this.nearestNpcSpawn(position);
    if (npcSpawn !== undefined) this.startNpcDialogue(npcSpawn);
  }

  private nearestNpcSpawn(position: PointDefinition): ActorSpawnDefinition | undefined {
    if (this.definition === undefined) return undefined;
    let nearest: ActorSpawnDefinition | undefined;
    let nearestDistance = NPC_INTERACT_RANGE;
    for (const spawn of this.definition.actorSpawns) {
      const actor = actorDefinitions.find(({ id }) => id === spawn.actorId);
      if (actor?.kind !== 'npc') continue;
      const distance = Math.abs(spawn.position.x - position.x);
      if (distance <= nearestDistance && Math.abs(spawn.position.y - position.y) <= 140) {
        nearest = spawn;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  private startNpcDialogue(spawn: ActorSpawnDefinition): void {
    const npc = this.npcs.find(({ actorId }) => actorId === spawn.actorId);
    if (npc === undefined) return;
    const dialogueId = npc.dialogueFor({
      questStages: this.save.questStages,
      questFlags: this.save.questFlags
    });
    this.dialogueOpen = true;
    this.inputService?.clearTransient();
    this.scene.launch(SceneKeys.Dialogue, {
      dialogueId,
      questStages: this.save.questStages,
      questFlags: this.save.questFlags
    });
  }

  private applyMechanism(mechanismId: string, activation: PuzzleActivation): void {
    if (this.puzzles === undefined) return;
    const result = this.puzzles.apply(mechanismId, activation, {
      solvedPuzzleIds: this.save.solvedPuzzleIds,
      activatedShortcutIds: this.save.activatedShortcutIds,
      unlockedAbilities: this.save.unlockedAbilities
    });
    if (result.kind === 'rejected') {
      if (result.reason === 'missing-ability' && activation.kind === 'interact') {
        this.gameEvents?.emit('ui:notification-requested', {
          message: 'Something here is still beyond reach.',
          tone: 'info'
        });
      }
      return;
    }
    const progress = applyPuzzleResult(this.save, result);
    this.save = progress.save;
    const mechanism = this.definition?.mechanisms.find(({ id }) => id === mechanismId);
    if (progress.first) {
      this.gameEvents?.emit('ui:notification-requested', {
        message: this.mechanismNotification(mechanism),
        tone: 'success'
      });
    }
    if (progress.questSignal !== undefined) this.applyQuestSignals([progress.questSignal]);
    if (progress.first) this.persist(true);
  }

  private mechanismNotification(mechanism: MechanismDefinition | undefined): string {
    switch (mechanism?.kind) {
      case 'listening-arch':
        return 'The Listening Arch stirs and hums.';
      case 'lens':
        return 'A rootglass lens brightens.';
      case 'shortcut':
        return 'A shortcut grinds open.';
      case 'seed-lantern':
        return 'A memorial lantern takes the flame.';
      case 'rootglass-forge':
        return 'The forge remembers its work.';
      default:
        return 'Something old answers.';
    }
  }

  private applyQuestSignals(signals: readonly QuestSignal[]): void {
    if (this.questStore === undefined) return;
    const advance = advanceQuests(this.questStore, this.save, signals);
    this.save = advance.save;
    for (const transition of advance.transitions) {
      this.gameEvents?.emit('quest:transition-applied', {
        questId: transition.questId,
        toStage: transition.stageId
      });
      this.gameEvents?.emit('ui:notification-requested', {
        message: 'Journal updated.',
        tone: 'info'
      });
    }
    for (const abilityId of this.save.unlockedAbilities) {
      this.player?.unlockAbility(abilityId);
    }
  }

  private persist(flush = false): void {
    if (this.slotId === undefined || this.saveService === undefined) return;
    const now = Date.now();
    const elapsedSeconds = Math.max(0, Math.round((now - this.lastPersistMs) / 1000));
    this.lastPersistMs = now;
    this.save = {
      ...this.save,
      metadata: {
        ...this.save.metadata,
        updatedAt: now,
        playtimeSeconds: this.save.metadata.playtimeSeconds + elapsedSeconds
      },
      player: { ...this.save.player, health: Math.max(1, this.sessionHealth) }
    };
    void this.saveService.scheduleAutosave(this.slotId, this.save);
    if (flush) void this.saveService.flushAutosaves();
  }

  private renderLayers(loaded: LoadedArea): void {
    for (const layer of loaded.layers) {
      if (layer.kind === 'gameplay') continue;
      for (const x of horizontalLayerTiles(layer, loaded.bounds)) {
        const image = this.createImage(layer.assetKey, x, layer.position.y, layer);
        image.setScrollFactor(layer.scrollFactor);
      }
    }
  }

  private renderProps(definition: AreaDefinition): void {
    const brokenPropIds = new Set(
      (definition.breakables ?? [])
        .filter(({ id }) => this.breakables?.isBroken(id) === true)
        .map(({ propId }) => propId)
        .filter((id): id is string => id !== undefined)
    );
    for (const prop of definition.props) {
      if (brokenPropIds.has(prop.id)) continue;
      const image = this.createImage(
        prop.render.assetKey,
        prop.position.x,
        prop.position.y,
        prop.render
      );
      this.propImages.set(prop.id, image);
    }
  }

  private refreshSolidSurfaces(): void {
    this.solidSurfaces = this.activeSurfaces
      .filter(({ kind }) => kind === 'solid')
      .map(({ collision }) => collision);
  }

  private renderNpcs(definition: AreaDefinition): void {
    for (const spawn of definition.actorSpawns) {
      const actor = actorDefinitions.find(({ id }) => id === spawn.actorId);
      if (actor?.kind !== 'npc') continue;
      const image = this.createImage(
        actor.render.assetKey,
        spawn.position.x,
        spawn.position.y,
        actor.render
      );
      image.setFlipX(spawn.facing === 'left').setData('actorId', actor.id);
    }
  }

  private createImage(
    assetKey: string,
    x: number,
    y: number,
    render: LayerDefinition | RenderDefinition
  ): Phaser.GameObjects.Image {
    let frameKey: string | undefined;
    if (render.source !== undefined) {
      frameKey = [
        'crop',
        render.source.x,
        render.source.y,
        render.source.width,
        render.source.height
      ].join('-');
      const texture = this.textures.get(assetKey);
      if (!texture.has(frameKey)) {
        texture.add(
          frameKey,
          0,
          render.source.x,
          render.source.y,
          render.source.width,
          render.source.height
        );
      }
    }
    const image = this.add.image(x, y, assetKey, frameKey);
    const origin = 'origin' in render ? render.origin : { x: 0, y: 0 };
    image
      .setOrigin(origin.x, origin.y)
      .setDisplaySize(render.size.width, render.size.height)
      .setDepth(render.depth);
    this.scope.add(() => image.destroy());
    return image;
  }

  private exposeSemanticState(loaded: LoadedArea): void {
    const canvas = this.game.canvas;
    canvas.dataset.areaId = loaded.areaId;
    canvas.dataset.roomId = loaded.initialSpawn.roomId;
    canvas.setAttribute('aria-label', `${loaded.displayName} gameplay`);
    this.scope.add(() => {
      delete canvas.dataset.areaId;
      delete canvas.dataset.roomId;
      delete canvas.dataset.playerX;
      delete canvas.dataset.playerY;
      delete canvas.dataset.playerState;
      delete canvas.dataset.playerLandingCount;
      delete canvas.dataset.playerFacing;
      delete canvas.dataset.playerGrounded;
      delete canvas.dataset.cameraX;
      delete canvas.dataset.cameraY;
      delete canvas.dataset.cameraMinX;
      delete canvas.dataset.cameraMaxX;
      delete canvas.dataset.playerMana;
      delete canvas.dataset.playerGuard;
      delete canvas.dataset.playerInvulnerable;
      delete canvas.dataset.playerComboStage;
      delete canvas.dataset.playerComboMaxStage;
      delete canvas.dataset.playerActionFrame;
      delete canvas.dataset.playerLastAttack;
      delete canvas.dataset.playerLastAbility;
      delete canvas.dataset.playerSelectedAbility;
      delete canvas.dataset.lumenProjectileCount;
      delete canvas.dataset.lumenCooldownReadyAt;
      delete canvas.dataset.combatTargetHealth;
      delete canvas.dataset.combatTargetState;
      delete canvas.dataset.combatTargetX;
      delete canvas.dataset.playerHealth;
      delete canvas.dataset.playerMaxHealth;
      delete canvas.dataset.playerXp;
      delete canvas.dataset.enemiesRemaining;
      delete canvas.dataset.silentBloomStage;
      delete canvas.dataset.dialogueOpen;
      delete canvas.dataset.saveSlot;
      canvas.removeAttribute('aria-label');
    });
  }

  private updateSemanticState(): void {
    if (this.player === undefined || this.definition === undefined) return;
    const snapshot = this.player.snapshot;
    const combatState = this.player.combatSnapshot;
    const combatStep = this.player.latestCombatStep;
    const combatScene = this.combat?.snapshot;
    const room = this.definition.rooms.find(
      ({ bounds }) =>
        snapshot.position.x >= bounds.x &&
        snapshot.position.x < bounds.x + bounds.width &&
        snapshot.position.y >= bounds.y &&
        snapshot.position.y <= bounds.y + bounds.height
    );
    const canvas = this.game.canvas;
    if (snapshot.machine.value === 'land' && this.previousPlayerState !== 'land') {
      this.landingCount += 1;
    }
    this.previousPlayerState = snapshot.machine.value;
    this.comboMaxStage = Math.max(this.comboMaxStage, combatState.comboStage);
    if (room !== undefined) canvas.dataset.roomId = room.id;
    canvas.dataset.playerX = snapshot.position.x.toFixed(2);
    canvas.dataset.playerY = snapshot.position.y.toFixed(2);
    canvas.dataset.playerState = snapshot.machine.value;
    canvas.dataset.playerLandingCount = String(this.landingCount);
    canvas.dataset.playerFacing = snapshot.facing;
    canvas.dataset.playerGrounded = String(snapshot.grounded);
    canvas.dataset.cameraX = this.cameras.main.scrollX.toFixed(2);
    canvas.dataset.cameraY = this.cameras.main.scrollY.toFixed(2);
    canvas.dataset.cameraMinX = this.definition.bounds.x.toFixed(2);
    canvas.dataset.cameraMaxX = (
      this.definition.bounds.x +
      this.definition.bounds.width -
      this.cameras.main.width
    ).toFixed(2);
    canvas.dataset.playerMana = String(combatState.mana);
    canvas.dataset.playerSelectedAbility = combatState.selectedAbilityId;
    canvas.dataset.playerGuard = combatStep?.guard.kind ?? 'none';
    canvas.dataset.playerInvulnerable = String(combatStep?.invulnerable ?? false);
    canvas.dataset.playerComboStage = String(combatState.comboStage);
    canvas.dataset.playerComboMaxStage = String(this.comboMaxStage);
    canvas.dataset.playerActionFrame = String(combatState.actionFrame);
    canvas.dataset.lumenCooldownReadyAt = String(combatState.cooldownReadyAt['lumen-bolt'] ?? 0);
    canvas.dataset.lumenProjectileCount = String(combatScene?.activeProjectileCount ?? 0);
    canvas.dataset.combatTargetHealth = String(combatScene?.targetHealth ?? 0);
    canvas.dataset.combatTargetState = combatScene?.targetState ?? 'dead';
    canvas.dataset.combatTargetX = String(combatScene?.targetPosition.x ?? 0);
    canvas.dataset.playerHealth = String(this.sessionHealth);
    canvas.dataset.playerMaxHealth = String(maxHealthFor(this.save.player.healthUpgrades));
    canvas.dataset.playerXp = String(this.save.player.xp);
    canvas.dataset.enemiesRemaining = String(combatScene?.enemiesRemaining ?? 0);
    canvas.dataset.silentBloomStage = this.save.questStages['silent-bloom'] ?? 'unstarted';
    canvas.dataset.dialogueOpen = String(this.dialogueOpen);
    canvas.dataset.saveSlot = this.slotId ?? 'none';
    if (combatScene?.lastAttackId !== undefined) {
      canvas.dataset.playerLastAttack = combatScene.lastAttackId;
    }
    if (combatScene?.lastAbilityId !== undefined) {
      canvas.dataset.playerLastAbility = combatScene.lastAbilityId;
    }
    const stage = this.save.questStages['silent-bloom'];
    if (stage !== this.lastQuestStage) this.lastQuestStage = stage;
  }

  private renderDebugOverlay(definition: AreaDefinition): void {
    const graphics = this.add.graphics().setDepth(1000);
    for (const room of definition.rooms) {
      this.strokeRect(graphics, room.bounds, 0x9ee7d7, 0.5);
    }
    for (const surface of definition.surfaces) {
      this.strokeRect(graphics, surface.collision, 0xf0e3c0, 0.8);
    }
    for (const trigger of definition.triggers) {
      this.strokeRect(graphics, trigger.bounds, 0xf5c96a, 0.8);
    }
    for (const spawn of definition.playerSpawns) {
      graphics.lineStyle(2, 0xbc8ae8, 0.9).strokeCircle(spawn.position.x, spawn.position.y - 8, 8);
    }
    for (const spawn of definition.actorSpawns) {
      graphics.lineStyle(2, 0xee765f, 0.9).strokeCircle(spawn.position.x, spawn.position.y - 8, 8);
    }
    this.scope.add(() => graphics.destroy());
  }

  private strokeRect(
    graphics: Phaser.GameObjects.Graphics,
    bounds: RectDefinition,
    colour: number,
    alpha: number
  ): void {
    graphics
      .lineStyle(2, colour, alpha)
      .strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  }

  private shutdown(): void {
    this.scope.dispose();
  }
}
