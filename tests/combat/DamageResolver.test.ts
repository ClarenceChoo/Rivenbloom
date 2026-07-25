import { describe, expect, it } from 'vitest';
import { resolveDamage } from '../../src/game/combat/DamageResolver';
import type {
  DamagePacket,
  DamageTypeId,
  DefenseSnapshot
} from '../../src/game/combat/CombatTypes';

const physical = 'physical' as DamageTypeId;

const packet: DamagePacket = {
  amount: 100,
  damageType: physical,
  criticalMultiplier: 1,
  poiseDamage: 20,
  knockback: 12
};

const target: DefenseSnapshot = {
  armor: 25,
  resistances: { [physical]: 20 },
  guard: { kind: 'none' },
  invulnerable: false
};

describe('resolveDamage', () => {
  it('applies flat armor before percentage resistance', () => {
    expect(resolveDamage(packet, target).healthDamage).toBe(60);
  });

  it('clamps negative armor so it cannot amplify damage', () => {
    expect(resolveDamage(packet, { ...target, armor: -25, resistances: {} }).healthDamage).toBe(
      100
    );
  });

  it('clamps resistance to complete prevention at one hundred percent', () => {
    expect(
      resolveDamage(packet, { ...target, armor: 0, resistances: { [physical]: 150 } }).healthDamage
    ).toBe(0);
  });

  it('prevents all hit effects while invulnerable', () => {
    expect(resolveDamage(packet, { ...target, invulnerable: true })).toMatchObject({
      healthDamage: 0,
      poiseDamage: 0,
      knockback: 0,
      invulnerable: true
    });
  });

  it('reduces damage, poise, and knockback through a block', () => {
    expect(
      resolveDamage(packet, {
        ...target,
        armor: 0,
        resistances: {},
        guard: {
          kind: 'block',
          damageMultiplier: 0.5,
          poiseMultiplier: 0.25,
          knockbackMultiplier: 0.5
        }
      })
    ).toMatchObject({ healthDamage: 50, poiseDamage: 5, knockback: 6, blocked: true });
  });

  it('applies a critical multiplier only when the hit is unguarded', () => {
    expect(
      resolveDamage(
        { ...packet, criticalMultiplier: 1.5 },
        { ...target, armor: 0, resistances: {} }
      )
    ).toMatchObject({ healthDamage: 150, criticalApplied: true });
  });

  it('parries the entire hit and excludes its critical effect', () => {
    expect(
      resolveDamage({ ...packet, criticalMultiplier: 2 }, { ...target, guard: { kind: 'parry' } })
    ).toMatchObject({
      healthDamage: 0,
      poiseDamage: 0,
      knockback: 0,
      criticalApplied: false,
      parried: true
    });
  });
});
