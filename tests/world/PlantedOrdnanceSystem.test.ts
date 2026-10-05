import { describe, expect, test } from 'vitest';

import { damageTypeId, stableId } from '../../src/game/core/StableId';
import { PlantedOrdnanceSystem } from '../../src/game/world/PlantedOrdnanceSystem';
import type { EnemyOrdnanceCommand } from '../../src/game/entities/enemies/EnemyController';

const command: EnemyOrdnanceCommand = {
  kind: 'plant',
  attackId: stableId<'attack'>('spore-scribe-pollen-plant'),
  ownerId: stableId<'combatant'>('scribe-one'),
  teamId: stableId<'team'>('hostile'),
  position: { x: 200, y: 608 },
  facing: 'left',
  armsAtMs: 350,
  expiresAtMs: 1_250,
  roomCap: 6,
  maxHits: 1,
  delivery: 'projectile',
  damage: {
    baseDamage: 8,
    damageType: damageTypeId('physical'),
    poiseDamage: 6,
    critical: { kind: 'excluded' },
  },
  knockback: { x: 90, y: -20 },
  hitStopMs: 45,
  tags: ['blockable', 'parryable', 'projectile'],
  bounds: { x: -22, y: -44, width: 44, height: 44 },
};

describe('PlantedOrdnanceSystem', () => {
  test('arms at the exact boundary, resolves once, and consumes explicitly', () => {
    const system = new PlantedOrdnanceSystem(6);
    expect(system.plant(command)).toBe(1);
    const target = {
      targetId: stableId<'combatant'>('mara'),
      teamId: stableId<'team'>('player'),
      hurtboxes: [{ x: 176, y: 540, width: 48, height: 68 }],
    };

    expect(system.step(349, target).impacts).toEqual([]);
    const armed = system.step(350, target);

    expect(armed.impacts).toHaveLength(1);
    expect(armed.impacts[0]).toMatchObject({
      impact: { occurredAtMs: 350, targetId: 'mara' },
      instanceId: 1,
    });
    expect(system.consume(1)).toBe(true);
    expect(system.snapshot()).toEqual([]);
    expect(system.consume(1)).toBe(false);
  });

  test('respects its room cap, does not rehit after a continue, and expires at the exact boundary', () => {
    const system = new PlantedOrdnanceSystem(8);
    for (let instance = 1; instance <= 6; instance += 1) {
      expect(system.plant(command)).toBe(instance);
    }
    expect(system.plant(command)).toBeNull();
    const target = {
      targetId: stableId<'combatant'>('mara'),
      teamId: stableId<'team'>('player'),
      hurtboxes: [{ x: 176, y: 540, width: 48, height: 68 }],
    };

    expect(system.step(350, target).impacts).toHaveLength(6);
    expect(system.step(351, target).impacts).toEqual([]);
    expect(system.step(1_249, target).expiredInstanceIds).toEqual([]);
    expect(system.step(1_250, target).expiredInstanceIds).toEqual([1, 2, 3, 4, 5, 6]);
    expect(system.snapshot()).toEqual([]);
  });
});
