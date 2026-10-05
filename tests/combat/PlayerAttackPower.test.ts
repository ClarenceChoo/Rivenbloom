import { expect, test } from 'vitest';
import { damageTypeId, stableId } from '../../src/game/core/StableId';
import type { CombatImpact } from '../../src/game/combat/CombatImpact';
import { applyPlayerAttackPower } from '../../src/game/combat/PlayerAttackPower';

const heavy: CombatImpact = {
  attackId: stableId<'attack'>('mara-charged-heavy'),
  targetId: stableId<'combatant'>('pallid-cantor-at-hollow-choir'),
  source: {
    ownerId: stableId<'combatant'>('mara'),
    teamId: stableId<'team'>('player'),
    position: { x: 850, y: 900 },
    facing: 'right',
  },
  occurredAtMs: 100,
  delivery: 'melee',
  damage: {
    baseDamage: 28,
    damageType: damageTypeId('physical'),
    poiseDamage: 30,
    critical: { kind: 'excluded' },
  },
  knockback: { x: 0, y: 0 },
  hitStopMs: 0,
  tags: ['blockable'],
  projectile: null,
};

test('saved attack power and weapon level strengthen physical hits without changing the source packet', () => {
  expect(applyPlayerAttackPower(heavy, { attackPower: 12, weaponLevel: 0 }).damage.baseDamage).toBe(
    40,
  );
  expect(applyPlayerAttackPower(heavy, { attackPower: 12, weaponLevel: 1 }).damage.baseDamage).toBe(
    48,
  );
  expect(
    applyPlayerAttackPower(heavy, { attackPower: 120, weaponLevel: 1 }).damage.baseDamage,
  ).toBe(156);
  expect(heavy.damage.baseDamage).toBe(28);
});

test('magic and zero-damage contacts keep their authored damage', () => {
  const lumen: CombatImpact = {
    ...heavy,
    damage: { ...heavy.damage, damageType: damageTypeId('lumen') },
  };
  const pulse: CombatImpact = { ...heavy, damage: { ...heavy.damage, baseDamage: 0 } };
  expect(applyPlayerAttackPower(lumen, { attackPower: 120, weaponLevel: 1 })).toBe(lumen);
  expect(applyPlayerAttackPower(pulse, { attackPower: 120, weaponLevel: 1 })).toBe(pulse);
});
