import { describe, expect, it } from 'vitest';
import { EffectPool } from '../../src/game/effects/EffectPool';
import { combatFeedbackFor } from '../../src/game/effects/ParticleProfiles';
import { DEFAULT_ACCESSIBILITY_SETTINGS } from '../../src/game/config/accessibility';

type Member = {
  readonly id: number;
  value: string;
  active: boolean;
};

describe('EffectPool', () => {
  it('preallocates a bounded capacity, drops overflow, and reuses released members', () => {
    let allocations = 0;
    const pool = new EffectPool<string, Member>({
      capacity: 2,
      create: (index) => {
        allocations += 1;
        return { id: index, value: '', active: false };
      },
      activate: (member, value) => {
        member.value = value;
        member.active = true;
      },
      deactivate: (member) => {
        member.active = false;
      }
    });

    const first = pool.spawn('slash');
    const second = pool.spawn('impact');
    const dropped = pool.spawn('overflow');
    if (first === undefined) throw new Error('Expected first pooled member.');
    pool.release(first);
    const reused = pool.spawn('label');

    expect(allocations).toBe(2);
    expect(second?.value).toBe('impact');
    expect(dropped).toBeUndefined();
    expect(pool.droppedCount).toBe(1);
    expect(reused).toBe(first);
    expect(reused?.value).toBe('label');
    expect(pool.activeCount).toBe(2);
  });

  it('deactivates every active member during disposal without allocating', () => {
    let deactivations = 0;
    const pool = new EffectPool<number, Member>({
      capacity: 2,
      create: (index) => ({ id: index, value: '', active: false }),
      activate: (member, value) => {
        member.value = String(value);
        member.active = true;
      },
      deactivate: (member) => {
        member.active = false;
        deactivations += 1;
      }
    });
    pool.spawn(1);
    pool.spawn(2);

    pool.dispose();

    expect(deactivations).toBe(2);
    expect(pool.activeCount).toBe(0);
    expect(pool.spawn(3)).toBeUndefined();
  });
});

describe('combatFeedbackFor', () => {
  it('scales directional shake, flash, particles, and optional labels from accessibility state', () => {
    const feedback = combatFeedbackFor(
      { hitStopMs: 60, amount: 18, direction: -1 },
      {
        ...DEFAULT_ACCESSIBILITY_SETTINGS,
        screenShake: 0.5,
        screenFlash: 0.25,
        damageNumbers: false
      }
    );

    expect(feedback).toEqual({
      hitStopMs: 60,
      shake: { x: -3, y: -1 },
      flashAlpha: 0.25,
      particleCount: 6,
      showDamageLabel: false,
      highContrastHoldFrames: 0
    });
  });

  it('retains a static readable cue while reducing motion and flash', () => {
    const feedback = combatFeedbackFor(
      { hitStopMs: 60, amount: 18, direction: 1 },
      {
        ...DEFAULT_ACCESSIBILITY_SETTINGS,
        reducedMotion: true,
        highContrastPrompts: true,
        screenShake: 1,
        screenFlash: 1
      }
    );

    expect(feedback).toEqual({
      hitStopMs: 35,
      shake: { x: 0, y: 0 },
      flashAlpha: 0.35,
      particleCount: 2,
      showDamageLabel: true,
      highContrastHoldFrames: 6
    });
  });
});
