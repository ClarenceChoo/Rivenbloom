import { deepFreeze } from '../data/immutability';
import type { ContentRegistry, MechanismId, Rect, TransitionId } from '../data/types';
import { stableId } from '../core/StableId';
import type { PlayerFixedStepFrame } from '../entities/player/PlayerController';
import type { HurtboxTarget } from '../combat/HitboxSystem';
import type { CombatImpact, CombatImpactResolution } from '../combat/CombatImpact';
import { applyPlayerAttackPower } from '../combat/PlayerAttackPower';
import type { RoomId, SaveV1 } from '../saves/SaveSchema';
import type { AreaLoader, LoadedArea } from './AreaLoader';
import { EncounterProgressRuntime } from './EncounterProgressRuntime';
import type { EncounterProgressProposal } from './EncounterProgressRuntime';
import type { RuntimeSaveStamp, RuntimeVitals } from './RuntimeSaveCoordinator';
import { WorldCombatRuntime } from './WorldCombatRuntime';
import type {
  WorldCombatPlayerPorts,
  WorldCombatRuntimeBaseline,
  WorldCombatRuntimeSnapshot,
  WorldCombatJournalEvent,
} from './WorldCombatRuntime';
import { WorldInteractionRuntime } from './WorldInteractionRuntime';
import type { WorldInteractionStep } from './WorldInteractionRuntime';
import { WorldObjectRuntime } from './WorldObjectRuntime';
import type {
  WorldObjectProposal,
  WorldObjectSnapshot,
  WorldObjectStep,
} from './WorldObjectRuntime';
import { WorldTransitionCoordinator } from './WorldTransitionCoordinator';
import type { PreparedWorldTransition } from './WorldTransitionCoordinator';

export type WorldRoomRuntimeOptions = Readonly<{
  registry: ContentRegistry;
  loader: AreaLoader;
  area: LoadedArea;
  roomId: RoomId;
  save: SaveV1;
  baseline: WorldCombatRuntimeBaseline;
  readCameraBounds(): Rect;
  spawnsOverride?: readonly import('../data/types').ActorSpawnDefinition[];
}>;

export type WorldRoomStep = Readonly<{
  interactBufferId: number | null;
  prompt: string | null;
  combat: WorldCombatRuntimeSnapshot;
  journal: readonly WorldCombatJournalEvent[];
  encounterProposal: EncounterProgressProposal | null;
  objectStep: WorldObjectStep;
  interaction: WorldInteractionStep;
  transitionId: TransitionId | null;
  consumedTransitionBufferId: number | null;
}>;

export type WorldRoomRuntimeSnapshot = Readonly<{
  roomId: RoomId;
  activeSpawnIds: readonly string[];
  combat: WorldCombatRuntimeSnapshot;
  objects: WorldObjectSnapshot;
  prompt: string | null;
  disposed: boolean;
}>;

export class WorldRoomRuntime {
  private readonly roomId: RoomId;
  private readonly combat: WorldCombatRuntime;
  private readonly encounters: EncounterProgressRuntime;
  private readonly objects: WorldObjectRuntime;
  private readonly interactions: WorldInteractionRuntime;
  private readonly transitions: WorldTransitionCoordinator;
  private currentSave: SaveV1;
  private currentPrompt: string | null = null;
  private unbindPlayer: (() => void) | null = null;
  private playerPorts: WorldCombatPlayerPorts | null = null;
  private readonly lastHazardContactAtMs = new Map<string, number>();
  private disposed = false;

  public constructor(private readonly options: WorldRoomRuntimeOptions) {
    if (options.area.room(options.roomId) === null) {
      throw new RangeError('World room runtime requires an authored room.');
    }
    this.roomId = options.roomId;
    this.currentSave = options.save;
    this.objects = new WorldObjectRuntime({
      area: options.area,
      roomId: options.roomId,
      puzzles: options.registry.puzzles,
      registry: options.registry,
      save: options.save,
    });
    this.encounters = new EncounterProgressRuntime({
      encounters: options.area.encountersFor(options.roomId),
      spawns: options.area.actorsFor(options.roomId),
      actors: options.registry.actors,
      dropTables: options.registry.dropTables,
      save: options.save,
    });
    this.transitions = new WorldTransitionCoordinator(
      options.registry,
      options.loader,
      options.area,
    );
    this.interactions = new WorldInteractionRuntime(
      options.area,
      options.roomId,
      options.registry.npcs,
    );
    const activeSpawns = options.spawnsOverride ?? this.encounters.activeSpawns();
    const ordinarySpawns = activeSpawns.filter(
      (spawn) =>
        options.registry.actors.find(({ actorId }) => actorId === spawn.actorId)?.kind === 'enemy',
    );
    const bossEncounter = options.registry.bossEncounters.find(
      ({ roomId, bossId }) =>
        roomId === options.roomId && !options.save.worldProgress.defeatedBosses.includes(bossId),
    );
    this.combat = new WorldCombatRuntime({
      spawns: ordinarySpawns,
      actors: options.registry.actors,
      profiles: options.registry.aiProfiles,
      attacks: options.registry.attacks,
      dropTables: options.registry.dropTables,
      surfaces: options.area.surfacesFor(options.roomId),
      readCameraBounds: options.readCameraBounds,
      baseline: options.baseline,
      bossEncounter: bossEncounter ?? null,
      environment: {
        targets: () => this.objects.targets(this.currentSave),
        receiveImpact: (impact) => this.objects.receiveImpact(impact, this.currentSave),
      },
    });
  }

  public bindPlayer(ports: WorldCombatPlayerPorts): () => void {
    if (this.disposed) throw new Error('World room runtime is disposed.');
    if (this.unbindPlayer !== null) throw new Error('World room player is already bound.');
    const unbind = this.combat.bindPlayer(ports);
    this.playerPorts = ports;
    let active = true;
    this.unbindPlayer = () => {
      if (!active) return;
      active = false;
      unbind();
      this.playerPorts = null;
      this.unbindPlayer = null;
    };
    return this.unbindPlayer;
  }

  public targets(): readonly HurtboxTarget[] {
    return this.combat.targets();
  }

  public receivePlayerImpact(impact: CombatImpact): CombatImpactResolution {
    return this.combat.receivePlayerImpact(
      applyPlayerAttackPower(impact, {
        attackPower: this.currentSave.player.baseStats.attackPower,
        weaponLevel: this.currentSave.player.weaponLevel,
      }),
    );
  }

  public confirmBossDefeatSaved(token: number, savedAtEpochMs: number): boolean {
    return this.combat.confirmBossDefeatSaved(token, savedAtEpochMs);
  }

  public prepareRoomEntry(save: SaveV1): WorldObjectProposal | null {
    this.currentSave = save;
    return this.objects.prepareRoomEntry(save);
  }

  public armEnterTransitionsAt(position: Readonly<{ x: number; y: number }>): void {
    if (this.disposed) return;
    this.transitions.armEnterTransitionsAt(this.roomId, bodyBounds(position));
  }

  public advance(frame: PlayerFixedStepFrame, save: SaveV1): WorldRoomStep {
    if (this.disposed) throw new Error('World room runtime is disposed.');
    this.currentSave = save;
    const combat = this.combat.advance(frame);
    this.advanceHazards(frame);
    const journal = this.combat.drainJournal();
    const encounterProposal = this.encounters.observe(journal);
    const pulseMechanismIds = this.pulseMechanisms(frame);
    const objectStep = this.objects.step({
      playerPosition: frame.player.position,
      playerState: frame.player.state,
      interactBufferId: frame.input.interactBufferId,
      pulseMechanismIds,
      nowMs: frame.endTimeMs,
      save,
    });
    const interaction = this.interactions.step({
      playerPosition: frame.player.position,
      playerState: frame.player.state,
      interactBufferId: frame.input.interactBufferId,
      facts: save.quests.flags,
      fulfilledTriggerIds: [],
    });
    const transition = this.transitions.select({
      roomId: this.roomId,
      playerBounds: bodyBounds(frame.player.position),
      interactBufferId: frame.input.interactBufferId,
      save,
    });
    this.currentPrompt =
      interaction.prompt ??
      objectStep.prompt ??
      (frame.player.climbAvailable && !frame.player.climbEngaged ? 'Climb' : null) ??
      this.transitions.promptAt(this.roomId, bodyBounds(frame.player.position), save);
    return deepFreeze({
      interactBufferId: frame.input.interactBufferId,
      prompt: this.currentPrompt,
      combat,
      journal,
      encounterProposal,
      objectStep,
      interaction,
      transitionId: transition?.transitionId ?? null,
      consumedTransitionBufferId:
        transition?.activation === 'interact' ? frame.input.interactBufferId : null,
    });
  }

  public prepareTransition(
    transitionId: TransitionId,
    save: SaveV1,
    vitals: RuntimeVitals,
    stamp: RuntimeSaveStamp,
  ): PreparedWorldTransition {
    return this.transitions.prepare(transitionId, save, vitals, stamp);
  }

  public updateSave(save: SaveV1): void {
    if (this.disposed) return;
    this.currentSave = save;
  }

  public commitObject(token: number): boolean {
    return this.objects.commit(token);
  }

  public cancelObject(token: number): boolean {
    return this.objects.cancel(token);
  }

  public commitEncounter(token: number): boolean {
    return this.encounters.commit(token);
  }

  public cancelInteraction(): void {
    this.interactions.cancelAcceptedInteraction();
  }

  public resetForRestore(): boolean {
    if (this.disposed) return false;
    this.combat.resetForRest();
    this.objects.resetTransient();
    this.encounters.resetTransient();
    this.interactions.cancelAcceptedInteraction();
    this.currentPrompt = null;
    this.lastHazardContactAtMs.clear();
    return true;
  }

  public snapshot(): WorldRoomRuntimeSnapshot {
    return deepFreeze({
      roomId: this.roomId,
      activeSpawnIds: this.encounters.snapshot().activeSpawnIds,
      combat: this.combat.snapshot(),
      objects: this.objects.snapshot(this.currentSave),
      prompt: this.currentPrompt,
      disposed: this.disposed,
    });
  }

  public dispose(): boolean {
    if (this.disposed) return false;
    this.unbindPlayer?.();
    this.unbindPlayer = null;
    this.playerPorts = null;
    this.combat.dispose();
    this.interactions.dispose();
    this.objects.dispose();
    this.encounters.dispose();
    this.currentPrompt = null;
    this.disposed = true;
    return true;
  }

  private pulseMechanisms(frame: PlayerFixedStepFrame): readonly MechanismId[] {
    const pulses = frame.combatEvents.filter((event) => event.kind === 'radial-pulse');
    if (pulses.length === 0) return Object.freeze([]);
    const mechanisms = this.options.area.mechanismsFor(this.roomId);
    return Object.freeze(
      mechanisms
        .filter((mechanism) =>
          pulses.some(({ radius }) =>
            circleTouchesRect(frame.player.position, radius, mechanism.bounds),
          ),
        )
        .map(({ mechanismId }) => mechanismId),
    );
  }

  private advanceHazards(frame: PlayerFixedStepFrame): void {
    const player = this.playerPorts;
    if (player === null || frame.player.state === 'dead') return;
    const target = player.readTarget();
    if (target.hurtboxes.length === 0) return;
    for (const zone of this.options.area.zonesFor(this.roomId)) {
      if (
        zone.kind !== 'hazard' ||
        !target.hurtboxes.some((hurtbox) => overlaps(zone.bounds, hurtbox))
      ) {
        continue;
      }
      const attack = this.options.registry.attacks.find(
        ({ attackId }) => attackId === zone.attackId,
      );
      if (attack === undefined) continue;
      const lastContactAtMs = this.lastHazardContactAtMs.get(zone.zoneId);
      const intervalMs =
        attack.hitPolicy.kind === 'interval'
          ? attack.hitPolicy.rehitIntervalMs
          : Number.POSITIVE_INFINITY;
      if (lastContactAtMs !== undefined && frame.endTimeMs - lastContactAtMs < intervalMs) {
        continue;
      }
      const centerX = zone.bounds.x + zone.bounds.width / 2;
      const resolution = player.receiveImpact({
        attackId: attack.attackId,
        targetId: target.targetId,
        source: {
          ownerId: stableId<'combatant'>(zone.zoneId),
          teamId: stableId<'team'>('environment'),
          position: {
            x: centerX,
            y: zone.bounds.y + zone.bounds.height / 2,
          },
          facing: frame.player.position.x < centerX ? 'left' : 'right',
        },
        occurredAtMs: frame.endTimeMs,
        delivery: 'hazard',
        damage: attack.damage,
        knockback: attack.knockback,
        hitStopMs: attack.hitStopMs,
        tags: attack.tags,
        projectile: null,
      });
      this.lastHazardContactAtMs.set(zone.zoneId, frame.endTimeMs);
      if (resolution.kind === 'resolved' && resolution.damage.healthDamage > 0) {
        player.requestHitStop(attack.hitStopMs);
      }
    }
  }
}

function bodyBounds(position: Readonly<{ x: number; y: number }>): Rect {
  return Object.freeze({ x: position.x - 24, y: position.y - 96, width: 48, height: 96 });
}

function circleTouchesRect(
  center: Readonly<{ x: number; y: number }>,
  radius: number,
  rect: Rect,
): boolean {
  const closestX = Math.max(rect.x, Math.min(center.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(center.y, rect.y + rect.height));
  const dx = center.x - closestX;
  const dy = center.y - closestY;
  return dx * dx + dy * dy <= radius * radius;
}

function overlaps(left: Rect, right: Rect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}
