import { describe, expect, it } from 'vitest';
import { resolveDamage } from '../../src/game/combat/DamageResolver';
import type { DamagePacket, DefenseSnapshot } from '../../src/game/combat/CombatTypes';
import {
  abilityId,
  damageTypeId,
  itemId,
  parseAbilityId,
  questId,
  questStageId
} from '../../src/game/combat/CombatTypes';

const physical = damageTypeId('physical');

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
  it('constructs stable IDs only from lowercase kebab-case strings', () => {
    expect(abilityId('gust-step')).toBe('gust-step');
    expect(itemId('bracken-seed')).toBe('bracken-seed');
    expect(questId('rootglass-reliquary')).toBe('rootglass-reliquary');
    expect(questStageId('collect-bell')).toBe('collect-bell');
    expect(parseAbilityId('Gust Step')).toBeUndefined();
    expect(() => damageTypeId('Physical Damage')).toThrow('lowercase-kebab-case');
  });

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

  it('normalizes malformed combat numbers to finite non-negative outputs', () => {
    expect(
      resolveDamage(
        {
          ...packet,
          amount: Number.POSITIVE_INFINITY,
          criticalMultiplier: Number.NaN,
          poiseDamage: -20,
          knockback: Number.NaN
        },
        {
          armor: Number.POSITIVE_INFINITY,
          resistances: { [physical]: Number.NaN },
          guard: {
            kind: 'block',
            damageMultiplier: Number.POSITIVE_INFINITY,
            poiseMultiplier: -1,
            knockbackMultiplier: Number.NaN
          },
          invulnerable: false
        }
      )
    ).toMatchObject({ healthDamage: 0, poiseDamage: 0, knockback: 0 });
  });

  it('saturates finite arithmetic overflow without turning full resistance into NaN', () => {
    const result = resolveDamage(
      {
        amount: Number.MAX_VALUE,
        damageType: physical,
        criticalMultiplier: 2,
        poiseDamage: Number.MAX_VALUE,
        knockback: Number.MAX_VALUE
      },
      {
        armor: 0,
        resistances: { [physical]: 100 },
        guard: {
          kind: 'block',
          damageMultiplier: 2,
          poiseMultiplier: 2,
          knockbackMultiplier: 2
        },
        invulnerable: false
      }
    );

    expect(result).toMatchObject({
      healthDamage: 0,
      poiseDamage: Number.MAX_VALUE,
      knockback: Number.MAX_VALUE
    });
    expect(Number.isFinite(result.healthDamage)).toBe(true);
    expect(Number.isFinite(result.poiseDamage)).toBe(true);
    expect(Number.isFinite(result.knockback)).toBe(true);
  });

  it('saturates a rounded finite product that overflows after the division guard', () => {
    const roundedOperand = Number.MAX_VALUE / 1.5;
    const result = resolveDamage(
      {
        amount: roundedOperand,
        damageType: physical,
        criticalMultiplier: 1,
        poiseDamage: roundedOperand,
        knockback: roundedOperand
      },
      {
        armor: 0,
        resistances: {},
        guard: {
          kind: 'block',
          damageMultiplier: 1.5,
          poiseMultiplier: 1.5,
          knockbackMultiplier: 1.5
        },
        invulnerable: false
      }
    );

    expect(result).toMatchObject({
      healthDamage: Number.MAX_VALUE,
      poiseDamage: Number.MAX_VALUE,
      knockback: Number.MAX_VALUE
    });
  });
});
