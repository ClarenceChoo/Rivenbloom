import { describe, expect, it } from 'vitest';
import { projectCombatVisuals } from '../../src/game/effects/CombatPresentation';
import { stableId } from '../../src/game/core/StableId';

describe('combat presentation', () => {
  it('keeps owner identities distinct and clears expired projectiles', () => {
    const bolt = {
      instanceId: 1,
      projectileId: stableId<'projectile'>('lumen-bolt'),
      position: { x: 300, y: 400 },
    };
    const visuals = projectCombatVisuals([bolt], null);
    expect(visuals).toContainEqual(
      expect.objectContaining({ key: 'player:1', x: 300, y: 400, kind: 'bolt' }),
    );
    expect(projectCombatVisuals([], null)).toEqual([]);
  });
  it('renders delayed ordnance at its real bounds before and after arming', () => {
    const ordnance = {
      instanceId: 4,
      bounds: { x: 20, y: 30, width: 80, height: 100 },
      armed: false,
    };
    const world = { enemies: [], boss: null, ordnance: [ordnance] };
    expect(projectCombatVisuals([], world)[0]).toMatchObject({
      x: 60,
      y: 80,
      width: 80,
      height: 100,
      phase: 'warning',
    });
    expect(
      projectCombatVisuals([], { ...world, ordnance: [{ ...ordnance, armed: true }] })[0]?.phase,
    ).toBe('active');
  });
});

it('reserves enough threat slots for the authored worst case without dropping damaging regions', async () => {
  const { THREAT_CAPACITY } = await import('../../src/game/effects/CombatPresentation');
  const { CONTENT_REGISTRY } = await import('../../src/game/data/areas');
  const { ATTACKS } = await import('../../src/game/data/attacks');
  const { PALLID_CANTOR_ENCOUNTER } = await import('../../src/game/data/bosses/pallidCantor');
  const mostActors = Math.max(
    ...CONTENT_REGISTRY.areas.flatMap((area) =>
      area.rooms.map(
        (room) => area.actorSpawns.filter((spawn) => spawn.roomId === room.roomId).length,
      ),
    ),
  );
  const mostHitboxes = Math.max(...ATTACKS.map((attack) => attack.hitboxes.length));
  const conservativeMaximum =
    8 + PALLID_CANTOR_ENCOUNTER.projectileCapacity + 12 + (mostActors + 1) * mostHitboxes + 3 + 1;
  expect(conservativeMaximum).toBeLessThanOrEqual(THREAT_CAPACITY);
});

it('keeps both boss phases visible and clears all threats on interruption/disposal', async () => {
  const { PallidCantorController } =
    await import('../../src/game/entities/bosses/PallidCantorController');
  const { PALLID_CANTOR_PHASE_ONE_ATTACKS, PALLID_CANTOR_PHASE_TWO_ATTACKS } =
    await import('../../src/game/entities/bosses/pallidCantorAttacks');
  const boss = new PallidCantorController({
    readTarget: () => ({
      position: { x: 800, y: 900 },
      hurtboxTarget: {
        targetId: stableId<'combatant'>('mara'),
        teamId: stableId<'team'>('player'),
        hurtboxes: [{ x: 776, y: 804, width: 48, height: 96 }],
      },
    }),
    receiveTargetImpact: () => ({
      kind: 'unresolved',
      projectileDisposition: 'continue',
      commands: [],
    }),
  });
  const seen = new Set<string>();
  function step(count: number) {
    for (let i = 0; i < count; i++) {
      const previous = boss.snapshot();
      const current = boss.update({
        stepIndex: previous.stepIndex + 1,
        nowMs: previous.simulationTimeMs + 17,
        stepMs: 17,
        pulses: [],
      }).snapshot;
      const visuals = projectCombatVisuals([], { enemies: [], ordnance: [], boss: current });
      if (current.activeAttackId && visuals.length) seen.add(current.activeAttackId);
      for (const projectile of current.projectiles)
        expect(visuals).toContainEqual(
          expect.objectContaining({
            key: `boss:${projectile.instanceId}`,
            x: projectile.position.x,
            y: projectile.position.y,
          }),
        );
    }
  }
  step(1000);
  for (const id of PALLID_CANTOR_PHASE_ONE_ATTACKS) expect(seen.has(id), id).toBe(true);
  const current = boss.snapshot();
  boss.receiveImpact({
    attackId: stableId<'attack'>('mara-light-one'),
    targetId: current.combatantId,
    source: {
      ownerId: stableId<'combatant'>('mara'),
      teamId: stableId<'team'>('player'),
      position: { x: 900, y: 900 },
      facing: 'right',
    },
    occurredAtMs: current.simulationTimeMs,
    delivery: 'melee',
    damage: {
      baseDamage: 1000,
      damageType: stableId<'damage-type'>('physical'),
      poiseDamage: 0,
      critical: { kind: 'excluded' },
    },
    knockback: { x: 0, y: 0 },
    hitStopMs: 0,
    tags: ['blockable'],
    projectile: null,
  });
  expect(boss.snapshot().state).toBe('transition');
  expect(projectCombatVisuals([], { enemies: [], ordnance: [], boss: boss.snapshot() })).toEqual(
    [],
  );
  step(1100);
  for (const id of PALLID_CANTOR_PHASE_TWO_ATTACKS) expect(seen.has(id), id).toBe(true);
  boss.dispose();
  expect(projectCombatVisuals([], { enemies: [], ordnance: [], boss: boss.snapshot() })).toEqual(
    [],
  );
});
