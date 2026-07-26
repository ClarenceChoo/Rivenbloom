import { describe, expect, it } from 'vitest';
import {
  segmentIntersectsRect,
  senseTarget,
  type PerceptionObserver,
  type PerceptionTarget
} from '../../src/game/ai/Perception';

const observer = (update: Partial<PerceptionObserver> = {}): PerceptionObserver => ({
  position: { x: 400, y: 600 },
  facing: 'right',
  eyeHeight: 60,
  sightRange: 420,
  sightVerticalRange: 200,
  rearRange: 90,
  hearingRange: 320,
  ...update
});

const target = (update: Partial<PerceptionTarget> = {}): PerceptionTarget => ({
  position: { x: 640, y: 600 },
  eyeHeight: 60,
  noiseLevel: 0,
  ...update
});

describe('segmentIntersectsRect', () => {
  it('detects crossing, containment, and clean misses', () => {
    const rect = { x: 100, y: 100, width: 50, height: 50 };
    expect(segmentIntersectsRect({ x: 0, y: 125 }, { x: 200, y: 125 }, rect)).toBe(true);
    expect(segmentIntersectsRect({ x: 110, y: 110 }, { x: 140, y: 140 }, rect)).toBe(true);
    expect(segmentIntersectsRect({ x: 0, y: 0 }, { x: 200, y: 60 }, rect)).toBe(false);
    expect(segmentIntersectsRect({ x: 0, y: 200 }, { x: 90, y: 125 }, rect)).toBe(false);
  });
});

describe('senseTarget', () => {
  it('alerts on a facing target in range with clear line of sight', () => {
    const sample = senseTarget(observer(), target(), []);
    expect(sample).toMatchObject({ level: 'alert', visible: true, heard: false });
    expect(sample.distance).toBeCloseTo(240);
  });

  it('does not see behind itself beyond the rear radius but hears movement noise', () => {
    const behind = senseTarget(
      observer({ facing: 'left' }),
      target({ position: { x: 640, y: 600 }, noiseLevel: 1 }),
      []
    );
    expect(behind.visible).toBe(false);
    expect(behind).toMatchObject({ level: 'suspicious', heard: true });

    const close = senseTarget(
      observer({ facing: 'left' }),
      target({ position: { x: 460, y: 600 } }),
      []
    );
    expect(close).toMatchObject({ level: 'alert', visible: true });
  });

  it('blocks sight with solid obstacles while hearing passes through', () => {
    const wall = { x: 500, y: 400, width: 40, height: 220 };
    const blocked = senseTarget(observer(), target({ noiseLevel: 1 }), [wall]);
    expect(blocked.visible).toBe(false);
    expect(blocked).toMatchObject({ level: 'suspicious', heard: true });
  });

  it('scales hearing by noise level and ignores silent targets', () => {
    const silent = senseTarget(
      observer({ facing: 'left' }),
      target({ position: { x: 700, y: 600 }, noiseLevel: 0 }),
      []
    );
    expect(silent.level).toBe('unaware');

    const quiet = senseTarget(
      observer({ facing: 'left' }),
      target({ position: { x: 700, y: 600 }, noiseLevel: 0.5 }),
      []
    );
    expect(quiet.level).toBe('unaware');

    const loud = senseTarget(
      observer({ facing: 'left' }),
      target({ position: { x: 700, y: 600 }, noiseLevel: 1 }),
      []
    );
    expect(loud.level).toBe('suspicious');
  });

  it('gates sight vertically so enemies do not track through floors', () => {
    const above = senseTarget(observer(), target({ position: { x: 520, y: 320 } }), []);
    expect(above.visible).toBe(false);
    expect(above.level).toBe('unaware');
  });
});
