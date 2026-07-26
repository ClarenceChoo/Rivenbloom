import type Phaser from 'phaser';
import type { RectDefinition, SizeDefinition } from '../data/types';
import type { Facing, Vector2 } from '../physics/MovementModel';

export type CameraTuning = {
  readonly viewport: SizeDefinition;
  readonly horizontalDeadZone: number;
  readonly verticalDeadZone: number;
  readonly lookAheadDistance: number;
  readonly verticalSmoothing: number;
  readonly defaultZoom: number;
};

export type CameraFrame = {
  readonly center: Vector2;
  readonly zoom: number;
};

export type CameraFollowOptions = {
  readonly facing: Facing;
  readonly reducedMotion: boolean;
  readonly deltaSeconds: number;
  readonly cinematic?: CameraFrame;
};

export const computeCameraFrame = (
  current: CameraFrame,
  target: Vector2,
  roomBounds: RectDefinition,
  options: CameraFollowOptions,
  tuning: CameraTuning
): CameraFrame => {
  if (options.cinematic !== undefined) return options.cinematic;
  const lookAhead = options.reducedMotion
    ? 0
    : (options.facing === 'right' ? 1 : -1) * tuning.lookAheadDistance;
  const horizontalTarget = target.x + lookAhead;
  let x = current.center.x;
  if (horizontalTarget > x + tuning.horizontalDeadZone) {
    x = horizontalTarget - tuning.horizontalDeadZone;
  } else if (horizontalTarget < x - tuning.horizontalDeadZone) {
    x = horizontalTarget + tuning.horizontalDeadZone;
  }
  let desiredY = current.center.y;
  if (target.y > desiredY + tuning.verticalDeadZone) {
    desiredY = target.y - tuning.verticalDeadZone;
  } else if (target.y < desiredY - tuning.verticalDeadZone) {
    desiredY = target.y + tuning.verticalDeadZone;
  }
  const verticalBlend = options.reducedMotion
    ? 1
    : Math.min(1, tuning.verticalSmoothing * Math.max(0, options.deltaSeconds));
  const y = current.center.y + (desiredY - current.center.y) * verticalBlend;
  const halfWidth = tuning.viewport.width / (2 * tuning.defaultZoom);
  const halfHeight = tuning.viewport.height / (2 * tuning.defaultZoom);
  const minimumX = roomBounds.x + halfWidth;
  const maximumX = roomBounds.x + roomBounds.width - halfWidth;
  const minimumY = roomBounds.y + halfHeight;
  const maximumY = roomBounds.y + roomBounds.height - halfHeight;
  const boundedX =
    maximumX < minimumX
      ? roomBounds.x + roomBounds.width / 2
      : Math.max(minimumX, Math.min(maximumX, x));
  const boundedY =
    maximumY < minimumY
      ? roomBounds.y + roomBounds.height / 2
      : Math.max(minimumY, Math.min(maximumY, y));
  return {
    center: { x: boundedX, y: boundedY },
    zoom: tuning.defaultZoom
  };
};

export class CameraDirector {
  private frame: CameraFrame | undefined;

  public constructor(
    private readonly camera: Phaser.Cameras.Scene2D.Camera,
    private readonly tuning: CameraTuning
  ) {}

  public follow(target: Vector2, roomBounds: RectDefinition, options: CameraFollowOptions): void {
    this.camera.setBounds(roomBounds.x, roomBounds.y, roomBounds.width, roomBounds.height);
    const current =
      this.frame ??
      ({
        center: {
          x: this.camera.midPoint.x,
          y: this.camera.midPoint.y
        },
        zoom: this.camera.zoom
      } satisfies CameraFrame);
    this.frame = computeCameraFrame(current, target, roomBounds, options, this.tuning);
    this.camera.setZoom(this.frame.zoom);
    this.camera.centerOn(this.frame.center.x, this.frame.center.y);
  }

  public get currentFrame(): CameraFrame | undefined {
    return this.frame;
  }

  public dispose(): void {
    this.frame = undefined;
  }
}
