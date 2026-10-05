import { describe, expect, test } from 'vitest';

import { EncounterDirector } from '../../src/game/ai/EncounterDirector';
import type { AttackSlotRequest } from '../../src/game/ai/EncounterDirector';
import { stableId } from '../../src/game/core/StableId';

function request(
  combatantId: string,
  slotClass: AttackSlotRequest['slotClass'],
  pressureCost: 1 | 2 = slotClass === 'elite' ? 2 : 1,
): AttackSlotRequest {
  return {
    combatantId: stableId<'combatant'>(combatantId),
    slotClass,
    pressureCost,
    telegraphMs: 200,
    activeMs: 80,
  };
}

describe('encounter attack director', () => {
  test('allows one close and one ranged lease within pressure two', () => {
    const director = new EncounterDirector();
    const close = director.request(request('a-close', 'close'), 100);
    const ranged = director.request(request('b-ranged', 'ranged'), 100);

    expect(close).toMatchObject({ combatantId: 'a-close', expiresAtMs: 480 });
    expect(ranged).toMatchObject({ combatantId: 'b-ranged', expiresAtMs: 480 });
    expect(director.snapshot()).toMatchObject({ pressure: 2, pending: [] });
    expect(director.snapshot().leases).toHaveLength(2);
  });

  test('denies a second lease of the same class and retains it as pending', () => {
    const director = new EncounterDirector();
    expect(director.request(request('a-close', 'close'), 0)).not.toBeNull();
    expect(director.request(request('b-close', 'close'), 0)).toBeNull();
    expect(director.snapshot().pending.map(({ combatantId }) => combatantId)).toEqual(['b-close']);
  });

  test('makes elite leases exclusive in both directions', () => {
    const occupied = new EncounterDirector();
    occupied.request(request('a-close', 'close'), 0);
    expect(occupied.request(request('elite', 'elite'), 0)).toBeNull();

    const eliteFirst = new EncounterDirector();
    expect(eliteFirst.request(request('elite', 'elite'), 0)).not.toBeNull();
    expect(eliteFirst.request(request('ranged', 'ranged'), 0)).toBeNull();
    expect(eliteFirst.snapshot()).toMatchObject({ pressure: 2 });
  });

  test('uses lexical circular round-robin order after the last grantee', () => {
    const director = new EncounterDirector();
    const first = director.request(request('b-close', 'close'), 0);
    director.request(request('a-close', 'close'), 0);
    director.request(request('c-close', 'close'), 0);

    expect(first?.combatantId).toBe('b-close');
    director.release(first!, 10);
    expect(director.snapshot().leases[0]?.combatantId).toBe('c-close');
    const second = director.snapshot().leases[0]!;
    director.release(second, 20);
    expect(director.snapshot().leases[0]?.combatantId).toBe('a-close');
  });

  test('expires leases and grants pending requests at the expiry deadline', () => {
    const director = new EncounterDirector();
    director.request(request('a-close', 'close'), 10);
    director.request(request('b-close', 'close'), 10);

    expect(director.advance(389)).toEqual([]);
    expect(director.advance(390)).toEqual([
      expect.objectContaining({ combatantId: 'b-close', expiresAtMs: 770 }),
    ]);
  });

  test('stale release sequence cannot cancel a later grant', () => {
    const director = new EncounterDirector();
    const first = director.request(request('a-close', 'close'), 0)!;
    director.release(first, 1);
    const second = director.request(request('a-close', 'close'), 2)!;

    director.release(first, 3);
    expect(director.snapshot().leases).toEqual([second]);
  });

  test('release prunes every expired lease before granting pending combatants', () => {
    const director = new EncounterDirector();
    director.request(request('a-close', 'close'), 0);
    director.request(request('b-close', 'close'), 0);
    const ranged = director.request(request('c-ranged', 'ranged'), 0)!;

    expect(director.release(ranged, 380)).toEqual([
      expect.objectContaining({ combatantId: 'b-close', grantedAtMs: 380 }),
    ]);
    expect(director.snapshot().leases.map(({ combatantId }) => combatantId)).toEqual(['b-close']);
  });

  test('withdrawal prunes expired leases before its pending grant pass', () => {
    const director = new EncounterDirector();
    director.request(request('a-close', 'close'), 0);
    director.request(request('b-close', 'close'), 0);

    expect(director.withdraw(stableId<'combatant'>('not-present'), 380)).toEqual([
      expect.objectContaining({ combatantId: 'b-close', grantedAtMs: 380 }),
    ]);
  });

  test.each(['withdraw', 'interrupt', 'sleep', 'death'] as const)(
    '%s releases active and pending ownership',
    (method) => {
      const director = new EncounterDirector();
      director.request(request('a-close', 'close'), 0);
      director.request(request('b-close', 'close'), 0);
      director[method](stableId<'combatant'>('a-close'), 1);

      expect(director.snapshot().leases[0]?.combatantId).toBe('b-close');
      director[method](stableId<'combatant'>('b-close'), 2);
      expect(director.snapshot()).toMatchObject({ pressure: 0, pending: [], leases: [] });
    },
  );

  test('dispose is idempotent, clears ownership, and rejects future requests', () => {
    const director = new EncounterDirector();
    director.request(request('a-close', 'close'), 0);
    director.request(request('b-close', 'close'), 0);
    director.dispose();
    director.dispose();

    expect(director.snapshot()).toMatchObject({
      disposed: true,
      pressure: 0,
      pending: [],
      leases: [],
    });
    expect(() => director.request(request('c-close', 'close'), 1)).toThrow(/disposed/i);
  });

  test('rejects invalid clocks and slot contracts', () => {
    const director = new EncounterDirector();
    expect(() => director.request(request('a-close', 'close'), 0.5)).toThrow(RangeError);
    expect(() => director.request({ ...request('elite', 'elite'), pressureCost: 1 }, 0)).toThrow(
      RangeError,
    );
    director.request(request('a-close', 'close'), 2);
    expect(() => director.advance(1)).toThrow(RangeError);
  });

  test('snapshots and leases are immutable', () => {
    const director = new EncounterDirector();
    const lease = director.request(request('a-close', 'close'), 0)!;
    const snapshot = director.snapshot();
    expect(Object.isFrozen(lease)).toBe(true);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.leases)).toBe(true);
    expect(Reflect.set(lease, 'expiresAtMs', 1)).toBe(false);
  });
});
