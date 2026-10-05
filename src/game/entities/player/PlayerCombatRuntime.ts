import { AbilitySystem } from '../../abilities/AbilitySystem';
import type { AbilityCommand } from '../../abilities/AbilitySystem';
import { HitboxSystem } from '../../combat/HitboxSystem';
import type {
  AttackHit,
  AttackInstance,
  AttackSample,
  Facing,
  HurtboxTarget,
} from '../../combat/HitboxSystem';
import { ProjectileSystem } from '../../combat/ProjectileSystem';
import type { ProjectileImpact, ProjectileSnapshot } from '../../combat/ProjectileSystem';
import { StatusEffects } from '../../combat/StatusEffects';
import type { StatusEffectSnapshot } from '../../combat/StatusEffects';
import {
  freezeCombatImpact,
  freezeCombatImpactResolution,
  freezeCombatVitality,
  UNRESOLVED_COMBAT_IMPACT,
} from '../../combat/CombatImpact';
import type {
  CombatImpact,
  CombatImpactResolution,
  CombatVitalitySnapshot,
} from '../../combat/CombatImpact';
import type { GuardResolution, GuardSnapshot } from '../../combat/GuardResolver';
import { abilityId, stableId } from '../../core/StableId';
import type {
  AbilityId,
  CombatantId,
  ProjectileId,
  StatusEffectId,
  TeamId,
} from '../../core/StableId';
import { ABILITIES } from '../../data/abilities';
import { ATTACKS } from '../../data/attacks';
import type { AbilityDefinition, AttackDefinition, AttackId, Vec2 } from '../../data/types';
import { combatFeedback } from '../../effects/CombatFeedback';
import type { FeedbackCommand } from '../../effects/CombatFeedback';
import type { SaveSettings } from '../../saves/SaveSchema';
import { INITIAL_PLAYER_COMBAT_STATE, stepPlayerCombat } from './PlayerCombatModel';
import type { PlayerCombatState } from './PlayerCombatModel';
import type { PlayerState } from './PlayerState';

export type AcceptedCombatAction = 'attack-light' | 'attack-heavy' | 'block' | 'dash' | 'cast';

export type PlayerCombatRuntimeEvent =
  | Readonly<{
      kind: 'action-accepted';
      sequence: number;
      action: AcceptedCombatAction;
      attackId: AttackId | null;
      abilityId: AbilityId | null;
    }>
  | Readonly<{ kind: 'mana-changed'; previousMana: number; currentMana: number }>
  | Readonly<{ kind: 'ability-selected'; abilityId: AbilityId }>
  | Readonly<{
      kind: 'attack-contact';
      attackId: AttackId;
      targetId: CombatantId;
      hit: AttackHit;
      resolution: CombatImpactResolution;
    }>
  | Readonly<{
      kind: 'projectile-contact';
      projectileId: ProjectileId;
      attackId: AttackId;
      targetId: CombatantId;
      impact: CombatImpact;
      resolution: CombatImpactResolution;
    }>
  | Readonly<{
      kind: 'feedback-requested';
      hitStopMs: number;
      commands: readonly FeedbackCommand[];
    }>
  | Readonly<{
      kind: 'barrier-applied';
      abilityId: AbilityId;
      statusId: StatusEffectId;
      expiresAtMs: number;
      absorptions: number;
    }>
  | Readonly<{
      kind: 'radial-pulse';
      abilityId: AbilityId;
      attackId: AttackId;
      ownerId: CombatantId;
      teamId: TeamId;
      origin: Vec2;
      occurredAtMs: number;
      radius: number;
      mechanismTag: 'rootglass-affecting';
    }>
  | Readonly<{
      kind: 'ability-attack';
      abilityId: AbilityId;
      attackId: AttackId;
    }>
  | Readonly<{
      kind: 'restore-requested';
      abilityId: AbilityId;
      resource: 'health' | 'mana';
      amount: number;
    }>
  | Readonly<{
      kind: 'vitality-changed';
      reason: 'damage' | 'death' | 'poise-recovered' | 'respawn';
      previous: CombatVitalitySnapshot;
      current: CombatVitalitySnapshot;
    }>
  | Readonly<{
      kind: 'incoming-impact';
      impact: CombatImpact;
      resolution: CombatImpactResolution;
    }>
  | Readonly<{
      kind: 'status-transition';
      removedStatusId: StatusEffectId;
      appliedStatusId: StatusEffectId;
      expiresAtMs: number;
    }>;

export type PlayerCombatRuntimeSnapshot = Readonly<{
  actionSequence: number;
  lastAcceptedAction: AcceptedCombatAction | null;
  activeAttackId: AttackId | null;
  attackFrame: number | null;
  attackPhase: Exclude<AttackSample['phase'], 'complete'> | null;
  currentMana: number;
  selectedAbilityId: AbilityId;
  guarding: boolean;
  parryActive: boolean;
  invulnerable: boolean;
  aegisActive: boolean;
  aegisChargeActive: boolean;
  statuses: readonly StatusEffectSnapshot[];
  projectiles: readonly ProjectileSnapshot[];
  projectileCount: number;
  confirmedHitCount: number;
  hitStopRemainingMs: number;
}>;

export type PlayerCombatRuntimeOptions = Readonly<{
  currentMana: number;
  unlockedAbilityIds: readonly AbilityId[];
  initialFacing: Facing;
  settings: SaveSettings;
  targets: () => readonly HurtboxTarget[];
  selectedAbilityId?: AbilityId;
  projectileCapacity?: number;
  ownerId?: CombatantId;
  teamId?: TeamId;
  receiveImpact?: (impact: CombatImpact) => CombatImpactResolution;
  abilityDefinitions?: readonly AbilityDefinition[];
}>;

export type PlayerCombatRuntimeInput = Readonly<{
  nowMs: number;
  stepMs: number;
  position: Vec2;
  grounded: boolean;
  movementState: PlayerState;
  playerState: PlayerState;
  facing: Facing;
  lightBufferId: number | null;
  heavyPressed: boolean;
  heavyReleased: boolean;
  heavyHeld: boolean;
  blockPressed: boolean;
  blockHeld: boolean;
  dashBufferId: number | null;
  castBufferId: number | null;
}>;

export type PlayerCombatRuntimeStep = Readonly<{
  stateRequests: readonly PlayerState[];
  consumed: Readonly<{
    lightBufferId: number | null;
    dashBufferId: number | null;
    castBufferId: number | null;
  }>;
  movement:
    | Readonly<{ kind: 'normal' | 'committed' }>
    | Readonly<{
        kind: 'dash';
        speedX: number;
        durationMs: number;
        completes: boolean;
      }>;
  movementImpulse: Vec2 | null;
  clearHeavyToggleLatch: boolean;
  clearBlockToggleLatch: boolean;
}>;

export type CombatLatchReset = Readonly<{
  clearHeavyToggleLatch: true;
  clearBlockToggleLatch: true;
}>;

type ActiveAttack = {
  definition: AttackDefinition;
  instance: AttackInstance;
  nextFrame: number;
};

type AbilityAttempt = Readonly<{
  accepted: boolean;
  movementImpulse: Vec2 | null;
  ownsAttack: boolean;
}>;

type AbilityExecution = Readonly<{
  movementImpulse: Vec2 | null;
  ownedAttackId: AttackId | null;
}>;

const PLAYER_ID = stableId<'combatant'>('mara');
const PLAYER_TEAM_ID = stableId<'team'>('player');
const LUMEN_BOLT_ID = abilityId('lumen-bolt');
const DASH_ID = abilityId('wayfinder-dash');
const LATCH_RESET: CombatLatchReset = Object.freeze({
  clearHeavyToggleLatch: true,
  clearBlockToggleLatch: true,
});
const REJECTED_ABILITY: AbilityAttempt = Object.freeze({
  accepted: false,
  movementImpulse: null,
  ownsAttack: false,
});
const LOGICAL_ABILITY_EXECUTION: AbilityExecution = Object.freeze({
  movementImpulse: null,
  ownedAttackId: null,
});

export class PlayerCombatRuntime {
  private readonly abilities: AbilitySystem;
  private readonly abilityDefinitions: readonly AbilityDefinition[];
  private readonly projectiles: ProjectileSystem;
  private readonly statuses = new StatusEffects();
  private readonly hitboxes = new HitboxSystem();
  private unlockedAbilityIds: readonly AbilityId[];
  private selectedAbilityId: AbilityId;
  private settings: SaveSettings;
  private readonly targetProvider: () => readonly HurtboxTarget[];
  private readonly ownerId: CombatantId;
  private readonly teamId: TeamId;
  private readonly receiveImpact: (impact: CombatImpact) => CombatImpactResolution;
  private combatState: PlayerCombatState = INITIAL_PLAYER_COMBAT_STATE;
  private activeAttack: ActiveAttack | null = null;
  private attackFrame: number | null = null;
  private attackPhase: PlayerCombatRuntimeSnapshot['attackPhase'] = null;
  private currentMana: number;
  private facing: Facing;
  private dashEndsAtMs: number | null = null;
  private dashSpeedX = 0;
  private dashReturnPending = false;
  private castActivationPending = false;
  private actionSequence = 0;
  private lastAcceptedAction: AcceptedCombatAction | null = null;
  private projectileSnapshots: readonly ProjectileSnapshot[] = Object.freeze([]);
  private confirmedHitCount = 0;
  private hitStopRemainingMs = 0;
  private lastObservedMs = 0;
  private readonly events: PlayerCombatRuntimeEvent[] = [];
  private disposed = false;

  public constructor(options: PlayerCombatRuntimeOptions) {
    if (!Number.isSafeInteger(options.currentMana) || options.currentMana < 0) {
      throw new RangeError('Player mana must be a non-negative safe integer.');
    }
    this.currentMana = options.currentMana;
    this.abilityDefinitions = Object.freeze([...(options.abilityDefinitions ?? ABILITIES)]);
    this.abilities = new AbilitySystem(this.abilityDefinitions);
    this.unlockedAbilityIds = Object.freeze([...options.unlockedAbilityIds]);
    this.selectedAbilityId = options.selectedAbilityId ?? LUMEN_BOLT_ID;
    this.facing = options.initialFacing;
    this.settings = Object.freeze({ ...options.settings });
    this.targetProvider = options.targets;
    this.ownerId = options.ownerId ?? PLAYER_ID;
    this.teamId = options.teamId ?? PLAYER_TEAM_ID;
    this.receiveImpact = options.receiveImpact ?? (() => UNRESOLVED_COMBAT_IMPACT);
    this.projectiles = new ProjectileSystem(options.projectileCapacity ?? 8);
  }

  public step(input: PlayerCombatRuntimeInput): PlayerCombatRuntimeStep {
    this.assertActive();
    this.observeTime(input.nowMs);
    assertStepMs(input.stepMs);
    this.facing = this.isCommitted() ? this.facing : input.facing;
    const stateRequests: PlayerState[] = [];
    const consumed = { lightBufferId: null, dashBufferId: null, castBufferId: null } as {
      lightBufferId: number | null;
      dashBufferId: number | null;
      castBufferId: number | null;
    };
    let movementImpulse: Vec2 | null = null;
    const targets = freezeTargets(this.targetProvider());

    this.advanceProjectiles(input.nowMs, targets);

    if (
      input.playerState === 'hurt' ||
      input.playerState === 'dead' ||
      input.playerState === 'interact'
    ) {
      return freezeStep(
        stateRequests,
        consumed,
        Object.freeze({ kind: 'committed' }),
        null,
        false,
        false,
      );
    }
    const activeDashMovement = this.advanceDash(input, stateRequests);
    if (activeDashMovement !== null) {
      return freezeStep(stateRequests, consumed, activeDashMovement, null, false, false);
    }
    if (this.dashReturnPending) {
      this.dashReturnPending = false;
      stateRequests.push(input.movementState);
    }
    if (this.castActivationPending) {
      this.castActivationPending = false;
      stateRequests.push(input.movementState);
    }

    const previousAttack = this.activeAttack;
    let attackComplete = false;
    if (previousAttack !== null) {
      const sample = this.sampleAttack(previousAttack, input.position, targets, input.nowMs);
      attackComplete = sample.phase === 'complete';
      if (attackComplete) {
        this.activeAttack = null;
        this.attackFrame = null;
        this.attackPhase = null;
      }
    }

    const combatStep = stepPlayerCombat(
      this.combatState,
      {
        nowMs: input.nowMs,
        grounded: input.grounded,
        lightBufferId: input.lightBufferId,
        heavyPressed: input.heavyPressed,
        heavyReleased: input.heavyReleased,
        heavyHeld: input.heavyHeld,
        blockPressed: input.blockPressed,
        blockHeld: input.blockHeld,
        reset: null,
      },
      {
        activeAttackFrame: this.attackFrame,
        attackComplete,
      },
    );
    const wasGuarding = this.combatState.guarding;
    this.combatState = combatStep.state;
    const clearHeavyToggleLatch = combatStep.clearHeavyToggleLatch;
    consumed.lightBufferId = combatStep.consumedBufferIds[0] ?? null;

    let startedAttack = false;
    for (const command of combatStep.commands) {
      if (command.kind === 'request-state') {
        stateRequests.push(command.state === 'idle' ? input.movementState : command.state);
        continue;
      }
      if (command.kind !== 'start-attack') continue;
      startedAttack = true;
      movementImpulse = this.activateAttack(command.attackId, input.position, targets, input.nowMs);
      this.acceptAction(
        command.attackId === 'mara-charged-heavy' ? 'attack-heavy' : 'attack-light',
        command.attackId,
        null,
      );
    }
    if (!wasGuarding && this.combatState.guarding) this.acceptAction('block', null, null);
    if (attackComplete && !startedAttack) stateRequests.push(input.movementState);

    const higherPriorityCommitment =
      this.activeAttack !== null ||
      this.combatState.heavyChargeStartedAtMs !== null ||
      this.combatState.guarding;
    let movement: PlayerCombatRuntimeStep['movement'] = higherPriorityCommitment
      ? Object.freeze({ kind: 'committed' as const })
      : Object.freeze({ kind: 'normal' as const });

    if (!higherPriorityCommitment && startedAttack === false) {
      if (input.dashBufferId !== null) {
        const result = this.tryAbility(
          DASH_ID,
          input.playerState,
          input.position,
          targets,
          input.nowMs,
        );
        if (result.accepted) {
          consumed.dashBufferId = input.dashBufferId;
          stateRequests.push('dash');
          const startedDashMovement = this.advanceDash(input, stateRequests);
          if (startedDashMovement === null) {
            throw new Error('Accepted dash did not start a dash movement.');
          }
          movement = startedDashMovement;
        }
      } else if (input.castBufferId !== null) {
        const definition = this.abilityDefinitions.find(
          ({ abilityId: id }) => id === this.selectedAbilityId,
        );
        const projectileBlocked =
          definition?.action.kind === 'projectile' && !this.projectiles.canSpawn();
        if (!projectileBlocked) {
          const result = this.tryAbility(
            this.selectedAbilityId,
            input.playerState,
            input.position,
            targets,
            input.nowMs,
          );
          if (result.accepted) {
            consumed.castBufferId = input.castBufferId;
            stateRequests.push('cast');
            movementImpulse = result.movementImpulse;
            this.castActivationPending = !result.ownsAttack;
            movement = Object.freeze({ kind: 'committed' });
          }
        }
      }
    }

    return freezeStep(
      stateRequests,
      consumed,
      movement,
      movementImpulse,
      clearHeavyToggleLatch,
      false,
    );
  }

  public snapshot(): PlayerCombatRuntimeSnapshot {
    const nowMs = this.lastObservedMs;
    const statuses = this.statuses.snapshot(nowMs);
    const invulnerable = statuses.some(({ statusId }) => statusId === 'dash-invulnerable');
    const aegisActive = statuses.some(({ statusId }) => statusId === 'aegis-veil');
    const aegisChargeActive = statuses.some(({ statusId }) => statusId === 'aegis-charge');
    return Object.freeze({
      actionSequence: this.actionSequence,
      lastAcceptedAction: this.lastAcceptedAction,
      activeAttackId: this.activeAttack?.definition.attackId ?? null,
      attackFrame: this.attackFrame,
      attackPhase: this.attackPhase,
      currentMana: this.currentMana,
      selectedAbilityId: this.selectedAbilityId,
      guarding: this.combatState.guarding,
      parryActive: this.combatState.parryUntilMs !== null && nowMs < this.combatState.parryUntilMs,
      invulnerable,
      aegisActive,
      aegisChargeActive,
      statuses,
      projectiles: freezeProjectileSnapshots(this.projectileSnapshots),
      projectileCount: this.projectileSnapshots.length,
      confirmedHitCount: this.confirmedHitCount,
      hitStopRemainingMs: this.hitStopRemainingMs,
    });
  }

  public synchronizeUnlockedAbilities(unlockedAbilityIds: readonly AbilityId[]): boolean {
    this.assertActive();
    const requested = new Set(unlockedAbilityIds);
    if (requested.size !== unlockedAbilityIds.length) {
      throw new RangeError('Unlocked abilities must be unique.');
    }
    const canonical = this.abilityDefinitions
      .filter(({ abilityId: id }) => requested.has(id))
      .map(({ abilityId: id }) => id);
    if (canonical.length !== requested.size) {
      throw new RangeError('Unlocked abilities must reference authored ability definitions.');
    }
    if (
      canonical.length === this.unlockedAbilityIds.length &&
      canonical.every((id, index) => this.unlockedAbilityIds[index] === id)
    ) {
      return false;
    }
    this.unlockedAbilityIds = Object.freeze(canonical);
    return true;
  }

  public cycleSelectedAbility(): boolean {
    this.assertActive();
    const castArts = this.abilityDefinitions
      .filter(
        ({ abilityId: id, action }) =>
          action.kind !== 'dash' && this.unlockedAbilityIds.includes(id),
      )
      .map(({ abilityId: id }) => id);
    if (castArts.length < 2) return false;
    const currentIndex = castArts.indexOf(this.selectedAbilityId);
    const next = castArts[currentIndex < 0 ? 0 : (currentIndex + 1) % castArts.length];
    if (next === undefined || next === this.selectedAbilityId) return false;
    this.selectedAbilityId = next;
    this.events.push(Object.freeze({ kind: 'ability-selected', abilityId: next }));
    return true;
  }

  public drainEvents(): readonly PlayerCombatRuntimeEvent[] {
    const drained = Object.freeze([...this.events]);
    this.events.length = 0;
    return drained;
  }

  public applySettings(settings: SaveSettings): void {
    this.settings = Object.freeze({ ...settings });
  }

  public identity(): Readonly<{ ownerId: CombatantId; teamId: TeamId }> {
    return Object.freeze({ ownerId: this.ownerId, teamId: this.teamId });
  }

  public guardSnapshot(positionX: number, nowMs: number): GuardSnapshot {
    this.assertActive();
    this.observeTime(nowMs);
    if (!Number.isFinite(positionX)) throw new RangeError('Guard position must be finite.');
    const statuses = this.statuses.snapshot(nowMs);
    return Object.freeze({
      positionX,
      facing: this.facing,
      mana: this.currentMana,
      invulnerable: statuses.some(({ statusId }) => statusId === 'dash-invulnerable'),
      parryActive: this.combatState.parryUntilMs !== null && nowMs < this.combatState.parryUntilMs,
      blocking: this.combatState.guarding,
      aegisActive: statuses.some(({ statusId }) => statusId === 'aegis-veil'),
    });
  }

  public applyGuardResolution(resolution: GuardResolution, nowMs: number): void {
    this.assertActive();
    this.observeTime(nowMs);
    if (resolution.kind === 'ignored') return;
    const previousMana = this.currentMana;
    this.currentMana -= resolution.manaSpent;
    if (this.currentMana < 0) throw new Error('Guard resolution overspent player mana.');
    if (this.currentMana !== previousMana) {
      this.events.push(
        Object.freeze({
          kind: 'mana-changed',
          previousMana,
          currentMana: this.currentMana,
        }),
      );
    }
    if (resolution.consumeAegis) {
      const aegisId = stableId<'status'>('aegis-veil');
      const aegis = this.statuses.snapshot(nowMs).find(({ statusId }) => statusId === aegisId);
      if (aegis !== undefined && this.statuses.remove(aegisId, nowMs)) {
        const remainingMs = aegis.expiresAtMs - nowMs;
        if (resolution.grantStatusId !== null && remainingMs > 0) {
          this.statuses.apply(resolution.grantStatusId, remainingMs, nowMs);
          this.events.push(
            Object.freeze({
              kind: 'status-transition',
              removedStatusId: aegisId,
              appliedStatusId: resolution.grantStatusId,
              expiresAtMs: aegis.expiresAtMs,
            }),
          );
        }
      }
    }
  }

  public recordVitalityChange(
    reason: Extract<PlayerCombatRuntimeEvent, { kind: 'vitality-changed' }>['reason'],
    previous: CombatVitalitySnapshot,
    current: CombatVitalitySnapshot,
  ): void {
    this.assertActive();
    this.events.push(
      Object.freeze({
        kind: 'vitality-changed',
        reason,
        previous: freezeCombatVitality(previous),
        current: freezeCombatVitality(current),
      }),
    );
  }

  public recordIncomingImpact(impact: CombatImpact, resolution: CombatImpactResolution): void {
    this.assertActive();
    this.events.push(
      Object.freeze({
        kind: 'incoming-impact',
        impact: freezeCombatImpact(impact),
        resolution: freezeCombatImpactResolution(resolution),
      }),
    );
  }

  public consumeHitStop(elapsedMs: number): boolean {
    assertStepMs(elapsedMs);
    if (this.hitStopRemainingMs === 0) return false;
    this.hitStopRemainingMs = Math.max(0, this.hitStopRemainingMs - elapsedMs);
    return true;
  }

  public requestHitStop(hitStopMs: number): void {
    this.assertActive();
    if (!Number.isSafeInteger(hitStopMs) || hitStopMs < 0) {
      throw new RangeError('Hit stop must be a non-negative safe integer.');
    }
    this.hitStopRemainingMs = Math.max(this.hitStopRemainingMs, hitStopMs);
  }

  public stopDash(): void {
    if (this.dashEndsAtMs === null) return;
    this.dashEndsAtMs = null;
    this.dashReturnPending = true;
  }

  public interrupt(kind: 'hurt' | 'dead', nowMs: number): CombatLatchReset {
    this.assertActive();
    this.observeTime(nowMs);
    this.resetTransient(kind);
    return LATCH_RESET;
  }

  public respawn(nowMs: number): CombatLatchReset {
    this.assertActive();
    this.observeTime(nowMs);
    this.resetTransient('respawn');
    this.projectiles.clear();
    this.projectileSnapshots = Object.freeze([]);
    this.confirmedHitCount = 0;
    this.events.length = 0;
    return LATCH_RESET;
  }

  public suspendForInteraction(nowMs: number): CombatLatchReset {
    this.assertActive();
    this.observeTime(nowMs);
    this.resetTransient('interaction');
    return LATCH_RESET;
  }

  public rebindRoom(facing: Facing, nowMs: number): CombatLatchReset {
    this.assertActive();
    this.observeTime(nowMs);
    this.resetTransient('interaction');
    this.facing = facing;
    this.projectiles.clear();
    this.projectileSnapshots = Object.freeze([]);
    this.confirmedHitCount = 0;
    this.lastAcceptedAction = null;
    this.events.length = 0;
    return LATCH_RESET;
  }

  public restoreAtCheckpoint(currentMana: number, nowMs: number): CombatLatchReset {
    this.assertActive();
    this.observeTime(nowMs);
    if (!Number.isSafeInteger(currentMana) || currentMana < 0) {
      throw new RangeError('Checkpoint mana must be a non-negative safe integer.');
    }
    this.currentMana = currentMana;
    this.resetTransient('respawn');
    this.projectiles.clear();
    this.projectileSnapshots = Object.freeze([]);
    this.confirmedHitCount = 0;
    this.events.length = 0;
    return LATCH_RESET;
  }

  public synchronizeMana(currentMana: number, maxMana: number): boolean {
    if (
      !Number.isSafeInteger(maxMana) ||
      maxMana <= 0 ||
      !Number.isSafeInteger(currentMana) ||
      currentMana < 0 ||
      currentMana > maxMana
    ) {
      throw new RangeError('Synchronized player mana is outside the player range.');
    }
    if (this.currentMana === currentMana) return false;
    this.currentMana = currentMana;
    return true;
  }

  public restoreManaTo(maximumMana: number, occurredAtMs: number): boolean {
    this.observeTime(occurredAtMs);
    if (!Number.isSafeInteger(maximumMana) || maximumMana <= 0) {
      throw new RangeError('Maximum mana must be a positive safe integer.');
    }
    const previousMana = this.currentMana;
    this.currentMana = maximumMana;
    if (previousMana === this.currentMana) return false;
    this.events.push(
      Object.freeze({ kind: 'mana-changed', previousMana, currentMana: this.currentMana }),
    );
    return true;
  }

  public dispose(): boolean {
    if (this.disposed) return false;
    this.disposed = true;
    this.activeAttack = null;
    this.projectiles.dispose();
    this.projectileSnapshots = Object.freeze([]);
    this.statuses.clear();
    this.events.length = 0;
    return true;
  }

  private sampleAttack(
    attack: ActiveAttack,
    position: Vec2,
    targets: readonly HurtboxTarget[],
    nowMs: number,
  ): AttackSample {
    const frame = attack.nextFrame;
    const sample = attack.instance.sample(frame, position, targets, nowMs);
    this.attackFrame = frame;
    this.attackPhase = sample.phase === 'complete' ? null : sample.phase;
    if (sample.phase !== 'complete') attack.nextFrame += 1;
    for (const hit of sample.hits) this.recordAttackContact(attack.definition, hit);
    return sample;
  }

  private activateAttack(
    attackId: AttackId,
    position: Vec2,
    targets: readonly HurtboxTarget[],
    nowMs: number,
  ): Vec2 {
    const definition = ATTACKS.find((attack) => attack.attackId === attackId);
    if (definition === undefined) throw new Error(`Missing attack definition: ${attackId}`);
    const active = {
      definition,
      instance: this.hitboxes.activate(this.ownerId, definition, this.facing, this.teamId),
      nextFrame: 0,
    };
    this.activeAttack = active;
    this.sampleAttack(active, position, targets, nowMs);
    return Object.freeze({
      x: this.facing === 'right' ? definition.movementImpulse.x : -definition.movementImpulse.x,
      y: definition.movementImpulse.y,
    });
  }

  private tryAbility(
    ability: AbilityId,
    state: PlayerState,
    position: Vec2,
    targets: readonly HurtboxTarget[],
    nowMs: number,
  ): AbilityAttempt {
    const result = this.abilities.tryCast(ability, {
      mana: this.currentMana,
      unlockedAbilityIds: this.unlockedAbilityIds,
      state,
      nowMs,
    });
    if (result.kind === 'rejected') return REJECTED_ABILITY;
    const previousMana = this.currentMana;
    this.currentMana = result.mana;
    if (this.currentMana !== previousMana) {
      this.events.push(
        Object.freeze({
          kind: 'mana-changed',
          previousMana,
          currentMana: this.currentMana,
        }),
      );
    }
    const execution = this.executeAbility(result.commands[0], ability, position, targets, nowMs);
    const action = ability === DASH_ID ? 'dash' : 'cast';
    this.acceptAction(action, execution.ownedAttackId, ability);
    return Object.freeze({
      accepted: true,
      movementImpulse: execution.movementImpulse,
      ownsAttack: execution.ownedAttackId !== null,
    });
  }

  private executeAbility(
    command: AbilityCommand,
    ability: AbilityId,
    position: Vec2,
    targets: readonly HurtboxTarget[],
    nowMs: number,
  ): AbilityExecution {
    if (command.kind === 'spawn-projectile') {
      const definition = ATTACKS.find(({ attackId }) => attackId === command.attackId);
      if (definition === undefined) {
        throw new Error(`Missing projectile attack definition: ${command.attackId}`);
      }
      const instanceId = this.projectiles.spawn(
        {
          projectileId: command.projectileId,
          attackId: command.attackId,
          ownerId: this.ownerId,
          teamId: this.teamId,
          speed: command.speed,
          lifetimeMs: command.lifetimeMs,
          bounds: command.bounds,
          delivery: definition.delivery,
          damage: definition.damage,
          knockback: definition.knockback,
          hitStopMs: definition.hitStopMs,
          tags: definition.tags,
        },
        position,
        this.facing,
        nowMs,
      );
      if (instanceId === null) throw new Error('Projectile capacity changed after preflight.');
      this.advanceProjectiles(nowMs, targets);
      return LOGICAL_ABILITY_EXECUTION;
    }
    if (command.kind === 'dash') {
      const endsAtMs = nowMs + command.durationMs;
      if (!Number.isSafeInteger(endsAtMs)) throw new RangeError('Dash end time exceeds range.');
      this.dashEndsAtMs = endsAtMs;
      this.dashSpeedX = this.facing === 'right' ? command.speed : -command.speed;
      this.statuses.apply(command.invulnerabilityStatusId, command.invulnerableMs, nowMs);
      return LOGICAL_ABILITY_EXECUTION;
    }
    if (command.kind === 'apply-barrier') {
      const expiresAtMs = nowMs + command.durationMs;
      this.statuses.apply(command.statusId, command.durationMs, nowMs);
      this.events.push(
        Object.freeze({
          kind: 'barrier-applied',
          abilityId: command.abilityId,
          statusId: command.statusId,
          expiresAtMs,
          absorptions: command.absorptions,
        }),
      );
      return LOGICAL_ABILITY_EXECUTION;
    }
    if (command.kind === 'radial-pulse') {
      this.events.push(
        Object.freeze({
          kind: 'radial-pulse',
          abilityId: command.abilityId,
          attackId: command.attackId,
          ownerId: this.ownerId,
          teamId: this.teamId,
          origin: Object.freeze({ ...position }),
          occurredAtMs: nowMs,
          radius: command.radius,
          mechanismTag: command.mechanismTag,
        }),
      );
      return LOGICAL_ABILITY_EXECUTION;
    }
    if (command.kind === 'attack') {
      const movementImpulse = this.activateAttack(command.attackId, position, targets, nowMs);
      this.combatState = Object.freeze({ ...this.combatState, activeAttackId: command.attackId });
      this.events.push(
        Object.freeze({ kind: 'ability-attack', abilityId: ability, attackId: command.attackId }),
      );
      return Object.freeze({ movementImpulse, ownedAttackId: command.attackId });
    }
    this.events.push(
      Object.freeze({
        kind: 'restore-requested',
        abilityId: command.abilityId,
        resource: command.resource,
        amount: command.amount,
      }),
    );
    return LOGICAL_ABILITY_EXECUTION;
  }

  private advanceProjectiles(nowMs: number, targets: readonly HurtboxTarget[]): void {
    const result = this.projectiles.step(nowMs, targets);
    for (const impact of result.impacts) this.recordProjectileImpact(impact);
    this.projectileSnapshots = freezeProjectileSnapshots(this.projectiles.snapshot());
  }

  private advanceDash(
    input: PlayerCombatRuntimeInput,
    stateRequests: PlayerState[],
  ): Extract<PlayerCombatRuntimeStep['movement'], { kind: 'dash' }> | null {
    if (this.dashEndsAtMs === null) return null;
    const remainingMs = this.dashEndsAtMs - input.nowMs;
    if (remainingMs <= 0) {
      this.dashEndsAtMs = null;
      this.dashSpeedX = 0;
      stateRequests.push(input.movementState);
      return null;
    }
    const durationMs = Math.min(input.stepMs, remainingMs);
    const completes = durationMs === remainingMs;
    const speedX = this.dashSpeedX;
    if (completes) {
      this.dashEndsAtMs = null;
      this.dashSpeedX = 0;
      stateRequests.push(input.movementState);
    }
    return Object.freeze({ kind: 'dash', speedX, durationMs, completes });
  }

  private recordAttackContact(definition: AttackDefinition, hit: AttackHit): void {
    const resolution = freezeCombatImpactResolution(this.receiveImpact(hit));
    const contact = Object.freeze({
      kind: 'attack-contact' as const,
      attackId: definition.attackId,
      targetId: hit.targetId,
      hit,
      resolution,
    });
    this.events.push(contact);
    if (!isPositiveResolvedImpact(resolution)) return;
    this.confirmedHitCount += 1;
    this.requestFeedback(hit, resolution.damage.healthDamage);
  }

  private recordProjectileImpact(impact: ProjectileImpact): void {
    const resolution = freezeCombatImpactResolution(this.receiveImpact(impact));
    const contact = Object.freeze({
      kind: 'projectile-contact' as const,
      projectileId: impact.projectile!.projectileId,
      attackId: impact.attackId,
      targetId: impact.targetId,
      impact,
      resolution,
    });
    this.events.push(contact);
    if (resolution.projectileDisposition === 'consume') {
      this.projectiles.consume(impact.projectile!.instanceId);
    }
    if (!isPositiveResolvedImpact(resolution)) return;
    this.confirmedHitCount += 1;
    this.requestFeedback(impact, resolution.damage.healthDamage);
  }

  private requestFeedback(impact: CombatImpact, healthDamage: number): void {
    const feedback = combatFeedback(
      {
        kind: 'damaging',
        class: impact.attackId === 'mara-charged-heavy' ? 'heavy' : 'ordinary',
        damage: healthDamage,
        particleProfileId: stableId<'particle-profile'>(
          impact.delivery === 'projectile' ? 'lumen-spark' : 'blade-sedge-spark',
        ),
        audioCueId: stableId<'audio-cue'>(
          impact.delivery === 'projectile' ? 'lumen-impact' : 'blade-impact',
        ),
      },
      this.settings,
    );
    this.hitStopRemainingMs = Math.max(this.hitStopRemainingMs, feedback.hitStopMs);
    this.events.push(
      Object.freeze({
        kind: 'feedback-requested',
        hitStopMs: feedback.hitStopMs,
        commands: feedback.commands,
      }),
    );
  }

  private acceptAction(
    action: AcceptedCombatAction,
    attackId: AttackId | null,
    ability: AbilityId | null,
  ): void {
    this.actionSequence += 1;
    this.lastAcceptedAction = action;
    this.events.push(
      Object.freeze({
        kind: 'action-accepted',
        sequence: this.actionSequence,
        action,
        attackId,
        abilityId: ability,
      }),
    );
  }

  private resetTransient(kind: 'hurt' | 'dead' | 'respawn' | 'interaction'): void {
    this.combatState = stepPlayerCombat(
      this.combatState,
      {
        nowMs: this.lastObservedMs,
        grounded: kind === 'respawn',
        lightBufferId: null,
        heavyPressed: false,
        heavyReleased: false,
        heavyHeld: false,
        blockPressed: false,
        blockHeld: false,
        reset: kind === 'interaction' ? 'hurt' : kind,
      },
      { activeAttackFrame: null, attackComplete: false },
    ).state;
    this.activeAttack = null;
    this.attackFrame = null;
    this.attackPhase = null;
    this.dashEndsAtMs = null;
    this.dashSpeedX = 0;
    this.dashReturnPending = false;
    this.castActivationPending = false;
    this.hitStopRemainingMs = 0;
    if (kind !== 'interaction') this.statuses.clear();
  }

  private observeTime(nowMs: number): void {
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
      throw new RangeError('Combat simulation time must be a non-negative safe integer.');
    }
    if (nowMs < this.lastObservedMs) {
      throw new RangeError('Combat simulation time cannot move backwards.');
    }
    this.lastObservedMs = nowMs;
  }

  private isCommitted(): boolean {
    return (
      this.activeAttack !== null ||
      this.combatState.guarding ||
      this.combatState.heavyChargeStartedAtMs !== null ||
      this.dashEndsAtMs !== null ||
      this.castActivationPending
    );
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('Player combat runtime is disposed.');
  }
}

function isPositiveResolvedImpact(
  resolution: CombatImpactResolution,
): resolution is Extract<CombatImpactResolution, { kind: 'resolved' }> {
  return resolution.kind === 'resolved' && resolution.damage.healthDamage > 0;
}

function freezeStep(
  stateRequests: readonly PlayerState[],
  consumed: PlayerCombatRuntimeStep['consumed'],
  movement: PlayerCombatRuntimeStep['movement'],
  movementImpulse: Vec2 | null,
  clearHeavyToggleLatch: boolean,
  clearBlockToggleLatch: boolean,
): PlayerCombatRuntimeStep {
  return Object.freeze({
    stateRequests: Object.freeze([...stateRequests]),
    consumed: Object.freeze({ ...consumed }),
    movement,
    movementImpulse: movementImpulse === null ? null : Object.freeze({ ...movementImpulse }),
    clearHeavyToggleLatch,
    clearBlockToggleLatch,
  });
}

function freezeTargets(targets: readonly HurtboxTarget[]): readonly HurtboxTarget[] {
  return Object.freeze(
    targets.map((target) =>
      Object.freeze({
        ...target,
        hurtboxes: Object.freeze(target.hurtboxes.map((hurtbox) => Object.freeze({ ...hurtbox }))),
      }),
    ),
  );
}

function freezeProjectileSnapshots(
  snapshots: readonly ProjectileSnapshot[],
): readonly ProjectileSnapshot[] {
  return Object.freeze(
    snapshots.map((snapshot) =>
      Object.freeze({ ...snapshot, position: Object.freeze({ ...snapshot.position }) }),
    ),
  );
}

function assertStepMs(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError('Combat step duration must be a positive safe integer.');
  }
}
