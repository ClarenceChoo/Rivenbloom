import { describe, expect, test } from 'vitest';

import { resolveGuardImpact } from '../../src/game/combat/GuardResolver';

const impact = {
  delivery: 'melee' as const,
  tags: ['blockable', 'parryable'] as const,
  sourceX: 20,
};

const defender = {
  positionX: 10,
  facing: 'right' as const,
  mana: 10,
  invulnerable: false,
  parryActive: false,
  blocking: true,
  aegisActive: false,
};

describe('resolveGuardImpact', () => {
  test('invulnerability ignores every consequence including projectile consumption', () => {
    expect(
      resolveGuardImpact(
        { ...impact, delivery: 'projectile' },
        { ...defender, invulnerable: true },
      ),
    ).toEqual({ kind: 'ignored' });
  });

  test('parries a front-facing tagged impact without resource spend and emits one punish', () => {
    expect(resolveGuardImpact(impact, { ...defender, parryActive: true })).toEqual({
      kind: 'resolved',
      guard: { kind: 'parry' },
      manaSpent: 0,
      consumeProjectile: false,
      consumeAegis: false,
      grantStatusId: null,
      commands: [{ kind: 'punish-attacker', statusId: 'staggered' }],
    });
  });

  test('blocks for exactly four mana after parry and preserves full poise arithmetic downstream', () => {
    expect(resolveGuardImpact(impact, defender)).toMatchObject({
      kind: 'resolved',
      guard: { kind: 'block', multiplier: 0.35 },
      manaSpent: 4,
    });
  });

  test('insufficient mana spends nothing, resolves unguarded, and breaks guard', () => {
    expect(resolveGuardImpact(impact, { ...defender, mana: 3 })).toEqual({
      kind: 'resolved',
      guard: { kind: 'none' },
      manaSpent: 0,
      consumeProjectile: false,
      consumeAegis: false,
      grantStatusId: null,
      commands: [{ kind: 'guard-break' }],
    });
  });

  test('rear and unblockable impacts bypass parry and block', () => {
    expect(
      resolveGuardImpact({ ...impact, sourceX: 0 }, { ...defender, parryActive: true }),
    ).toMatchObject({ guard: { kind: 'none' }, manaSpent: 0 });
    expect(
      resolveGuardImpact(
        { ...impact, tags: ['blockable', 'parryable', 'unblockable'] },
        { ...defender, parryActive: true },
      ),
    ).toMatchObject({ guard: { kind: 'none' }, manaSpent: 0 });
  });

  test('Aegis absorbs exactly one otherwise valid blocked projectile and grants charge', () => {
    expect(
      resolveGuardImpact({ ...impact, delivery: 'projectile' }, { ...defender, aegisActive: true }),
    ).toEqual({
      kind: 'absorbed',
      manaSpent: 4,
      consumeProjectile: true,
      consumeAegis: true,
      grantStatusId: 'aegis-charge',
      commands: [],
    });

    expect(resolveGuardImpact(impact, { ...defender, aegisActive: true })).toMatchObject({
      guard: { kind: 'block', multiplier: 0.35 },
      consumeAegis: false,
    });
  });

  test('returns deeply immutable guard decisions', () => {
    const result = resolveGuardImpact(impact, { ...defender, parryActive: true });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.kind === 'resolved') {
      expect(Object.isFrozen(result.guard)).toBe(true);
      expect(Object.isFrozen(result.commands)).toBe(true);
    }
  });
});
