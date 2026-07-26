import {
  AbilitySystem,
  resolveAegisProjectile,
  type AbilityEffectDirective,
  type BarrierDirective,
  type ProjectileSnapshot
} from '../abilities/AbilitySystem';
import { attackDefinitions } from '../data/attacks';
import type { AttackDefinition } from '../data/types';
import {
  requestPlayerState,
  type PlayerStateMachine,
  type PlayerStateName
} from '../entities/player/PlayerState';
import type { Facing, MovementInput } from '../physics/MovementModel';

const FIXED_STEP = 1 / 60;
const MAX_FRAME_TIME = 0.05;
const HEAVY_CHARGE_THRESHOLD = 18;
const PARRY_WINDOW_FRAMES = 5;
const CAST_DURATION_FRAMES = 18;
const CAST_ABILITY_IDS = ['lumen-bolt', 'aegis-veil', 'resonant-pulse'] as const;
const COMBAT_ABILITY_IDS = [
  'lumen-bolt',
  'wayfinder-dash',
  'aegis-veil',
  'resonant-pulse'
] as const;
const COMBO_ATTACK_IDS = [
  'mara-light-combo-1',
  'mara-light-combo-2',
  'mara-light-combo-3'
] as const;

const attacks = new Map(attackDefinitions.map((attack) => [attack.id, attack]));
const abilities = new AbilitySystem();

export type PlayerCombatInput = {
  readonly lightPressed: boolean;
  readonly heavyPressed: boolean;
  readonly heavyHeld: boolean;
  readonly heavyReleased: boolean;
  readonly blockPressed: boolean;
  readonly blockHeld: boolean;
  readonly blockReleased: boolean;
  readonly dashPressed: boolean;
  readonly castPressed: boolean;
  readonly cycleLeftPressed: boolean;
  readonly cycleRightPressed: boolean;
};

export type PlayerCombatContext = {
  readonly machine: PlayerStateMachine;
  readonly grounded: boolean;
  readonly facing: Facing;
  readonly locomotionState: Extract<PlayerStateName, 'idle' | 'run' | 'jump' | 'fall' | 'land'>;
  readonly nowMs: number;
};

export type PlayerCombatState = {
  readonly activeAttackId: string | undefined;
  readonly comboStage: 0 | 1 | 2 | 3;
  readonly comboBuffered: boolean;
  readonly actionFrame: number;
  readonly chargingHeavy: boolean;
  readonly heavyChargeFrames: number;
  readonly blockFrames: number;
  readonly dashFramesRemaining: number;
  readonly dashVelocityX: number;
  readonly castFramesRemaining: number;
  readonly invulnerableFrames: number;
  readonly mana: number;
  readonly maximumMana: number;
  readonly unlockedAbilityIds: readonly string[];
  readonly cooldownReadyAt: Readonly<Record<string, number>>;
  readonly selectedAbilityId: string;
  readonly barrier: BarrierDirective | undefined;
  readonly frameRemainder: number;
};

export type PlayerCombatDirective =
  | {
      readonly kind: 'activate-attack';
      readonly attackId: string;
      readonly activationDelayFrames?: number;
    }
  | {
      readonly kind: 'ability-effect';
      readonly effect: AbilityEffectDirective;
      readonly activationDelayFrames?: number;
    }
  | { readonly kind: 'cue'; readonly cueId: string };

export type PlayerCombatStep = {
  readonly state: PlayerCombatState;
  readonly machine: PlayerStateMachine;
  readonly movementLocked: boolean;
  readonly invulnerable: boolean;
  readonly guard:
    | { readonly kind: 'none' }
    | { readonly kind: 'parry' }
    | {
        readonly kind: 'block';
        readonly damageMultiplier: number;
        readonly poiseMultiplier: number;
        readonly knockbackMultiplier: number;
      };
  readonly dashVelocityX: number;
  readonly directives: readonly PlayerCombatDirective[];
};

export type PlayerProjectileIntercept = {
  readonly converted: boolean;
  readonly manaRestored: number;
  readonly projectileId: string;
  readonly state: PlayerCombatState;
};

type Substep = {
  readonly state: PlayerCombatState;
  readonly machine: PlayerStateMachine;
  readonly directives: readonly PlayerCombatDirective[];
};

export const createPlayerCombatState = (
  unlockedAbilityIds: readonly string[] = ['lumen-bolt']
): PlayerCombatState => {
  const unlocked = [
    ...new Set(
      unlockedAbilityIds.filter((abilityId) =>
        (COMBAT_ABILITY_IDS as readonly string[]).includes(abilityId)
      )
    )
  ];
  return {
    activeAttackId: undefined,
    comboStage: 0,
    comboBuffered: false,
    actionFrame: 0,
    chargingHeavy: false,
    heavyChargeFrames: 0,
    blockFrames: 0,
    dashFramesRemaining: 0,
    dashVelocityX: 0,
    castFramesRemaining: 0,
    invulnerableFrames: 0,
    mana: 60,
    maximumMana: 60,
    unlockedAbilityIds: unlocked,
    cooldownReadyAt: {},
    selectedAbilityId:
      CAST_ABILITY_IDS.find((abilityId) => unlocked.includes(abilityId)) ?? 'lumen-bolt',
    barrier: undefined,
    frameRemainder: 0
  };
};

export const unlockPlayerAbility = (
  state: PlayerCombatState,
  abilityId: string
): PlayerCombatState => {
  if (!(COMBAT_ABILITY_IDS as readonly string[]).includes(abilityId)) return state;
  if (state.unlockedAbilityIds.includes(abilityId)) return state;
  return { ...state, unlockedAbilityIds: [...state.unlockedAbilityIds, abilityId] };
};

const emptyEdges = (input: PlayerCombatInput): PlayerCombatInput => ({
  ...input,
  lightPressed: false,
  heavyPressed: false,
  heavyReleased: false,
  blockPressed: false,
  blockReleased: false,
  dashPressed: false,
  castPressed: false,
  cycleLeftPressed: false,
  cycleRightPressed: false
});

const ageExistingBarrier = (
  previous: PlayerCombatState,
  next: PlayerCombatState
): PlayerCombatState => {
  if (previous.barrier === undefined || next.barrier !== previous.barrier) return next;
  const durationFrames = previous.barrier.durationFrames - 1;
  return {
    ...next,
    barrier: durationFrames > 0 ? { ...previous.barrier, durationFrames } : undefined
  };
};

const totalFrames = (attack: AttackDefinition): number =>
  attack.anticipationFrames + attack.activeFrames + attack.recoveryFrames;

const transitionToLocomotion = (
  machine: PlayerStateMachine,
  context: PlayerCombatContext
): PlayerStateMachine => requestPlayerState(machine, context.locomotionState);

const startAttack = (
  state: PlayerCombatState,
  machine: PlayerStateMachine,
  attackId: string,
  comboStage: PlayerCombatState['comboStage'],
  playerState: Extract<PlayerStateName, 'attackLight' | 'attackHeavy' | 'airAttack'>,
  activationDelayFrames = 0
): Substep => {
  const attack = attacks.get(attackId);
  return {
    state: {
      ...state,
      activeAttackId: attackId,
      comboStage,
      comboBuffered: false,
      actionFrame: 0,
      chargingHeavy: false,
      heavyChargeFrames: 0
    },
    machine: requestPlayerState(machine, playerState),
    directives: [
      {
        kind: 'activate-attack',
        attackId,
        ...(activationDelayFrames === 0 ? {} : { activationDelayFrames })
      },
      { kind: 'cue', cueId: attack?.effectCueId ?? `${attackId}-effect` },
      { kind: 'cue', cueId: attack?.soundCueId ?? `${attackId}-sound` }
    ]
  };
};

const advanceAttack = (
  state: PlayerCombatState,
  machine: PlayerStateMachine,
  input: PlayerCombatInput,
  context: PlayerCombatContext
): Substep => {
  const attack = state.activeAttackId === undefined ? undefined : attacks.get(state.activeAttackId);
  if (attack === undefined) return { state, machine, directives: [] };
  const comboBuffered =
    state.comboBuffered ||
    (input.lightPressed &&
      state.comboStage > 0 &&
      state.comboStage < 3 &&
      state.actionFrame >= attack.cancelAfterFrame);
  const actionFrame = state.actionFrame + 1;
  if (actionFrame < totalFrames(attack)) {
    return {
      state: { ...state, comboBuffered, actionFrame },
      machine,
      directives: []
    };
  }
  if (comboBuffered && state.comboStage > 0 && state.comboStage < 3) {
    const nextStage = (state.comboStage + 1) as 2 | 3;
    return startAttack(
      state,
      machine,
      COMBO_ATTACK_IDS[nextStage - 1],
      nextStage,
      'attackLight',
      1
    );
  }
  return {
    state: {
      ...state,
      activeAttackId: undefined,
      comboStage: 0,
      comboBuffered: false,
      actionFrame: 0
    },
    machine: transitionToLocomotion(machine, context),
    directives: []
  };
};

const startAbility = (
  abilityId: string,
  state: PlayerCombatState,
  machine: PlayerStateMachine,
  context: PlayerCombatContext
): Substep => {
  const result = abilities.tryCast(abilityId, {
    actorId: 'mara-vey',
    mana: state.mana,
    maximumMana: state.maximumMana,
    state: machine.value,
    grounded: context.grounded,
    facing: context.facing,
    nowMs: context.nowMs,
    unlockedAbilityIds: state.unlockedAbilityIds,
    cooldownReadyAt: state.cooldownReadyAt
  });
  if (result.kind === 'failure') return { state, machine, directives: [] };
  const dash = result.effects.find(
    (effect): effect is Extract<AbilityEffectDirective, { readonly kind: 'dash' }> =>
      effect.kind === 'dash'
  );
  const barrier = result.effects.find(
    (effect): effect is BarrierDirective => effect.kind === 'barrier'
  );
  return {
    state: {
      ...state,
      mana: result.actor.mana,
      cooldownReadyAt: result.actor.cooldownReadyAt,
      dashFramesRemaining: dash?.durationFrames ?? 0,
      dashVelocityX: dash?.velocityX ?? 0,
      invulnerableFrames: dash?.invulnerableFrames ?? 0,
      castFramesRemaining: dash === undefined ? CAST_DURATION_FRAMES : 0,
      barrier: barrier ?? state.barrier
    },
    machine: requestPlayerState(machine, result.nextState),
    directives: [
      ...result.effects.map(
        (effect): PlayerCombatDirective => ({ kind: 'ability-effect', effect })
      ),
      { kind: 'cue', cueId: result.cueIds.effect },
      { kind: 'cue', cueId: result.cueIds.sound }
    ]
  };
};

const advanceSubstep = (
  state: PlayerCombatState,
  machine: PlayerStateMachine,
  input: PlayerCombatInput,
  context: PlayerCombatContext
): Substep => {
  if (machine.value === 'dead' || machine.value === 'hurt') {
    return {
      state: {
        ...state,
        activeAttackId: undefined,
        comboStage: 0,
        comboBuffered: false,
        chargingHeavy: false,
        actionFrame: 0
      },
      machine,
      directives: []
    };
  }
  if (state.dashFramesRemaining > 0) {
    const dashFramesRemaining = state.dashFramesRemaining - 1;
    const invulnerableFrames = Math.max(0, state.invulnerableFrames - 1);
    return {
      state: {
        ...state,
        dashFramesRemaining,
        invulnerableFrames,
        dashVelocityX: dashFramesRemaining === 0 ? 0 : state.dashVelocityX
      },
      machine: dashFramesRemaining === 0 ? transitionToLocomotion(machine, context) : machine,
      directives: []
    };
  }
  if (state.castFramesRemaining > 0) {
    const castFramesRemaining = state.castFramesRemaining - 1;
    return {
      state: { ...state, castFramesRemaining },
      machine: castFramesRemaining === 0 ? transitionToLocomotion(machine, context) : machine,
      directives: []
    };
  }
  if (state.activeAttackId !== undefined) {
    return advanceAttack(state, machine, input, context);
  }
  if (state.chargingHeavy) {
    if (input.heavyReleased || (!input.heavyHeld && state.heavyChargeFrames > 1)) {
      const attackId =
        state.heavyChargeFrames >= HEAVY_CHARGE_THRESHOLD
          ? 'mara-charged-strike'
          : 'mara-heavy-slash';
      const started = startAttack(state, machine, attackId, 0, 'attackHeavy');
      const advanced = advanceAttack(started.state, started.machine, emptyEdges(input), context);
      return {
        ...advanced,
        directives: [...started.directives, ...advanced.directives]
      };
    }
    return {
      state: {
        ...state,
        heavyChargeFrames: Math.min(36, state.heavyChargeFrames + Number(input.heavyHeld))
      },
      machine,
      directives: []
    };
  }
  if (machine.value === 'block' || machine.value === 'parry') {
    if (input.blockReleased || (!input.blockHeld && !input.blockPressed)) {
      return {
        state: { ...state, blockFrames: 0 },
        machine: transitionToLocomotion(machine, context),
        directives: []
      };
    }
    const blockFrames = state.blockFrames + 1;
    return {
      state: { ...state, blockFrames },
      machine: requestPlayerState(machine, blockFrames <= PARRY_WINDOW_FRAMES ? 'parry' : 'block'),
      directives: []
    };
  }
  if (input.blockPressed && context.grounded) {
    return {
      state: { ...state, blockFrames: 1 },
      machine: requestPlayerState(machine, 'parry'),
      directives: [{ kind: 'cue', cueId: 'mara-parry-ready' }]
    };
  }
  if (input.cycleLeftPressed || input.cycleRightPressed) {
    const castAbilityIds = CAST_ABILITY_IDS.filter((abilityId) =>
      state.unlockedAbilityIds.includes(abilityId)
    );
    if (castAbilityIds.length === 0) return { state, machine, directives: [] };
    const currentIndex = castAbilityIds.indexOf(
      state.selectedAbilityId as (typeof CAST_ABILITY_IDS)[number]
    );
    const direction = input.cycleRightPressed ? 1 : -1;
    const selectedIndex =
      (Math.max(0, currentIndex) + direction + castAbilityIds.length) % castAbilityIds.length;
    return {
      state: { ...state, selectedAbilityId: castAbilityIds[selectedIndex] ?? 'lumen-bolt' },
      machine,
      directives: [{ kind: 'cue', cueId: 'ability-selection-changed' }]
    };
  }
  if (input.dashPressed) return startAbility('wayfinder-dash', state, machine, context);
  if (input.castPressed) return startAbility(state.selectedAbilityId, state, machine, context);
  if (input.heavyPressed && context.grounded) {
    return {
      state: {
        ...state,
        chargingHeavy: true,
        heavyChargeFrames: 1,
        actionFrame: 0
      },
      machine: requestPlayerState(machine, 'attackHeavy'),
      directives: [{ kind: 'cue', cueId: 'mara-heavy-charge' }]
    };
  }
  if (input.lightPressed) {
    const started = context.grounded
      ? startAttack(state, machine, COMBO_ATTACK_IDS[0], 1, 'attackLight')
      : startAttack(state, machine, 'mara-air-slash', 0, 'airAttack');
    const advanced = advanceAttack(started.state, started.machine, emptyEdges(input), context);
    return {
      ...advanced,
      directives: [...started.directives, ...advanced.directives]
    };
  }
  return { state, machine, directives: [] };
};

const guardFor = (
  state: PlayerCombatState,
  machine: PlayerStateMachine
): PlayerCombatStep['guard'] => {
  if (machine.value === 'parry' && state.blockFrames <= PARRY_WINDOW_FRAMES) {
    return { kind: 'parry' };
  }
  if (machine.value === 'block') {
    return {
      kind: 'block',
      damageMultiplier: 0.35,
      poiseMultiplier: 0.5,
      knockbackMultiplier: 0.45
    };
  }
  return { kind: 'none' };
};

const locksMovement = (machine: PlayerStateMachine): boolean =>
  [
    'attackLight',
    'attackHeavy',
    'airAttack',
    'block',
    'parry',
    'dash',
    'cast',
    'hurt',
    'dead'
  ].includes(machine.value);

export const advancePlayerCombatFrame = (
  state: PlayerCombatState,
  input: PlayerCombatInput,
  context: PlayerCombatContext,
  deltaSeconds: number
): PlayerCombatStep => {
  let remaining = state.frameRemainder + Math.min(MAX_FRAME_TIME, Math.max(0, deltaSeconds));
  let current = state;
  let machine = context.machine;
  let firstStep = true;
  let substepIndex = 0;
  const directives: PlayerCombatDirective[] = [];
  while (remaining + Number.EPSILON >= FIXED_STEP) {
    const step = advanceSubstep(current, machine, firstStep ? input : emptyEdges(input), context);
    current = ageExistingBarrier(current, step.state);
    machine = step.machine;
    directives.push(
      ...step.directives.map((directive): PlayerCombatDirective => {
        if (directive.kind === 'cue') return directive;
        const activationDelayFrames = (directive.activationDelayFrames ?? 0) + substepIndex;
        return activationDelayFrames === 0 ? directive : { ...directive, activationDelayFrames };
      })
    );
    remaining -= FIXED_STEP;
    firstStep = false;
    substepIndex += 1;
  }
  current = { ...current, frameRemainder: Math.max(0, remaining) };
  const movementLocked = locksMovement(machine);
  return {
    state: current,
    machine,
    movementLocked,
    invulnerable: current.invulnerableFrames > 0,
    guard: guardFor(current, machine),
    dashVelocityX: machine.value === 'dash' ? current.dashVelocityX : 0,
    directives
  };
};

export const interceptPlayerProjectile = (
  state: PlayerCombatState,
  projectile: ProjectileSnapshot
): PlayerProjectileIntercept => {
  if (state.barrier === undefined) {
    return {
      converted: false,
      manaRestored: 0,
      projectileId: projectile.id,
      state
    };
  }
  const result = resolveAegisProjectile(state.barrier, projectile, {
    actorId: 'mara-vey',
    mana: state.mana,
    maximumMana: state.maximumMana,
    state: 'block',
    grounded: true,
    facing: 'right',
    nowMs: 0,
    unlockedAbilityIds: state.unlockedAbilityIds,
    cooldownReadyAt: state.cooldownReadyAt
  });
  return {
    converted: result.converted,
    manaRestored: result.actor.mana - state.mana,
    projectileId: result.projectileId,
    state: {
      ...state,
      mana: result.actor.mana,
      barrier: result.barrier
    }
  };
};

export const applyCombatMovementLocks = (
  input: MovementInput,
  combat: Pick<PlayerCombatStep, 'movementLocked'>
): MovementInput =>
  combat.movementLocked
    ? {
        ...input,
        moveX: 0,
        jumpPressed: false,
        jumpHeld: false
      }
    : input;
