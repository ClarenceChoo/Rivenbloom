import type { CameraTuning } from '../camera/CameraDirector';
import type { MovementTuning } from '../physics/MovementModel';

export const PLAYER_MOVEMENT_TUNING: MovementTuning = {
  maxRunSpeed: 240,
  groundAcceleration: 1200,
  groundBraking: 1800,
  groundFriction: 900,
  airAcceleration: 720,
  gravity: 1800,
  jumpSpeed: 600,
  jumpCutSpeed: 240,
  maxFallSpeed: 900,
  coyoteTime: 0.1,
  jumpBufferTime: 0.12,
  landingLockTime: 0.12,
  climbSpeed: 160,
  dropThroughTime: 0.18,
  dropSpeed: 60,
  knockbackLockTime: 0.16,
  fixedStep: 1 / 60,
  maxFrameTime: 0.05
};

export const PLAYER_CAMERA_TUNING: CameraTuning = {
  viewport: { width: 1280, height: 720 },
  horizontalDeadZone: 120,
  verticalDeadZone: 48,
  lookAheadDistance: 96,
  verticalSmoothing: 6,
  defaultZoom: 1
};
