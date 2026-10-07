import type { Rect, Vec2 } from '../data/types';

// Settle directional look-ahead over roughly half a second, independent of frame rate.
const LOOK_AHEAD_RESPONSE_PER_SECOND = 8;

export interface CameraPort {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly zoom: number;
  setScroll(x: number, y: number): void;
  setZoom(zoom: number): void;
  setDeadZone(width: number, height: number): void;
  stopFollow(): void;
}

export type CameraFollowOptions = Readonly<{
  dt: number;
  deadZone: Readonly<{ width: number; height: number }>;
  lookAheadDistance: number;
  facing: 'left' | 'right';
  verticalSmoothing: number;
  reducedMotion: boolean;
  cinematic?: Readonly<{ center: Vec2; zoom: number }> | null;
}>;

export class CameraDirector {
  private focus: Vec2 | null = null;
  private lookAhead: number | null = null;

  public constructor(private readonly camera: CameraPort) {}

  public follow(target: Vec2, roomBounds: Rect, options: CameraFollowOptions): void {
    if (options.cinematic !== undefined && options.cinematic !== null) {
      const zoom = Math.max(0.1, options.cinematic.zoom);
      this.camera.setZoom(zoom);
      this.camera.setDeadZone(0, 0);
      this.focus = Object.freeze({ ...options.cinematic.center });
      this.lookAhead = null;
      const viewportWidth = this.camera.viewportWidth / zoom;
      const viewportHeight = this.camera.viewportHeight / zoom;
      this.camera.setScroll(
        clampScroll(
          options.cinematic.center.x - viewportWidth / 2,
          roomBounds.x,
          roomBounds.width,
          viewportWidth,
        ),
        clampScroll(
          options.cinematic.center.y - viewportHeight / 2,
          roomBounds.y,
          roomBounds.height,
          viewportHeight,
        ),
      );
      return;
    }
    if (this.camera.zoom !== 1) this.camera.setZoom(1);
    const firstFrame = this.focus === null;
    const focus = this.focus ?? target;
    const nextFocus = Object.freeze({
      x: deadZoneAxis(focus.x, target.x, options.deadZone.width),
      y: deadZoneAxis(focus.y, target.y, options.deadZone.height),
    });
    this.focus = nextFocus;
    const desiredLookAhead = options.reducedMotion
      ? 0
      : options.lookAheadDistance * (options.facing === 'left' ? -1 : 1);
    const lookAheadAlpha = 1 - Math.exp(-LOOK_AHEAD_RESPONSE_PER_SECOND * Math.max(0, options.dt));
    this.lookAhead =
      this.lookAhead === null || options.reducedMotion
        ? desiredLookAhead
        : this.lookAhead + (desiredLookAhead - this.lookAhead) * lookAheadAlpha;
    const viewportWidth = this.camera.viewportWidth / this.camera.zoom;
    const viewportHeight = this.camera.viewportHeight / this.camera.zoom;
    const desiredX = nextFocus.x + this.lookAhead - viewportWidth / 2;
    const desiredY = nextFocus.y - viewportHeight / 2;
    const verticalAlpha =
      firstFrame || options.reducedMotion
        ? 1
        : 1 - Math.exp(-Math.max(0, options.verticalSmoothing) * Math.max(0, options.dt));
    const smoothedY = this.camera.scrollY + (desiredY - this.camera.scrollY) * verticalAlpha;

    this.camera.setDeadZone(options.deadZone.width, options.deadZone.height);
    this.camera.setScroll(
      clampScroll(desiredX, roomBounds.x, roomBounds.width, viewportWidth),
      clampScroll(smoothedY, roomBounds.y, roomBounds.height, viewportHeight),
    );
  }

  public dispose(): void {
    this.focus = null;
    this.lookAhead = null;
    this.camera.setDeadZone(0, 0);
    this.camera.setZoom(1);
    this.camera.stopFollow();
  }
}

function deadZoneAxis(focus: number, target: number, size: number): number {
  const half = Math.max(0, size) / 2;
  if (target > focus + half) return target - half;
  if (target < focus - half) return target + half;
  return focus;
}

function clampScroll(desired: number, origin: number, size: number, viewportSize: number): number {
  if (size <= viewportSize) return origin + (size - viewportSize) / 2;
  return Math.min(origin + size - viewportSize, Math.max(origin, desired));
}
