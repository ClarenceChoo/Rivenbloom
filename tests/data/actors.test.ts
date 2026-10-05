import { describe, expect, test } from 'vitest';

import { ACTORS, MARA_ACTOR } from '../../src/game/data/actors';

describe('direct actor content exports', () => {
  test('are deeply immutable without relying on registry assembly', () => {
    expect(Object.isFrozen(ACTORS)).toBe(true);
    expect(Object.isFrozen(MARA_ACTOR)).toBe(true);
    expect(Object.isFrozen(MARA_ACTOR.stats)).toBe(true);
    expect(Object.isFrozen(MARA_ACTOR.movement)).toBe(true);
    expect(Object.isFrozen(MARA_ACTOR.resistances)).toBe(true);

    expect(Reflect.set(MARA_ACTOR.stats, 'armour', 99)).toBe(false);
    expect(Reflect.set(MARA_ACTOR.movement, 'maxSpeed', 99)).toBe(false);
    expect(MARA_ACTOR.stats.armour).toBe(3);
    expect(MARA_ACTOR.movement.maxSpeed).toBe(280);
  });

  test('provides playable run and jump speeds to the player movement controller', () => {
    expect(MARA_ACTOR.movement).toEqual({ maxSpeed: 280, jumpSpeed: 680 });
  });
});
