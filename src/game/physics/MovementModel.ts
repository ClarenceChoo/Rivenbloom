import {
  createPlayerStateMachine,
  requestPlayerState,
  type PlayerStateMachine
} from '../entities/player/PlayerState';

export type Vector2 = {
  readonly x: number;
  readonly y: number;
};

export type Facing = 'left' | 'right';

export type MovementTuning = {
  readonly maxRunSpeed: number;
  readonly groundAcceleration: number;
  readonly groundBraking: number;
  readonly groundFriction: number;
  readonly airAcceleration: number;
  readonly gravity: number;
  readonly jumpSpeed: number;
  readonly jumpCutSpeed: number;
  readonly maxFallSpeed: number;
  readonly coyoteTime: number;
  readonly jumpBufferTime: number;
  readonly landingLockTime: number;
  readonly climbSpeed: number;
  readonly dropThroughTime: number;
  readonly dropSpeed: number;
  readonly knockbackLockTime: number;
  readonly fixedStep: number;
  readonly maxFrameTime: number;
};

export type MovementInput = {
  readonly moveX: number;
  readonly moveY: number;
  readonly jumpPressed: boolean;
  readonly jumpHeld: boolean;
  readonly dropPressed: boolean;
  readonly respawn: boolean;
  readonly knockback?: Vector2;
};

export type MovementContacts = {
  readonly grounded: boolean;
  readonly supportKind?: 'solid' | 'one-way';
  readonly climbable: boolean;
};

export type MovementState = {
  readonly position: Vector2;
  readonly velocity: Vector2;
  readonly facing: Facing;
  readonly spawnPosition: Vector2;
  readonly spawnFacing: Facing;
  readonly machine: PlayerStateMachine;
  readonly grounded: boolean;
  readonly coyoteRemaining: number;
  readonly jumpBufferRemaining: number;
  readonly landingRemaining: number;
  readonly dropThroughRemaining: number;
  readonly knockbackRemaining: number;
};

export type MovementStep = {
  readonly state: MovementState;
  readonly animation: {
    readonly state: PlayerStateMachine['value'];
    readonly facing: Facing;
    readonly speedRatio: number;
  };
  readonly events: {
    readonly jumped: boolean;
    readonly landed: boolean;
    readonly dropThroughStarted: boolean;
    readonly respawned: boolean;
  };
};

export const createMovementState = (position: Vector2, facing: Facing): MovementState => ({
  position,
  velocity: { x: 0, y: 0 },
  facing,
  spawnPosition: position,
  spawnFacing: facing,
  machine: createPlayerStateMachine(),
  grounded: true,
  coyoteRemaining: 0,
  jumpBufferRemaining: 0,
  landingRemaining: 0,
  dropThroughRemaining: 0,
  knockbackRemaining: 0
});

const moveToward = (value: number, target: number, amount: number): number => {
  if (value < target) return Math.min(target, value + amount);
  if (value > target) return Math.max(target, value - amount);
  return target;
};

const stepMovementOnce = (
  state: MovementState,
  input: MovementInput,
  contacts: MovementContacts,
  tuning: MovementTuning,
  dt: number
): MovementStep => {
  if (input.respawn) {
    const reset = createMovementState(state.spawnPosition, state.spawnFacing);
    return {
      state: reset,
      animation: {
        state: reset.machine.value,
        facing: reset.facing,
        speedRatio: 0
      },
      events: {
        jumped: false,
        landed: false,
        dropThroughStarted: false,
        respawned: true
      }
    };
  }
  const moveX = Math.max(-1, Math.min(1, input.moveX));
  const knockbackStarted = input.knockback !== undefined;
  const knockbackRemaining = knockbackStarted
    ? tuning.knockbackLockTime
    : Math.max(0, state.knockbackRemaining - dt);
  const knockbackLocked = knockbackStarted || knockbackRemaining > 0;
  const dropThroughStarted =
    !knockbackLocked &&
    input.dropPressed &&
    contacts.grounded &&
    contacts.supportKind === 'one-way';
  const dropThroughActive = dropThroughStarted || state.dropThroughRemaining > 0;
  const effectivelyGrounded = contacts.grounded && !dropThroughActive && !knockbackLocked;
  const landed =
    effectivelyGrounded &&
    !state.grounded &&
    state.velocity.y >= 0 &&
    (state.machine.value === 'fall' || state.machine.value === 'jump');
  const landingRemaining = landed
    ? tuning.landingLockTime
    : state.machine.value === 'land'
      ? Math.max(0, state.landingRemaining - dt)
      : 0;
  const landingLocked = landed || (state.machine.value === 'land' && landingRemaining > 0);
  const controlMoveX = landingLocked || knockbackLocked ? 0 : moveX;
  const reversing =
    state.velocity.x !== 0 && Math.sign(state.velocity.x) !== Math.sign(controlMoveX);
  const velocityX = knockbackStarted
    ? input.knockback.x
    : knockbackLocked
      ? state.velocity.x
      : controlMoveX === 0
        ? effectivelyGrounded || state.machine.value === 'climb'
          ? moveToward(state.velocity.x, 0, tuning.groundFriction * dt)
          : state.velocity.x
        : moveToward(
            state.velocity.x,
            controlMoveX * tuning.maxRunSpeed,
            (effectivelyGrounded
              ? reversing
                ? tuning.groundBraking
                : tuning.groundAcceleration
              : tuning.airAcceleration) * dt
          );
  const coyoteRemaining = effectivelyGrounded
    ? tuning.coyoteTime
    : Math.max(0, state.coyoteRemaining - dt);
  const jumpBufferRemaining = dropThroughStarted
    ? 0
    : input.jumpPressed
      ? tuning.jumpBufferTime
      : Math.max(0, state.jumpBufferRemaining - dt);
  const jumped = jumpBufferRemaining > 0 && (effectivelyGrounded || coyoteRemaining > 0);
  const climbing =
    contacts.climbable &&
    (input.moveY !== 0 || state.machine.value === 'climb') &&
    !jumped &&
    !dropThroughActive;
  const verticalStart =
    !input.jumpHeld && state.machine.value === 'jump' && state.velocity.y < -tuning.jumpCutSpeed
      ? -tuning.jumpCutSpeed
      : state.velocity.y;
  const velocityY = knockbackStarted
    ? input.knockback.y
    : dropThroughStarted
      ? tuning.dropSpeed
      : jumped
        ? -tuning.jumpSpeed
        : climbing
          ? Math.max(-1, Math.min(1, input.moveY)) * tuning.climbSpeed
          : effectivelyGrounded
            ? 0
            : Math.min(tuning.maxFallSpeed, verticalStart + tuning.gravity * dt);
  let machine = state.machine;
  if (knockbackStarted) machine = requestPlayerState(machine, 'hurt');
  else if (dropThroughStarted) machine = requestPlayerState(machine, 'fall');
  else if (jumped) machine = requestPlayerState(machine, 'jump');
  else if (climbing) machine = requestPlayerState(machine, 'climb');
  else if (landed) machine = requestPlayerState(machine, 'land');
  else if (!effectivelyGrounded && (machine.value !== 'jump' || velocityY >= 0)) {
    machine = requestPlayerState(machine, 'fall');
  } else if (controlMoveX !== 0) machine = requestPlayerState(machine, 'run');
  else if (effectivelyGrounded && velocityX === 0 && !landingLocked) {
    machine = requestPlayerState(machine, 'idle');
  }
  const nextState: MovementState = {
    ...state,
    position: {
      x: state.position.x + velocityX * dt,
      y: state.position.y + velocityY * dt
    },
    velocity: { x: velocityX, y: velocityY },
    facing: controlMoveX < 0 ? 'left' : controlMoveX > 0 ? 'right' : state.facing,
    machine,
    grounded: effectivelyGrounded && !jumped && !climbing,
    coyoteRemaining: jumped ? 0 : coyoteRemaining,
    jumpBufferRemaining: jumped ? 0 : jumpBufferRemaining,
    landingRemaining,
    dropThroughRemaining: dropThroughStarted
      ? tuning.dropThroughTime
      : Math.max(0, state.dropThroughRemaining - dt),
    knockbackRemaining
  };
  return {
    state: nextState,
    animation: {
      state: nextState.machine.value,
      facing: nextState.facing,
      speedRatio: Math.abs(velocityX) / tuning.maxRunSpeed
    },
    events: {
      jumped,
      landed,
      dropThroughStarted,
      respawned: false
    }
  };
};

export const stepMovement = (
  state: MovementState,
  input: MovementInput,
  contacts: MovementContacts,
  tuning: MovementTuning,
  dt: number
): MovementStep => {
  let remaining = Math.min(tuning.maxFrameTime, Math.max(0, dt));
  let current = state;
  let animation: MovementStep['animation'] = {
    state: state.machine.value,
    facing: state.facing,
    speedRatio: Math.abs(state.velocity.x) / tuning.maxRunSpeed
  };
  let jumped = false;
  let landed = false;
  let dropThroughStarted = false;
  let respawned = false;
  let firstStep = true;

  while (remaining > Number.EPSILON) {
    const stepTime = Math.min(tuning.fixedStep, remaining);
    const stepInput: MovementInput = firstStep
      ? input
      : {
          ...input,
          jumpPressed: false,
          dropPressed: false,
          respawn: false,
          knockback: undefined
        };
    const step = stepMovementOnce(current, stepInput, contacts, tuning, stepTime);
    current = step.state;
    animation = step.animation;
    jumped ||= step.events.jumped;
    landed ||= step.events.landed;
    dropThroughStarted ||= step.events.dropThroughStarted;
    respawned ||= step.events.respawned;
    remaining -= stepTime;
    firstStep = false;
  }

  return {
    state: current,
    animation,
    events: { jumped, landed, dropThroughStarted, respawned }
  };
};
