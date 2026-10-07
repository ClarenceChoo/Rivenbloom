import { describe, expect, test } from 'vitest';

import { CameraDirector } from '../../src/game/camera/CameraDirector';
import type { CameraPort } from '../../src/game/camera/CameraDirector';

class RecordingCamera implements CameraPort {
  public readonly viewportWidth = 1_280;
  public readonly viewportHeight = 720;
  public scrollX = 0;
  public scrollY = 0;
  public zoom = 1;
  public deadZone = { width: 0, height: 0 };
  public stopped = false;

  public setScroll(x: number, y: number): void {
    this.scrollX = x;
    this.scrollY = y;
  }

  public setZoom(zoom: number): void {
    this.zoom = zoom;
  }

  public setDeadZone(width: number, height: number): void {
    this.deadZone = { width, height };
  }

  public stopFollow(): void {
    this.stopped = true;
  }
}

const ROOM = Object.freeze({ x: 0, y: 0, width: 2_560, height: 720 });

describe('CameraDirector', () => {
  test('keeps motion inside the dead zone while applying horizontal look-ahead', () => {
    const camera = new RecordingCamera();
    const director = new CameraDirector(camera);
    const options = {
      dt: 1 / 60,
      deadZone: { width: 320, height: 180 },
      lookAheadDistance: 120,
      facing: 'right' as const,
      verticalSmoothing: 8,
      reducedMotion: false,
    };

    director.follow({ x: 700, y: 500 }, ROOM, options);
    director.follow({ x: 750, y: 500 }, ROOM, options);

    expect(camera.deadZone).toEqual({ width: 320, height: 180 });
    expect(camera.scrollX).toBe(180);
    expect(camera.scrollY).toBe(0);
  });

  test('smooths vertical tracking unless reduced motion requests an immediate settle', () => {
    const camera = new RecordingCamera();
    const director = new CameraDirector(camera);
    const room = { x: 0, y: 0, width: 2_560, height: 1_440 };
    const options = {
      dt: 1 / 60,
      deadZone: { width: 0, height: 0 },
      lookAheadDistance: 120,
      facing: 'right' as const,
      verticalSmoothing: 8,
      reducedMotion: false,
    };
    director.follow({ x: 640, y: 360 }, room, options);

    director.follow({ x: 640, y: 720 }, room, options);
    expect(camera.scrollY).toBeCloseTo(44.938, 3);

    director.follow({ x: 640, y: 900 }, room, { ...options, reducedMotion: true });
    expect(camera.scrollY).toBe(540);
    expect(camera.scrollX).toBe(0);
  });

  test('eases look-ahead when facing reverses instead of jumping the view', () => {
    const camera = new RecordingCamera();
    const director = new CameraDirector(camera);
    const options = {
      dt: 1 / 60,
      deadZone: { width: 320, height: 180 },
      lookAheadDistance: 120,
      facing: 'right' as const,
      verticalSmoothing: 8,
      reducedMotion: false,
    };
    const target = { x: 1_280, y: 500 };
    director.follow(target, ROOM, options);
    const before = camera.scrollX;

    director.follow(target, ROOM, { ...options, facing: 'left', dt: 0 });
    expect(camera.scrollX).toBe(before);
    director.follow(target, ROOM, { ...options, facing: 'left' });
    expect(before - camera.scrollX).toBeGreaterThan(0);
    expect(before - camera.scrollX).toBeLessThan(40);

    for (let frame = 0; frame < 120; frame += 1) {
      director.follow(target, ROOM, { ...options, facing: 'left' });
    }
    expect(camera.scrollX).toBeCloseTo(520, 3);

    const beforeReturn = camera.scrollX;
    director.follow(target, ROOM, options);
    expect(camera.scrollX - beforeReturn).toBeGreaterThan(0);
    expect(camera.scrollX - beforeReturn).toBeLessThan(40);
  });

  test('look-ahead easing depends on elapsed time rather than frame count', () => {
    const scrolls = [30, 60, 120].map((fps) => {
      const camera = new RecordingCamera();
      const director = new CameraDirector(camera);
      const options = {
        dt: 1 / fps,
        deadZone: { width: 320, height: 180 },
        lookAheadDistance: 120,
        facing: 'right' as const,
        verticalSmoothing: 8,
        reducedMotion: false,
      };
      const target = { x: 1_280, y: 500 };
      director.follow(target, ROOM, options);
      for (let frame = 0; frame < fps / 2; frame += 1) {
        director.follow(target, ROOM, { ...options, facing: 'left' });
      }
      return camera.scrollX;
    });

    expect(scrolls[0]).toBeGreaterThan(520);
    expect(scrolls[0]).toBeLessThan(530);
    expect(scrolls[1]).toBeCloseTo(scrolls[0]!, 8);
    expect(scrolls[2]).toBeCloseTo(scrolls[0]!, 8);
  });

  test('centres camera axes whose room bounds are smaller than the viewport', () => {
    const camera = new RecordingCamera();
    const director = new CameraDirector(camera);

    director.follow(
      { x: 400, y: 250 },
      { x: 100, y: 50, width: 600, height: 400 },
      {
        dt: 1 / 60,
        deadZone: { width: 320, height: 180 },
        lookAheadDistance: 0,
        facing: 'right',
        verticalSmoothing: 8,
        reducedMotion: false,
      },
    );

    expect(camera.scrollX).toBe(-240);
    expect(camera.scrollY).toBe(-110);
  });

  test('cinematic framing overrides gameplay focus and zoom deterministically', () => {
    const camera = new RecordingCamera();
    const director = new CameraDirector(camera);

    director.follow(
      { x: 300, y: 300 },
      { x: 0, y: 0, width: 2_560, height: 1_440 },
      {
        dt: 1 / 60,
        deadZone: { width: 320, height: 180 },
        lookAheadDistance: 120,
        facing: 'left',
        verticalSmoothing: 8,
        reducedMotion: false,
        cinematic: { center: { x: 1_280, y: 500 }, zoom: 1.25 },
      },
    );

    expect(camera.zoom).toBe(1.25);
    expect(camera.scrollX).toBe(768);
    expect(camera.scrollY).toBe(212);
  });

  test('restores gameplay zoom when cinematic framing ends', () => {
    const camera = new RecordingCamera();
    const director = new CameraDirector(camera);
    const options = {
      dt: 1 / 60,
      deadZone: { width: 320, height: 180 },
      lookAheadDistance: 120,
      facing: 'right' as const,
      verticalSmoothing: 8,
      reducedMotion: false,
    };
    director.follow(
      { x: 700, y: 500 },
      { x: 0, y: 0, width: 2_560, height: 1_440 },
      { ...options, cinematic: { center: { x: 1_280, y: 500 }, zoom: 1.25 } },
    );

    director.follow({ x: 700, y: 500 }, { x: 0, y: 0, width: 2_560, height: 1_440 }, options);

    expect(camera.zoom).toBe(1);
  });

  test('dispose resets dead-zone, zoom, and follow resources owned by the director', () => {
    const camera = new RecordingCamera();
    const director = new CameraDirector(camera);
    director.follow({ x: 700, y: 500 }, ROOM, {
      dt: 1 / 60,
      deadZone: { width: 320, height: 180 },
      lookAheadDistance: 120,
      facing: 'right',
      verticalSmoothing: 8,
      reducedMotion: false,
      cinematic: { center: { x: 1_280, y: 360 }, zoom: 1.25 },
    });

    director.dispose();

    expect(camera.deadZone).toEqual({ width: 0, height: 0 });
    expect(camera.zoom).toBe(1);
    expect(camera.stopped).toBe(true);
  });
});
