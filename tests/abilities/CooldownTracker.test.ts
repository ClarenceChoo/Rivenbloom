import { describe, expect, it } from 'vitest';

import { abilityId } from '../../src/game/core/StableId';
import { CooldownTracker } from '../../src/game/abilities/CooldownTracker';

const mistStep = abilityId('mist-step');
const thornBurst = abilityId('thorn-burst');
const unknownAbility = abilityId('unknown-ability');

describe('CooldownTracker', () => {
  it('allows the first use, rejects an active cooldown, and allows use at the exact ready time', () => {
    const tracker = new CooldownTracker({ [mistStep]: 1000 });

    expect(tracker.tryUse(mistStep, 0)).toBe(true);
    expect(tracker.tryUse(mistStep, 999)).toBe(false);
    expect(tracker.tryUse(mistStep, 1000)).toBe(true);
  });

  it('tracks each ability independently', () => {
    const tracker = new CooldownTracker({ [mistStep]: 1000, [thornBurst]: 500 });

    expect(tracker.tryUse(mistStep, 0)).toBe(true);
    expect(tracker.tryUse(thornBurst, 0)).toBe(true);
    expect(tracker.tryUse(thornBurst, 500)).toBe(true);
    expect(tracker.tryUse(mistStep, 500)).toBe(false);
  });

  it('does not extend readiness after a rejected active-cooldown attempt', () => {
    const tracker = new CooldownTracker({ [mistStep]: 1000 });

    expect(tracker.tryUse(mistStep, 0)).toBe(true);
    expect(tracker.tryUse(mistStep, 999)).toBe(false);
    expect(tracker.tryUse(mistStep, 1000)).toBe(true);
  });

  it('rejects clock rollback without corrupting an existing cooldown', () => {
    const tracker = new CooldownTracker({ [mistStep]: 1000 });

    expect(tracker.tryUse(mistStep, 1000)).toBe(true);
    expect(tracker.tryUse(mistStep, 1500)).toBe(false);
    expect(() => tracker.tryUse(mistStep, 1499)).toThrow(RangeError);
    expect(tracker.tryUse(mistStep, 2000)).toBe(true);
  });

  it('allows a zero-duration ability to be used repeatedly at the same time', () => {
    const tracker = new CooldownTracker({ [mistStep]: 0 });

    expect(tracker.tryUse(mistStep, 400)).toBe(true);
    expect(tracker.tryUse(mistStep, 400)).toBe(true);
  });

  it('rejects invalid definitions, unknown abilities, invalid times, and readiness overflow', () => {
    expect(() => new CooldownTracker({ [mistStep]: -1 })).toThrow(RangeError);
    expect(() => new CooldownTracker({ [mistStep]: Number.NaN })).toThrow(RangeError);

    const tracker = new CooldownTracker({ [mistStep]: 1000 });
    expect(() => tracker.tryUse(unknownAbility, 0)).toThrow(RangeError);
    expect(() => tracker.tryUse(mistStep, -1)).toThrow(RangeError);
    expect(() => tracker.tryUse(mistStep, Number.POSITIVE_INFINITY)).toThrow(RangeError);

    const overflowing = new CooldownTracker({ [mistStep]: 1 });
    expect(() => overflowing.tryUse(mistStep, Number.MAX_SAFE_INTEGER)).toThrow(RangeError);
  });
});
