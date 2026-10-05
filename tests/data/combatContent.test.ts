import { describe, expect, test } from 'vitest';

import { CONTENT_REGISTRY } from '../../src/game/data/areas';

describe('Task 9A authored combat content', () => {
  test('publishes the intrinsic attacks, four abilities, and only Lumen Bolt at new game', () => {
    expect(CONTENT_REGISTRY.actors[0]!.attackIds).toEqual([
      'mara-light-one',
      'mara-light-two',
      'mara-light-three',
      'mara-air-slash',
      'mara-charged-heavy',
    ]);
    expect(CONTENT_REGISTRY.abilities.map(({ abilityId }) => abilityId)).toEqual([
      'lumen-bolt',
      'wayfinder-dash',
      'aegis-veil',
      'resonant-pulse',
    ]);
    expect(CONTENT_REGISTRY.newGame.startingAbilities).toEqual(['lumen-bolt']);
    expect(CONTENT_REGISTRY.abilities[1]!.action).toMatchObject({
      kind: 'dash',
      invulnerabilityStatusId: 'dash-invulnerable',
    });
    expect(CONTENT_REGISTRY.abilities[0]!.action).toEqual({
      kind: 'projectile',
      projectileId: 'lumen-bolt-projectile',
      attackId: 'lumen-bolt-impact',
      speed: 720,
      lifetimeMs: 900,
      bounds: { x: 32, y: -76, width: 16, height: 16 },
    });
  });

  test('preserves authored attack values and deeply immutable public content', () => {
    expect(
      CONTENT_REGISTRY.attacks
        .slice(0, 7)
        .map(({ attackId, damage }) => [attackId, damage.baseDamage, damage.poiseDamage]),
    ).toEqual([
      ['mara-light-one', 12, 8],
      ['mara-light-two', 14, 10],
      ['mara-light-three', 18, 16],
      ['mara-air-slash', 14, 10],
      ['mara-charged-heavy', 28, 30],
      ['lumen-bolt-impact', 16, 8],
      ['resonant-pulse-wave', 4, 24],
    ]);
    expect(Object.isFrozen(CONTENT_REGISTRY.attacks[0]!.tags)).toBe(true);
    expect(Object.isFrozen(CONTENT_REGISTRY.abilities[0]!.action)).toBe(true);
    expect(
      Object.isFrozen(
        CONTENT_REGISTRY.abilities[0]!.action.kind === 'projectile'
          ? CONTENT_REGISTRY.abilities[0]!.action.bounds
          : null,
      ),
    ).toBe(true);
    expect(
      CONTENT_REGISTRY.attacks.find(({ attackId }) => attackId === 'mara-charged-heavy')?.charge,
    ).toEqual({ minimumMs: 350, maximumMs: 900 });
  });
});
