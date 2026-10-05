import { describe, expect, it } from 'vitest';

import { damageTypeId } from '../../src/game/core/StableId';
import { resolveDamage } from '../../src/game/combat/DamageResolver';
import type { DamagePacket, DefenseSnapshot } from '../../src/game/combat/CombatTypes';

const physical = damageTypeId('physical');
const frost = damageTypeId('frost');

function target(overrides: Partial<DefenseSnapshot> = {}): DefenseSnapshot {
  return {
    armour: 0,
    resistances: {},
    currentPoise: 10,
    guard: { kind: 'none' },
    ...overrides,
  };
}

function packet(overrides: Partial<DamagePacket> = {}): DamagePacket {
  return {
    baseDamage: 10,
    damageType: physical,
    poiseDamage: 2,
    critical: { kind: 'excluded' },
    ...overrides,
  };
}

describe('resolveDamage', () => {
  it('applies armour before resistance and block, then rounds only the final health damage', () => {
    const result = resolveDamage(
      packet({ baseDamage: 10 }),
      target({
        armour: 3,
        resistances: { [physical]: 0.5 },
        guard: { kind: 'block', multiplier: 0.5 },
      }),
    );

    expect(result).toEqual({
      healthDamage: 2,
      poiseDamage: 2,
      remainingPoise: 8,
      staggered: false,
      critical: false,
      parried: false,
    });
  });

  it('uses zero for missing resistance and supports negative typed resistance', () => {
    const missingResistance = resolveDamage(packet(), target());
    const vulnerability = resolveDamage(
      packet(),
      target({ resistances: { [frost]: -1 }, currentPoise: null }),
    );

    expect(missingResistance.healthDamage).toBe(10);
    expect(vulnerability.healthDamage).toBe(10);

    const frostVulnerability = resolveDamage(
      packet({ damageType: frost }),
      target({ resistances: { [frost]: -1 }, currentPoise: null }),
    );

    expect(frostVulnerability.healthDamage).toBe(20);
  });

  it('applies a triggered eligible critical but excludes ineligible and untriggered criticals', () => {
    const triggered = resolveDamage(
      packet({ critical: { kind: 'eligible', triggered: true, multiplier: 1.5 } }),
      target(),
    );
    const untriggered = resolveDamage(
      packet({ critical: { kind: 'eligible', triggered: false, multiplier: 2 } }),
      target(),
    );
    const excluded = resolveDamage(packet(), target());

    expect(triggered.healthDamage).toBe(15);
    expect(triggered.critical).toBe(true);
    expect(untriggered.healthDamage).toBe(10);
    expect(untriggered.critical).toBe(false);
    expect(excluded.healthDamage).toBe(10);
    expect(excluded.critical).toBe(false);
  });

  it('reduces health with a block without reducing poise damage', () => {
    const result = resolveDamage(
      packet({ poiseDamage: 7 }),
      target({ currentPoise: 7, guard: { kind: 'block', multiplier: 0 } }),
    );

    expect(result.healthDamage).toBe(0);
    expect(result.poiseDamage).toBe(7);
    expect(result.remainingPoise).toBe(0);
    expect(result.staggered).toBe(true);
  });

  it('returns no damage, critical, or stagger when a parry is already resolved', () => {
    const result = resolveDamage(
      packet({ critical: { kind: 'eligible', triggered: true, multiplier: 2 }, poiseDamage: 7 }),
      target({ currentPoise: 5, guard: { kind: 'parry' } }),
    );

    expect(result).toEqual({
      healthDamage: 0,
      poiseDamage: 0,
      remainingPoise: 5,
      staggered: false,
      critical: false,
      parried: true,
    });
  });

  it('staggers only on exact depletion from a positive poise value and preserves poise immunity', () => {
    const exactDepletion = resolveDamage(packet({ poiseDamage: 5 }), target({ currentPoise: 5 }));
    const zeroPoise = resolveDamage(packet({ poiseDamage: 5 }), target({ currentPoise: 0 }));
    const immune = resolveDamage(packet({ poiseDamage: 5 }), target({ currentPoise: null }));

    expect(exactDepletion.remainingPoise).toBe(0);
    expect(exactDepletion.staggered).toBe(true);
    expect(zeroPoise.staggered).toBe(false);
    expect(immune.remainingPoise).toBeNull();
    expect(immune.staggered).toBe(false);
  });

  it('rejects malformed numeric combat inputs instead of sanitizing authored data', () => {
    expect(() => resolveDamage(packet({ baseDamage: -1 }), target())).toThrow(RangeError);
    expect(() => resolveDamage(packet({ poiseDamage: 1.5 }), target())).toThrow(RangeError);
    expect(() => resolveDamage(packet(), target({ armour: Number.POSITIVE_INFINITY }))).toThrow(
      RangeError,
    );
    expect(() => resolveDamage(packet(), target({ resistances: { [physical]: 1.1 } }))).toThrow(
      RangeError,
    );
    expect(() =>
      resolveDamage(
        packet({ critical: { kind: 'eligible', triggered: true, multiplier: 0 } }),
        target(),
      ),
    ).toThrow(RangeError);
    expect(() =>
      resolveDamage(packet(), target({ guard: { kind: 'block', multiplier: 1.1 } })),
    ).toThrow(RangeError);
    expect(() =>
      resolveDamage(
        packet({
          baseDamage: Number.MAX_SAFE_INTEGER,
          critical: { kind: 'eligible', triggered: true, multiplier: 2 },
        }),
        target({ armour: Number.MAX_SAFE_INTEGER }),
      ),
    ).toThrow(RangeError);
  });
});
