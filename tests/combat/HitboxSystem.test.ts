import { describe, expect, test } from 'vitest';

import { HitboxSystem } from '../../src/game/combat/HitboxSystem';
import { damageTypeId, stableId } from '../../src/game/core/StableId';
import type { AttackDefinition } from '../../src/game/data/types';

const attack: AttackDefinition = {
  attackId: stableId<'attack'>('test-sweep'),
  damage: {
    baseDamage: 12,
    damageType: damageTypeId('physical'),
    poiseDamage: 8,
    critical: { kind: 'excluded' },
  },
  totalFrames: 10,
  hitboxes: [
    {
      hitboxId: stableId<'hitbox'>('test-sweep-edge'),
      fromFrame: 3,
      toFrame: 5,
      bounds: { x: 10, y: -20, width: 30, height: 20 },
    },
  ],
  movementImpulse: { x: 0, y: 0 },
  cancelWindows: [],
  animationSetId: null,
  audioSetId: null,
  cooldownMs: 0,
  delivery: 'melee',
  knockback: { x: 90, y: -20 },
  hitStopMs: 55,
  tags: ['blockable', 'parryable'],
  hitPolicy: { kind: 'once' },
  charge: null,
};

const enemy = {
  targetId: stableId<'combatant'>('reed-wisp'),
  teamId: stableId<'team'>('enemy'),
  hurtboxes: [{ x: 65, y: 80, width: 10, height: 20 }],
};

describe('HitboxSystem', () => {
  test('samples anticipation, inclusive active frames, recovery, and completion', () => {
    const instance = new HitboxSystem().activate(
      stableId<'combatant'>('mara'),
      attack,
      'right',
      stableId<'team'>('player'),
    );
    const sample = (frame: number) => instance.sample(frame, { x: 50, y: 100 }, [], frame * 10);

    expect(sample(2).phase).toBe('anticipation');
    expect(sample(3).phase).toBe('active');
    expect(sample(5).phase).toBe('active');
    expect(sample(6).phase).toBe('recovery');
    expect(sample(10).phase).toBe('complete');
  });

  test('mirrors authored right-facing hitboxes and knockback around the owner origin', () => {
    const instance = new HitboxSystem().activate(
      stableId<'combatant'>('mara'),
      attack,
      'left',
      stableId<'team'>('player'),
    );
    const target = {
      ...enemy,
      hurtboxes: [{ x: 12, y: 80, width: 8, height: 20 }],
    };

    const result = instance.sample(3, { x: 50, y: 100 }, [target], 30);

    expect(result.activeHitboxes).toEqual([{ x: 10, y: 80, width: 30, height: 20 }]);
    expect(result.hits[0]).toMatchObject({
      attackId: 'test-sweep',
      targetId: 'reed-wisp',
      source: {
        ownerId: 'mara',
        teamId: 'player',
        position: { x: 50, y: 100 },
        facing: 'left',
      },
      occurredAtMs: 30,
      delivery: 'melee',
      knockback: { x: -90, y: -20 },
      projectile: null,
    });
  });

  test('excludes edge-only, owner, and allied contact', () => {
    const instance = new HitboxSystem().activate(
      stableId<'combatant'>('mara'),
      attack,
      'right',
      stableId<'team'>('player'),
    );
    const edgeOnly = { ...enemy, hurtboxes: [{ x: 90, y: 80, width: 10, height: 20 }] };
    const owner = { ...enemy, targetId: stableId<'combatant'>('mara') };
    const ally = { ...enemy, teamId: stableId<'team'>('player') };

    expect(instance.sample(3, { x: 50, y: 100 }, [edgeOnly, owner, ally], 0).hits).toEqual([]);
  });

  test('hits once across active frames unless a positive interval is authored', () => {
    const once = new HitboxSystem().activate(
      stableId<'combatant'>('mara'),
      attack,
      'right',
      stableId<'team'>('player'),
    );
    expect(once.sample(3, { x: 50, y: 100 }, [enemy], 0).hits).toHaveLength(1);
    expect(once.sample(4, { x: 50, y: 100 }, [enemy], 100).hits).toHaveLength(0);

    const repeating = new HitboxSystem().activate(
      stableId<'combatant'>('mara'),
      { ...attack, hitPolicy: { kind: 'interval', rehitIntervalMs: 50 } },
      'right',
      stableId<'team'>('player'),
    );
    expect(repeating.sample(3, { x: 50, y: 100 }, [enemy], 0).hits).toHaveLength(1);
    expect(repeating.sample(4, { x: 50, y: 100 }, [enemy], 49).hits).toHaveLength(0);
    expect(repeating.sample(5, { x: 50, y: 100 }, [enemy], 50).hits).toHaveLength(1);
  });

  test('returns immutable impact data rather than render bounds', () => {
    const mutableAttack = structuredClone(attack);
    const instance = new HitboxSystem().activate(
      stableId<'combatant'>('mara'),
      mutableAttack,
      'right',
      stableId<'team'>('player'),
    );
    Reflect.set(mutableAttack.damage, 'baseDamage', 999);
    const hit = instance.sample(3, { x: 50, y: 100 }, [enemy], 0).hits[0]!;

    expect(hit).toMatchObject({
      damage: { baseDamage: 12 },
      hitStopMs: 55,
      tags: ['blockable', 'parryable'],
    });
    expect(Object.isFrozen(hit)).toBe(true);
    expect(Object.isFrozen(hit.source)).toBe(true);
    expect(Object.isFrozen(hit.source.position)).toBe(true);
    expect(Object.isFrozen(hit.damage)).toBe(true);
    expect(Object.isFrozen(hit.knockback)).toBe(true);
    expect(Object.isFrozen(hit.tags)).toBe(true);
    expect(hit).not.toHaveProperty('renderBounds');
  });
});
