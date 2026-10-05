import { describe, expect, test } from 'vitest';

import { ProjectileSystem } from '../../src/game/combat/ProjectileSystem';
import { damageTypeId, stableId } from '../../src/game/core/StableId';

const command = {
  projectileId: stableId<'projectile'>('lumen-bolt-shot'),
  attackId: stableId<'attack'>('lumen-bolt-impact'),
  ownerId: stableId<'combatant'>('mara'),
  teamId: stableId<'team'>('player'),
  speed: 100,
  lifetimeMs: 1000,
  bounds: { x: -2, y: -2, width: 4, height: 4 },
  delivery: 'projectile' as const,
  damage: {
    baseDamage: 16,
    damageType: damageTypeId('lumen'),
    poiseDamage: 8,
    critical: { kind: 'excluded' as const },
  },
  knockback: { x: 180, y: -40 },
  hitStopMs: 55,
  tags: ['blockable', 'parryable', 'projectile'] as const,
};

describe('ProjectileSystem', () => {
  test('is capacity bounded, reuses leases, and fails safely on exhaustion', () => {
    const projectiles = new ProjectileSystem(1);
    expect(projectiles.canSpawn()).toBe(true);
    expect(projectiles.spawn(command, { x: 0, y: 0 }, 'right', 0)).not.toBeNull();
    expect(projectiles.canSpawn()).toBe(false);
    expect(projectiles.spawn(command, { x: 0, y: 0 }, 'right', 0)).toBeNull();
    expect(projectiles.step(1000, []).active).toEqual([]);
    expect(projectiles.canSpawn()).toBe(true);
    expect(projectiles.spawn(command, { x: 0, y: 0 }, 'right', 1000)).not.toBeNull();
  });

  test('mirrors right-authored relative bounds about the owner feet when facing left', () => {
    const projectiles = new ProjectileSystem(1);
    projectiles.spawn(
      { ...command, speed: 1, bounds: { x: 10, y: -20, width: 6, height: 8 } },
      { x: 100, y: 200 },
      'left',
      0,
    );

    const impact = projectiles.step(0, [
      {
        targetId: stableId<'combatant'>('left-target'),
        teamId: stableId<'team'>('enemy'),
        hurtboxes: [{ x: 84, y: 180, width: 6, height: 8 }],
      },
    ]);

    expect(impact.impacts).toEqual([
      expect.objectContaining({
        attackId: 'lumen-bolt-impact',
        targetId: 'left-target',
        source: {
          ownerId: 'mara',
          teamId: 'player',
          position: { x: 100, y: 200 },
          facing: 'left',
        },
        occurredAtMs: 0,
        delivery: 'projectile',
        knockback: { x: -180, y: -40 },
        projectile: { instanceId: 1, projectileId: 'lumen-bolt-shot' },
      }),
    ]);
    expect(impact.active).toHaveLength(1);
  });

  test('moves deterministically and releases at exact lifetime expiry', () => {
    const projectiles = new ProjectileSystem(1);
    projectiles.spawn(command, { x: 10, y: 20 }, 'left', 100);

    expect(projectiles.step(600, []).active[0]).toMatchObject({ position: { x: -40, y: 20 } });
    expect(projectiles.step(1099, []).active).toHaveLength(1);
    expect(projectiles.step(1100, []).active).toHaveLength(0);
  });

  test('supports copy-owned directed velocity while preserving facing metadata', () => {
    const projectiles = new ProjectileSystem(1);
    const velocity = { x: 120, y: -80 };
    projectiles.spawnDirected({ ...command, velocity }, { x: 10, y: 20 }, 'left', 100);
    velocity.x = 999;

    expect(projectiles.step(600, []).active[0]).toMatchObject({
      position: { x: 70, y: -20 },
    });
    expect(() =>
      projectiles.spawnDirected(
        { ...command, velocity: { x: 0, y: 0 } },
        { x: 0, y: 0 },
        'right',
        600,
      ),
    ).toThrow(RangeError);
  });

  test('cannot hit owner or allies and emits one contact until explicit idempotent consumption', () => {
    const projectiles = new ProjectileSystem(1);
    projectiles.spawn(command, { x: 0, y: 0 }, 'right', 0);
    const body = (targetId: string, teamId: string) => ({
      targetId: stableId<'combatant'>(targetId),
      teamId: stableId<'team'>(teamId),
      hurtboxes: [{ x: 48, y: -5, width: 10, height: 10 }],
    });

    expect(
      projectiles.step(500, [body('mara', 'enemy'), body('reed-friend', 'player')]).impacts,
    ).toEqual([]);
    const result = projectiles.step(500, [body('reed-wisp', 'enemy'), body('root-mite', 'enemy')]);
    expect(result.impacts).toEqual([
      expect.objectContaining({ targetId: 'reed-wisp', attackId: 'lumen-bolt-impact' }),
    ]);
    expect(result.active).toHaveLength(1);
    expect(projectiles.step(500, [body('reed-wisp', 'enemy')]).impacts).toEqual([]);
    expect(projectiles.consume(1)).toBe(true);
    expect(projectiles.consume(1)).toBe(false);
    expect(projectiles.snapshot()).toEqual([]);
    expect(projectiles.canSpawn()).toBe(true);
  });

  test('rejects malformed runtime geometry without occupying the pool', () => {
    const projectiles = new ProjectileSystem(1);
    expect(() =>
      projectiles.spawn(
        { ...command, bounds: { x: 0, y: 0, width: 0, height: 4 } },
        { x: 0, y: 0 },
        'right',
        0,
      ),
    ).toThrow(RangeError);
    expect(() => projectiles.spawn(command, { x: Number.NaN, y: 0 }, 'right', 0)).toThrow(
      RangeError,
    );
    expect(projectiles.spawn(command, { x: 0, y: 0 }, 'right', 0)).not.toBeNull();
  });

  test('clear releases active leases once, preserves time, and permits reuse', () => {
    const projectiles = new ProjectileSystem(2);
    projectiles.spawn(command, { x: 0, y: 0 }, 'right', 100);
    projectiles.spawn(command, { x: 0, y: 0 }, 'right', 100);

    expect(projectiles.clear()).toBe(true);
    expect(projectiles.clear()).toBe(false);
    expect(projectiles.step(100, []).active).toEqual([]);
    expect(projectiles.canSpawn()).toBe(true);
    expect(() => projectiles.spawn(command, { x: 0, y: 0 }, 'right', 99)).toThrow(RangeError);
    expect(projectiles.spawn(command, { x: 0, y: 0 }, 'right', 100)).not.toBeNull();
  });

  test('dispose is idempotent, releases active leases, and permanently blocks spawning', () => {
    const projectiles = new ProjectileSystem(1);
    projectiles.spawn(command, { x: 0, y: 0 }, 'right', 0);

    expect(projectiles.dispose()).toBe(true);
    expect(projectiles.dispose()).toBe(false);
    expect(projectiles.canSpawn()).toBe(false);
    expect(projectiles.spawn(command, { x: 0, y: 0 }, 'right', 0)).toBeNull();
    expect(projectiles.step(0, []).active).toEqual([]);
  });

  test('returns deeply immutable contacts and read-only snapshots', () => {
    const projectiles = new ProjectileSystem(1);
    projectiles.spawn(command, { x: 0, y: 0 }, 'right', 0);
    const result = projectiles.step(500, [
      {
        targetId: stableId<'combatant'>('root-mite'),
        teamId: stableId<'team'>('enemy'),
        hurtboxes: [{ x: 48, y: -5, width: 10, height: 10 }],
      },
    ]);
    const impact = result.impacts[0]!;
    const snapshot = projectiles.snapshot();

    expect(Object.isFrozen(impact)).toBe(true);
    expect(Object.isFrozen(impact.source)).toBe(true);
    expect(Object.isFrozen(impact.source.position)).toBe(true);
    expect(Object.isFrozen(impact.damage)).toBe(true);
    expect(Object.isFrozen(impact.damage.critical)).toBe(true);
    expect(Object.isFrozen(impact.knockback)).toBe(true);
    expect(Object.isFrozen(impact.tags)).toBe(true);
    expect(Object.isFrozen(impact.projectile)).toBe(true);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot[0])).toBe(true);
    expect(Object.isFrozen(snapshot[0]?.position)).toBe(true);
  });
});
