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
import type { HurtboxTarget } from '../../combat/HitboxSystem';
import { ProjectileSystem } from '../../combat/ProjectileSystem';
import type { ProjectileSnapshot } from '../../combat/ProjectileSystem';
import { stableId } from '../../core/StableId';
import type { CombatantId, TeamId } from '../../core/StableId';
import { ATTACKS } from '../../data/attacks';
import { PALLID_CANTOR_ACTOR } from '../../data/actors';
import {
  PALLID_CANTOR_ENCOUNTER,
  PALLID_CANTOR_LANE_CENTERS,
} from '../../data/bosses/pallidCantor';
import { deepFreeze } from '../../data/immutability';
import type { AttackId, BossPhaseId, MechanismId, Rect, Vec2 } from '../../data/types';
import type { BossId } from '../../saves/SaveSchema';
import type { BossPhaseReason, PallidCantorEvent } from './BossEvents';
import {
  PALLID_CANTOR_ATTACK_PROGRAMS,
  PALLID_CANTOR_PHASE_ONE_ATTACKS,
  PALLID_CANTOR_PHASE_TWO_ATTACKS,
  spearLaneIndices,
  INVERSION_FAN_ZONES,
} from './pallidCantorAttacks';

export const PALLID_CANTOR_STATES = [
  'intro',
  'phaseOne',
  'transition',
  'phaseTwo',
  'stagger',
  'defeat',
] as const;

export type PallidCantorState = (typeof PALLID_CANTOR_STATES)[number];

export type ResonantPulseActivation = Readonly<{
  abilityId: import('../../core/StableId').AbilityId;
  attackId: AttackId;
  ownerId: CombatantId;
  teamId: TeamId;
  origin: Vec2;
  occurredAtMs: number;
  radius: number;
  mechanismTag: 'rootglass-affecting';
}>;

export type PallidCantorTargetSnapshot = Readonly<{
  position: Vec2;
  hurtboxTarget: HurtboxTarget;
}>;

export type PallidCantorPorts = Readonly<{
  readTarget(): PallidCantorTargetSnapshot | null;
  receiveTargetImpact(impact: CombatImpact): CombatImpactResolution;
}>;

export type PallidCantorFrame = Readonly<{
  stepIndex: number;
  nowMs: number;
  stepMs: number;
  pulses: readonly ResonantPulseActivation[];
}>;

export type PallidCantorCommand =
  | Readonly<{ kind: 'arena-lock'; locked: boolean }>
  | Readonly<{ kind: 'attack'; attackId: AttackId; programStep: number }>
  | Readonly<{ kind: 'telegraph'; attackId: AttackId; bounds: readonly Rect[] }>
  | Readonly<{ kind: 'clear-effects' }>
  | Readonly<{ kind: 'enable-lenses' }>
  | Readonly<{ kind: 'lens-activated'; mechanismId: MechanismId }>
  | Readonly<{ kind: 'restore-player-mana-to-maximum' }>
  | Readonly<{ kind: 'camera-cue'; cue: 'intro' | 'combat' | 'heart-opening' | 'release' }>
  | Readonly<{
      kind: 'music-layer';
      layer: 'first-verse' | 'broken-refrain' | 'heart-opening' | 'release';
    }>
  | Readonly<{ kind: 'audio-cue'; cueId: string }>
  | Readonly<{ kind: 'request-defeat-save'; token: number }>;

export type PallidCantorLensSnapshot = Readonly<{
  mechanismId: MechanismId;
  state: 'disabled' | 'dormant' | 'latched';
}>;

export type PallidCantorHazardSnapshot = Readonly<{
  hazardId: string;
  bounds: Rect;
  waveIndex: number;
}>;

export type PallidCantorSnapshot = Readonly<{
  combatantId: CombatantId;
  teamId: TeamId;
  bossId: BossId;
  state: PallidCantorState;
  phaseId: BossPhaseId | null;
  position: Vec2;
  velocity: Vec2;
  facing: 'left' | 'right';
  vitality: CombatVitalitySnapshot;
  targetable: boolean;
  activeAttackId: AttackId | null;
  attackProgramStep: number | null;
  attackPhase: 'pause' | 'telegraph' | 'active' | 'recovery' | null;
  attackCycleIndex: number;
  lenses: readonly PallidCantorLensSnapshot[];
  heartExposed: boolean;
  staggerReason: 'poise-break' | 'parry' | 'lenses-awakened' | null;
  staggerResumeState: 'phaseOne' | 'phaseTwo' | null;
  arenaLocked: boolean;
  transitionElapsedSteps: number;
  defeatElapsedSteps: number;
  defeatSave: 'idle' | 'pending' | 'committed';
  defeatSaveToken: number | null;
  presentationBounds?: readonly Rect[];
  projectiles: readonly ProjectileSnapshot[];
  hazards: readonly PallidCantorHazardSnapshot[];
  activeProjectileCount: number;
  activeHazardCount: number;
  eventSequence: number;
  stepIndex: number;
  simulationTimeMs: number;
  disposed: boolean;
}>;

export type BossFrameResult = Readonly<{
  snapshot: PallidCantorSnapshot;
  commands: readonly PallidCantorCommand[];
}>;

const COMBATANT_ID = stableId<'combatant'>('pallid-cantor-at-hollow-choir');
const TEAM_ID = stableId<'team'>('hostile');
const BOSS_ID = stableId<'boss'>('pallid-cantor');
const FIRST_PHASE = stableId<'boss-phase'>('pallid-cantor-first-verse');
const SECOND_PHASE = stableId<'boss-phase'>('pallid-cantor-broken-refrain');
export class PallidCantorController {
  private state: PallidCantorState = 'intro';
  private position: Vec2 = PALLID_CANTOR_ENCOUNTER.spawnPosition;
  private velocity: Vec2 = Object.freeze({ x: 0, y: 0 });
  private facing: 'left' | 'right' = 'left';
  private vitality = initialVitality();
  private lastStepIndex = 0;
  private simulationTimeMs = 0;
  private stateElapsedSteps = 0;
  private pauseSteps = 0;
  private attackIndex = 0;
  private attackCycleIndex = 0;
  private activeAttackId: AttackId | null = null;
  private attackProgramStep: number | null = null;
  private readonly lenses = new Map<MechanismId, 'disabled' | 'dormant' | 'latched'>(
    PALLID_CANTOR_ENCOUNTER.lenses.map(({ mechanismId }) => [mechanismId, 'disabled']),
  );
  private heartExposed = false;
  private staggerReason: 'poise-break' | 'parry' | 'lenses-awakened' | null = null;
  private staggerResumeState: 'phaseOne' | 'phaseTwo' | null = null;
  private arenaLocked = true;
  private defeatSaveToken: number | null = null;
  private defeatSave: 'idle' | 'pending' | 'committed' = 'idle';
  private nextDefeatToken = 1;
  private nextEventSequence = 1;
  private readonly events: PallidCantorEvent[] = [];
  private readonly projectiles = new ProjectileSystem(PALLID_CANTOR_ENCOUNTER.projectileCapacity);
  private hazards: PallidCantorHazardSnapshot[] = [];
  private contactedThisAttack = false;
  private disposed = false;

  public constructor(
    private readonly ports: PallidCantorPorts,
    baseline: Readonly<{ stepIndex: number; simulationTimeMs: number }> = {
      stepIndex: 0,
      simulationTimeMs: 0,
    },
  ) {
    if (
      !Number.isSafeInteger(baseline.stepIndex) ||
      baseline.stepIndex < 0 ||
      !Number.isSafeInteger(baseline.simulationTimeMs) ||
      baseline.simulationTimeMs < 0
    ) {
      throw new RangeError('Boss baseline is invalid.');
    }
    this.lastStepIndex = baseline.stepIndex;
    this.simulationTimeMs = baseline.simulationTimeMs;
    this.queueIntro();
  }

  public identity(): Readonly<{ combatantId: CombatantId; teamId: TeamId; bossId: BossId }> {
    return Object.freeze({ combatantId: COMBATANT_ID, teamId: TEAM_ID, bossId: BOSS_ID });
  }

  public update(frame: PallidCantorFrame): BossFrameResult {
    this.assertFrame(frame);
    if (this.disposed) return deepFreeze({ snapshot: this.snapshot(), commands: [] });
    this.lastStepIndex = frame.stepIndex;
    this.simulationTimeMs = frame.nowMs;
    const commands: PallidCantorCommand[] = [];
    if (this.state === 'phaseTwo' && !this.heartExposed) this.applyPulses(frame.pulses, commands);
    if (this.state !== 'defeat') this.advanceProjectiles(frame.nowMs);
    this.advanceState(commands);
    this.stateElapsedSteps += 1;
    return deepFreeze({ snapshot: this.snapshot(), commands });
  }

  public snapshot(): PallidCantorSnapshot {
    return deepFreeze({
      combatantId: COMBATANT_ID,
      teamId: TEAM_ID,
      bossId: BOSS_ID,
      state: this.state,
      phaseId: this.phaseId(),
      position: this.position,
      velocity: this.velocity,
      facing: this.facing,
      vitality: this.vitality,
      targetable: this.hurtboxTarget().hurtboxes.length > 0,
      activeAttackId: this.activeAttackId,
      attackProgramStep: this.attackProgramStep,
      attackPhase: this.attackPhase(),
      attackCycleIndex: this.attackCycleIndex,
      lenses: PALLID_CANTOR_ENCOUNTER.lenses.map(({ mechanismId }) => ({
        mechanismId,
        state: this.lenses.get(mechanismId) ?? 'disabled',
      })),
      heartExposed: this.heartExposed,
      staggerReason: this.staggerReason,
      staggerResumeState: this.staggerResumeState,
      arenaLocked: this.arenaLocked,
      transitionElapsedSteps: this.state === 'transition' ? this.stateElapsedSteps : 0,
      defeatElapsedSteps: this.state === 'defeat' ? this.stateElapsedSteps : 0,
      defeatSave: this.defeatSave,
      defeatSaveToken: this.defeatSaveToken,
      presentationBounds: this.presentationBounds(),
      projectiles: this.projectiles.snapshot(),
      hazards: this.hazards,
      activeProjectileCount: this.projectiles.snapshot().length,
      activeHazardCount: this.hazards.length,
      eventSequence: this.nextEventSequence - 1,
      stepIndex: this.lastStepIndex,
      simulationTimeMs: this.simulationTimeMs,
      disposed: this.disposed,
    });
  }

  public hurtboxTarget(): HurtboxTarget {
    const local = this.currentHurtbox();
    return deepFreeze({
      targetId: COMBATANT_ID,
      teamId: TEAM_ID,
      hurtboxes: local === null ? [] : [place(local, this.position, this.facing)],
    });
  }

  public receiveImpact(rawImpact: CombatImpact): CombatImpactResolution {
    const impact = freezeCombatImpact(rawImpact);
    if (this.disposed) return ignored('disposed');
    if (impact.targetId !== COMBATANT_ID) return ignored('invalid-target');
    if (impact.occurredAtMs !== this.simulationTimeMs) {
      throw new RangeError('Boss impact time must equal the authoritative fixed time.');
    }
    if (this.state === 'defeat') return ignored('dead');
    const hurtbox = this.currentHurtbox();
    if (hurtbox === null) return ignored('invulnerable');
    if (this.state === 'phaseTwo' && !this.heartExposed)
      return sealedResolution(impact, this.vitality);

    const previousHealth = this.vitality.currentHealth;
    const rawDamage = resolveDamage(impact.damage, {
      armour: this.vitality.armour,
      resistances: this.vitality.resistances,
      currentPoise: this.vitality.currentPoise,
      guard: { kind: 'none' },
    });
    const floor = this.state === 'phaseOne' ? 210 : 0;
    const appliedHealth = Math.min(rawDamage.healthDamage, Math.max(0, previousHealth - floor));
    const damage = Object.freeze({ ...rawDamage, healthDamage: appliedHealth });
    const remainingHealth = previousHealth - appliedHealth;
    const remainingPoise = damage.remainingPoise ?? this.vitality.currentPoise;
    this.vitality = freezeCombatVitality({
      ...this.vitality,
      currentHealth: remainingHealth,
      currentPoise: remainingPoise,
    });
    const defeated = remainingHealth === 0;
    const resolution = freezeCombatImpactResolution({
      kind: 'resolved',
      guard: 'none',
      manaSpent: 0,
      damage,
      remainingHealth,
      remainingPoise,
      staggered: damage.staggered,
      defeated,
      projectileDisposition: impact.projectile === null ? 'continue' : 'consume',
      commands: Object.freeze([]),
    });
    if (appliedHealth > 0) this.queueHealth(appliedHealth * -1, true);
    if (this.state === 'phaseOne' && remainingHealth === 210) {
      this.enterTransition();
    } else if (defeated && this.heartExposed) {
      this.enterDefeat();
    } else if (damage.staggered) {
      this.enterStagger('poise-break');
    }
    return resolution;
  }

  public applyResolutionCommand(command: CombatResolutionCommand, occurredAtMs: number): boolean {
    if (occurredAtMs !== this.simulationTimeMs)
      throw new RangeError('Boss command time is invalid.');
    if (this.disposed || command.kind !== 'punish-attacker' || this.state === 'defeat')
      return false;
    this.enterStagger('parry');
    return true;
  }

  public confirmDefeatSaved(token: number, savedAtEpochMs: number): boolean {
    if (
      this.disposed ||
      this.state !== 'defeat' ||
      this.defeatSave !== 'pending' ||
      token !== this.defeatSaveToken ||
      !Number.isSafeInteger(savedAtEpochMs) ||
      savedAtEpochMs <= 0
    ) {
      return false;
    }
    this.defeatSave = 'committed';
    return true;
  }

  public drainEvents(): readonly PallidCantorEvent[] {
    const drained = deepFreeze([...this.events]);
    this.events.length = 0;
    return drained;
  }

  public resetForRespawn(
    baseline: Readonly<{ stepIndex: number; simulationTimeMs: number }> = {
      stepIndex: 0,
      simulationTimeMs: 0,
    },
  ): boolean {
    if (this.disposed) return false;
    if (
      !Number.isSafeInteger(baseline.stepIndex) ||
      baseline.stepIndex < 0 ||
      !Number.isSafeInteger(baseline.simulationTimeMs) ||
      baseline.simulationTimeMs < 0
    ) {
      throw new RangeError('Boss reset baseline is invalid.');
    }
    this.state = 'intro';
    this.position = PALLID_CANTOR_ENCOUNTER.spawnPosition;
    this.velocity = Object.freeze({ x: 0, y: 0 });
    this.facing = 'left';
    this.vitality = initialVitality();
    this.lastStepIndex = baseline.stepIndex;
    this.simulationTimeMs = baseline.simulationTimeMs;
    this.stateElapsedSteps = 0;
    this.pauseSteps = 0;
    this.attackIndex = 0;
    this.attackCycleIndex = 0;
    this.activeAttackId = null;
    this.attackProgramStep = null;
    for (const { mechanismId } of PALLID_CANTOR_ENCOUNTER.lenses)
      this.lenses.set(mechanismId, 'disabled');
    this.heartExposed = false;
    this.staggerReason = null;
    this.staggerResumeState = null;
    this.arenaLocked = true;
    this.defeatSaveToken = null;
    this.defeatSave = 'idle';
    this.nextDefeatToken = 1;
    this.nextEventSequence = 1;
    this.events.length = 0;
    this.projectiles.clear();
    this.hazards = [];
    this.contactedThisAttack = false;
    this.queueIntro();
    return true;
  }

  public dispose(): boolean {
    if (this.disposed) return false;
    this.disposed = true;
    this.projectiles.dispose();
    this.hazards = [];
    this.events.length = 0;
    this.activeAttackId = null;
    this.attackProgramStep = null;
    return true;
  }

  private assertFrame(frame: PallidCantorFrame): void {
    if (
      !Number.isSafeInteger(frame.stepIndex) ||
      frame.stepIndex !== this.lastStepIndex + 1 ||
      !Number.isSafeInteger(frame.nowMs) ||
      frame.nowMs <= this.simulationTimeMs ||
      !Number.isSafeInteger(frame.stepMs) ||
      frame.stepMs <= 0 ||
      frame.nowMs - this.simulationTimeMs !== frame.stepMs
    ) {
      throw new RangeError('Boss frame must advance one contiguous fixed step.');
    }
  }

  private advanceState(commands: PallidCantorCommand[]): void {
    if (this.state === 'intro') {
      if (this.stateElapsedSteps + 1 === 144) {
        this.changeState('phaseOne', 'encounter-start');
        this.pauseSteps = 24;
        commands.push(
          { kind: 'camera-cue', cue: 'combat' },
          { kind: 'music-layer', layer: 'first-verse' },
        );
        this.queueHealth(0, true);
      }
      return;
    }
    if (this.state === 'transition') {
      if (this.stateElapsedSteps + 1 === 108) {
        this.position = PALLID_CANTOR_ENCOUNTER.phaseTwoBaseline;
        for (const { mechanismId } of PALLID_CANTOR_ENCOUNTER.lenses)
          this.lenses.set(mechanismId, 'dormant');
        this.changeState('phaseTwo', 'transition-complete');
        this.pauseSteps = 24;
        commands.push(
          { kind: 'enable-lenses' },
          { kind: 'restore-player-mana-to-maximum' },
          { kind: 'music-layer', layer: 'broken-refrain' },
        );
      }
      return;
    }
    if (this.state === 'stagger') {
      const duration = this.staggerReason === 'lenses-awakened' ? 300 : 72;
      if (this.stateElapsedSteps + 1 === duration) {
        const resume = this.staggerResumeState ?? 'phaseTwo';
        this.vitality = freezeCombatVitality({ ...this.vitality, currentPoise: 84 });
        this.changeState(resume, 'stagger-complete');
        this.staggerReason = null;
        this.staggerResumeState = null;
        this.pauseSteps = 24;
        if (resume === 'phaseTwo') commands.push({ kind: 'music-layer', layer: 'broken-refrain' });
      }
      return;
    }
    if (this.state === 'defeat') {
      if (this.stateElapsedSteps === 0 && this.defeatSaveToken !== null) {
        commands.push(
          { kind: 'clear-effects' },
          { kind: 'music-layer', layer: 'release' },
          { kind: 'request-defeat-save', token: this.defeatSaveToken },
        );
      }
      if (
        this.stateElapsedSteps + 1 >= 132 &&
        this.defeatSave === 'committed' &&
        this.arenaLocked
      ) {
        this.arenaLocked = false;
        commands.push(
          { kind: 'arena-lock', locked: false },
          { kind: 'camera-cue', cue: 'release' },
        );
      }
      return;
    }
    this.advanceAttack(commands);
  }

  private advanceAttack(commands: PallidCantorCommand[]): void {
    if (this.pauseSteps > 0) {
      this.pauseSteps -= 1;
      return;
    }
    const cycle =
      this.state === 'phaseOne' ? PALLID_CANTOR_PHASE_ONE_ATTACKS : PALLID_CANTOR_PHASE_TWO_ATTACKS;
    if (this.activeAttackId === null) {
      this.activeAttackId = cycle[this.attackIndex]!;
      this.attackProgramStep = 0;
      this.contactedThisAttack = false;
      this.faceTarget();
    }
    const program = PALLID_CANTOR_ATTACK_PROGRAMS.find(
      ({ attackId }) => attackId === this.activeAttackId,
    )!;
    const step = this.attackProgramStep ?? 0;
    commands.push({ kind: 'attack', attackId: program.attackId, programStep: step });
    if (program.telegraph.some(({ from, to }) => step >= from && step <= to)) {
      commands.push({
        kind: 'telegraph',
        attackId: program.attackId,
        bounds: this.telegraphBounds(program.attackId, step),
      });
    }
    if (program.emissions.includes(step)) this.emitProgramEffect(program.attackId, step);
    if (program.active.some(({ from }) => step === from)) this.contactedThisAttack = false;
    if (program.active.some(({ from, to }) => step >= from && step <= to))
      this.applyLocalAttack(program.attackId, step);
    if (step + 1 >= program.totalSteps) {
      this.activeAttackId = null;
      this.attackProgramStep = null;
      this.hazards = [];
      this.attackIndex += 1;
      if (this.attackIndex >= cycle.length) {
        this.attackIndex = 0;
        this.attackCycleIndex += 1;
      }
      this.pauseSteps = 24;
    } else {
      this.attackProgramStep = step + 1;
    }
  }

  private applyPulses(
    pulses: readonly ResonantPulseActivation[],
    commands: PallidCantorCommand[],
  ): void {
    for (const pulse of pulses) {
      if (
        pulse.abilityId !== 'resonant-pulse' ||
        pulse.attackId !== 'resonant-pulse-wave' ||
        pulse.teamId !== 'player' ||
        pulse.mechanismTag !== 'rootglass-affecting' ||
        pulse.occurredAtMs > this.simulationTimeMs
      )
        continue;
      const lens = PALLID_CANTOR_ENCOUNTER.lenses.find(
        ({ mechanismId, center, activationRadius }) =>
          this.lenses.get(mechanismId) === 'dormant' &&
          distance(center, pulse.origin) <= activationRadius + pulse.radius,
      );
      if (lens === undefined) continue;
      this.lenses.set(lens.mechanismId, 'latched');
      commands.push({ kind: 'lens-activated', mechanismId: lens.mechanismId });
    }
    if ([...this.lenses.values()].every((state) => state === 'latched')) {
      this.heartExposed = true;
      this.clearEffects();
      this.position = PALLID_CANTOR_ENCOUNTER.spawnPosition;
      this.enterStagger('lenses-awakened');
      this.queueHealth(0, true);
      commands.push(
        { kind: 'clear-effects' },
        { kind: 'camera-cue', cue: 'heart-opening' },
        { kind: 'music-layer', layer: 'heart-opening' },
      );
    }
  }

  private emitProgramEffect(attackId: AttackId, step: number): void {
    if (attackId === 'pallid-cantor-note-volley' || attackId === 'pallid-cantor-note-chain') {
      this.emitProjectile(attackId, step);
      return;
    }
    if (attackId === 'pallid-cantor-spearfall' || attackId === 'pallid-cantor-spear-cascade') {
      const waveIndex = attackId === 'pallid-cantor-spear-cascade' ? [30, 54, 78].indexOf(step) : 0;
      const rotation = this.attackCycleIndex + Math.max(0, waveIndex);
      this.hazards = spearLaneIndices(rotation).map((index) => ({
        hazardId: `${attackId}-hazard-${waveIndex}-${index}`,
        bounds: { x: PALLID_CANTOR_LANE_CENTERS[index]! - 56, y: 180, width: 112, height: 720 },
        waveIndex,
      }));
    }
  }

  private emitProjectile(attackId: AttackId, step: number): void {
    const target = this.ports.readTarget();
    if (target === null) return;
    const definition = ATTACKS.find((attack) => attack.attackId === attackId)!;
    const chain = attackId === 'pallid-cantor-note-chain';
    const origin = {
      x: this.position.x + (this.facing === 'right' ? (chain ? 48 : 58) : chain ? -48 : -58),
      y: this.position.y - (chain ? 190 : 220),
    };
    const center = targetCenter(target.hurtboxTarget) ?? target.position;
    const base = normalize({ x: center.x - origin.x, y: center.y - origin.y }, chain ? 400 : 360);
    const emission = chain ? [24, 33, 42, 51, 60].indexOf(step) : [30, 40, 50].indexOf(step);
    const degrees = chain ? [0, -8, 8, -12, 12][emission]! : [-10, 0, 10][emission]!;
    const velocity = rotate(base, degrees);
    this.projectiles.spawnDirected(
      {
        projectileId: stableId<'projectile'>(
          chain ? 'pallid-cantor-note-chain-projectile' : 'pallid-cantor-note-volley-projectile',
        ),
        attackId,
        ownerId: COMBATANT_ID,
        teamId: TEAM_ID,
        velocity,
        lifetimeMs: chain ? 4000 : 4500,
        bounds: { x: -9, y: -9, width: 18, height: 18 },
        delivery: definition.delivery,
        damage: definition.damage,
        knockback: definition.knockback,
        hitStopMs: definition.hitStopMs,
        tags: definition.tags,
      },
      origin,
      this.facing,
      this.simulationTimeMs,
    );
  }

  private advanceProjectiles(nowMs: number): void {
    const target = this.ports.readTarget();
    const result = this.projectiles.step(nowMs, target === null ? [] : [target.hurtboxTarget]);
    for (const impact of result.impacts) {
      const resolution = this.ports.receiveTargetImpact(impact);
      if (resolution.projectileDisposition === 'consume' && impact.projectile !== null) {
        this.projectiles.consume(impact.projectile.instanceId);
      }
      for (const command of resolution.commands) this.applyResolutionCommand(command, nowMs);
    }
  }

  private applyLocalAttack(attackId: AttackId, step: number): void {
    if (this.contactedThisAttack) return;
    const target = this.ports.readTarget();
    const definition = ATTACKS.find((attack) => attack.attackId === attackId);
    if (target === null || definition === undefined) return;
    const regions = this.attackRegions(attackId, step, false);
    if (
      !target.hurtboxTarget.hurtboxes.some((bounds) =>
        regions.some((region) => overlaps(region, bounds)),
      )
    )
      return;
    this.contactedThisAttack = true;
    const impact = freezeCombatImpact({
      attackId,
      targetId: target.hurtboxTarget.targetId,
      source: {
        ownerId: COMBATANT_ID,
        teamId: TEAM_ID,
        position: this.position,
        facing: this.facing,
      },
      occurredAtMs: this.simulationTimeMs,
      delivery: definition.delivery,
      damage: definition.damage,
      knockback: definition.knockback,
      hitStopMs: definition.hitStopMs,
      tags: definition.tags,
      projectile: null,
    });
    const resolution = this.ports.receiveTargetImpact(impact);
    for (const command of resolution.commands)
      this.applyResolutionCommand(command, this.simulationTimeMs);
  }

  private presentationBounds(): readonly Rect[] {
    const attackId = this.activeAttackId;
    const phase = this.attackPhase();
    if (attackId === null || (phase !== 'telegraph' && phase !== 'active')) return [];
    const step = this.attackProgramStep ?? 0;
    return this.attackRegions(attackId, step, phase === 'telegraph');
  }

  private attackRegions(attackId: AttackId, step: number, warning: boolean): readonly Rect[] {
    if (attackId === 'pallid-cantor-inversion-fan')
      return step < 42 ? INVERSION_FAN_ZONES.slice(0, 2) : INVERSION_FAN_ZONES.slice(2);
    const lanes = this.telegraphBounds(attackId, step);
    if (lanes.length > 0) return lanes;
    const definition = ATTACKS.find((attack) => attack.attackId === attackId);
    return (definition?.hitboxes ?? [])
      .filter((box) => warning || (step >= box.fromFrame && step <= box.toFrame))
      .map((box) => place(box.bounds, this.position, this.facing));
  }

  private telegraphBounds(attackId: AttackId, step: number): readonly Rect[] {
    if (attackId === 'pallid-cantor-spearfall' || attackId === 'pallid-cantor-spear-cascade') {
      const wave =
        attackId === 'pallid-cantor-spear-cascade' ? (step < 36 ? 0 : step < 60 ? 1 : 2) : 0;
      return spearLaneIndices(this.attackCycleIndex + wave).map((index) => ({
        x: PALLID_CANTOR_LANE_CENTERS[index]! - 56,
        y: 180,
        width: 112,
        height: 720,
      }));
    }
    return Object.freeze([]);
  }

  private faceTarget(): void {
    const target = this.ports.readTarget();
    if (target !== null) this.facing = target.position.x >= this.position.x ? 'right' : 'left';
  }

  private enterTransition(): void {
    const previous = this.state;
    this.clearEffects();
    this.state = 'transition';
    this.stateElapsedSteps = 0;
    this.queuePhase(previous, 'health-threshold');
  }

  private enterStagger(reason: 'poise-break' | 'parry' | 'lenses-awakened'): void {
    const previous = this.state;
    const resume = previous === 'phaseOne' ? 'phaseOne' : 'phaseTwo';
    this.clearEffects();
    this.state = 'stagger';
    this.stateElapsedSteps = 0;
    this.staggerReason = reason;
    this.staggerResumeState = resume;
    this.queuePhase(previous, reason);
  }

  private enterDefeat(): void {
    const previous = this.state;
    this.clearEffects();
    this.state = 'defeat';
    this.stateElapsedSteps = 0;
    this.defeatSaveToken = this.nextDefeatToken;
    this.nextDefeatToken += 1;
    this.defeatSave = 'pending';
    this.queuePhase(previous, 'lethal');
  }

  private changeState(next: PallidCantorState, reason: BossPhaseReason): void {
    const previous = this.state;
    this.state = next;
    this.stateElapsedSteps = 0;
    this.queuePhase(previous, reason);
  }

  private clearEffects(): void {
    this.projectiles.clear();
    this.hazards = [];
    this.activeAttackId = null;
    this.attackProgramStep = null;
    this.contactedThisAttack = false;
  }

  private currentHurtbox(): Rect | null {
    if (this.state === 'intro' || this.state === 'transition' || this.state === 'defeat')
      return null;
    if (
      this.state === 'phaseTwo' ||
      (this.state === 'stagger' && this.staggerResumeState === 'phaseTwo')
    ) {
      return this.heartExposed
        ? PALLID_CANTOR_ENCOUNTER.exposedHeartHurtbox
        : PALLID_CANTOR_ENCOUNTER.sealedShellHurtbox;
    }
    return PALLID_CANTOR_ENCOUNTER.groundedHurtbox;
  }

  private phaseId(): BossPhaseId | null {
    if (this.state === 'phaseOne') return FIRST_PHASE;
    if (this.state === 'phaseTwo') return SECOND_PHASE;
    if (this.state === 'stagger')
      return this.staggerResumeState === 'phaseOne' ? FIRST_PHASE : SECOND_PHASE;
    return null;
  }

  private attackPhase(): PallidCantorSnapshot['attackPhase'] {
    if (this.activeAttackId === null || this.attackProgramStep === null)
      return this.pauseSteps > 0 ? 'pause' : null;
    const program = PALLID_CANTOR_ATTACK_PROGRAMS.find(
      ({ attackId }) => attackId === this.activeAttackId,
    )!;
    if (
      program.telegraph.some(
        ({ from, to }) => this.attackProgramStep! >= from && this.attackProgramStep! <= to,
      )
    )
      return 'telegraph';
    if (
      program.active.some(
        ({ from, to }) => this.attackProgramStep! >= from && this.attackProgramStep! <= to,
      )
    )
      return 'active';
    return 'recovery';
  }

  private queueIntro(): void {
    this.events.push(
      deepFreeze({
        sequence: this.nextEventSequence++,
        bossId: BOSS_ID,
        actorId: stableId<'actor'>('pallid-cantor'),
        roomId: stableId<'room'>('hollow-choir-arena'),
        displayName: 'The Pallid Cantor',
        currentHealth: 420,
        maxHealth: 420,
        healthBarVisible: false,
      }),
    );
  }

  private queuePhase(previousState: PallidCantorState, reason: BossPhaseReason): void {
    this.events.push(
      deepFreeze({
        sequence: this.nextEventSequence++,
        bossId: BOSS_ID,
        previousState,
        state: this.state,
        phaseId: this.phaseId(),
        reason,
        heartExposed: this.heartExposed,
      }),
    );
  }

  private queueHealth(delta: number, visible: boolean): void {
    this.events.push(
      deepFreeze({
        sequence: this.nextEventSequence++,
        bossId: BOSS_ID,
        displayName: 'The Pallid Cantor',
        currentHealth: this.vitality.currentHealth,
        maxHealth: 420,
        ratio: Math.max(0, Math.min(1, this.vitality.currentHealth / 420)),
        currentPoise: this.vitality.currentPoise,
        maxPoise: 84,
        heartExposed: this.heartExposed,
        visible,
        delta,
      }),
    );
  }
}

function initialVitality(): CombatVitalitySnapshot {
  const boss = PALLID_CANTOR_ACTOR.kind === 'boss' ? PALLID_CANTOR_ACTOR : null;
  if (boss === null) throw new Error('Pallid Cantor actor is missing.');
  return freezeCombatVitality({
    currentHealth: 420,
    maxHealth: 420,
    currentPoise: 84,
    maxPoise: 84,
    armour: boss.stats.armour,
    resistances: Object.freeze(
      Object.fromEntries(
        boss.resistances.map(({ damageTypeId, multiplier }) => [damageTypeId, multiplier]),
      ),
    ),
  });
}

function place(bounds: Rect, position: Vec2, facing: 'left' | 'right'): Rect {
  return facing === 'right'
    ? {
        x: position.x + bounds.x,
        y: position.y + bounds.y,
        width: bounds.width,
        height: bounds.height,
      }
    : {
        x: position.x - bounds.x - bounds.width,
        y: position.y + bounds.y,
        width: bounds.width,
        height: bounds.height,
      };
}

function sealedResolution(
  impact: CombatImpact,
  vitality: CombatVitalitySnapshot,
): CombatImpactResolution {
  return freezeCombatImpactResolution({
    kind: 'resolved',
    guard: 'none',
    manaSpent: 0,
    damage: {
      healthDamage: 0,
      poiseDamage: 0,
      remainingPoise: vitality.currentPoise,
      staggered: false,
      critical: false,
      parried: false,
    },
    remainingHealth: vitality.currentHealth,
    remainingPoise: vitality.currentPoise,
    staggered: false,
    defeated: false,
    projectileDisposition: impact.projectile === null ? 'continue' : 'consume',
    commands: Object.freeze([]),
  });
}

function ignored(
  reason: 'invulnerable' | 'invalid-target' | 'dead' | 'disposed',
): CombatImpactResolution {
  return freezeCombatImpactResolution({
    kind: 'ignored',
    reason,
    projectileDisposition: 'continue',
    commands: Object.freeze([]) as readonly [],
  });
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}
function normalize(vector: Vec2, speed: number): Vec2 {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) return { x: speed, y: 0 };
  return { x: (vector.x / length) * speed, y: (vector.y / length) * speed };
}
function rotate(vector: Vec2, degrees: number): Vec2 {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: vector.x * Math.cos(radians) - vector.y * Math.sin(radians),
    y: vector.x * Math.sin(radians) + vector.y * Math.cos(radians),
  };
}
function targetCenter(target: HurtboxTarget): Vec2 | null {
  const first = target.hurtboxes[0];
  return first === undefined
    ? null
    : { x: first.x + first.width / 2, y: first.y + first.height / 2 };
}
function overlaps(left: Rect, right: Rect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}
