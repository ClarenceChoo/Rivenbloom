import { applyPlayerItemAction } from '../world/PlayerItemActions';
import { CombatPresentationView } from '../effects/CombatPresentationView';
import { projectCombatVisuals } from '../effects/CombatPresentation';
import Phaser from 'phaser';

import { appServices } from '../core/AppServices';
import { musicLayerForRoom } from '../audio/AudioDirector';
import { stableId } from '../core/StableId';
import { SceneScope } from '../core/SceneScope';
import { CONTENT_REGISTRY } from '../data/areas';
import { MARA_ACTOR } from '../data/actors';
import type { ActorSpawnDefinition, Rect, Vec2 } from '../data/types';
import { CameraDirector } from '../camera/CameraDirector';
import type { CameraPort } from '../camera/CameraDirector';
import { PlayerController } from '../entities/player/PlayerController';
import type { PlayerControllerSnapshot } from '../entities/player/PlayerController';
import type { PlayerCombatRuntimeEvent } from '../entities/player/PlayerCombatRuntime';
import { PlayerView } from '../entities/player/PlayerView';
import { WorldActorView } from '../entities/WorldActorView';
import type { BossHealthEvent } from '../entities/bosses/BossEvents';
import { gamepadUiActions } from '../input/GamepadUiNavigation';
import { DEFAULT_MOVEMENT_TUNING } from '../physics/MovementModel';
import type { SaveSettings } from '../saves/SaveSchema';
import type { SaveSlotId } from '../saves/SaveSchema';
import {
  drainDevActions,
  recordDevDeathReloadInitial,
  updateDevBridge,
} from '../testing/devBridge';
import type { TitleTransitionPayload } from '../title/TitleController';
import { AreaLoader } from '../world/AreaLoader';
import { CheckpointSystem } from '../world/CheckpointSystem';
import { BossEncounterCoordinator } from '../world/BossEncounterCoordinator';
import { RuntimeSaveCoordinator } from '../world/RuntimeSaveCoordinator';
import type { WorldInteractionAction } from '../world/WorldInteractionRuntime';
import { WorldModalController } from '../world/WorldModalController';
import type {
  WorldDomainEvent,
  WorldModalCommand,
  WorldModalState,
} from '../world/WorldModalController';
import { checkpointLabel, projectWorldUi } from '../world/WorldUiProjection';
import type { UiSessionProjection } from '../world/WorldUiProjection';
import { WorldSceneCoordinator } from '../world/WorldSceneCoordinator';
import type {
  WorldCombatJournalEvent,
  WorldCombatRuntimeSnapshot,
} from '../world/WorldCombatRuntime';
import { WorldRoomRuntime } from '../world/WorldRoomRuntime';
import type { WorldRoomStep } from '../world/WorldRoomRuntime';
import { applyProgressionTransaction } from '../world/WorldProgression';
import type { ProgressionEvent } from '../world/WorldProgression';
import type { WorldStartResult } from '../world/WorldStart';
import { WorldStart } from '../world/WorldStart';
import { SceneKeys } from './SceneKeys';

type EnemyDebugViewPort = Readonly<{
  sync(snapshot: WorldCombatRuntimeSnapshot): void;
  destroy(): boolean;
}>;

export class WorldScene extends Phaser.Scene {
  private errorButton: HTMLButtonElement | null = null;
  private playerController: PlayerController | null = null;
  private playerView: PlayerView | null = null;
  private enemyDebugView: EnemyDebugViewPort | null = null;
  private combatView: CombatPresentationView | null = null;
  private worldActorView: WorldActorView | null = null;
  private worldRoomRuntime: WorldRoomRuntime | null = null;
  private cameraDirector: CameraDirector | null = null;
  private roomBounds: Rect | null = null;
  private respawnPosition: Vec2 | null = null;
  private settings: SaveSettings | null = null;
  private facing: 'left' | 'right' = 'right';
  private runtimeSlotId: SaveSlotId | null = null;
  private runtimeSaves: RuntimeSaveCoordinator | null = null;
  private modalController: WorldModalController | null = null;
  private checkpointSystem: CheckpointSystem | null = null;
  private bossCoordinator: BossEncounterCoordinator | null = null;
  private activeArea: Extract<WorldStartResult, { kind: 'ready' }>['area'] | null = null;
  private activeRoom: Extract<WorldStartResult, { kind: 'ready' }>['room'] | null = null;
  private activeCheckpoint: Extract<WorldStartResult, { kind: 'ready' }>['checkpoint'] | null =
    null;
  private currentPrompt: string | null = null;
  private pendingInteraction: Readonly<{
    action: WorldInteractionAction;
    interactBufferId: number;
  }> | null = null;
  private pendingTransition: Readonly<{
    transitionId: import('../data/types').TransitionId;
    interactBufferId: number | null;
  }> | null = null;
  private readonly pendingWorldCombatEvents: WorldCombatJournalEvent[] = [];
  private pendingDeath = false;
  private pendingPause = false;
  private returningToTitle = false;
  private endingStarted = false;
  private uiRevision = 0;
  private nextDomainSequence = 1;
  private devDomainEvents: WorldDomainEvent[] = [];
  private unbindModalCommands: (() => void) | null = null;
  private unbindSaveState: (() => void) | null = null;
  private lastUiKey = '';
  private unbindMenuCommands: (() => void) | null = null;
  private currentUiProjection: UiSessionProjection | null = null;
  private bossHealth: BossHealthEvent | null = null;
  private startingPlayTimeMs = 0;
  private sessionElapsedMs = 0;
  private gameplayGeneration = 0;

  public constructor() {
    super(SceneKeys.World);
  }

  public create(payload: TitleTransitionPayload): void {
    this.returningToTitle = false;
    const scope = new SceneScope();
    let alive = true;
    let destroyDebugOverlay: (() => void) | null = null;
    const shutdown = () => scope.dispose();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, shutdown);
    scope.add(() => this.events.off(Phaser.Scenes.Events.SHUTDOWN, shutdown));

    const services = appServices(this);
    services.get('inputService').clearTransient();
    const coordinator = new WorldSceneCoordinator(
      new WorldStart(
        services.get('saveService'),
        new AreaLoader(CONTENT_REGISTRY),
        CONTENT_REGISTRY,
        () => Date.now(),
      ),
      {
        areaLoaded: (event) => services.get('events').emit('area-loaded', event),
        worldSnapshot: (event) => {
          if (import.meta.env.DEV) {
            updateDevBridge({
              activeScene: SceneKeys.World,
              transition: null,
              world: event,
            });
          }
        },
        failed: (result) => this.showFailure(result, payload.settings, scope),
      },
    );
    scope.add(() => {
      alive = false;
      coordinator.stop();
      this.stopGameplay();
      destroyDebugOverlay?.();
      destroyDebugOverlay = null;
      this.errorButton = null;
    });

    if (import.meta.env.DEV) {
      updateDevBridge({
        activeScene: SceneKeys.World,
        transition: null,
        world: null,
        player: null,
        camera: null,
        combat: null,
        encounter: null,
        worldUi: null,
        modal: null,
        lastDomainEvent: null,
        domainEvents: [],
        runtimeSaveRevision: null,
      });
    }
    void coordinator.begin(payload).then((result) => {
      if (!alive || result.kind !== 'ready') return;
      this.startGameplay(result);
      if (
        import.meta.env.DEV &&
        new URLSearchParams(globalThis.location.search).has('debug-world')
      ) {
        void import('../world/WorldDebugOverlay').then(({ createWorldDebugOverlay }) => {
          if (!alive) return;
          destroyDebugOverlay = createWorldDebugOverlay(this, result.area);
        });
      }
    });
  }

  public update(_time: number, deltaMs: number): void {
    const controller = this.playerController;
    const cameraDirector = this.cameraDirector;
    const roomBounds = this.roomBounds;
    const settings = this.settings;
    if (
      controller !== null &&
      cameraDirector !== null &&
      roomBounds !== null &&
      settings !== null
    ) {
      if (this.pendingDeath) {
        this.beginDeathTransition();
        return;
      }
      if (this.modalController !== null && this.modalController.snapshot !== null) {
        const frozen = controller.snapshot();
        const encounterSnapshot = this.worldRoomRuntime?.snapshot().combat ?? null;
        this.playerView?.sync(frozen);
        if (encounterSnapshot !== null)
          this.worldActorView?.sync(
            encounterSnapshot,
            this.worldRoomRuntime?.snapshot().objects,
            settings.reducedMotion,
            this.activeCheckpoint?.checkpointId,
          );
        if (import.meta.env.DEV) {
          if (encounterSnapshot !== null) this.enemyDebugView?.sync(encounterSnapshot);
          this.publishGameplaySnapshot(frozen, encounterSnapshot);
        }
        return;
      }
      if (import.meta.env.DEV) {
        for (const action of drainDevActions()) {
          if (action.kind === 'respawn' && this.respawnPosition !== null) {
            this.worldRoomRuntime?.resetForRestore();
            controller.respawn(this.respawnPosition);
          }
          if (action.kind === 'defeat-enemies' && this.worldRoomRuntime !== null) {
            const runtime = this.worldRoomRuntime;
            const encounter = runtime.snapshot().combat;
            const player = controller.snapshot();
            for (const combatantId of action.combatantIds) {
              const enemy = encounter.enemies.find(
                (candidate) => candidate.combatantId === combatantId,
              );
              if (enemy === undefined || enemy.state === 'dead') continue;
              runtime.receivePlayerImpact({
                attackId: stableId<'attack'>('dev-defeat-enemy'),
                targetId: enemy.combatantId,
                source: {
                  ownerId: stableId<'combatant'>('mara'),
                  teamId: stableId<'team'>('player'),
                  position: player.position,
                  facing: this.facing,
                },
                occurredAtMs: encounter.simulationTimeMs,
                delivery: 'melee',
                damage: {
                  baseDamage: 10_000,
                  damageType: stableId<'damage-type'>('dev'),
                  poiseDamage: 10_000,
                  critical: { kind: 'excluded' },
                },
                knockback: { x: 0, y: 0 },
                hitStopMs: 0,
                tags: [],
                projectile: null,
              });
            }
          }
        }
      }
      this.pendingInteraction = null;
      this.pendingTransition = null;
      let snapshot = controller.update(performance.now(), Math.max(0, deltaMs) / 1_000);
      if (this.pendingPause) {
        this.beginPause(snapshot);
        return;
      }
      this.sessionElapsedMs = Math.min(
        Number.MAX_SAFE_INTEGER - this.startingPlayTimeMs,
        this.sessionElapsedMs + Math.max(0, deltaMs),
      );
      this.publishCombatEvents(controller.drainCombatEvents());
      const roomRuntime = this.worldRoomRuntime;
      if (this.pendingWorldCombatEvents.length > 0) {
        this.publishWorldCombatEvents(Object.freeze([...this.pendingWorldCombatEvents]));
        this.pendingWorldCombatEvents.length = 0;
      }
      if (this.pendingDeath) {
        this.beginDeathTransition();
        return;
      }
      const pending = this.takePendingInteraction();
      if (pending !== null) {
        if (this.handleInteraction(pending.action)) {
          appServices(this).get('inputService').consume('interact', pending.interactBufferId);
        }
        snapshot = controller.snapshot();
      }
      if (this.pendingTransition !== null) {
        if (this.handlePendingTransition()) return;
        snapshot = controller.snapshot();
      }
      this.publishWorldUi(snapshot);
      if (snapshot.velocity.x < -0.01) this.facing = 'left';
      if (snapshot.velocity.x > 0.01) this.facing = 'right';
      cameraDirector.follow(snapshot.position, roomBounds, {
        dt: Math.max(0, deltaMs) / 1_000,
        deadZone: { width: 320, height: 180 },
        lookAheadDistance: 120,
        facing: this.facing,
        verticalSmoothing: 8,
        reducedMotion: settings.reducedMotion,
      });
      this.playerView?.sync(snapshot);
      const encounterSnapshot = roomRuntime?.snapshot().combat ?? null;
      if (encounterSnapshot !== null)
        this.worldActorView?.sync(
          encounterSnapshot,
          this.worldRoomRuntime?.snapshot().objects,
          settings.reducedMotion,
          this.activeCheckpoint?.checkpointId,
        );
      this.combatView?.sync(
        projectCombatVisuals(snapshot.combat.projectiles, encounterSnapshot, {
          position: snapshot.position,
          facing: this.facing,
          combat: snapshot.combat,
        }),
        this.time.now,
        this.settings ?? undefined,
      );
      if (import.meta.env.DEV) {
        if (encounterSnapshot !== null) this.enemyDebugView?.sync(encounterSnapshot);
        this.publishGameplaySnapshot(snapshot, encounterSnapshot);
      }
      return;
    }
    const errorButton = this.errorButton;
    if (errorButton === null) return;
    const frame = appServices(this).get('inputService').sample(performance.now());
    const actions = gamepadUiActions(frame);
    if (actions.includes('confirm') || actions.includes('cancel')) errorButton.click();
  }

  private startGameplay(result: Extract<WorldStartResult, { kind: 'ready' }>): void {
    const generation = ++this.gameplayGeneration;
    const authoredSpawns = this.enemySpawnsFor(result);
    if (import.meta.env.DEV) {
      const fixtureId = new URLSearchParams(globalThis.location.search).get('debug-encounter');
      if (fixtureId !== null) {
        void import('../testing/debugEncounters').then(({ debugEncounterSpawns }) => {
          if (generation !== this.gameplayGeneration) return;
          const fixture = debugEncounterSpawns(fixtureId, result.room.roomId);
          this.startGameplayWithSpawns(result, fixture ?? authoredSpawns, fixture !== null);
        });
        return;
      }
    }
    this.startGameplayWithSpawns(result, authoredSpawns, false);
  }

  private startGameplayWithSpawns(
    result: Extract<WorldStartResult, { kind: 'ready' }>,
    spawns: readonly ActorSpawnDefinition[],
    showEnemyDebugView: boolean,
  ): void {
    const generation = this.gameplayGeneration;
    const services = appServices(this);
    const input = services.get('inputService');
    input.setSustainedActionMode(result.settings.sustainedAction);
    const saveCoordinator = new RuntimeSaveCoordinator(
      result.slotId,
      result.save,
      services.get('saveService'),
    );
    const modalController = new WorldModalController(CONTENT_REGISTRY);
    const checkpointSystem = new CheckpointSystem(CONTENT_REGISTRY.areas);
    const loader = new AreaLoader(CONTENT_REGISTRY);
    const roomRuntime = new WorldRoomRuntime({
      registry: CONTENT_REGISTRY,
      loader,
      area: result.area,
      roomId: result.room.roomId,
      save: result.save,
      baseline: { lastStepIndex: 0, simulationTimeMs: 0 },
      readCameraBounds: () => this.visibleCameraBounds(),
      ...(showEnemyDebugView ? { spawnsOverride: spawns } : {}),
    });
    const unlockedAbilityIds =
      showEnemyDebugView &&
      spawns.some(({ actorId }) => actorId === 'thorn-sentinel') &&
      !result.save.player.unlockedAbilities.includes(stableId<'ability'>('wayfinder-dash'))
        ? [...result.save.player.unlockedAbilities, stableId<'ability'>('wayfinder-dash')]
        : result.save.player.unlockedAbilities;
    const controller: PlayerController = new PlayerController({
      input,
      roomId: result.room.roomId,
      position: result.position,
      surfaces: result.area.surfacesFor(result.room.roomId),
      zones: result.area.zonesFor(result.room.roomId),
      tuning: {
        ...DEFAULT_MOVEMENT_TUNING,
        maxSpeed: MARA_ACTOR.movement.maxSpeed,
        jumpSpeed: MARA_ACTOR.movement.jumpSpeed,
      },
      bodyHalfWidth: 24,
      bodyHeight: 96,
      movementBounds: result.room.bounds,
      combat: {
        currentMana: result.save.player.currentMana,
        unlockedAbilityIds,
        initialFacing: result.checkpoint.facing,
        settings: result.settings,
        targets: () => this.worldRoomRuntime?.targets() ?? Object.freeze([]),
        receiveImpact: (impact) =>
          this.worldRoomRuntime?.receivePlayerImpact(impact) ?? {
            kind: 'unresolved',
            projectileDisposition: 'continue',
            commands: [],
          },
      },
      vitals: {
        currentHealth: result.save.player.currentHealth,
        maxHealth: result.save.player.baseStats.maxHealth,
        maxPoise: MARA_ACTOR.stats.maxPoise,
        armour: result.save.player.baseStats.armour,
        resistances: Object.freeze(
          Object.fromEntries(
            MARA_ACTOR.resistances.map(({ damageTypeId, multiplier }) => [
              damageTypeId,
              multiplier,
            ]),
          ),
        ),
      },
      fixedStepObserver: (frame) => {
        const activeRuntime = this.worldRoomRuntime;
        if (activeRuntime === null) return { halt: true };
        const roomStep = activeRuntime.advance(frame, saveCoordinator.snapshot);
        this.pendingWorldCombatEvents.push(...roomStep.journal);
        if (frame.input.pausePressed === true) {
          this.pendingPause = true;
          return { halt: true };
        }
        const latest = controller.snapshot();
        if (latest.vitality.currentHealth === 0) {
          this.pendingDeath = true;
          return { halt: true };
        }
        return this.handleRoomStep(
          activeRuntime,
          roomStep,
          latest,
          saveCoordinator,
          checkpointSystem,
        );
      },
    });
    roomRuntime.armEnterTransitionsAt(result.position);
    roomRuntime.bindPlayer({
      readSnapshot: () => controller.snapshot(),
      readTarget: () => controller.hurtboxTarget(),
      receiveImpact: (impact) => controller.receiveImpact(impact),
      captureCombatEvents: () => controller.captureFixedStepCombatEvents(),
      requestHitStop: (hitStopMs) => controller.requestSharedHitStop(hitStopMs),
      restoreManaTo: (maximumMana, occurredAtMs) =>
        controller.restoreManaTo(maximumMana, occurredAtMs),
      readMaximumMana: () => saveCoordinator.snapshot.player.baseStats.maxMana,
    });
    this.worldRoomRuntime = roomRuntime;
    this.bossCoordinator =
      roomRuntime.snapshot().combat.boss === null
        ? null
        : new BossEncounterCoordinator({
            saves: saveCoordinator,
            confirmDefeatSaved: (token, savedAtEpochMs) =>
              roomRuntime.confirmBossDefeatSaved(token, savedAtEpochMs),
            updateSave: (save) => roomRuntime.updateSave(save),
            publishProgressionEvents: (events) => this.publishProgressionEvents(events),
            emit: (name, event) => {
              const eventBus = appServices(this).get('events');
              if (name === 'boss-intro' && 'healthBarVisible' in event) {
                eventBus.emit(name, event);
              } else if (name === 'boss-phase' && 'previousState' in event) {
                eventBus.emit(name, event);
              } else if (name === 'boss-defeated' && 'rewardItemId' in event) {
                eventBus.emit(name, event);
              } else if (name === 'boss-health' && 'delta' in event) {
                this.bossHealth = event;
                eventBus.emit(name, event);
              }
            },
            reportSaveFailure: () => {
              saveCoordinator.markFailed();
              this.currentPrompt = 'The Cantor is silent, but progress could not be saved. Retry.';
            },
            isCurrentGeneration: () =>
              this.gameplayGeneration === generation && this.worldRoomRuntime === roomRuntime,
          });
    this.installRoomEntry(roomRuntime, saveCoordinator, controller.snapshot());
    if (import.meta.env.DEV) {
      const initialPlayer = controller.snapshot();
      const initialEncounter = roomRuntime.snapshot().combat;
      recordDevDeathReloadInitial(result.slotId, {
        position: initialPlayer.position,
        currentHealth: initialPlayer.vitality.currentHealth,
        maxHealth: initialPlayer.vitality.maxHealth,
        currentMana: initialPlayer.combat.currentMana,
        maxMana: result.save.player.baseStats.maxMana,
        projectileCount: initialPlayer.combat.projectileCount,
        activeOrdnance: initialEncounter.activeOrdnance,
        enemiesFresh: initialEncounter.enemies.every(
          ({ health, maxHealth, activeAttackId }) =>
            health === maxHealth && activeAttackId === null,
        ),
      });
    }
    this.runtimeSaves = saveCoordinator;
    this.lastUiKey = '';
    this.unbindSaveState?.();
    this.unbindSaveState = services.get('saveService').onSaveState((slot) => {
      if (slot === this.runtimeSlotId && this.playerController !== null)
        this.publishWorldUi(this.playerController.snapshot());
    });
    this.modalController = modalController;
    this.checkpointSystem = checkpointSystem;
    this.activeArea = result.area;
    this.activeRoom = result.room;
    this.activeCheckpoint = result.checkpoint;
    this.playerController = controller;
    controller.applyItemState(
      {
        currentHealth: result.save.player.currentHealth,
        currentMana: result.save.player.currentMana,
        maxMana: result.save.player.baseStats.maxMana,
      },
      result.save.equipment.map((item) => item.itemId),
    );
    this.cameraDirector = new CameraDirector(new PhaserCameraPort(this.cameras.main));
    this.roomBounds = result.room.cameraBounds;
    this.respawnPosition = Object.freeze({ ...result.checkpoint.canonicalPosition });
    this.settings = result.settings;
    services.get('audioDirector').applySettings(result.settings);
    services.get('audioDirector').setMusicLayer(
      musicLayerForRoom(
        result.area.definition.areaId,
        result.area.actorsFor(result.room.roomId).map(({ actorId }) => actorId),
      ),
    );
    this.facing = result.checkpoint.facing;
    this.runtimeSlotId = result.slotId;
    this.startingPlayTimeMs = result.save.metadata.playTimeMs;
    this.sessionElapsedMs = 0;
    this.pendingInteraction = null;
    this.pendingTransition = null;
    this.pendingDeath = false;
    this.pendingPause = false;
    this.endingStarted = false;
    this.currentPrompt = null;
    this.uiRevision = 0;
    this.nextDomainSequence = 1;
    this.devDomainEvents = [];
    this.unbindModalCommands?.();
    this.unbindModalCommands = services
      .get('events')
      .on('world-modal-command', (command) => this.handleModalCommand(command));
    this.unbindMenuCommands?.();
    this.unbindMenuCommands = services
      .get('events')
      .on('menu-command', (command) => this.handleMenuCommand(command));
    this.combatView = new CombatPresentationView(this);
    this.playerView = new PlayerView(this, MARA_ACTOR.visualHeight);
    this.playerView.sync(controller.snapshot());
    this.worldActorView = new WorldActorView(this, result.area.definition, result.room);
    this.worldActorView.sync(roomRuntime.snapshot().combat, roomRuntime.snapshot().objects);
    if (!this.scene.isActive(SceneKeys.UI)) this.scene.launch(SceneKeys.UI);
    this.scene.bringToTop(SceneKeys.UI);
    this.publishWorldUi(controller.snapshot());
    if (import.meta.env.DEV) {
      updateDevBridge({
        modal: null,
        lastDomainEvent: null,
        domainEvents: [],
        runtimeSaveRevision: saveCoordinator.revision,
      });
    }

    if (import.meta.env.DEV) {
      if (showEnemyDebugView) {
        void import('../testing/EnemyDebugView').then(({ EnemyDebugView }) => {
          if (this.worldRoomRuntime !== roomRuntime) return;
          const view = new EnemyDebugView(this);
          this.enemyDebugView = view;
          view.sync(roomRuntime.snapshot().combat);
        });
      }
    }
  }

  private publishGameplaySnapshot(
    snapshot: PlayerControllerSnapshot,
    encounter: WorldCombatRuntimeSnapshot | null,
  ): void {
    const camera = this.cameras.main;
    updateDevBridge({
      player: {
        position: snapshot.position,
        velocity: snapshot.velocity,
        state: snapshot.state,
        grounded: snapshot.grounded,
        animationIntent: snapshot.animationIntent,
      },
      camera: { scrollX: camera.scrollX, scrollY: camera.scrollY, zoom: camera.zoom },
      combat: snapshot.combat,
      encounter,
    });
  }

  private publishCombatEvents(events: readonly PlayerCombatRuntimeEvent[]): void {
    if (events.length === 0) return;
    const services = appServices(this);
    for (const event of events) {
      services.get('events').emit('combat-event', event);
      if (
        this.settings !== null &&
        (event.kind === 'incoming-impact' ||
          event.kind === 'projectile-contact' ||
          event.kind === 'attack-contact')
      ) {
        const damage =
          event.resolution.kind === 'resolved' ? event.resolution.damage.healthDamage : 0;
        const encounter = this.worldRoomRuntime?.snapshot().combat;
        const position =
          event.kind === 'incoming-impact'
            ? this.playerController?.snapshot().position
            : (encounter?.enemies.find((enemy) => enemy.combatantId === event.targetId)?.position ??
              (encounter?.boss?.combatantId === event.targetId
                ? encounter.boss.position
                : undefined));
        if (position !== undefined && event.resolution.kind !== 'ignored')
          this.combatView?.impact(position, damage, this.settings);
      }
      if (event.kind === 'radial-pulse' && this.settings !== null)
        this.combatView?.pulse(event.origin, event.radius, this.settings);
      if (event.kind === 'feedback-requested') services.get('audioDirector').playCue('impact');
      const saves = this.runtimeSaves;
      if (saves === null) continue;
      const save = saves.snapshot;
      const vitalityPatch =
        event.kind === 'mana-changed'
          ? { currentHealth: save.player.currentHealth, currentMana: event.currentMana }
          : event.kind === 'vitality-changed' &&
              event.previous.currentHealth !== event.current.currentHealth
            ? {
                currentHealth: event.current.currentHealth,
                currentMana: save.player.currentMana,
              }
            : null;
      if (vitalityPatch === null) continue;
      if (this.pendingDeath && vitalityPatch.currentHealth === 0) continue;
      saves.patchVitals(vitalityPatch, this.runtimeStamp());
    }
  }

  private publishWorldCombatEvents(events: readonly WorldCombatJournalEvent[]): void {
    if (events.length === 0) return;
    const eventBus = appServices(this).get('events');
    const player = this.playerController?.snapshot() ?? null;
    for (const event of events) {
      eventBus.emit('world-combat-event', event);
      if (event.kind === 'boss-command') {
        if (event.command.kind === 'music-layer') {
          appServices(this).get('audioDirector').setMusicLayer(event.command.layer);
        }
        if (event.command.kind === 'audio-cue') {
          appServices(this).get('audioDirector').playCue(event.command.cueId);
        }
      }
      if (player !== null) {
        this.bossCoordinator?.observe(
          event,
          {
            currentHealth: player.vitality.currentHealth,
            currentMana: player.combat.currentMana,
          },
          this.runtimeStamp(),
        );
      }
    }
  }

  private installRoomEntry(
    roomRuntime: WorldRoomRuntime,
    saves: RuntimeSaveCoordinator,
    player: PlayerControllerSnapshot,
  ): void {
    const proposal = roomRuntime.prepareRoomEntry(saves.snapshot);
    if (proposal === null) return;
    const result = saves.transact(
      (latest) => applyProgressionTransaction(latest, { commands: proposal.commands }),
      {
        snapshotAtEpochMs: Math.max(saves.snapshot.metadata.snapshotAtEpochMs, Date.now()),
        playTimeMs: saves.snapshot.metadata.playTimeMs,
      },
      {
        currentHealth: player.vitality.currentHealth,
        currentMana: player.combat.currentMana,
      },
    );
    if (result.kind !== 'installed' && result.kind !== 'unchanged') return;
    roomRuntime.commitObject(proposal.token);
    roomRuntime.updateSave(result.save);
    this.playerController?.synchronizeUnlockedAbilities(result.save.player.unlockedAbilities);
    this.publishProgressionEvents(result.events);
  }

  private handleRoomStep(
    runtime: WorldRoomRuntime,
    step: WorldRoomStep,
    player: PlayerControllerSnapshot,
    saves: RuntimeSaveCoordinator,
    checkpoints: CheckpointSystem,
  ): Readonly<{ halt: boolean }> | undefined {
    this.currentPrompt = step.prompt;
    const encounter = step.encounterProposal;
    const object = step.objectStep.proposal;
    if (encounter !== null || object !== null) {
      const commands = [...(encounter?.commands ?? []), ...(object?.commands ?? [])];
      const result = saves.transact(
        (latest) => applyProgressionTransaction(latest, { commands }),
        this.runtimeStamp(),
        {
          currentHealth: player.vitality.currentHealth,
          currentMana: player.combat.currentMana,
        },
      );
      if (result.kind !== 'installed' && result.kind !== 'unchanged') {
        this.currentPrompt = 'Progress could not be saved. Try again.';
        return { halt: true };
      }
      if (encounter !== null) runtime.commitEncounter(encounter.token);
      if (object !== null) {
        runtime.commitObject(object.token);
        if (object.consumedInteractBufferId !== null) {
          appServices(this)
            .get('inputService')
            .consume('interact', object.consumedInteractBufferId);
        }
      }
      runtime.updateSave(result.save);
      if (result.kind === 'installed') {
        this.playerController?.synchronizeProgressionResources({
          currentHealth: result.save.player.currentHealth,
          maxHealth: result.save.player.baseStats.maxHealth,
          currentMana: result.save.player.currentMana,
          maxMana: result.save.player.baseStats.maxMana,
        });
        this.playerController?.synchronizeUnlockedAbilities(result.save.player.unlockedAbilities);
      }
      this.publishProgressionEvents(result.events);
      if (
        object?.consumedInteractBufferId !== null &&
        object?.consumedInteractBufferId !== undefined
      ) {
        return { halt: true };
      }
    }

    if (step.interactBufferId === null) checkpoints.releaseInteraction();
    if (
      step.interaction.kind === 'accepted' &&
      step.interaction.action !== null &&
      step.interaction.consumedInteractBufferId !== null
    ) {
      this.pendingInteraction = {
        action: step.interaction.action,
        interactBufferId: step.interaction.consumedInteractBufferId,
      };
      return { halt: true };
    }
    if (step.transitionId !== null) {
      this.pendingTransition = {
        transitionId: step.transitionId,
        interactBufferId: step.consumedTransitionBufferId,
      };
      return { halt: true };
    }
    return undefined;
  }

  private handlePendingTransition(): boolean {
    const pending = this.pendingTransition;
    const runtime = this.worldRoomRuntime;
    const controller = this.playerController;
    const saves = this.runtimeSaves;
    const area = this.activeArea;
    const slotId = this.runtimeSlotId;
    if (
      pending === null ||
      runtime === null ||
      controller === null ||
      saves === null ||
      area === null ||
      slotId === null
    ) {
      this.pendingTransition = null;
      return false;
    }
    this.pendingTransition = null;
    const player = controller.snapshot();
    const stamp = this.runtimeStamp();
    const prepared = runtime.prepareTransition(
      pending.transitionId,
      saves.snapshot,
      {
        currentHealth: player.vitality.currentHealth,
        currentMana: player.combat.currentMana,
      },
      stamp,
    );
    if (prepared.kind === 'rejected') {
      this.currentPrompt = 'That path will not open yet.';
      return false;
    }

    if (prepared.kind === 'area') {
      const installed = saves.install(prepared.save, stamp);
      if (installed.kind !== 'installed') {
        this.currentPrompt = 'The crossing could not be saved. Try again.';
        return false;
      }
      if (pending.interactBufferId !== null) {
        appServices(this).get('inputService').consume('interact', pending.interactBufferId);
      }
      this.scene.start(SceneKeys.Transition, {
        kind: 'area-transition',
        travel: {
          slotId,
          settings: installed.save.settings,
          save: installed.save,
          sourceLabel: area.definition.displayName,
          targetLabel: prepared.targetArea.definition.displayName,
          revision: installed.revision,
        },
      });
      return true;
    }

    const nextRuntime = new WorldRoomRuntime({
      registry: CONTENT_REGISTRY,
      loader: new AreaLoader(CONTENT_REGISTRY),
      area,
      roomId: prepared.targetRoom.roomId,
      save: prepared.save,
      baseline: {
        lastStepIndex: player.stepIndex,
        simulationTimeMs: player.combatSimulationTimeMs,
      },
      readCameraBounds: () => this.visibleCameraBounds(),
    });
    let candidate = prepared.save;
    const entry = nextRuntime.prepareRoomEntry(candidate);
    if (entry !== null) {
      const progression = applyProgressionTransaction(candidate, { commands: entry.commands });
      if (progression.kind === 'rejected') {
        nextRuntime.dispose();
        this.currentPrompt = 'The destination could not be prepared.';
        return false;
      }
      candidate = progression.save;
    }
    const installed = saves.install(candidate, stamp, {
      currentHealth: player.vitality.currentHealth,
      currentMana: player.combat.currentMana,
    });
    if (installed.kind !== 'installed' && installed.kind !== 'unchanged') {
      nextRuntime.dispose();
      this.currentPrompt = 'The room change could not be saved. Try again.';
      return false;
    }
    if (!controller.rebindRoom(prepared.binding)) {
      nextRuntime.dispose();
      this.currentPrompt = 'The destination footing is unsafe.';
      return false;
    }
    nextRuntime.armEnterTransitionsAt(prepared.binding.position);
    runtime.dispose();
    this.enemyDebugView?.destroy();
    this.enemyDebugView = null;
    this.worldRoomRuntime = nextRuntime;
    nextRuntime.updateSave(installed.save);
    nextRuntime.bindPlayer({
      readSnapshot: () => controller.snapshot(),
      readTarget: () => controller.hurtboxTarget(),
      receiveImpact: (impact) => controller.receiveImpact(impact),
      captureCombatEvents: () => controller.captureFixedStepCombatEvents(),
      requestHitStop: (hitStopMs) => controller.requestSharedHitStop(hitStopMs),
      restoreManaTo: (maximumMana, occurredAtMs) =>
        controller.restoreManaTo(maximumMana, occurredAtMs),
      readMaximumMana: () => saves.snapshot.player.baseStats.maxMana,
    });
    if (entry !== null) nextRuntime.commitObject(entry.token);
    this.activeRoom = prepared.targetRoom;
    appServices(this)
      .get('audioDirector')
      .setMusicLayer(
        musicLayerForRoom(
          area.definition.areaId,
          area.actorsFor(prepared.targetRoom.roomId).map(({ actorId }) => actorId),
        ),
      );
    this.combatView?.clear();
    this.worldActorView?.bindRoom(area.definition, prepared.targetRoom);
    this.roomBounds = prepared.targetRoom.cameraBounds;
    this.facing = prepared.binding.facing;
    this.currentPrompt = null;
    if (import.meta.env.DEV && this.activeCheckpoint !== null) {
      updateDevBridge({
        world: {
          slotId,
          mode: 'load',
          areaId: area.definition.areaId,
          roomId: prepared.targetRoom.roomId,
          checkpointId: this.activeCheckpoint.checkpointId,
          position: prepared.binding.position,
        },
      });
    }
    if (pending.interactBufferId !== null) {
      appServices(this).get('inputService').consume('interact', pending.interactBufferId);
    }
    this.publishWorldUi(controller.snapshot());
    return false;
  }

  private publishProgressionEvents(events: readonly ProgressionEvent[]): void {
    this.publishDomainEvents(
      events.map((event) => ({ sequence: 0, kind: 'progression' as const, event })),
    );
  }

  private handleInteraction(action: WorldInteractionAction): boolean {
    const controller = this.playerController;
    const saves = this.runtimeSaves;
    if (controller === null || saves === null) return false;
    if (action.kind === 'activate-checkpoint') {
      const checkpoint = this.checkpointSystem?.activate(saves.snapshot, action);
      if (checkpoint?.kind !== 'activated') {
        this.worldRoomRuntime?.cancelInteraction();
        return false;
      }
      const installed = saves.install(checkpoint.save, this.runtimeStamp());
      if (installed.kind !== 'installed') {
        this.checkpointSystem?.cancelActivation(action.checkpointId);
        this.worldRoomRuntime?.cancelInteraction();
        return false;
      }
      controller.synchronizeProgressionResources({
        currentHealth: installed.save.player.currentHealth,
        maxHealth: installed.save.player.baseStats.maxHealth,
        currentMana: installed.save.player.currentMana,
        maxMana: installed.save.player.baseStats.maxMana,
      });
      controller.restAtCheckpoint(checkpoint.position, {
        currentHealth: installed.save.player.currentHealth,
        currentMana: installed.save.player.currentMana,
      });
      controller.synchronizeUnlockedAbilities(installed.save.player.unlockedAbilities);
      this.worldRoomRuntime?.updateSave(installed.save);
      this.worldRoomRuntime?.resetForRestore();
      this.respawnPosition = Object.freeze({ ...checkpoint.position });
      this.activeCheckpoint =
        this.activeArea?.checkpoint(installed.save.location.checkpointId) ?? this.activeCheckpoint;
      this.publishDomainEvents([
        {
          sequence: 0,
          kind: 'checkpoint-activated',
          checkpointId: installed.save.location.checkpointId,
        },
      ]);
      return true;
    }

    const opened = this.modalController?.openNpc(action.spawnId, saves.snapshot);
    if (opened?.kind !== 'opened' || this.settings === null) {
      this.worldRoomRuntime?.cancelInteraction();
      return false;
    }
    if (!controller.beginInteraction()) {
      this.modalController?.issue(
        {
          kind: 'close',
          sessionId: opened.state.sessionId,
          revision: opened.state.revision,
        },
        saves.snapshot,
      );
      this.worldRoomRuntime?.cancelInteraction();
      return false;
    }
    this.publishModal(opened.state);
    this.scene.launch(SceneKeys.Dialogue, { state: opened.state, settings: this.settings });
    return true;
  }

  private takePendingInteraction(): typeof this.pendingInteraction {
    const pending = this.pendingInteraction;
    this.pendingInteraction = null;
    return pending;
  }

  private handleModalCommand(command: WorldModalCommand): void {
    const modal = this.modalController;
    const controller = this.playerController;
    const saves = this.runtimeSaves;
    if (modal === null || controller === null || saves === null) return;
    const prepared = modal.prepare(command, saves.snapshot);
    if (prepared.kind === 'ignored') return;
    let response;
    if (prepared.save !== null) {
      const live = controller.snapshot();
      const installed = saves.install(prepared.save, this.runtimeStamp(), {
        currentHealth: live.vitality.currentHealth,
        currentMana: live.combat.currentMana,
      });
      if (installed.kind !== 'installed') {
        response = modal.fail(prepared.token, 'Progress could not be saved. Try again.');
      } else {
        this.worldRoomRuntime?.updateSave(installed.save);
        controller.synchronizeProgressionResources({
          currentHealth: installed.save.player.currentHealth,
          maxHealth: installed.save.player.baseStats.maxHealth,
          currentMana: installed.save.player.currentMana,
          maxMana: installed.save.player.baseStats.maxMana,
        });
        controller.synchronizeUnlockedAbilities(installed.save.player.unlockedAbilities);
        response = modal.commit(prepared.token);
      }
    } else {
      response = modal.commit(prepared.token);
    }
    if (response.save !== null) {
      this.publishDomainEvents(response.events);
    }
    if (response.state === null) controller.endInteraction();
    this.publishModal(response.state);
    this.publishWorldUi(controller.snapshot());
    if (
      response.save !== null &&
      response.events.some(
        (domain) =>
          domain.kind === 'progression' &&
          domain.event.kind === 'fact-set' &&
          domain.event.id === 'silent-bloom-restored',
      )
    ) {
      this.beginEndingTransition(response.save);
    }
  }

  private beginEndingTransition(save: import('../saves/SaveSchema').SaveV1): void {
    const slotId = this.runtimeSlotId;
    const settings = this.settings;
    if (this.endingStarted || slotId === null || settings === null) return;
    this.endingStarted = true;
    this.scene.stop(SceneKeys.Dialogue);
    this.scene.stop(SceneKeys.UI);
    this.scene.start(SceneKeys.Transition, {
      kind: 'ending',
      ending: { slotId, settings, save },
    });
  }

  private beginDeathTransition(): void {
    const saves = this.runtimeSaves;
    const slotId = this.runtimeSlotId;
    const checkpoint = this.activeCheckpoint;
    if (saves === null || slotId === null || checkpoint === null) return;
    const restored = this.checkpointSystem?.restore(saves.snapshot);
    if (restored?.kind !== 'restored') return;
    const candidate = saves.prepare(restored.save, this.runtimeStamp());
    if (candidate === null) return;
    this.pendingDeath = false;
    this.scene.start(SceneKeys.Transition, {
      kind: 'player-death',
      death: {
        slotId,
        settings: candidate.settings,
        save: candidate,
        checkpointLabel: checkpointLabel(checkpoint.checkpointId),
      },
    });
  }

  private beginPause(snapshot: PlayerControllerSnapshot): void {
    this.pendingPause = false;
    appServices(this).get('inputService').clearTransient();
    this.publishWorldUi(snapshot);
    const projection = this.currentUiProjection;
    const settings = this.settings;
    if (projection === null || settings === null) return;
    if (!this.scene.isActive(SceneKeys.Menu)) {
      this.scene.launch(SceneKeys.Menu, { projection, settings });
    }
    this.scene.bringToTop(SceneKeys.Menu);
    this.scene.pause();
  }

  private handleMenuCommand(command: import('./MenuScene').MenuCommand): void {
    if (this.returningToTitle) return;
    if (command.kind === 'close') {
      appServices(this).get('inputService').clearTransient();
      this.scene.resume();
      return;
    }
    const saves = this.runtimeSaves;
    const player = this.playerController?.snapshot() ?? null;
    if (saves === null || player === null) return;
    if (command.kind === 'return-title') {
      this.returningToTitle = true;
      void appServices(this)
        .get('saveService')
        .flush(this.runtimeSlotId ?? undefined)
        .then(() => {
          this.scene.stop(SceneKeys.Menu);
          this.scene.stop(SceneKeys.UI);
          this.scene.start(SceneKeys.Title);
        })
        .catch(() => {
          this.returningToTitle = false;
          appServices(this)
            .get('events')
            .emit('menu-action-result', 'Save failed. Stay here and try Return to title again.');
        });
      return;
    }
    if (
      command.kind === 'use-item' ||
      command.kind === 'equip-item' ||
      command.kind === 'unequip-item'
    ) {
      const liveSave = {
        ...saves.snapshot,
        player: {
          ...saves.snapshot.player,
          currentHealth: player.vitality.currentHealth,
          currentMana: player.combat.currentMana,
        },
      };
      const action = applyPlayerItemAction(
        liveSave,
        command,
        this.currentUiProjection?.revision ?? -1,
      );
      if (action.kind === 'rejected') {
        appServices(this).get('events').emit('menu-action-result', action.copy);
        return;
      }
      const installed = saves.install(action.save, this.runtimeStamp());
      if (installed.kind !== 'installed' && installed.kind !== 'unchanged') {
        appServices(this)
          .get('events')
          .emit('menu-action-result', 'The item change could not be saved. Try again.');
        return;
      }
      this.playerController?.applyItemState(
        {
          currentHealth: installed.save.player.currentHealth,
          currentMana: installed.save.player.currentMana,
          maxMana: installed.save.player.baseStats.maxMana,
        },
        installed.save.equipment.map((item) => item.itemId),
      );
      this.worldRoomRuntime?.updateSave(installed.save);
      if (this.playerController !== null) this.publishWorldUi(this.playerController.snapshot());
      appServices(this).get('events').emit('menu-action-result', action.copy);
      return;
    }
    if (command.kind === 'rebind-key') {
      const services = appServices(this);
      const input = services.get('inputService');
      const previous = input
        .getBindings(command.action)
        .find((binding) => binding.kind === 'keyboard');
      const rebound = input.rebind(command.action, { kind: 'keyboard', code: command.code });
      if (rebound.kind === 'conflict') {
        services.get('events').emit('menu-binding-result', {
          kind: 'conflict',
          action: command.action,
          copy: `That key is already used by ${rebound.conflictingActions.join(', ')}.`,
        });
        return;
      }
      if (rebound.kind !== 'applied') {
        services.get('events').emit('menu-binding-result', {
          kind: 'failed',
          action: command.action,
          copy: 'That key cannot be used.',
        });
        return;
      }
      const installed = saves.install(
        { ...saves.snapshot, bindingOverrides: input.serializeBindingOverrides() },
        this.runtimeStamp(),
        {
          currentHealth: player.vitality.currentHealth,
          currentMana: player.combat.currentMana,
        },
      );
      if (installed.kind !== 'installed' && installed.kind !== 'unchanged') {
        if (previous !== undefined) input.rebind(command.action, previous);
        services.get('events').emit('menu-binding-result', {
          kind: 'failed',
          action: command.action,
          copy: 'The new binding could not be saved.',
        });
        return;
      }
      this.worldRoomRuntime?.updateSave(installed.save);
      services.get('events').emit('menu-binding-result', {
        kind: 'applied',
        action: command.action,
        copy: `${command.action.replaceAll('-', ' ')} now uses ${command.code}.`,
      });
      this.publishWorldUi(player);
      return;
    }
    const result = saves.install(
      { ...saves.snapshot, settings: command.settings },
      this.runtimeStamp(),
      {
        currentHealth: player.vitality.currentHealth,
        currentMana: player.combat.currentMana,
      },
    );
    if (result.kind !== 'installed' && result.kind !== 'unchanged') {
      appServices(this)
        .get('events')
        .emit('menu-action-result', 'Settings could not be applied. Try again.');
      return;
    }
    this.settings = command.settings;
    appServices(this).get('inputService').setSustainedActionMode(command.settings.sustainedAction);
    this.playerController?.applySettings(command.settings);
    appServices(this).get('audioDirector').applySettings(command.settings);
    this.worldRoomRuntime?.updateSave(result.save);
    this.publishWorldUi(player);
  }

  private publishWorldUi(snapshot: PlayerControllerSnapshot): void {
    const saves = this.runtimeSaves;
    const area = this.activeArea;
    const room = this.activeRoom;
    const checkpoint = this.activeCheckpoint;
    if (saves === null || area === null || room === null || checkpoint === null) return;
    const projection = projectWorldUi({
      revision: ++this.uiRevision,
      inputDevice: appServices(this).get('inputService').getActiveDevice(),
      save: saves.snapshot,
      area: area.definition,
      room,
      checkpoint,
      prompt: this.currentPrompt,
      liveVitals: {
        currentHealth: snapshot.vitality.currentHealth,
        currentMana: snapshot.combat.currentMana,
      },
      selectedAbilityId: snapshot.combat.selectedAbilityId,
      boss: this.bossHealth,
      autosave: saves.autosaveState,
      objects: this.worldRoomRuntime?.snapshot().objects ?? {
        roomId: room.roomId,
        puzzles: [],
        chests: [],
        discoveries: [],
        shortcuts: [],
        breakables: [],
      },
    });
    if (import.meta.env.DEV) updateDevBridge({ runtimeSaveRevision: saves.revision });
    const displayKey = JSON.stringify({ ...projection, revision: 0 });
    if (displayKey === this.lastUiKey) return;
    this.lastUiKey = displayKey;
    this.currentUiProjection = projection;
    appServices(this).get('events').emit('world-ui', projection);
    if (import.meta.env.DEV) {
      updateDevBridge({ worldUi: projection, runtimeSaveRevision: saves.revision });
    }
  }

  private publishModal(state: WorldModalState | null): void {
    appServices(this).get('events').emit('world-modal-state', state);
    if (import.meta.env.DEV) updateDevBridge({ modal: state });
  }

  private publishDomainEvents(events: readonly WorldDomainEvent[]): void {
    const eventBus = appServices(this).get('events');
    for (const event of events) {
      const sequenced = Object.freeze({ ...event, sequence: this.nextDomainSequence++ });
      eventBus.emit('world-domain-event', sequenced);
      if (import.meta.env.DEV) {
        this.devDomainEvents.push(sequenced);
        updateDevBridge({
          lastDomainEvent: sequenced,
          domainEvents: Object.freeze([...this.devDomainEvents]),
        });
      }
    }
  }

  private runtimeStamp(): Readonly<{ snapshotAtEpochMs: number; playTimeMs: number }> {
    const current = this.runtimeSaves?.snapshot;
    const playTimeMs = this.startingPlayTimeMs + Math.floor(this.sessionElapsedMs);
    return Object.freeze({
      snapshotAtEpochMs: Math.max(current?.metadata.snapshotAtEpochMs ?? 0, Date.now()),
      playTimeMs: Math.max(current?.metadata.playTimeMs ?? 0, playTimeMs),
    });
  }

  private enemySpawnsFor(
    result: Extract<WorldStartResult, { kind: 'ready' }>,
  ): readonly ActorSpawnDefinition[] {
    return Object.freeze(
      result.area.actorsFor(result.room.roomId).filter((spawn) => {
        const actor = CONTENT_REGISTRY.actors.find(({ actorId }) => actorId === spawn.actorId);
        return actor?.kind === 'enemy';
      }),
    );
  }

  private visibleCameraBounds(): Rect {
    const camera = this.cameras.main;
    return Object.freeze({
      x: camera.scrollX,
      y: camera.scrollY,
      width: camera.width / camera.zoom,
      height: camera.height / camera.zoom,
    });
  }

  private stopGameplay(): void {
    this.gameplayGeneration += 1;
    this.unbindModalCommands?.();
    this.unbindModalCommands = null;
    this.unbindMenuCommands?.();
    this.unbindMenuCommands = null;
    this.unbindSaveState?.();
    this.unbindSaveState = null;
    if (this.scene.isActive(SceneKeys.Dialogue)) this.scene.stop(SceneKeys.Dialogue);
    if (this.scene.isActive(SceneKeys.Menu)) this.scene.stop(SceneKeys.Menu);
    if (this.scene.isActive(SceneKeys.UI)) this.scene.stop(SceneKeys.UI);
    this.modalController?.dispose();
    this.modalController = null;
    this.checkpointSystem = null;
    this.bossCoordinator = null;
    this.runtimeSaves = null;
    this.activeArea = null;
    this.activeRoom = null;
    this.activeCheckpoint = null;
    this.currentPrompt = null;
    this.pendingInteraction = null;
    this.pendingTransition = null;
    this.pendingWorldCombatEvents.length = 0;
    this.pendingDeath = false;
    this.pendingPause = false;
    this.endingStarted = false;
    this.uiRevision = 0;
    this.nextDomainSequence = 1;
    this.devDomainEvents = [];
    this.currentUiProjection = null;
    this.bossHealth = null;
    this.worldRoomRuntime?.dispose();
    this.worldRoomRuntime = null;
    this.playerController?.dispose();
    this.enemyDebugView?.destroy();
    this.enemyDebugView = null;
    this.combatView?.destroy();
    this.combatView = null;
    this.worldActorView?.destroy();
    this.worldActorView = null;
    this.playerView?.destroy();
    this.playerView = null;
    this.cameraDirector?.dispose();
    this.cameraDirector = null;
    this.playerController = null;
    this.roomBounds = null;
    this.respawnPosition = null;
    this.settings = null;
    this.runtimeSlotId = null;
    this.startingPlayTimeMs = 0;
    this.sessionElapsedMs = 0;
    if (import.meta.env.DEV) {
      updateDevBridge({
        combat: null,
        encounter: null,
        worldUi: null,
        modal: null,
        lastDomainEvent: null,
        domainEvents: [],
        runtimeSaveRevision: null,
      });
    }
  }

  private showFailure(
    result: Extract<WorldStartResult, { kind: 'failed' }>,
    settings: SaveSettings,
    scope: SceneScope,
  ): void {
    const parent = this.game.canvas.parentElement;
    if (parent === null) throw new Error('The game stage is unavailable.');
    const root = document.createElement('section');
    root.className = 'scene-overlay world-error-screen';
    root.setAttribute('aria-labelledby', 'world-error-title');
    root.dataset.reducedMotion = String(settings.reducedMotion);
    root.dataset.highContrastPrompts = String(settings.highContrastPrompts);
    root.style.setProperty('--user-text-scale', String(settings.textScale));
    const panel = document.createElement('div');
    panel.className = 'world-error-panel seed-panel';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'THE THREAD HOLDS';
    const heading = document.createElement('h1');
    heading.id = 'world-error-title';
    heading.textContent = 'The path would not open';
    const message = document.createElement('p');
    message.setAttribute('role', 'alert');
    message.textContent = result.message;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button--primary';
    button.textContent = 'Return to title';
    panel.append(eyebrow, heading, message, button);
    root.append(panel);
    parent.append(root);
    this.errorButton = button;
    const returnToTitle = () => this.scene.start(SceneKeys.Title);
    button.addEventListener('click', returnToTitle);
    const focusFrame = requestAnimationFrame(() => button.focus());
    scope.add(() => cancelAnimationFrame(focusFrame));
    scope.add(() => button.removeEventListener('click', returnToTitle));
    scope.add(() => root.remove());
  }
}

class PhaserCameraPort implements CameraPort {
  public constructor(private readonly camera: Phaser.Cameras.Scene2D.Camera) {}

  public get viewportWidth(): number {
    return this.camera.width;
  }

  public get viewportHeight(): number {
    return this.camera.height;
  }

  public get scrollX(): number {
    return this.camera.scrollX;
  }

  public get scrollY(): number {
    return this.camera.scrollY;
  }

  public get zoom(): number {
    return this.camera.zoom;
  }

  public setScroll(x: number, y: number): void {
    this.camera.setScroll(x, y);
  }

  public setZoom(zoom: number): void {
    this.camera.setZoom(zoom);
  }

  public setDeadZone(width: number, height: number): void {
    this.camera.setDeadzone(width, height);
  }

  public stopFollow(): void {
    this.camera.stopFollow();
  }
}
