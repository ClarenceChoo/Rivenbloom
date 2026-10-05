import { equippedCharmEffects } from '../../inventory/CharmRules';
import { difficultyHealthDamage } from '../../combat/DifficultyRules';
import type { SaveSettings } from '../../saves/SaveSchema';
import type { Rect, SurfaceDefinition, Vec2, ZoneDefinition } from '../../data/types';
import { isStableId, stableId } from '../../core/StableId';
import type { AbilityId, CombatantId, DamageTypeId, TeamId } from '../../core/StableId';
import type { InputService } from '../../input/InputService';
import { DEFAULT_SAVE_SETTINGS } from '../../saves/SaveSchema';
import type { RoomId } from '../../saves/SaveSchema';
import {
  DEFAULT_MOVEMENT_TUNING,
  createMovementState,
  stepMovement,
} from '../../physics/MovementModel';
import type {
  MovementInput,
  MovementState,
  MovementStep,
  MovementTuning,
} from '../../physics/MovementModel';
import { resolvePlatformContacts } from '../../physics/PlatformRules';
import { PlayerStateMachine } from './PlayerState';
import type { PlayerState } from './PlayerState';
import { PlayerCombatRuntime } from './PlayerCombatRuntime';
import type {
  PlayerCombatRuntimeEvent,
  PlayerCombatRuntimeOptions,
  PlayerCombatRuntimeSnapshot,
} from './PlayerCombatRuntime';
import {
  freezeCombatImpact,
  freezeCombatImpactResolution,
  freezeCombatVitality,
} from '../../combat/CombatImpact';
import type {
  CombatImpact,
  CombatImpactResolution,
  CombatVitalitySnapshot,
} from '../../combat/CombatImpact';
import { resolveGuardImpact } from '../../combat/GuardResolver';
import type { GuardResolution } from '../../combat/GuardResolver';
import { resolveDamage } from '../../combat/DamageResolver';

export type PlayerControllerOptions = Readonly<{
  input: InputService;
  roomId?: RoomId;
  position: Vec2;
  surfaces: readonly SurfaceDefinition[];
  zones: readonly ZoneDefinition[];
  tuning?: MovementTuning;
  bodyHalfWidth?: number;
  bodyHeight?: number;
  movementBounds?: Rect;
  combat?: PlayerCombatRuntimeOptions;
  vitals?: PlayerVitalOptions;
  fixedStepObserver?: PlayerFixedStepObserver;
}>;

export type PlayerRoomBinding = Readonly<{
  roomId: RoomId;
  position: Vec2;
  facing: 'left' | 'right';
  surfaces: readonly SurfaceDefinition[];
  zones: readonly ZoneDefinition[];
  movementBounds: Rect;
}>;

export type PlayerFixedStepFrame = Readonly<{
  stepIndex: number;
  startTimeMs: number;
  endTimeMs: number;
  stepMs: number;
  player: PlayerControllerSnapshot;
  target: import('../../combat/HitboxSystem').HurtboxTarget;
  combatEvents: readonly PlayerCombatRuntimeEvent[];
  input: Readonly<{
    move: Vec2;
    interactBufferId: number | null;
    pauseBufferId?: number | null;
    pausePressed?: boolean;
  }>;
}>;

export type PlayerFixedStepObserverResult = Readonly<{ halt: boolean }>;
export type PlayerFixedStepObserver = (
  frame: PlayerFixedStepFrame,
) => PlayerFixedStepObserverResult | void;

export type PlayerVitalOptions = Readonly<{
  currentHealth: number;
  maxHealth: number;
  maxPoise: number;
  armour: number;
  resistances: Readonly<Partial<Record<DamageTypeId, number>>>;
}>;

export type RuntimeCheckpointResources = Readonly<{
  currentHealth: number;
  currentMana: number;
}>;

export type PlayerControllerSnapshot = Readonly<{
  roomId: RoomId;
  stepIndex: number;
  position: Vec2;
  velocity: Vec2;
  state: PlayerState;
  grounded: boolean;
  animationIntent: MovementStep['animationIntent'];
  pendingSimulationSeconds: number;
  coyoteRemaining: number;
  dropThroughRemaining: number;
  knockbackRemaining: number;
  climbEngaged: boolean;
  climbAvailable: boolean;
  climbDetachRemaining: number;
  landingLockRemaining: number;
  combatSimulationTimeMs: number;
  combat: PlayerCombatRuntimeSnapshot;
  vitality: CombatVitalitySnapshot;
}>;

const MAX_SUBSTEPS_PER_UPDATE = 8;
export const PLAYER_HURT_RECOVERY_SECONDS = 0.2;
export const PLAYER_POST_HIT_PROTECTION_MS = 900;
const DEFAULT_PLAYER_VITALS: PlayerVitalOptions = Object.freeze({
  currentHealth: 100,
  maxHealth: 100,
  maxPoise: 40,
  armour: 3,
  resistances: Object.freeze({}),
});

export class PlayerController {
  private movement: MovementState;
  private readonly stateMachine = new PlayerStateMachine('idle');
  private readonly tuning: MovementTuning;
  private readonly bodyHalfWidth: number;
  private readonly bodyHeight: number;
  private settings: SaveSettings = DEFAULT_SAVE_SETTINGS;
  private charms = equippedCharmEffects([]);
  private baseInvulnerableUntil = 0;
  private charmInvulnerableUntil = 0;
  private maximumMana = 40;
  private readonly combat: PlayerCombatRuntime;
  private readonly ownerId: CombatantId;
  private readonly teamId: TeamId;
  private vitality: CombatVitalitySnapshot;
  private pendingSeconds = 0;
  private animationIntent: MovementStep['animationIntent'] = 'idle';
  private combatStepIndex = 0;
  private combatSimulationTimeMs = 0;
  private facing: 'left' | 'right';
  private lightBufferId: number | null = null;
  private dashBufferId: number | null = null;
  private castBufferId: number | null = null;
  private pendingHeavyPressed = false;
  private pendingHeavyReleased = false;
  private pendingBlockPressed = false;
  private interactionReturnState: PlayerState = 'idle';
  private readonly pendingCombatEvents: PlayerCombatRuntimeEvent[] = [];
  private roomId: RoomId;
  private surfaces: readonly SurfaceDefinition[];
  private zones: readonly ZoneDefinition[];
  private movementBounds: Rect | undefined;
  private disposed = false;

  public constructor(private readonly options: PlayerControllerOptions) {
    this.tuning = options.tuning ?? DEFAULT_MOVEMENT_TUNING;
    this.bodyHalfWidth = options.bodyHalfWidth ?? 24;
    this.bodyHeight = options.bodyHeight ?? 96;
    this.roomId =
      options.roomId ??
      options.surfaces[0]?.roomId ??
      options.zones[0]?.roomId ??
      stableId<'room'>('runtime-room');
    this.surfaces = freezeSurfaces(options.surfaces);
    this.zones = freezeZones(options.zones);
    this.movementBounds =
      options.movementBounds === undefined ? undefined : freezeRect(options.movementBounds);
    this.movement = this.createSupportedMovement(options.position);
    const combatOptions =
      options.combat ??
      Object.freeze({
        currentMana: 0,
        unlockedAbilityIds: Object.freeze([]),
        initialFacing: 'right' as const,
        settings: DEFAULT_SAVE_SETTINGS,
        targets: () => Object.freeze([]),
      });
    this.combat = new PlayerCombatRuntime(combatOptions);
    this.settings = combatOptions.settings;
    const identity = this.combat.identity();
    this.ownerId = identity.ownerId;
    this.teamId = identity.teamId;
    this.vitality = createVitality(options.vitals ?? DEFAULT_PLAYER_VITALS);
    this.facing = combatOptions.initialFacing;
    if (this.vitality.currentHealth === 0) {
      this.stateMachine.request('dead', 'external');
      this.combat.interrupt('dead', this.combatSimulationTimeMs);
      this.options.input.clearLatch('attack-heavy');
      this.options.input.clearLatch('block');
      this.clearPendingCombatInput();
    }
  }

  private createSupportedMovement(position: Vec2): MovementState {
    const initial = createMovementState(position);
    const contacts = resolvePlatformContacts(position, position, this.surfaces, this.zones, {
      bodyHalfWidth: this.bodyHalfWidth,
      bodyHeight: this.bodyHeight,
      ignoreOneWay: false,
    });
    return Object.freeze({
      ...initial,
      grounded: contacts.groundY !== null,
      coyoteRemaining: contacts.groundY === null ? 0 : this.tuning.coyoteSeconds,
    });
  }

  public update(nowMs: number, elapsedSeconds: number): PlayerControllerSnapshot {
    if (this.disposed) throw new Error('Player controller is disposed.');
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      throw new RangeError('Player elapsed time must be finite and non-negative.');
    }
    const frame = this.options.input.sample(nowMs);
    if (
      frame.actions['cycle-ability'].pressed &&
      this.stateMachine.current !== 'dead' &&
      this.stateMachine.current !== 'interact'
    ) {
      this.combat.cycleSelectedAbility();
    }
    this.pendingSeconds += elapsedSeconds;
    const fixedStep = this.tuning.maxStepSeconds;
    const availableSteps = Math.floor((this.pendingSeconds + Number.EPSILON) / fixedStep);
    const stepCount = Math.min(availableSteps, MAX_SUBSTEPS_PER_UPDATE);
    let jumpBufferId = frame.actions.jump.bufferedPressId;
    this.lightBufferId = frame.actions['attack-light'].bufferedPressId;
    this.dashBufferId = frame.actions.dash.bufferedPressId;
    this.castBufferId = frame.actions.cast.bufferedPressId;
    this.pendingHeavyPressed ||= frame.actions['attack-heavy'].pressed;
    this.pendingHeavyReleased ||= frame.actions['attack-heavy'].released;
    this.pendingBlockPressed ||= frame.actions.block.pressed;
    let rawEdgesPending = true;
    for (let index = 0; index < stepCount; index += 1) {
      const nextCombatStepIndex = this.combatStepIndex + 1;
      const nextCombatTimeMs = Math.round(nextCombatStepIndex * fixedStep * 1_000);
      if (
        !Number.isSafeInteger(nextCombatTimeMs) ||
        nextCombatTimeMs <= this.combatSimulationTimeMs
      ) {
        throw new RangeError('Fixed combat clock exceeded its supported range.');
      }
      const stepMs = nextCombatTimeMs - this.combatSimulationTimeMs;
      if (this.combat.consumeHitStop(stepMs)) continue;
      const combatNowMs = this.combatSimulationTimeMs;
      this.combatStepIndex = nextCombatStepIndex;
      this.combatSimulationTimeMs = nextCombatTimeMs;
      const usesRawEdges = rawEdgesPending;
      const combatStep = this.combat.step({
        nowMs: combatNowMs,
        stepMs,
        position: this.movement.position,
        grounded: this.movement.grounded,
        movementState: this.animationIntent,
        playerState: this.stateMachine.current,
        facing: this.facing,
        lightBufferId: this.lightBufferId,
        heavyPressed: usesRawEdges && this.pendingHeavyPressed,
        heavyReleased: usesRawEdges && this.pendingHeavyReleased,
        heavyHeld: frame.actions['attack-heavy'].held,
        blockPressed: usesRawEdges && this.pendingBlockPressed,
        blockHeld: frame.actions.block.held,
        dashBufferId: this.dashBufferId,
        castBufferId: this.castBufferId,
      });
      if (usesRawEdges) {
        rawEdgesPending = false;
        this.pendingHeavyPressed = false;
        this.pendingHeavyReleased = false;
        this.pendingBlockPressed = false;
      }
      this.consumeCombatBuffers(combatStep.consumed);
      if (combatStep.clearHeavyToggleLatch) this.options.input.clearLatch('attack-heavy');
      if (combatStep.clearBlockToggleLatch) this.options.input.clearLatch('block');
      for (const state of combatStep.stateRequests) this.stateMachine.request(state, 'combat');
      if (combatStep.movementImpulse !== null) {
        this.movement = Object.freeze({
          ...this.movement,
          velocity: Object.freeze({
            x: this.movement.velocity.x + combatStep.movementImpulse.x,
            y: this.movement.velocity.y + combatStep.movementImpulse.y,
          }),
        });
      }
      if (combatStep.movement.kind === 'dash') {
        const blocked = this.stepDash(
          combatStep.movement.speedX,
          combatStep.movement.durationMs,
          combatStep.movement.completes,
        );
        if (blocked) {
          this.combat.stopDash();
          this.stateMachine.request(this.animationIntent, 'combat');
        }
        if (
          this.notifyFixedStep(
            combatNowMs,
            nextCombatTimeMs,
            stepMs,
            frame.move,
            frame.actions.interact.bufferedPressId,
            frame.actions.pause.bufferedPressId,
            frame.actions.pause.pressed,
          )
        ) {
          break;
        }
        continue;
      }
      const committed = combatStep.movement.kind === 'committed';
      const input: MovementInput = {
        moveX: committed ? 0 : frame.move.x,
        moveY: committed ? 0 : frame.move.y,
        jumpPressed: !committed && jumpBufferId !== null,
        jumpHeld: !committed && frame.actions.jump.held,
        dropPressed: !committed && frame.move.y > 0 && jumpBufferId !== null,
      };
      const proposalContacts = resolvePlatformContacts(
        this.movement.position,
        this.movement.position,
        this.surfaces,
        this.zones,
        {
          bodyHalfWidth: this.bodyHalfWidth,
          bodyHeight: this.bodyHeight,
          ignoreOneWay: this.movement.dropThroughRemaining > 0,
        },
      );
      const proposal = stepMovement(this.movement, input, proposalContacts, this.tuning, fixedStep);
      const sweptContacts = resolvePlatformContacts(
        this.movement.position,
        proposal.state.position,
        this.surfaces,
        this.zones,
        {
          bodyHalfWidth: this.bodyHalfWidth,
          bodyHeight: this.bodyHeight,
          ignoreOneWay: this.movement.dropThroughRemaining > 0,
        },
      );
      const proposalAcceptedGroundAction =
        proposal.jumped || proposal.state.dropThroughRemaining > this.movement.dropThroughRemaining;
      const contacts = proposalAcceptedGroundAction ? proposalContacts : sweptContacts;
      const result = stepMovement(this.movement, input, contacts, this.tuning, fixedStep);
      const armedDrop =
        this.movement.dropThroughRemaining === 0 && result.state.dropThroughRemaining > 0;
      if ((result.jumped || armedDrop) && jumpBufferId !== null) {
        this.options.input.consume('jump', jumpBufferId);
        jumpBufferId = null;
      }
      this.movement = this.clampToMovementBounds(result.state);
      this.animationIntent = result.animationIntent;
      if (!committed && this.movement.knockbackRemaining === 0) {
        if (input.moveX < -0.01) this.facing = 'left';
        if (input.moveX > 0.01) this.facing = 'right';
      }
      if (this.movement.knockbackRemaining === 0) {
        if (this.stateMachine.releaseHurt(result.animationIntent)) {
          this.recoverPoise();
        } else {
          this.stateMachine.request(result.animationIntent, 'movement');
        }
      }
      if (
        this.notifyFixedStep(
          combatNowMs,
          nextCombatTimeMs,
          stepMs,
          frame.move,
          frame.actions.interact.bufferedPressId,
          frame.actions.pause.bufferedPressId,
          frame.actions.pause.pressed,
        )
      ) {
        break;
      }
    }
    this.pendingSeconds -= stepCount * fixedStep;
    return this.snapshot();
  }

  public snapshot(): PlayerControllerSnapshot {
    return Object.freeze({
      roomId: this.roomId,
      stepIndex: this.combatStepIndex,
      position: Object.freeze({ ...this.movement.position }),
      velocity: Object.freeze({ ...this.movement.velocity }),
      state: this.stateMachine.current,
      grounded: this.movement.grounded,
      animationIntent: this.animationIntent,
      pendingSimulationSeconds: this.pendingSeconds,
      coyoteRemaining: this.movement.coyoteRemaining,
      dropThroughRemaining: this.movement.dropThroughRemaining,
      knockbackRemaining: this.movement.knockbackRemaining,
      climbEngaged: this.movement.climbEngaged,
      climbAvailable: resolvePlatformContacts(
        this.movement.position,
        this.movement.position,
        this.surfaces,
        this.zones,
        {
          bodyHalfWidth: this.bodyHalfWidth,
          bodyHeight: this.bodyHeight,
          ignoreOneWay: this.movement.dropThroughRemaining > 0,
        },
      ).climbZone,
      climbDetachRemaining: this.movement.climbDetachRemaining,
      landingLockRemaining: this.movement.landingLockRemaining,
      combatSimulationTimeMs: this.combatSimulationTimeMs,
      combat: this.combat.snapshot(),
      vitality: freezeCombatVitality(this.vitality),
    });
  }

  public synchronizeUnlockedAbilities(unlockedAbilityIds: readonly AbilityId[]): boolean {
    if (this.disposed) return false;
    return this.combat.synchronizeUnlockedAbilities(unlockedAbilityIds);
  }

  public synchronizeProgressionResources(
    resources: Readonly<{
      currentHealth: number;
      maxHealth: number;
      currentMana: number;
      maxMana: number;
    }>,
  ): boolean {
    if (this.disposed) return false;
    if (
      !Number.isSafeInteger(resources.maxHealth) ||
      resources.maxHealth <= 0 ||
      !Number.isSafeInteger(resources.currentHealth) ||
      resources.currentHealth < 0 ||
      resources.currentHealth > resources.maxHealth
    ) {
      throw new RangeError('Synchronized player health is outside the player range.');
    }
    const healthChanged =
      this.vitality.currentHealth !== resources.currentHealth ||
      this.vitality.maxHealth !== resources.maxHealth;
    const manaChanged = this.combat.synchronizeMana(resources.currentMana, resources.maxMana);
    this.maximumMana = resources.maxMana;
    if (healthChanged) {
      this.vitality = freezeCombatVitality({
        ...this.vitality,
        currentHealth: resources.currentHealth,
        maxHealth: resources.maxHealth,
      });
    }
    return manaChanged || healthChanged;
  }

  public restoreManaTo(maximumMana: number, occurredAtMs: number): boolean {
    if (this.disposed) return false;
    this.maximumMana = maximumMana;
    return this.combat.restoreManaTo(maximumMana, occurredAtMs);
  }

  public applySettings(settings: SaveSettings): void {
    this.settings = Object.freeze({ ...settings });
    this.combat.applySettings(settings);
  }

  public applyItemState(
    resources: Readonly<{ currentHealth: number; currentMana: number; maxMana?: number }>,
    equipment: readonly string[],
  ): void {
    if (
      !Number.isSafeInteger(resources.currentHealth) ||
      resources.currentHealth < 0 ||
      resources.currentHealth > this.vitality.maxHealth
    )
      throw new RangeError('Invalid item health.');
    const maximum = resources.maxMana ?? this.maximumMana;
    if (
      !Number.isSafeInteger(maximum) ||
      maximum < 0 ||
      !Number.isSafeInteger(resources.currentMana) ||
      resources.currentMana < 0 ||
      resources.currentMana > maximum
    )
      throw new RangeError('Invalid item mana.');
    this.vitality = freezeCombatVitality({
      ...this.vitality,
      currentHealth: resources.currentHealth,
    });
    this.maximumMana = maximum;
    this.combat.synchronizeMana(resources.currentMana, this.maximumMana);
    this.charms = equippedCharmEffects(equipment);
    if (this.charms.protectionMs === 0) this.charmInvulnerableUntil = 0;
  }

  public hurtboxTarget(): import('../../combat/HitboxSystem').HurtboxTarget {
    const hurtboxes =
      this.disposed || this.stateMachine.current === 'dead'
        ? Object.freeze([])
        : Object.freeze([
            Object.freeze({
              x: this.movement.position.x - this.bodyHalfWidth,
              y: this.movement.position.y - this.bodyHeight,
              width: this.bodyHalfWidth * 2,
              height: this.bodyHeight,
            }),
          ]);
    return Object.freeze({
      targetId: this.ownerId,
      teamId: this.teamId,
      hurtboxes,
    });
  }

  public receiveImpact(rawImpact: CombatImpact): CombatImpactResolution {
    assertImpactTime(rawImpact.occurredAtMs, this.combatSimulationTimeMs);
    assertProjectileMetadata(rawImpact);
    const impact = freezeCombatImpact(rawImpact);
    if (this.disposed) return ignoredResolution('disposed');
    if (impact.targetId !== this.ownerId) {
      return this.recordIgnoredImpact(impact, 'invalid-target');
    }
    if (this.stateMachine.current === 'dead') return this.recordIgnoredImpact(impact, 'dead');

    const guardSnapshot = this.combat.guardSnapshot(this.movement.position.x, impact.occurredAtMs);
    const guardResolution = resolveGuardImpact(
      {
        delivery: impact.delivery,
        tags: impact.tags,
        sourceX: impact.source.position.x,
      },
      guardSnapshot,
    );
    if (impact.occurredAtMs < Math.max(this.baseInvulnerableUntil, this.charmInvulnerableUntil))
      return this.recordIgnoredImpact(impact, 'invulnerable');
    if (guardResolution.kind === 'ignored') {
      return this.recordIgnoredImpact(impact, 'invulnerable');
    }
    this.combat.applyGuardResolution(guardResolution, impact.occurredAtMs);

    if (guardResolution.kind === 'absorbed') {
      const resolution = freezeCombatImpactResolution({
        kind: 'absorbed',
        guard: 'aegis',
        manaSpent: guardResolution.manaSpent,
        consumedStatusId: stableId<'status'>('aegis-veil'),
        grantedStatusId: guardResolution.grantStatusId,
        projectileDisposition: 'consume',
        commands: guardResolution.commands,
      });
      this.combat.recordIncomingImpact(impact, resolution);
      return resolution;
    }

    if (guardResolution.guard.kind === 'parry') {
      if (this.charms.parryMana > 0)
        this.combat.synchronizeMana(
          Math.min(this.maximumMana, this.combat.snapshot().currentMana + this.charms.parryMana),
          this.maximumMana,
        );
      const resolution = freezeCombatImpactResolution({
        kind: 'parried',
        guard: 'parry',
        manaSpent: 0,
        projectileDisposition: 'continue',
        commands: guardResolution.commands,
      });
      this.combat.recordIncomingImpact(impact, resolution);
      return resolution;
    }

    const previousVitality = this.vitality;
    const resolvedDamage = resolveDamage(impact.damage, {
      armour: previousVitality.armour,
      resistances: previousVitality.resistances,
      currentPoise: previousVitality.currentPoise,
      guard: guardResolution.guard,
    });
    const briar = impact.delivery === 'hazard' && impact.attackId === 'bramble-thorn-contact';
    const damage = {
      ...resolvedDamage,
      healthDamage: difficultyHealthDamage(
        briar
          ? Math.round(resolvedDamage.healthDamage * this.charms.briarMultiplier)
          : resolvedDamage.healthDamage,
        this.settings.difficulty,
      ),
    };
    if (damage.healthDamage > 0) {
      this.baseInvulnerableUntil = impact.occurredAtMs + PLAYER_POST_HIT_PROTECTION_MS;
      if (this.charms.protectionMs > 0)
        this.charmInvulnerableUntil = this.baseInvulnerableUntil + this.charms.protectionMs;
    }
    const currentPoise = damage.remainingPoise ?? previousVitality.currentPoise;
    const currentHealth = Math.max(0, previousVitality.currentHealth - damage.healthDamage);
    this.vitality = freezeCombatVitality({
      ...previousVitality,
      currentHealth,
      currentPoise,
    });
    if (
      currentHealth !== previousVitality.currentHealth ||
      currentPoise !== previousVitality.currentPoise
    ) {
      this.combat.recordVitalityChange('damage', previousVitality, this.vitality);
    }

    const defeated = currentHealth === 0;
    const guard = guardKind(guardResolution);
    const resolution = freezeCombatImpactResolution({
      kind: 'resolved',
      guard,
      manaSpent: guardResolution.manaSpent,
      damage,
      remainingHealth: currentHealth,
      remainingPoise: currentPoise,
      staggered: damage.staggered,
      defeated,
      projectileDisposition: impact.projectile === null ? 'continue' : 'consume',
      commands: guardResolution.commands,
    });
    if (defeated) {
      this.enterDead();
    } else if (guard === 'guard-break' || damage.healthDamage > 0 || damage.staggered) {
      this.applyKnockback(impact.knockback, PLAYER_HURT_RECOVERY_SECONDS);
    }
    this.combat.recordIncomingImpact(impact, resolution);
    return resolution;
  }

  public applyKnockback(impulse: Vec2, durationSeconds: number): void {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new RangeError('Knockback duration must be finite and positive.');
    }
    if (!this.stateMachine.request('hurt', 'external')) return;
    this.movement = Object.freeze({
      ...this.movement,
      velocity: Object.freeze({ ...impulse }),
      grounded: false,
      coyoteRemaining: 0,
      knockbackRemaining: durationSeconds,
    });
    const reset = this.combat.interrupt('hurt', this.combatSimulationTimeMs);
    if (reset.clearHeavyToggleLatch) this.options.input.clearLatch('attack-heavy');
    if (reset.clearBlockToggleLatch) this.options.input.clearLatch('block');
    this.clearPendingCombatInput();
  }

  public die(): void {
    if (this.stateMachine.current === 'dead') return;
    const previous = this.vitality;
    this.vitality = freezeCombatVitality({ ...previous, currentHealth: 0 });
    if (previous.currentHealth !== 0) {
      this.combat.recordVitalityChange('death', previous, this.vitality);
    }
    this.enterDead();
  }

  private enterDead(): void {
    this.stateMachine.request('dead', 'external');
    const reset = this.combat.interrupt('dead', this.combatSimulationTimeMs);
    if (reset.clearHeavyToggleLatch) this.options.input.clearLatch('attack-heavy');
    if (reset.clearBlockToggleLatch) this.options.input.clearLatch('block');
    this.clearPendingCombatInput();
  }

  public respawn(position: Vec2): void {
    this.baseInvulnerableUntil = 0;
    this.charmInvulnerableUntil = 0;
    const previousVitality = this.vitality;
    this.vitality = freezeCombatVitality({
      ...previousVitality,
      currentHealth: previousVitality.maxHealth,
      currentPoise: previousVitality.maxPoise,
    });
    this.movement = this.createSupportedMovement(position);
    this.pendingSeconds = 0;
    this.animationIntent = 'idle';
    this.stateMachine.request('idle', 'respawn');
    const reset = this.combat.respawn(this.combatSimulationTimeMs);
    if (reset.clearHeavyToggleLatch) this.options.input.clearLatch('attack-heavy');
    if (reset.clearBlockToggleLatch) this.options.input.clearLatch('block');
    this.clearPendingCombatInput();
    this.options.input.clearTransient();
    if (
      previousVitality.currentHealth !== this.vitality.currentHealth ||
      previousVitality.currentPoise !== this.vitality.currentPoise
    ) {
      this.combat.recordVitalityChange('respawn', previousVitality, this.vitality);
    }
  }

  public rebindRoom(binding: PlayerRoomBinding): boolean {
    if (this.disposed || this.vitality.currentHealth === 0) return false;
    const candidate = validateRoomBinding(binding, this.bodyHalfWidth, this.bodyHeight);
    if (candidate === null) return false;

    const reset = this.combat.rebindRoom(candidate.facing, this.combatSimulationTimeMs);
    if (reset.clearHeavyToggleLatch) this.options.input.clearLatch('attack-heavy');
    if (reset.clearBlockToggleLatch) this.options.input.clearLatch('block');
    this.roomId = candidate.roomId;
    this.surfaces = candidate.surfaces;
    this.zones = candidate.zones;
    this.movementBounds = candidate.movementBounds;
    this.movement = this.createSupportedMovement(candidate.position);
    this.facing = candidate.facing;
    this.pendingSeconds = 0;
    this.animationIntent = 'idle';
    this.stateMachine.request('idle', 'respawn');
    this.interactionReturnState = 'idle';
    this.clearPendingCombatInput();
    this.pendingCombatEvents.length = 0;
    this.options.input.clearTransient();
    return true;
  }

  public beginInteraction(): boolean {
    const previous = this.stateMachine.current;
    if (!this.stateMachine.request('interact', 'interaction')) return false;
    this.interactionReturnState = previous;
    this.movement = Object.freeze({
      ...this.movement,
      velocity: Object.freeze({ ...this.movement.velocity, x: 0 }),
    });
    const reset = this.combat.suspendForInteraction(this.combatSimulationTimeMs);
    if (reset.clearHeavyToggleLatch) this.options.input.clearLatch('attack-heavy');
    if (reset.clearBlockToggleLatch) this.options.input.clearLatch('block');
    this.clearPendingCombatInput();
    return true;
  }

  public endInteraction(): boolean {
    if (!this.stateMachine.request(this.interactionReturnState, 'interaction')) return false;
    this.options.input.clearTransient();
    this.interactionReturnState = 'idle';
    return true;
  }

  public restAtCheckpoint(position: Vec2, resources: RuntimeCheckpointResources): void {
    this.baseInvulnerableUntil = 0;
    this.charmInvulnerableUntil = 0;
    if (
      !Number.isSafeInteger(resources.currentHealth) ||
      resources.currentHealth <= 0 ||
      resources.currentHealth > this.vitality.maxHealth
    ) {
      throw new RangeError('Checkpoint health is outside the player range.');
    }
    if (!Number.isSafeInteger(resources.currentMana) || resources.currentMana < 0) {
      throw new RangeError('Checkpoint mana must be a non-negative safe integer.');
    }
    this.vitality = freezeCombatVitality({
      ...this.vitality,
      currentHealth: resources.currentHealth,
      currentPoise: this.vitality.maxPoise,
    });
    this.movement = this.createSupportedMovement(position);
    this.pendingSeconds = 0;
    this.animationIntent = 'idle';
    this.stateMachine.request('idle', 'respawn');
    const reset = this.combat.restoreAtCheckpoint(
      resources.currentMana,
      this.combatSimulationTimeMs,
    );
    if (reset.clearHeavyToggleLatch) this.options.input.clearLatch('attack-heavy');
    if (reset.clearBlockToggleLatch) this.options.input.clearLatch('block');
    this.clearPendingCombatInput();
    this.options.input.clearTransient();
    this.interactionReturnState = 'idle';
  }

  public drainCombatEvents(): readonly PlayerCombatRuntimeEvent[] {
    this.pendingCombatEvents.push(...this.combat.drainEvents());
    const drained = Object.freeze([...this.pendingCombatEvents]);
    this.pendingCombatEvents.length = 0;
    return drained;
  }

  public captureFixedStepCombatEvents(): readonly PlayerCombatRuntimeEvent[] {
    const captured = this.combat.drainEvents();
    this.pendingCombatEvents.push(...captured);
    return Object.freeze([...captured]);
  }

  public requestSharedHitStop(hitStopMs: number): void {
    this.combat.requestHitStop(hitStopMs);
  }

  public dispose(): boolean {
    if (this.disposed) return false;
    this.disposed = true;
    this.options.input.clearLatch('attack-heavy');
    this.options.input.clearLatch('block');
    this.clearPendingCombatInput();
    this.pendingCombatEvents.length = 0;
    this.combat.dispose();
    return true;
  }

  private consumeCombatBuffers(
    consumed: Readonly<{
      lightBufferId: number | null;
      dashBufferId: number | null;
      castBufferId: number | null;
    }>,
  ): void {
    if (consumed.lightBufferId !== null) {
      this.options.input.consume('attack-light', consumed.lightBufferId);
      this.lightBufferId = null;
    }
    if (consumed.dashBufferId !== null) {
      this.options.input.consume('dash', consumed.dashBufferId);
      this.dashBufferId = null;
    }
    if (consumed.castBufferId !== null) {
      this.options.input.consume('cast', consumed.castBufferId);
      this.castBufferId = null;
    }
  }

  private clearPendingCombatInput(): void {
    this.lightBufferId = null;
    this.dashBufferId = null;
    this.castBufferId = null;
    this.pendingHeavyPressed = false;
    this.pendingHeavyReleased = false;
    this.pendingBlockPressed = false;
  }

  private notifyFixedStep(
    startTimeMs: number,
    endTimeMs: number,
    stepMs: number,
    move: Vec2,
    interactBufferId: number | null,
    pauseBufferId: number | null,
    pausePressed: boolean,
  ): boolean {
    const observer = this.options.fixedStepObserver;
    if (observer === undefined) return false;
    const combatEvents = this.captureFixedStepCombatEvents();
    const result = observer(
      Object.freeze({
        stepIndex: this.combatStepIndex,
        startTimeMs,
        endTimeMs,
        stepMs,
        player: this.snapshot(),
        target: this.hurtboxTarget(),
        combatEvents: Object.freeze([...combatEvents]),
        input: Object.freeze({
          move: Object.freeze({ ...move }),
          interactBufferId,
          pauseBufferId,
          pausePressed,
        }),
      }),
    );
    this.captureFixedStepCombatEvents();
    return result?.halt === true;
  }

  private recoverPoise(): void {
    if (this.vitality.currentPoise !== 0) return;
    const previous = this.vitality;
    this.vitality = freezeCombatVitality({
      ...previous,
      currentPoise: previous.maxPoise,
    });
    this.combat.recordVitalityChange('poise-recovered', previous, this.vitality);
  }

  private recordIgnoredImpact(
    impact: CombatImpact,
    reason: Extract<CombatImpactResolution, { kind: 'ignored' }>['reason'],
  ): CombatImpactResolution {
    const resolution = ignoredResolution(reason);
    this.combat.recordIncomingImpact(impact, resolution);
    return resolution;
  }

  private stepDash(speedX: number, durationMs: number, completes: boolean): boolean {
    const proposedX = this.movement.position.x + speedX * (durationMs / 1_000);
    const resolvedX = this.resolveDashX(proposedX, speedX);
    const blocked = resolvedX !== proposedX;
    this.movement = Object.freeze({
      ...this.movement,
      position: Object.freeze({ x: resolvedX, y: this.movement.position.y }),
      velocity: Object.freeze({ x: blocked || completes ? 0 : speedX, y: 0 }),
    });
    return blocked;
  }

  private resolveDashX(proposedX: number, speedX: number): number {
    let resolvedX = proposedX;
    const feetY = this.movement.position.y;
    const bodyTop = feetY - this.bodyHeight;
    for (const surface of this.surfaces) {
      if (
        surface.kind !== 'solid' ||
        feetY <= surface.bounds.y ||
        bodyTop >= surface.bounds.y + surface.bounds.height
      ) {
        continue;
      }
      if (speedX > 0) {
        const wallX = surface.bounds.x - this.bodyHalfWidth;
        if (this.movement.position.x <= wallX && proposedX >= wallX) {
          resolvedX = Math.min(resolvedX, wallX);
        }
      } else {
        const wallX = surface.bounds.x + surface.bounds.width + this.bodyHalfWidth;
        if (this.movement.position.x >= wallX && proposedX <= wallX) {
          resolvedX = Math.max(resolvedX, wallX);
        }
      }
    }
    const bounds = this.movementBounds;
    if (bounds !== undefined) {
      const minimumX = bounds.x + this.bodyHalfWidth;
      const maximumX = bounds.x + bounds.width - this.bodyHalfWidth;
      resolvedX = Math.min(Math.max(minimumX, resolvedX), maximumX);
    }
    return resolvedX;
  }

  private clampToMovementBounds(state: MovementState): MovementState {
    const bounds = this.movementBounds;
    if (bounds === undefined) return state;
    const authoredMinimum = bounds.x + this.bodyHalfWidth;
    const authoredMaximum = bounds.x + bounds.width - this.bodyHalfWidth;
    const minimumX = Math.min(authoredMinimum, authoredMaximum);
    const maximumX = Math.max(authoredMinimum, authoredMaximum);
    const clampedX = Math.min(maximumX, Math.max(minimumX, state.position.x));
    if (clampedX === state.position.x) return state;
    const hitLeft = clampedX === minimumX && state.velocity.x < 0;
    const hitRight = clampedX === maximumX && state.velocity.x > 0;
    return Object.freeze({
      ...state,
      position: Object.freeze({ ...state.position, x: clampedX }),
      velocity: Object.freeze({
        ...state.velocity,
        x: hitLeft || hitRight ? 0 : state.velocity.x,
      }),
    });
  }
}

function validateRoomBinding(
  binding: PlayerRoomBinding,
  bodyHalfWidth: number,
  bodyHeight: number,
): PlayerRoomBinding | null {
  if (
    !isStableId(binding.roomId) ||
    (binding.facing !== 'left' && binding.facing !== 'right') ||
    !isFiniteVec2(binding.position) ||
    !isValidRect(binding.movementBounds) ||
    binding.movementBounds.width < bodyHalfWidth * 2 ||
    binding.movementBounds.height < bodyHeight
  ) {
    return null;
  }
  const minimumX = binding.movementBounds.x + bodyHalfWidth;
  const maximumX = binding.movementBounds.x + binding.movementBounds.width - bodyHalfWidth;
  const minimumY = binding.movementBounds.y + bodyHeight;
  const maximumY = binding.movementBounds.y + binding.movementBounds.height;
  if (
    binding.position.x < minimumX ||
    binding.position.x > maximumX ||
    binding.position.y < minimumY ||
    binding.position.y > maximumY
  ) {
    return null;
  }
  if (
    binding.surfaces.some(
      (surface) =>
        surface.roomId !== binding.roomId ||
        !isStableId(surface.surfaceId) ||
        !isStableId(surface.materialId) ||
        !isValidRect(surface.bounds),
    ) ||
    binding.zones.some(
      (zone) =>
        zone.roomId !== binding.roomId ||
        !isStableId(zone.zoneId) ||
        !isValidRect(zone.bounds) ||
        (zone.kind === 'hazard' && !isStableId(zone.attackId)),
    )
  ) {
    return null;
  }

  const candidate = Object.freeze({
    roomId: binding.roomId,
    position: Object.freeze({ ...binding.position }),
    facing: binding.facing,
    surfaces: freezeSurfaces(binding.surfaces),
    zones: freezeZones(binding.zones),
    movementBounds: freezeRect(binding.movementBounds),
  });
  const support = resolvePlatformContacts(
    candidate.position,
    candidate.position,
    candidate.surfaces,
    candidate.zones,
    { bodyHalfWidth, bodyHeight, ignoreOneWay: false },
  );
  return support.groundY !== null && Math.abs(support.groundY - candidate.position.y) < 0.001
    ? candidate
    : null;
}

function freezeSurfaces(surfaces: readonly SurfaceDefinition[]): readonly SurfaceDefinition[] {
  return Object.freeze(
    surfaces.map((surface) => Object.freeze({ ...surface, bounds: freezeRect(surface.bounds) })),
  );
}

function freezeZones(zones: readonly ZoneDefinition[]): readonly ZoneDefinition[] {
  return Object.freeze(
    zones.map((zone) => Object.freeze({ ...zone, bounds: freezeRect(zone.bounds) })),
  );
}

function freezeRect(rect: Rect): Rect {
  return Object.freeze({ ...rect });
}

function isFiniteVec2(position: Vec2): boolean {
  return Number.isFinite(position.x) && Number.isFinite(position.y);
}

function isValidRect(rect: Rect): boolean {
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function createVitality(options: PlayerVitalOptions): CombatVitalitySnapshot {
  assertPositiveSafeInteger(options.maxHealth, 'Maximum health');
  assertNonNegativeSafeInteger(options.currentHealth, 'Current health');
  if (options.currentHealth > options.maxHealth) {
    throw new RangeError('Current health cannot exceed maximum health.');
  }
  assertPositiveSafeInteger(options.maxPoise, 'Maximum poise');
  assertNonNegativeSafeInteger(options.armour, 'Armour');
  for (const [damageType, resistance] of Object.entries(options.resistances)) {
    if (!isStableId(damageType)) throw new RangeError('Resistance type must be a stable ID.');
    if (
      typeof resistance !== 'number' ||
      !Number.isFinite(resistance) ||
      resistance < -1 ||
      resistance > 1
    ) {
      throw new RangeError('Resistance must be between -1 and 1.');
    }
  }
  return freezeCombatVitality({
    currentHealth: options.currentHealth,
    maxHealth: options.maxHealth,
    currentPoise: options.maxPoise,
    maxPoise: options.maxPoise,
    armour: options.armour,
    resistances: options.resistances,
  });
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer.`);
  }
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer.`);
  }
}

function assertImpactTime(occurredAtMs: number, expectedAtMs: number): void {
  if (!Number.isSafeInteger(occurredAtMs) || occurredAtMs < 0 || occurredAtMs !== expectedAtMs) {
    throw new RangeError('Incoming impact must use the current fixed simulation time.');
  }
}

function assertProjectileMetadata(impact: CombatImpact): void {
  const isProjectile = impact.delivery === 'projectile';
  if (isProjectile !== (impact.projectile !== null)) {
    throw new RangeError('Projectile delivery and instance metadata must agree.');
  }
}

function ignoredResolution(
  reason: Extract<CombatImpactResolution, { kind: 'ignored' }>['reason'],
): CombatImpactResolution {
  return freezeCombatImpactResolution({
    kind: 'ignored',
    reason,
    projectileDisposition: 'continue',
    commands: Object.freeze([]) as readonly [],
  });
}

function guardKind(
  resolution: Extract<GuardResolution, { kind: 'resolved' }>,
): Extract<CombatImpactResolution, { kind: 'resolved' }>['guard'] {
  if (resolution.commands.some(({ kind }) => kind === 'guard-break')) return 'guard-break';
  if (resolution.guard.kind === 'parry') {
    throw new Error('Parry resolution must be handled before damage resolution.');
  }
  return resolution.guard.kind;
}
