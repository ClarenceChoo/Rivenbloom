import { describe, expect, it } from 'vitest';
import {
  computeCameraFrame,
  type CameraFollowOptions,
  type CameraFrame,
  type CameraTuning
} from '../../src/game/camera/CameraDirector';

const tuning: CameraTuning = {
  viewport: { width: 1280, height: 720 },
  horizontalDeadZone: 120,
  verticalDeadZone: 48,
  lookAheadDistance: 96,
  verticalSmoothing: 6,
  defaultZoom: 1
};

const bounds = { x: 0, y: 0, width: 2560, height: 720 };
const current: CameraFrame = {
  center: { x: 640, y: 360 },
  zoom: 1
};
const options: CameraFollowOptions = {
  facing: 'right',
  reducedMotion: false,
  deltaSeconds: 1 / 60
};

describe('computeCameraFrame', () => {
  it('applies look-ahead only after the target leaves the horizontal dead zone', () => {
    const frame = computeCameraFrame(current, { x: 700, y: 360 }, bounds, options, tuning);

    expect(frame).toEqual({
      center: { x: 676, y: 360 },
      zoom: 1
    });
  });

  it('smooths vertical correction after the target leaves the vertical dead zone', () => {
    const frame = computeCameraFrame(
      current,
      { x: 544, y: 500 },
      { x: 0, y: 0, width: 2560, height: 1440 },
      options,
      tuning
    );

    expect(frame.center.x).toBe(640);
    expect(frame.center.y).toBeCloseTo(369.2, 8);
  });

  it('contains the viewport within authored room boundaries', () => {
    const frame = computeCameraFrame(current, { x: 2500, y: 360 }, bounds, options, tuning);

    expect(frame.center).toEqual({ x: 1920, y: 360 });
  });

  it('removes look-ahead and easing when reduced motion is enabled', () => {
    const frame = computeCameraFrame(
      current,
      { x: 700, y: 500 },
      { x: 0, y: 0, width: 2560, height: 1440 },
      { ...options, reducedMotion: true },
      tuning
    );

    expect(frame.center).toEqual({ x: 640, y: 452 });
  });

  it('uses explicit cinematic framing without gameplay follow offsets', () => {
    const frame = computeCameraFrame(
      current,
      { x: 700, y: 500 },
      { x: 0, y: 0, width: 2560, height: 1440 },
      {
        ...options,
        cinematic: {
          center: { x: 1280, y: 480 },
          zoom: 1.1
        }
      },
      tuning
    );

    expect(frame).toEqual({
      center: { x: 1280, y: 480 },
      zoom: 1.1
    });
  });
});
