import { describe, expect, test } from 'vitest';

import { EffectPool } from '../../src/game/effects/EffectPool';

describe('EffectPool', () => {
  test('bounds allocations, reuses released values, and rejects double release', () => {
    let created = 0;
    const pool = new EffectPool(1, () => ({ serial: ++created }));
    const first = pool.acquire();

    expect(first?.value.serial).toBe(1);
    expect(pool.acquire()).toBeNull();
    expect(first?.release()).toBe(true);
    expect(first?.release()).toBe(false);
    expect(pool.acquire()?.value.serial).toBe(1);
    expect(created).toBe(1);
  });

  test('disposal releases active values exactly once and blocks acquisition', () => {
    const released: number[] = [];
    const pool = new EffectPool(
      2,
      () => ({ serial: released.length + 1 }),
      (value) => {
        released.push(value.serial);
      },
    );
    const active = pool.acquire()!;

    expect(pool.dispose()).toBe(true);
    expect(pool.dispose()).toBe(false);
    expect(released).toEqual([1]);
    expect(active.release()).toBe(false);
    expect(pool.acquire()).toBeNull();
  });

  test('rejects invalid capacity', () => {
    expect(() => new EffectPool(0, () => ({}))).toThrow(RangeError);
    expect(() => new EffectPool(1.5, () => ({}))).toThrow(RangeError);
  });

  test('restores capacity and releases partial preparation exactly once when prepare throws', () => {
    const released: number[] = [];
    const pool = new EffectPool(
      1,
      () => ({ serial: 1, prepared: false }),
      (value) => released.push(value.serial),
    );

    expect(() =>
      pool.acquire((value) => {
        value.prepared = true;
        throw new Error('prepare failed');
      }),
    ).toThrow('prepare failed');
    expect(released).toEqual([1]);

    const lease = pool.acquire();
    expect(lease?.value.serial).toBe(1);
    expect(pool.dispose()).toBe(true);
    expect(released).toEqual([1, 1]);
    expect(lease?.release()).toBe(false);
    expect(pool.acquire()).toBeNull();
  });
});
