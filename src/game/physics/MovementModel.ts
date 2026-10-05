import type { Vec2 } from '../data/types';

export type GroundSurfaceKind = 'solid' | 'one-way';

export type MovementState = Readonly<{
  position: Vec2;
  velocity: Vec2;
  grounded: boolean;
  coyoteRemaining: number;
  jumpCutApplied: boolean;
  dropThroughRemaining: number;
  landingLockRemaining: number;
  knockbackRemaining: number;
  climbEngaged: boolean;
  climbDetachRemaining: number;
}>;

export type MovementInput = Readonly<{
  moveX: number;
  moveY: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
  dropPressed: boolean;
}>;

export type MovementContacts = Readonly<{
  groundY: number | null;
  groundedSurface: GroundSurfaceKind | null;
  ceilingY: number | null;
  climbZone: boolean;
  climbCenterX: number | null;
}>;

export type MovementTuning = Readonly<{
  maxSpeed: number;
  acceleration: number;
  friction: number;
  gravity: number;
  jumpSpeed: number;
  maxFallSpeed: number;
  coyoteSeconds: number;
  jumpCutMultiplier: number;
  climbSpeed: number;
  climbDetachSeconds: number;
  dropThroughSeconds: number;
  landingLockSeconds: number;
  maxStepSeconds: number;
}>;

export type MovementStep = Readonly<{
  state: MovementState;
  landed: boolean;
  jumped: boolean;
  animationIntent: 'idle' | 'run' | 'jump' | 'fall' | 'land' | 'climb';
}>;

export const DEFAULT_MOVEMENT_TUNING: MovementTuning = Object.freeze({
  maxSpeed: 280,
  acceleration: 1_800,
  friction: 2_200,
  gravity: 1_900,
  jumpSpeed: 680,
  maxFallSpeed: 900,
  coyoteSeconds: 0.1,
  jumpCutMultiplier: 0.45,
  climbSpeed: 180,
  climbDetachSeconds: 0.12,
  dropThroughSeconds: 0.18,
  landingLockSeconds: 0.05,
  maxStepSeconds: 1 / 60,
});

export function createMovementState(position: Vec2): MovementState {
  return freezeState({
    position,
    velocity: { x: 0, y: 0 },
    grounded: false,
    coyoteRemaining: 0,
    jumpCutApplied: false,
    dropThroughRemaining: 0,
    landingLockRemaining: 0,
    knockbackRemaining: 0,
    climbEngaged: false,
    climbDetachRemaining: 0,
  });
}

export function stepMovement(
  state: MovementState,
  input: MovementInput,
  contacts: MovementContacts,
  tuning: MovementTuning,
  dt: number,
): MovementStep {
  const ladderJump = input.jumpPressed && state.climbEngaged;
  const climbing =
    contacts.climbZone &&
    state.climbDetachRemaining === 0 &&
    !input.jumpPressed &&
    (state.climbEngaged || input.moveY !== 0);
  const targetX = clamp(input.moveX, -1, 1) * tuning.maxSpeed;
  const horizontalRate = input.moveX === 0 ? tuning.friction : tuning.acceleration;
  const aligning = climbing && input.moveX === 0 && contacts.climbCenterX !== null;
  const regularVelocityX =
    state.knockbackRemaining > 0
      ? state.velocity.x
      : moveToward(state.velocity.x, targetX, horizontalRate * dt);
  const nextX = aligning
    ? moveToward(
        state.position.x,
        contacts.climbCenterX ?? state.position.x,
        tuning.maxSpeed * 2 * dt,
      )
    : state.position.x + regularVelocityX * dt;
  const velocityX = aligning ? (nextX - state.position.x) / dt : regularVelocityX;
  const cutsJump =
    state.knockbackRemaining === 0 &&
    !input.jumpHeld &&
    state.velocity.y < 0 &&
    !state.jumpCutApplied;
  const fallingVelocityY = climbing
    ? clamp(input.moveY, -1, 1) * tuning.climbSpeed
    : cutsJump
      ? state.velocity.y * tuning.jumpCutMultiplier
      : Math.min(state.velocity.y + tuning.gravity * dt, tuning.maxFallSpeed);
  const rawSupported =
    !climbing &&
    contacts.groundY !== null &&
    Math.abs(state.position.y - contacts.groundY) < 0.001 &&
    state.velocity.y >= 0;
  const dropRequested = input.dropPressed && rawSupported && contacts.groundedSurface === 'one-way';
  const dropping = state.dropThroughRemaining > 0 || dropRequested;
  const supported = rawSupported && !dropping;
  const reachesGround =
    !climbing &&
    !dropping &&
    contacts.groundY !== null &&
    fallingVelocityY >= 0 &&
    state.position.y <= contacts.groundY &&
    state.position.y + fallingVelocityY * dt >= contacts.groundY;
  const coyoteRemaining = dropRequested
    ? 0
    : supported
      ? tuning.coyoteSeconds
      : Math.max(0, (state.grounded ? tuning.coyoteSeconds : state.coyoteRemaining) - dt);
  const jumped = ladderJump || (input.jumpPressed && (coyoteRemaining > 0 || reachesGround));
  const velocityY = jumped ? -tuning.jumpSpeed : supported || reachesGround ? 0 : fallingVelocityY;
  const baseY = reachesGround && contacts.groundY !== null ? contacts.groundY : state.position.y;
  const landed = reachesGround && !state.grounded && !jumped;
  const next = freezeState({
    ...state,
    position: {
      x: nextX,
      y: baseY + velocityY * dt,
    },
    velocity: { x: velocityX, y: velocityY },
    grounded: (supported || reachesGround) && !jumped,
    coyoteRemaining: jumped ? 0 : coyoteRemaining,
    jumpCutApplied: jumped
      ? false
      : supported || reachesGround
        ? false
        : state.jumpCutApplied || cutsJump,
    dropThroughRemaining: dropRequested
      ? tuning.dropThroughSeconds
      : Math.max(0, state.dropThroughRemaining - dt),
    landingLockRemaining: landed
      ? tuning.landingLockSeconds
      : Math.max(0, state.landingLockRemaining - dt),
    knockbackRemaining: Math.max(0, state.knockbackRemaining - dt),
    climbEngaged: climbing && !jumped,
    climbDetachRemaining: ladderJump
      ? tuning.climbDetachSeconds
      : Math.max(0, state.climbDetachRemaining - dt),
  });
  const landingIntent = landed || (!jumped && next.grounded && next.landingLockRemaining > 0);
  return Object.freeze({
    state: next,
    landed,
    jumped,
    animationIntent: climbing
      ? 'climb'
      : landingIntent
        ? 'land'
        : jumped
          ? 'jump'
          : velocityY < 0
            ? 'jump'
            : velocityY > 0
              ? 'fall'
              : velocityX === 0
                ? 'idle'
                : 'run',
  });
}

function moveToward(value: number, target: number, amount: number): number {
  if (value < target) return Math.min(value + amount, target);
  return Math.max(value - amount, target);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function freezeState(state: MovementState): MovementState {
  return Object.freeze({
    ...state,
    position: Object.freeze({ ...state.position }),
    velocity: Object.freeze({ ...state.velocity }),
  });
}
