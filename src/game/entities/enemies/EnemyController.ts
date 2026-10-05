import { canPerceive, isLedgeProbeSupported } from '../../ai/Perception';
import type { EncounterDirector, AttackLease } from '../../ai/EncounterDirector';
import {
  freezeCombatImpact,
  freezeCombatImpactResolution,
  freezeCombatVitality,
} from '../../combat/CombatImpact';
import type {
  CombatImpact,
  CombatImpactResolution,
  CombatResolutionCommand,
  CombatVitalitySnapshot,
} from '../../combat/CombatImpact';
import { resolveDamage } from '../../combat/DamageResolver';
import { HitboxSystem } from '../../combat/HitboxSystem';
import type { AttackInstance, HurtboxTarget } from '../../combat/HitboxSystem';
import type { CombatantId, TeamId } from '../../core/StableId';
import { deepFreeze, immutableClone } from '../../data/immutability';
import type {
  ActorSpawnDefinition,
  AiAttackPatternDefinition,
  AiProfileDefinition,
  AttackDefinition,
  DropTableDefinition,
  EnemyActorDefinition,
  Rect,
  SurfaceDefinition,
  Vec2,
} from '../../data/types';
import { ENEMY_HURT_MS, ENEMY_STAGGER_MS } from './profiles/shared';

export const ENEMY_STATES = [
  'sleep',
  'idle',
  'patrol',
  'suspect',
  'chase',
  'telegraph',
  'attack',
  'recover',
  'retreat',
  'hurt',
  'stagger',
  'dead',
] as const;

export type EnemyState = (typeof ENEMY_STATES)[number];

const allowed = (...states: EnemyState[]): ReadonlySet<EnemyState> => new Set(states);

const LEGAL_TRANSITIONS: Readonly<Record<EnemyState, ReadonlySet<EnemyState>>> = Object.freeze({
  sleep: allowed('idle', 'dead'),
  idle: allowed('sleep', 'patrol', 'chase', 'retreat', 'hurt', 'stagger', 'dead'),
  patrol: allowed('sleep', 'suspect', 'chase', 'retreat', 'hurt', 'stagger', 'dead'),
  suspect: allowed('sleep', 'patrol', 'chase', 'retreat', 'hurt', 'stagger', 'dead'),
  chase: allowed('sleep', 'suspect', 'telegraph', 'retreat', 'hurt', 'stagger', 'dead'),
  telegraph: allowed('sleep', 'chase', 'attack', 'hurt', 'stagger', 'dead'),
  attack: allowed('sleep', 'recover', 'hurt', 'stagger', 'dead'),
  recover: allowed('sleep', 'idle', 'chase', 'retreat', 'hurt', 'stagger', 'dead'),
  retreat: allowed('sleep', 'idle', 'chase', 'hurt', 'stagger', 'dead'),
  hurt: allowed('sleep', 'idle', 'chase', 'retreat', 'stagger', 'dead'),
  stagger: allowed('sleep', 'idle', 'chase', 'retreat', 'hurt', 'dead'),
  dead: allowed(),
});

export class EnemyStateMachine {
  private state: EnemyState;

  public constructor(initialState: EnemyState) {
    if (!ENEMY_STATES.includes(initialState)) throw new RangeError('Unknown enemy state.');
    this.state = initialState;
  }

  public get current(): EnemyState {
    return this.state;
  }

  public request(next: EnemyState): boolean {
    if (next === this.state) return true;
    if (!LEGAL_TRANSITIONS[this.state].has(next)) return false;
    this.state = next;
    return true;
  }

  public reset(next: EnemyState = 'sleep'): void {
    if (!ENEMY_STATES.includes(next)) throw new RangeError('Unknown enemy reset state.');
    this.state = next;
  }
}

export type EnemyTargetSnapshot = Readonly<{
  position: Vec2;
  hurtboxTarget: HurtboxTarget;
}>;

export type EnemyDynamicPorts = Readonly<{
  readTarget(): EnemyTargetSnapshot | null;
  readCameraBounds(): Rect;
  readSurfaces(): readonly SurfaceDefinition[];
  receiveTargetImpact(impact: CombatImpact): CombatImpactResolution;
  readRoomOrdnanceCount(): number;
}>;

export type EnemyOrdnanceCommand = Readonly<{
  kind: 'plant';
  attackId: AttackDefinition['attackId'];
  ownerId: CombatantId;
  teamId: TeamId;
  position: Vec2;
  facing: 'left' | 'right';
  armsAtMs: number;
  expiresAtMs: number;
  roomCap: number;
  maxHits: number;
  delivery: 'projectile';
  damage: AttackDefinition['damage'];
  knockback: Vec2;
  hitStopMs: number;
  tags: AttackDefinition['tags'];
  bounds: Rect;
}>;

export type EnemyControllerEvent =
  | Readonly<{ kind: 'state-changed'; from: EnemyState; to: EnemyState; atMs: number }>
  | Readonly<{
      kind: 'attack-impact';
      impact: CombatImpact;
      resolution: CombatImpactResolution;
    }>
  | Readonly<{
      kind: 'incoming-impact';
      impact: CombatImpact;
      resolution: CombatImpactResolution;
    }>
  | Readonly<{ kind: 'ordnance'; command: EnemyOrdnanceCommand }>
  | Readonly<{
      kind: 'drop-request';
      combatantId: CombatantId;
      dropTableId: DropTableDefinition['dropTableId'];
      position: Vec2;
    }>;

export type EnemyAttackSnapshot = Readonly<{
  attackId: AttackDefinition['attackId'];
  phase: 'telegraph' | 'active' | 'recovery';
  startedAtMs: number;
  deadlineMs: number;
  leaseSequence: number | null;
}>;

export type EnemyControllerSnapshot = Readonly<{
  combatantId: CombatantId;
  actorId: EnemyActorDefinition['actorId'];
  state: EnemyState;
  position: Vec2;
  velocity: Vec2;
  facing: 'left' | 'right';
  vitality: CombatVitalitySnapshot;
  simulationTimeMs: number;
  stateDeadlineMs: number | null;
  knockbackUntilMs: number | null;
  attack: EnemyAttackSnapshot | null;
  hidden: boolean;
  targetable: boolean;
  coreExposedUntilMs: number | null;
  disposed: boolean;
}>;

export type EnemyControllerOptions = Readonly<{
  combatantId: CombatantId;
  teamId: TeamId;
  spawn: ActorSpawnDefinition;
  actor: EnemyActorDefinition;
  profile: AiProfileDefinition;
  attacks: readonly AttackDefinition[];
  dropTable: DropTableDefinition | null;
  director: EncounterDirector;
  ports: EnemyDynamicPorts;
  fixedStepMs?: number;
}>;

type ActiveAttack = {
  pattern: AiAttackPatternDefinition;
  definition: AttackDefinition;
  phase: EnemyAttackSnapshot['phase'];
  startedAtMs: number;
  deadlineMs: number;
  lease: AttackLease | null;
  instance: AttackInstance | null;
  origin: Vec2;
  targetPosition: Vec2;
  ordnanceEmitted: boolean;
};

const DEFAULT_FIXED_STEP_MS = 1_000 / 60;
export const ENEMY_KNOCKBACK_GRAVITY = 1_900;
export const ENEMY_KNOCKBACK_MAX_FALL_SPEED = 900;

export class EnemyController {
  private readonly combatantId: CombatantId;
  private readonly teamId: TeamId;
  private readonly spawn: ActorSpawnDefinition;
  private readonly actor: EnemyActorDefinition;
  private readonly profile: AiProfileDefinition;
  private readonly attacks: ReadonlyMap<string, AttackDefinition>;
  private readonly dropTable: DropTableDefinition | null;
  private readonly director: EncounterDirector;
  private readonly ports: EnemyDynamicPorts;
  private readonly fixedStepMs: number;
  private readonly stateMachine = new EnemyStateMachine('sleep');
  private readonly hitboxSystem = new HitboxSystem();
  private position: Vec2;
  private velocity: Vec2 = Object.freeze({ x: 0, y: 0 });
  private facing: 'left' | 'right';
  private vitality: CombatVitalitySnapshot;
  private simulationTimeMs = 0;
  private stateDeadlineMs: number | null = null;
  private knockbackStartedAtMs: number | null = null;
  private knockbackUntilMs: number | null = null;
  private activeAttack: ActiveAttack | null = null;
  private lastSeenPosition: Vec2 | null = null;
  private lostSightDeadlineMs: number | null = null;
  private nextPatternIndex = 0;
  private coreExposedUntilMs: number | null = null;
  private hidden = true;
  private disposed = false;
  private dropRequested = false;
  private readonly events: EnemyControllerEvent[] = [];

  public constructor(options: EnemyControllerOptions) {
    this.combatantId = options.combatantId;
    this.teamId = options.teamId;
    this.spawn = immutableClone(options.spawn);
    this.actor = immutableClone(options.actor);
    this.profile = immutableClone(options.profile);
    this.dropTable = options.dropTable === null ? null : immutableClone(options.dropTable);
    this.director = options.director;
    this.ports = options.ports;
    this.fixedStepMs = options.fixedStepMs ?? DEFAULT_FIXED_STEP_MS;
    if (!Number.isFinite(this.fixedStepMs) || this.fixedStepMs <= 0) {
      throw new RangeError('Enemy fixed step must be finite and positive.');
    }
    this.attacks = new Map(
      options.attacks.map((attack) => [attack.attackId, immutableClone(attack)]),
    );
    this.position = Object.freeze({ ...this.spawn.position });
    this.facing = this.spawn.facing;
    this.vitality = createVitality(this.actor);
    validateProfileTimings(this.profile, this.attacks, this.fixedStepMs);
  }

  public identity(): Readonly<{ combatantId: CombatantId; teamId: TeamId }> {
    return Object.freeze({ combatantId: this.combatantId, teamId: this.teamId });
  }

  public synchronizeSimulationTime(nowMs: number): void {
    this.assertUsable();
    if (!Number.isSafeInteger(nowMs) || nowMs < this.simulationTimeMs || nowMs < 0) {
      throw new RangeError('Enemy synchronization time must be monotonic and safe.');
    }
    this.simulationTimeMs = nowMs;
  }

  public update(nowMs: number, stepMs: number): EnemyControllerSnapshot {
    this.assertUsable();
    this.assertUpdateTime(nowMs, stepMs);
    this.simulationTimeMs = nowMs;
    if (this.coreExposedUntilMs !== null && nowMs >= this.coreExposedUntilMs) {
      this.coreExposedUntilMs = null;
    }

    const camera = this.readCamera();
    if (
      this.stateMachine.current !== 'dead' &&
      !insideExpanded(this.position, camera, this.profile.awareness.cameraSleepMargin)
    ) {
      this.enterSleep(nowMs);
      return this.snapshot();
    }
    if (this.stateMachine.current === 'dead') return this.snapshot();

    const target = this.readTarget();
    const visible = target !== null && this.perceives(target, this.profile.awareness.sightRange);
    if (visible && target !== null) {
      this.lastSeenPosition = Object.freeze({ ...target.position });
    }

    if (this.stateMachine.current === 'sleep') {
      if (target !== null && this.perceives(target, this.profile.awareness.wakeRange)) {
        this.hidden = false;
        this.transition('idle', nowMs);
      }
      return this.snapshot();
    }

    if (this.stateMachine.current === 'hurt' || this.stateMachine.current === 'stagger') {
      this.stepKnockback(nowMs, stepMs);
    }

    if (this.handleDeadline(nowMs, target, visible)) return this.snapshot();

    switch (this.stateMachine.current) {
      case 'idle':
        if (visible && target !== null && this.canLeaveRetreatFor(target)) {
          this.transition('chase', nowMs);
        } else if (visible) {
          this.transition('retreat', nowMs);
        } else this.transition('patrol', nowMs);
        break;
      case 'patrol':
        if (visible) {
          this.stateDeadlineMs = checkedDeadline(nowMs, this.profile.awareness.suspectMs);
          this.transition('suspect', nowMs);
        } else {
          this.patrol(stepMs);
        }
        break;
      case 'suspect':
        if (visible && target !== null && this.canLeaveRetreatFor(target)) {
          this.stateDeadlineMs = null;
          this.transition('chase', nowMs);
        } else if (visible) {
          this.stateDeadlineMs = null;
          this.transition('retreat', nowMs);
        }
        break;
      case 'chase':
        this.updateChase(nowMs, stepMs, target, visible, camera);
        break;
      case 'telegraph':
        break;
      case 'attack':
        this.sampleActiveAttack(nowMs, target);
        break;
      case 'recover':
        this.applyRecoveryMotion(nowMs, stepMs);
        break;
      case 'retreat':
        if (visible && target !== null && this.canLeaveRetreatFor(target)) {
          this.transition('chase', nowMs);
        } else {
          this.retreat(stepMs);
        }
        break;
      case 'hurt':
      case 'stagger':
        break;
    }
    return this.snapshot();
  }

  public snapshot(): EnemyControllerSnapshot {
    const attack = this.activeAttack;
    const attackSnapshot =
      attack === null
        ? null
        : Object.freeze({
            attackId: attack.definition.attackId,
            phase: attack.phase,
            startedAtMs: attack.startedAtMs,
            deadlineMs: attack.deadlineMs,
            leaseSequence: attack.lease?.sequence ?? null,
          });
    const targetable = this.isTargetable();
    return Object.freeze({
      combatantId: this.combatantId,
      actorId: this.actor.actorId,
      state: this.stateMachine.current,
      position: Object.freeze({ ...this.position }),
      velocity: Object.freeze({ ...this.velocity }),
      facing: this.facing,
      vitality: freezeCombatVitality(this.vitality),
      simulationTimeMs: this.simulationTimeMs,
      stateDeadlineMs: this.stateDeadlineMs,
      knockbackUntilMs: this.knockbackUntilMs,
      attack: attackSnapshot,
      hidden: this.hidden,
      targetable,
      coreExposedUntilMs: this.coreExposedUntilMs,
      disposed: this.disposed,
    });
  }

  public hurtboxTarget(): HurtboxTarget {
    const hurtboxes = this.isTargetable()
      ? this.profile.hurtboxes.map((bounds) =>
          Object.freeze(placeRelative(bounds, this.position, this.facing)),
        )
      : [];
    return Object.freeze({
      targetId: this.combatantId,
      teamId: this.teamId,
      hurtboxes: Object.freeze(hurtboxes),
    });
  }

  public receiveImpact(rawImpact: CombatImpact): CombatImpactResolution {
    assertImpactTime(rawImpact.occurredAtMs, this.simulationTimeMs);
    const impact = freezeCombatImpact(rawImpact);
    if (this.disposed) return ignored('disposed');
    if (impact.targetId !== this.combatantId || !this.isTargetable()) {
      const reason = this.stateMachine.current === 'dead' ? 'dead' : 'invalid-target';
      const resolution = ignored(reason);
      this.recordIncoming(impact, resolution);
      return resolution;
    }

    const defense = this.profile.frontalDefense;
    const front =
      this.facing === 'right'
        ? impact.source.position.x >= this.position.x
        : impact.source.position.x <= this.position.x;
    const coreExposed =
      this.coreExposedUntilMs !== null && this.coreExposedUntilMs > impact.occurredAtMs;
    const guarded =
      defense !== null && front && !coreExposed && !impact.tags.includes('unblockable');
    const damage = resolveDamage(impact.damage, {
      armour: this.vitality.armour,
      resistances: this.vitality.resistances,
      currentPoise: this.vitality.currentPoise,
      guard: guarded ? { kind: 'block', multiplier: defense.multiplier } : { kind: 'none' },
    });
    const previous = this.vitality;
    const remainingHealth = Math.max(0, previous.currentHealth - damage.healthDamage);
    const remainingPoise = damage.remainingPoise ?? previous.currentPoise;
    const exposesCore = guarded && defense.exposeCoreMs !== null;
    const staggered = damage.staggered || exposesCore;
    this.vitality = freezeCombatVitality({
      ...previous,
      currentHealth: remainingHealth,
      currentPoise: remainingPoise,
    });
    if (exposesCore) {
      this.coreExposedUntilMs = checkedDeadline(impact.occurredAtMs, defense.exposeCoreMs!);
    }
    const defeated = remainingHealth === 0;
    const resolution = freezeCombatImpactResolution({
      kind: 'resolved',
      guard: guarded ? 'block' : 'none',
      manaSpent: 0,
      damage,
      remainingHealth,
      remainingPoise,
      staggered,
      defeated,
      projectileDisposition: impact.projectile === null ? 'continue' : 'consume',
      commands: Object.freeze([]),
    });

    if (defeated) this.enterDead(impact.occurredAtMs);
    else if (staggered)
      this.enterInterrupted('stagger', impact.occurredAtMs, ENEMY_STAGGER_MS, impact.knockback);
    else if (damage.healthDamage > 0)
      this.enterInterrupted('hurt', impact.occurredAtMs, ENEMY_HURT_MS, impact.knockback);
    this.recordIncoming(impact, resolution);
    return resolution;
  }

  public applyResolutionCommand(command: CombatResolutionCommand, occurredAtMs: number): boolean {
    assertImpactTime(occurredAtMs, this.simulationTimeMs);
    if (
      this.disposed ||
      this.stateMachine.current === 'dead' ||
      this.stateMachine.current === 'sleep' ||
      command.kind !== 'punish-attacker'
    ) {
      return false;
    }
    this.enterInterrupted('stagger', occurredAtMs, ENEMY_STAGGER_MS, null);
    return true;
  }

  public drainEvents(): readonly EnemyControllerEvent[] {
    const drained = Object.freeze([...this.events]);
    this.events.length = 0;
    return drained;
  }

  public resetForRespawn(): boolean {
    if (this.disposed) return false;
    this.releaseAttack('interrupt', this.simulationTimeMs);
    this.director.withdraw(this.combatantId, this.simulationTimeMs);
    this.stateMachine.reset('sleep');
    this.position = Object.freeze({ ...this.spawn.position });
    this.velocity = Object.freeze({ x: 0, y: 0 });
    this.facing = this.spawn.facing;
    this.vitality = createVitality(this.actor);
    this.stateDeadlineMs = null;
    this.lastSeenPosition = null;
    this.lostSightDeadlineMs = null;
    this.nextPatternIndex = 0;
    this.coreExposedUntilMs = null;
    this.hidden = true;
    this.dropRequested = false;
    this.clearKnockback();
    this.events.length = 0;
    return true;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.releaseAttack('dispose', this.simulationTimeMs);
    this.director.withdraw(this.combatantId, this.simulationTimeMs);
    this.disposed = true;
    this.hidden = true;
    this.velocity = Object.freeze({ x: 0, y: 0 });
    this.clearKnockback();
  }

  private handleDeadline(
    nowMs: number,
    target: EnemyTargetSnapshot | null,
    visible: boolean,
  ): boolean {
    if (this.stateDeadlineMs === null || nowMs < this.stateDeadlineMs) return false;
    switch (this.stateMachine.current) {
      case 'suspect':
        this.stateDeadlineMs = null;
        this.transition('retreat', nowMs);
        return true;
      case 'telegraph':
        this.beginActiveAttack(nowMs, target);
        return true;
      case 'attack':
        this.finishActiveMotion();
        this.beginRecovery(nowMs);
        return true;
      case 'recover':
        this.finishRecoveryMotion();
        this.hidden = false;
        this.activeAttack = null;
        this.stateDeadlineMs = null;
        this.transition(
          visible && target !== null && this.canLeaveRetreatFor(target) ? 'chase' : 'retreat',
          nowMs,
        );
        return true;
      case 'hurt':
        this.stateDeadlineMs = null;
        this.velocity = Object.freeze({ x: 0, y: 0 });
        this.clearKnockback();
        this.transition(
          !this.enemyInsideLeash()
            ? 'retreat'
            : visible && target !== null && this.canLeaveRetreatFor(target)
              ? 'chase'
              : 'idle',
          nowMs,
        );
        return true;
      case 'stagger':
        this.vitality = freezeCombatVitality({
          ...this.vitality,
          currentPoise: this.vitality.maxPoise,
        });
        this.stateDeadlineMs = null;
        this.velocity = Object.freeze({ x: 0, y: 0 });
        this.clearKnockback();
        this.transition(
          !this.enemyInsideLeash()
            ? 'retreat'
            : visible && target !== null && this.canLeaveRetreatFor(target)
              ? 'chase'
              : 'idle',
          nowMs,
        );
        return true;
      default:
        return false;
    }
  }

  private updateChase(
    nowMs: number,
    stepMs: number,
    target: EnemyTargetSnapshot | null,
    visible: boolean,
    camera: Rect,
  ): void {
    if (!visible || target === null) {
      if (
        !this.enemyInsideLeash() ||
        (this.lastSeenPosition !== null && this.targetBeyondLeash(this.lastSeenPosition))
      ) {
        this.director.withdraw(this.combatantId, nowMs);
        this.velocity = Object.freeze({ x: 0, y: 0 });
        this.transition('retreat', nowMs);
        return;
      }
      if (this.lostSightDeadlineMs === null) {
        this.lostSightDeadlineMs = checkedDeadline(nowMs, this.profile.awareness.lostSightMs);
      }
      if (nowMs >= this.lostSightDeadlineMs) {
        this.lostSightDeadlineMs = null;
        this.stateDeadlineMs = checkedDeadline(nowMs, this.profile.awareness.suspectMs);
        this.transition('suspect', nowMs);
      } else if (this.lastSeenPosition !== null) {
        this.moveToward(this.lastSeenPosition, stepMs);
      }
      return;
    }
    this.lostSightDeadlineMs = null;
    if (this.targetBeyondLeash(target.position) || !this.enemyInsideLeash()) {
      this.director.withdraw(this.combatantId, nowMs);
      this.velocity = Object.freeze({ x: 0, y: 0 });
      this.transition('retreat', nowMs);
      return;
    }
    const pattern = this.profile.attacks[this.nextPatternIndex % this.profile.attacks.length]!;
    if (distanceX(this.position, target.position) < pattern.band.minimumX) {
      this.director.withdraw(this.combatantId, nowMs);
      this.moveAwayFrom(target.position, stepMs);
      return;
    }
    if (this.canAttack(pattern, target, camera)) {
      const lease = this.director.request(
        {
          combatantId: this.combatantId,
          slotClass: pattern.slotClass,
          pressureCost: pattern.pressureCost,
          telegraphMs: pattern.telegraphMs,
          activeMs: pattern.activeMs,
        },
        nowMs,
      );
      if (lease !== null) {
        const definition = this.attacks.get(pattern.attackId)!;
        this.facing = target.position.x < this.position.x ? 'left' : 'right';
        this.velocity = Object.freeze({ x: 0, y: 0 });
        this.activeAttack = {
          pattern,
          definition,
          phase: 'telegraph',
          startedAtMs: nowMs,
          deadlineMs: checkedDeadline(nowMs, pattern.telegraphMs),
          lease,
          instance: null,
          origin: Object.freeze({ ...this.position }),
          targetPosition: Object.freeze({ ...target.position }),
          ordnanceEmitted: false,
        };
        this.stateDeadlineMs = this.activeAttack.deadlineMs;
        this.transition('telegraph', nowMs);
        return;
      }
    } else {
      this.director.withdraw(this.combatantId, nowMs);
    }
    this.moveToward(target.position, stepMs);
    if (distanceX(this.position, this.spawn.position) > this.profile.territory.leashRange) {
      this.director.withdraw(this.combatantId, nowMs);
      this.transition('retreat', nowMs);
    }
  }

  private beginActiveAttack(nowMs: number, target: EnemyTargetSnapshot | null): void {
    const attack = this.activeAttack;
    if (attack === null) return;
    attack.phase = 'active';
    attack.startedAtMs = nowMs;
    attack.deadlineMs = checkedDeadline(nowMs, attack.pattern.activeMs);
    attack.origin = Object.freeze({ ...this.position });
    attack.targetPosition = Object.freeze({
      ...(target?.position ?? this.lastSeenPosition ?? this.position),
    });
    attack.instance = this.hitboxSystem.activate(
      this.combatantId,
      attack.definition,
      this.facing,
      this.teamId,
    );
    this.stateDeadlineMs = attack.deadlineMs;
    this.transition('attack', nowMs);
    this.emitOrdnance(attack, nowMs);
    this.sampleActiveAttack(nowMs, target);
  }

  private sampleActiveAttack(nowMs: number, target: EnemyTargetSnapshot | null): void {
    const attack = this.activeAttack;
    if (attack === null || attack.phase !== 'active' || attack.instance === null) return;
    this.applyAttackMotion(nowMs);
    const elapsed = Math.max(0, nowMs - attack.startedAtMs);
    const firstFrame = Math.min(...attack.definition.hitboxes.map(({ fromFrame }) => fromFrame));
    const activeFrameCount = Math.max(
      ...attack.definition.hitboxes.map(({ fromFrame, toFrame }) => toFrame - fromFrame + 1),
    );
    const activeOffset = Math.min(activeFrameCount - 1, Math.floor(elapsed / this.fixedStepMs));
    const sample = attack.instance.sample(
      firstFrame + activeOffset,
      this.position,
      target === null ? [] : [target.hurtboxTarget],
      nowMs,
    );
    for (const rawImpact of sample.hits) {
      const impact = freezeCombatImpact(rawImpact);
      const resolution = freezeCombatImpactResolution(this.ports.receiveTargetImpact(impact));
      this.events.push(deepFreeze({ kind: 'attack-impact', impact, resolution }));
      for (const command of resolution.commands) {
        this.applyResolutionCommand(command, nowMs);
      }
      if (this.stateMachine.current !== 'attack') break;
    }
  }

  private beginRecovery(nowMs: number): void {
    const attack = this.activeAttack;
    if (attack === null) return;
    if (attack.lease !== null) this.director.release(attack.lease, nowMs);
    attack.lease = null;
    attack.instance = null;
    attack.phase = 'recovery';
    attack.startedAtMs = nowMs;
    attack.deadlineMs = checkedDeadline(nowMs, attack.pattern.recoveryMs);
    this.nextPatternIndex = (this.nextPatternIndex + 1) % this.profile.attacks.length;
    this.hidden = attack.pattern.motion.kind === 'hide';
    this.stateDeadlineMs = attack.deadlineMs;
    this.transition('recover', nowMs);
  }

  private emitOrdnance(attack: ActiveAttack, nowMs: number): void {
    if (attack.ordnanceEmitted || attack.pattern.motion.kind !== 'plant') return;
    attack.ordnanceEmitted = true;
    const motion = attack.pattern.motion;
    if (this.ports.readRoomOrdnanceCount() >= motion.roomCap) return;
    const armsAtMs = checkedDeadline(nowMs, motion.armsMs);
    const command: EnemyOrdnanceCommand = deepFreeze({
      kind: 'plant',
      attackId: attack.definition.attackId,
      ownerId: this.combatantId,
      teamId: this.teamId,
      position: { ...attack.targetPosition },
      facing: this.facing,
      armsAtMs,
      expiresAtMs: checkedDeadline(armsAtMs, motion.lifetimeMs),
      roomCap: motion.roomCap,
      maxHits: motion.maxHits,
      delivery: 'projectile',
      damage: attack.definition.damage,
      knockback: attack.definition.knockback,
      hitStopMs: attack.definition.hitStopMs,
      tags: attack.definition.tags,
      bounds: attack.definition.hitboxes[0]!.bounds,
    });
    this.events.push(deepFreeze({ kind: 'ordnance', command }));
  }

  private canAttack(
    pattern: AiAttackPatternDefinition,
    target: EnemyTargetSnapshot,
    camera: Rect,
  ): boolean {
    const horizontal = distanceX(this.position, target.position);
    const vertical = Math.abs(this.position.y - target.position.y);
    if (
      horizontal < pattern.band.minimumX ||
      horizontal > pattern.band.maximumX ||
      vertical > pattern.band.vertical
    ) {
      return false;
    }
    if (!rectInside(camera, placeRelative(this.profile.bodyBounds, this.position, this.facing))) {
      return false;
    }
    return (
      pattern.slotClass !== 'ranged' || insideInset(this.position, camera, pattern.cameraInset)
    );
  }

  private perceives(target: EnemyTargetSnapshot, horizontalRange: number): boolean {
    const hurtboxes = target.hurtboxTarget.hurtboxes;
    if (hurtboxes.length === 0) return false;
    const chest = unionCenter(hurtboxes);
    return canPerceive({
      eye: {
        x:
          this.position.x +
          (this.facing === 'right' ? this.profile.eyeOffset.x : -this.profile.eyeOffset.x),
        y: this.position.y + this.profile.eyeOffset.y,
      },
      targetChest: chest,
      horizontalRange,
      verticalRange: this.profile.awareness.verticalRange,
      surfaces: this.ports.readSurfaces(),
    });
  }

  private patrol(stepMs: number): void {
    if (this.profile.locomotion.kind === 'stationary') return;
    const direction = this.facing === 'right' ? 1 : -1;
    const distance = (this.profile.locomotion.speed * stepMs) / 1_000;
    const proposed = { x: this.position.x + direction * distance, y: this.position.y };
    if (
      distanceX(proposed, this.spawn.position) > this.profile.territory.patrolRange ||
      this.groundMoveBlocked(proposed, direction)
    ) {
      this.facing = direction > 0 ? 'left' : 'right';
      this.velocity = Object.freeze({ x: 0, y: 0 });
      return;
    }
    this.position = Object.freeze(proposed);
    this.velocity = Object.freeze({ x: direction * this.profile.locomotion.speed, y: 0 });
  }

  private retreat(stepMs: number): void {
    const difference = this.spawn.position.x - this.position.x;
    if (Math.abs(difference) <= 1) {
      this.position = Object.freeze({ ...this.spawn.position });
      this.velocity = Object.freeze({ x: 0, y: 0 });
      return;
    }
    this.moveToward(this.spawn.position, stepMs);
  }

  private moveAwayFrom(target: Vec2, stepMs: number): void {
    if (this.profile.locomotion.kind === 'stationary') return;
    const direction = target.x >= this.position.x ? -1 : 1;
    const distance = (this.profile.locomotion.speed * stepMs) / 1_000;
    const proposed = { x: this.position.x + direction * distance, y: this.position.y };
    this.facing = direction < 0 ? 'left' : 'right';
    if (
      distanceX(proposed, this.spawn.position) > this.profile.territory.leashRange ||
      (this.profile.locomotion.kind === 'ground' && this.groundMoveBlocked(proposed, direction))
    ) {
      this.velocity = Object.freeze({ x: 0, y: 0 });
      return;
    }
    this.position = Object.freeze(proposed);
    this.velocity = Object.freeze({ x: direction * this.profile.locomotion.speed, y: 0 });
  }

  private targetBeyondLeash(target: Vec2): boolean {
    return (
      this.profile.territory.leashRange > 0 &&
      distanceX(target, this.spawn.position) > this.profile.territory.leashRange
    );
  }

  private enemyInsideLeash(): boolean {
    return (
      this.profile.territory.leashRange === 0 ||
      distanceX(this.position, this.spawn.position) <= this.profile.territory.leashRange
    );
  }

  private canLeaveRetreatFor(target: EnemyTargetSnapshot): boolean {
    return this.enemyInsideLeash() && !this.targetBeyondLeash(target.position);
  }

  private moveToward(target: Vec2, stepMs: number): void {
    if (this.profile.locomotion.kind === 'stationary') return;
    const speed = this.profile.locomotion.speed;
    const maximumDistance = (speed * stepMs) / 1_000;
    if (this.profile.locomotion.kind === 'aerial') {
      const dx = target.x - this.position.x;
      const dy = target.y - this.position.y;
      const length = Math.hypot(dx, dy);
      if (length === 0) return;
      const scale = Math.min(maximumDistance, length) / length;
      this.position = Object.freeze({
        x: this.position.x + dx * scale,
        y: this.position.y + dy * scale,
      });
      this.velocity = Object.freeze({ x: dx * (speed / length), y: dy * (speed / length) });
      this.facing = dx < 0 ? 'left' : 'right';
      return;
    }
    const direction = target.x < this.position.x ? -1 : 1;
    const distance = Math.min(maximumDistance, Math.abs(target.x - this.position.x));
    const proposed = { x: this.position.x + direction * distance, y: this.position.y };
    this.facing = direction < 0 ? 'left' : 'right';
    if (this.groundMoveBlocked(proposed, direction)) {
      this.velocity = Object.freeze({ x: 0, y: 0 });
      return;
    }
    this.position = Object.freeze(proposed);
    this.velocity = Object.freeze({ x: direction * speed, y: 0 });
  }

  private groundMoveBlocked(proposed: Vec2, direction: number): boolean {
    const surfaces = this.ports.readSurfaces();
    const body = placeRelative(this.profile.bodyBounds, proposed, this.facing);
    if (surfaces.some((surface) => surface.kind === 'solid' && overlaps(body, surface.bounds))) {
      return true;
    }
    const probe = this.profile.territory.ledgeProbe;
    if (probe === null) return false;
    const probeX = proposed.x + direction * probe.ahead;
    return !isLedgeProbeSupported(
      { x: probeX, y: proposed.y },
      { x: probeX, y: proposed.y + probe.depth },
      surfaces,
    );
  }

  private applyAttackMotion(nowMs: number): void {
    const attack = this.activeAttack;
    if (attack === null) return;
    if (attack.pattern.motion.kind === 'dive') {
      const t = Math.max(0, Math.min(1, (nowMs - attack.startedAtMs) / attack.pattern.activeMs));
      const arc = 4 * attack.pattern.motion.arcDepth * t * (1 - t);
      this.position = Object.freeze({
        x: lerp(attack.origin.x, attack.targetPosition.x, t),
        y: lerp(attack.origin.y, attack.targetPosition.y, t) + arc,
      });
    } else if (attack.pattern.motion.kind === 'lunge') {
      this.applyLungeMotion(Math.max(0, nowMs - attack.startedAtMs));
    }
  }

  private finishActiveMotion(): void {
    const attack = this.activeAttack;
    if (attack?.pattern.motion.kind === 'dive') {
      this.position = Object.freeze({ ...attack.targetPosition });
    } else if (attack?.pattern.motion.kind === 'lunge') {
      this.applyLungeMotion(attack.pattern.activeMs);
    }
  }

  private applyLungeMotion(elapsedMs: number): void {
    const attack = this.activeAttack;
    if (attack?.pattern.motion.kind !== 'lunge') return;
    const direction = this.facing === 'right' ? 1 : -1;
    const duration = Math.min(elapsedMs, attack.pattern.activeMs);
    const proposed = {
      x: attack.origin.x + direction * attack.pattern.motion.recoilSpeed * (duration / 1_000),
      y: attack.origin.y,
    };
    if (!this.groundMoveBlocked(proposed, direction)) this.position = Object.freeze(proposed);
  }

  private applyRecoveryMotion(nowMs: number, stepMs: number): void {
    const attack = this.activeAttack;
    if (attack?.pattern.motion.kind === 'lunge') {
      const direction = this.facing === 'right' ? -1 : 1;
      const distance = (attack.pattern.motion.recoilSpeed * stepMs) / 1_000;
      const proposed = { x: this.position.x + direction * distance, y: this.position.y };
      if (!this.groundMoveBlocked(proposed, direction)) this.position = Object.freeze(proposed);
    } else if (attack?.pattern.motion.kind === 'dive') {
      const elapsed = Math.max(0, nowMs - attack.startedAtMs);
      if (elapsed <= attack.pattern.motion.hoverMs) {
        this.position = Object.freeze({ ...attack.targetPosition });
        return;
      }
      const returnMs = Math.max(1, attack.pattern.recoveryMs - attack.pattern.motion.hoverMs);
      const t = Math.min(1, (elapsed - attack.pattern.motion.hoverMs) / returnMs);
      this.position = Object.freeze({
        x: lerp(attack.targetPosition.x, attack.origin.x, t),
        y: lerp(attack.targetPosition.y, attack.origin.y, t),
      });
    }
  }

  private finishRecoveryMotion(): void {
    const attack = this.activeAttack;
    if (attack?.pattern.motion.kind === 'dive') {
      this.position = Object.freeze({ ...attack.origin });
    }
  }

  private enterInterrupted(
    state: 'hurt' | 'stagger',
    nowMs: number,
    durationMs: number,
    knockback: Vec2 | null,
  ): void {
    this.releaseAttack('interrupt', nowMs);
    this.director.interrupt(this.combatantId, nowMs);
    this.hidden = false;
    this.stateDeadlineMs = checkedDeadline(nowMs, durationMs);
    if (knockback === null) {
      this.velocity = Object.freeze({ x: 0, y: 0 });
      this.clearKnockback();
    } else {
      assertPoint(knockback, 'Enemy knockback');
      this.velocity = Object.freeze({ ...knockback });
      this.knockbackStartedAtMs = nowMs;
      this.knockbackUntilMs = checkedDeadline(nowMs, ENEMY_HURT_MS);
    }
    this.transition(state, nowMs);
  }

  private enterSleep(nowMs: number): void {
    if (this.stateMachine.current === 'sleep') return;
    this.releaseAttack('sleep', nowMs);
    this.director.sleep(this.combatantId, nowMs);
    this.hidden = true;
    this.velocity = Object.freeze({ x: 0, y: 0 });
    this.clearKnockback();
    this.stateDeadlineMs = null;
    this.lostSightDeadlineMs = null;
    this.transition('sleep', nowMs);
  }

  private enterDead(nowMs: number): void {
    this.releaseAttack('death', nowMs);
    this.director.death(this.combatantId, nowMs);
    this.hidden = false;
    this.velocity = Object.freeze({ x: 0, y: 0 });
    this.clearKnockback();
    this.stateDeadlineMs = null;
    this.transition('dead', nowMs);
    if (!this.dropRequested && this.dropTable !== null) {
      this.dropRequested = true;
      this.events.push(
        deepFreeze({
          kind: 'drop-request',
          combatantId: this.combatantId,
          dropTableId: this.dropTable.dropTableId,
          position: { ...this.position },
        }),
      );
    }
  }

  private releaseAttack(reason: 'interrupt' | 'sleep' | 'death' | 'dispose', nowMs: number): void {
    const attack = this.activeAttack;
    if (attack?.lease !== null && attack?.lease !== undefined) {
      if (reason === 'interrupt' || reason === 'dispose')
        this.director.interrupt(this.combatantId, nowMs);
      else if (reason === 'sleep') this.director.sleep(this.combatantId, nowMs);
      else this.director.death(this.combatantId, nowMs);
    }
    this.activeAttack = null;
    this.stateDeadlineMs = null;
  }

  private transition(next: EnemyState, nowMs: number): void {
    const from = this.stateMachine.current;
    if (from === next) return;
    if (!this.stateMachine.request(next)) {
      throw new Error(`Illegal enemy state transition: ${from} -> ${next}`);
    }
    this.events.push(deepFreeze({ kind: 'state-changed', from, to: next, atMs: nowMs }));
  }

  private stepKnockback(nowMs: number, stepMs: number): void {
    if (this.knockbackStartedAtMs === null || this.knockbackUntilMs === null) return;
    const intervalStart = Math.max(this.knockbackStartedAtMs, nowMs - stepMs);
    const intervalEnd = Math.min(nowMs, this.knockbackUntilMs);
    const movementMs = Math.max(0, intervalEnd - intervalStart);
    if (movementMs > 0) {
      const movementSeconds = movementMs / 1_000;
      this.moveKnockbackAxis('x', this.velocity.x * movementSeconds);
      const initialVelocityY = this.velocity.y;
      const nextVelocityY = Math.min(
        initialVelocityY + ENEMY_KNOCKBACK_GRAVITY * movementSeconds,
        ENEMY_KNOCKBACK_MAX_FALL_SPEED,
      );
      const verticalBlocked = this.moveKnockbackAxis(
        'y',
        ((initialVelocityY + nextVelocityY) / 2) * movementSeconds,
      );
      if (!verticalBlocked) {
        this.velocity = Object.freeze({ ...this.velocity, y: nextVelocityY });
      }
    }
    if (nowMs >= this.knockbackUntilMs) {
      this.velocity = Object.freeze({ x: 0, y: 0 });
      this.clearKnockback();
    }
  }

  private moveKnockbackAxis(axis: 'x' | 'y', delta: number): boolean {
    if (delta === 0) return false;
    const allSurfaces = this.ports.readSurfaces();
    const surfaces = allSurfaces.filter(({ kind }) => kind === 'solid');
    const currentBody = placeRelative(this.profile.bodyBounds, this.position, this.facing);
    if (axis === 'x') {
      const nextPosition = { x: this.position.x + delta, y: this.position.y };
      const nextBody = placeRelative(this.profile.bodyBounds, nextPosition, this.facing);
      const blocked = surfaces.some(({ bounds }) => {
        const verticalOverlap =
          currentBody.y < bounds.y + bounds.height && currentBody.y + currentBody.height > bounds.y;
        if (!verticalOverlap) return false;
        return delta < 0
          ? currentBody.x >= bounds.x + bounds.width && nextBody.x < bounds.x + bounds.width
          : currentBody.x + currentBody.width <= bounds.x && nextBody.x + nextBody.width > bounds.x;
      });
      if (blocked || surfaces.some(({ bounds }) => overlaps(nextBody, bounds))) {
        this.velocity = Object.freeze({ ...this.velocity, x: 0 });
        return true;
      }
      this.position = Object.freeze(nextPosition);
      return false;
    }

    const nextPosition = { x: this.position.x, y: this.position.y + delta };
    const nextBody = placeRelative(this.profile.bodyBounds, nextPosition, this.facing);
    const horizontalOverlap = (bounds: Rect) =>
      currentBody.x < bounds.x + bounds.width && currentBody.x + currentBody.width > bounds.x;
    if (delta > 0) {
      const landingTop = allSurfaces
        .filter(({ bounds }) => {
          if (!horizontalOverlap(bounds)) return false;
          const currentBottom = currentBody.y + currentBody.height;
          const nextBottom = nextBody.y + nextBody.height;
          return currentBottom <= bounds.y && nextBottom >= bounds.y;
        })
        .map(({ bounds }) => bounds.y)
        .sort((left, right) => left - right)[0];
      if (landingTop !== undefined) {
        this.position = Object.freeze({
          x: this.position.x,
          y: landingTop - this.profile.bodyBounds.y - this.profile.bodyBounds.height,
        });
        this.velocity = Object.freeze({ ...this.velocity, y: 0 });
        return true;
      }
    } else {
      const ceilingBottom = surfaces
        .filter(({ bounds }) => {
          if (!horizontalOverlap(bounds)) return false;
          const bottom = bounds.y + bounds.height;
          return currentBody.y >= bottom && nextBody.y <= bottom;
        })
        .map(({ bounds }) => bounds.y + bounds.height)
        .sort((left, right) => right - left)[0];
      if (ceilingBottom !== undefined) {
        this.position = Object.freeze({
          x: this.position.x,
          y: ceilingBottom - this.profile.bodyBounds.y,
        });
        this.velocity = Object.freeze({ ...this.velocity, y: 0 });
        return true;
      }
    }
    if (surfaces.some(({ bounds }) => overlaps(nextBody, bounds))) {
      this.velocity = Object.freeze({ ...this.velocity, y: 0 });
      return true;
    }
    this.position = Object.freeze(nextPosition);
    return false;
  }

  private clearKnockback(): void {
    this.knockbackStartedAtMs = null;
    this.knockbackUntilMs = null;
  }

  private recordIncoming(impact: CombatImpact, resolution: CombatImpactResolution): void {
    this.events.push(deepFreeze({ kind: 'incoming-impact', impact, resolution }));
  }

  private isTargetable(): boolean {
    return (
      !this.disposed &&
      this.stateMachine.current !== 'dead' &&
      this.stateMachine.current !== 'sleep' &&
      !this.hidden
    );
  }

  private readTarget(): EnemyTargetSnapshot | null {
    const target = this.ports.readTarget();
    if (target === null) return null;
    assertPoint(target.position, 'Enemy target position');
    return target;
  }

  private readCamera(): Rect {
    const camera = this.ports.readCameraBounds();
    assertRect(camera, 'Enemy camera');
    return camera;
  }

  private assertUpdateTime(nowMs: number, stepMs: number): void {
    if (!Number.isSafeInteger(nowMs) || nowMs < this.simulationTimeMs || nowMs < 0) {
      throw new RangeError('Enemy time must be a monotonic non-negative safe integer.');
    }
    if (!Number.isSafeInteger(stepMs) || stepMs <= 0) {
      throw new RangeError('Enemy step must be a positive safe integer.');
    }
  }

  private assertUsable(): void {
    if (this.disposed) throw new Error('Enemy controller is disposed.');
  }
}

function createVitality(actor: EnemyActorDefinition): CombatVitalitySnapshot {
  const resistances = Object.fromEntries(
    actor.resistances.map(({ damageTypeId, multiplier }) => [damageTypeId, multiplier]),
  );
  return freezeCombatVitality({
    currentHealth: actor.stats.maxHealth,
    maxHealth: actor.stats.maxHealth,
    currentPoise: actor.stats.maxPoise,
    maxPoise: actor.stats.maxPoise,
    armour: actor.stats.armour,
    resistances,
  });
}

function validateProfileTimings(
  profile: AiProfileDefinition,
  attacks: ReadonlyMap<string, AttackDefinition>,
  fixedStepMs: number,
): void {
  for (const pattern of profile.attacks) {
    const attack = attacks.get(pattern.attackId);
    if (attack === undefined) throw new RangeError(`Missing enemy attack: ${pattern.attackId}`);
    const frames = Math.max(
      ...attack.hitboxes.map(({ fromFrame, toFrame }) => toFrame - fromFrame + 1),
    );
    if (
      !Number.isFinite(frames) ||
      frames <= 0 ||
      Math.abs(frames * fixedStepMs - pattern.activeMs) > fixedStepMs
    ) {
      throw new RangeError(
        `Enemy attack timing disagrees with authored frames: ${pattern.attackId}`,
      );
    }
  }
}

function ignored(reason: 'invalid-target' | 'dead' | 'disposed'): CombatImpactResolution {
  return freezeCombatImpactResolution({
    kind: 'ignored',
    reason,
    projectileDisposition: 'continue',
    commands: Object.freeze([]) as readonly [],
  });
}

function assertImpactTime(actual: number, expected: number): void {
  if (!Number.isSafeInteger(actual) || actual !== expected) {
    throw new RangeError('Enemy impacts must use the current fixed combat time.');
  }
}

function checkedDeadline(nowMs: number, durationMs: number): number {
  const deadline = nowMs + durationMs;
  if (!Number.isSafeInteger(deadline))
    throw new RangeError('Enemy deadline exceeds the safe clock range.');
  return deadline;
}

function insideExpanded(position: Vec2, camera: Rect, margin: number): boolean {
  return (
    position.x >= camera.x - margin &&
    position.x < camera.x + camera.width + margin &&
    position.y >= camera.y - margin &&
    position.y < camera.y + camera.height + margin
  );
}

function insideInset(position: Vec2, camera: Rect, inset: number): boolean {
  return (
    position.x >= camera.x + inset &&
    position.x < camera.x + camera.width - inset &&
    position.y >= camera.y + inset &&
    position.y < camera.y + camera.height - inset
  );
}

function rectInside(container: Rect, child: Rect): boolean {
  return (
    child.x >= container.x &&
    child.y >= container.y &&
    child.x + child.width <= container.x + container.width &&
    child.y + child.height <= container.y + container.height
  );
}

function unionCenter(hurtboxes: readonly Rect[]): Vec2 {
  const left = Math.min(...hurtboxes.map(({ x }) => x));
  const top = Math.min(...hurtboxes.map(({ y }) => y));
  const right = Math.max(...hurtboxes.map(({ x, width }) => x + width));
  const bottom = Math.max(...hurtboxes.map(({ y, height }) => y + height));
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

function placeRelative(bounds: Rect, position: Vec2, facing: 'left' | 'right'): Rect {
  return {
    x: facing === 'right' ? position.x + bounds.x : position.x - bounds.x - bounds.width,
    y: position.y + bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function overlaps(left: Rect, right: Rect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function distanceX(left: Vec2, right: Vec2): number {
  return Math.abs(left.x - right.x);
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function assertPoint(point: Vec2, label: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
    throw new RangeError(`${label} must be finite.`);
}

function assertRect(rect: Rect, label: string): void {
  if (
    !Number.isFinite(rect.x) ||
    !Number.isFinite(rect.y) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    throw new RangeError(`${label} must be finite and positive.`);
  }
}
