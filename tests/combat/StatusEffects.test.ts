import { describe, expect, test } from 'vitest';

import { StatusEffects } from '../../src/game/combat/StatusEffects';
import { stableId } from '../../src/game/core/StableId';

describe('StatusEffects', () => {
  test('applies independent immutable snapshots and expires at the exact boundary', () => {
    const effects = new StatusEffects();
    effects.apply(stableId<'status'>('staggered'), 100, 10);
    effects.apply(stableId<'status'>('aegis-veil'), 300, 20);

    const snapshot = effects.snapshot(109);
    expect(snapshot).toEqual([
      { statusId: 'aegis-veil', expiresAtMs: 320 },
      { statusId: 'staggered', expiresAtMs: 110 },
    ]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(effects.has(stableId<'status'>('staggered'), 110)).toBe(false);
    expect(effects.has(stableId<'status'>('aegis-veil'), 110)).toBe(true);
  });

  test('refreshes a status by ID without stacking', () => {
    const effects = new StatusEffects();
    const staggered = stableId<'status'>('staggered');
    effects.apply(staggered, 100, 0);
    effects.apply(staggered, 200, 50);

    expect(effects.snapshot(50)).toEqual([{ statusId: 'staggered', expiresAtMs: 250 }]);
  });

  test('rejects invalid durations and backward simulation time without mutation', () => {
    const effects = new StatusEffects();
    const staggered = stableId<'status'>('staggered');
    effects.apply(staggered, 100, 10);

    expect(() => effects.apply(staggered, 0, 20)).toThrow(RangeError);
    expect(() => effects.snapshot(9)).toThrow(RangeError);
    expect(effects.snapshot(10)).toEqual([{ statusId: 'staggered', expiresAtMs: 110 }]);
  });

  test('clear removes every status while preserving monotonic observed time', () => {
    const effects = new StatusEffects();
    const staggered = stableId<'status'>('staggered');
    effects.apply(staggered, 100, 10);

    expect(effects.clear()).toBe(true);
    expect(effects.clear()).toBe(false);
    expect(effects.snapshot(10)).toEqual([]);
    expect(() => effects.apply(staggered, 100, 9)).toThrow(RangeError);
    effects.apply(staggered, 100, 10);
    expect(effects.snapshot(10)).toEqual([{ statusId: 'staggered', expiresAtMs: 110 }]);
  });

  test('removes one active status at validated simulation time without touching others', () => {
    const effects = new StatusEffects();
    const aegis = stableId<'status'>('aegis-veil');
    const staggered = stableId<'status'>('staggered');
    effects.apply(aegis, 500, 10);
    effects.apply(staggered, 100, 10);

    expect(effects.remove(aegis, 20)).toBe(true);
    expect(effects.remove(aegis, 20)).toBe(false);
    expect(effects.snapshot(20)).toEqual([{ statusId: 'staggered', expiresAtMs: 110 }]);
    expect(() => effects.remove(staggered, 19)).toThrow(RangeError);
  });
});
