import {
  stepMovement,
  type MovementInput,
  type MovementState,
  type MovementStep,
  type MovementTuning
} from './MovementModel';
import type { PlatformRules } from './PlatformRules';

export const advanceMovementFrame = (
  state: MovementState,
  input: MovementInput,
  platforms: PlatformRules,
  tuning: MovementTuning,
  deltaSeconds: number
): MovementStep => {
  let remaining = Math.min(tuning.maxFrameTime, Math.max(0, deltaSeconds));
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
    const contacts = platforms.query(current.position, {
      ignoreOneWay: current.dropThroughRemaining > 0
    });
    const step = stepMovement(current, stepInput, contacts, tuning, stepTime);
    const resolution = step.events.respawned
      ? {
          position: step.state.position,
          velocity: step.state.velocity
        }
      : platforms.resolve(current.position, step.state.position, step.state.velocity, {
          ignoreOneWay: step.state.dropThroughRemaining > 0
        });
    current = {
      ...step.state,
      position: resolution.position,
      velocity: resolution.velocity
    };
    animation = {
      ...step.animation,
      state: current.machine.value,
      facing: current.facing
    };
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
