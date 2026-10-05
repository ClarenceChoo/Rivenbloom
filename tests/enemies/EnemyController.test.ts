import { describe, expect, test } from 'vitest';

import { EncounterDirector } from '../../src/game/ai/EncounterDirector';
import type { CombatImpact, CombatImpactResolution } from '../../src/game/combat/CombatImpact';
import type { CombatResolutionCommand } from '../../src/game/combat/CombatImpact';
import type { HurtboxTarget } from '../../src/game/combat/HitboxSystem';
import { damageTypeId, stableId } from '../../src/game/core/StableId';
import { ACTORS, AI_PROFILES, DROP_TABLES } from '../../src/game/data/actors';
import { ATTACKS } from '../../src/game/data/attacks';
import type {
  ActorSpawnDefinition,
  Rect,
  SurfaceDefinition,
  Vec2,
} from '../../src/game/data/types';
import { EnemyFactory } from '../../src/game/entities/enemies/EnemyFactory';
import type {
  EnemyController,
  EnemyControllerEvent,
  EnemyDynamicPorts,
  EnemyTargetSnapshot,
} from '../../src/game/entities/enemies/EnemyController';

const playerId = stableId<'combatant'>('mara');
const playerTeam = stableId<'team'>('player');

function target(position: Vec2): EnemyTargetSnapshot {
  const hurtboxTarget: HurtboxTarget = {
    targetId: playerId,
    teamId: playerTeam,
    hurtboxes: [{ x: position.x - 24, y: position.y - 96, width: 48, height: 96 }],
  };
  return { position, hurtboxTarget };
}

function floor(bounds: Rect): SurfaceDefinition {
  return {
    surfaceId: stableId<'surface'>('test-floor'),
    kind: 'solid',
    roomId: stableId<'room'>('test-room'),
    bounds,
    materialId: stableId<'material'>('test-stone'),
  };
}

function wall(bounds: Rect): SurfaceDefinition {
  return {
    ...floor(bounds),
    surfaceId: stableId<'surface'>('test-wall'),
  };
}

function oneWay(bounds: Rect): SurfaceDefinition {
  return {
    ...floor(bounds),
    surfaceId: stableId<'surface'>('test-one-way'),
    kind: 'one-way',
  };
}

function resolvedTargetImpact(impact: CombatImpact): CombatImpactResolution {
  return {
    kind: 'resolved',
    guard: 'none',
    manaSpent: 0,
    damage: {
      healthDamage: impact.damage.baseDamage,
      poiseDamage: impact.damage.poiseDamage,
      remainingPoise: 10,
      staggered: false,
      critical: false,
      parried: false,
    },
    remainingHealth: 90,
    remainingPoise: 10,
    staggered: false,
    defeated: false,
    projectileDisposition: 'continue',
    commands: [],
  };
}

function spawn(actorId: string, position: Vec2 = { x: 120, y: 300 }): ActorSpawnDefinition {
  return {
    spawnId: stableId<'actor-spawn'>(`${actorId}-one`),
    actorId: stableId<'actor'>(actorId),
    roomId: stableId<'room'>('test-room'),
    position,
    facing: 'right',
    encounterId: stableId<'encounter'>('test-encounter'),
  };
}

type Harness = Readonly<{
  controller: EnemyController;
  director: EncounterDirector;
  setTarget(value: EnemyTargetSnapshot | null): void;
  setCamera(value: Rect): void;
  setSurfaces(value: readonly SurfaceDefinition[]): void;
  setOrdnanceCount(value: number): void;
  impacts: CombatImpact[];
}>;

function harness(
  actorId: string,
  initialTarget: EnemyTargetSnapshot | null,
  position: Vec2 = { x: 120, y: 300 },
  receiveTargetImpact: (impact: CombatImpact) => CombatImpactResolution = resolvedTargetImpact,
): Harness {
  let currentTarget = initialTarget;
  let camera = { x: 0, y: 0, width: 1280, height: 720 };
  let surfaces: readonly SurfaceDefinition[] = [
    floor({ x: -500, y: 300, width: 2000, height: 120 }),
  ];
  let ordnanceCount = 0;
  const impacts: CombatImpact[] = [];
  const ports: EnemyDynamicPorts = {
    readTarget: () => currentTarget,
    readCameraBounds: () => camera,
    readSurfaces: () => surfaces,
    receiveTargetImpact: (impact) => {
      impacts.push(impact);
      return receiveTargetImpact(impact);
    },
    readRoomOrdnanceCount: () => ordnanceCount,
  };
  const director = new EncounterDirector();
  const factory = new EnemyFactory({
    actors: ACTORS,
    profiles: AI_PROFILES,
    attacks: ATTACKS,
    dropTables: DROP_TABLES,
  });
  return {
    controller: factory.create(spawn(actorId, position), director, ports),
    director,
    setTarget(value) {
      currentTarget = value;
    },
    setCamera(value) {
      camera = value;
    },
    setSurfaces(value) {
      surfaces = value;
    },
    setOrdnanceCount(value) {
      ordnanceCount = value;
    },
    impacts,
  };
}

function driveToTelegraph(enemy: Harness): ReturnType<EnemyController['snapshot']> {
  enemy.controller.update(0, 17);
  enemy.controller.update(17, 17);
  return enemy.controller.update(34, 17);
}

function incoming(
  controller: EnemyController,
  occurredAtMs: number,
  patch: Partial<CombatImpact> = {},
): CombatImpact {
  const identity = controller.identity();
  return {
    attackId: stableId<'attack'>('test-player-strike'),
    targetId: identity.combatantId,
    source: {
      ownerId: playerId,
      teamId: playerTeam,
      position: { x: controller.snapshot().position.x + 100, y: controller.snapshot().position.y },
      facing: 'left',
    },
    occurredAtMs,
    delivery: 'melee',
    damage: {
      baseDamage: 20,
      damageType: damageTypeId('physical'),
      poiseDamage: 5,
      critical: { kind: 'excluded' },
    },
    knockback: { x: -120, y: -40 },
    hitStopMs: 55,
    tags: ['blockable', 'parryable'],
    projectile: null,
    ...patch,
  };
}

function eventsOfKind<K extends EnemyControllerEvent['kind']>(
  controller: EnemyController,
  kind: K,
): Extract<EnemyControllerEvent, { kind: K }>[] {
  return controller
    .drainEvents()
    .filter((event): event is Extract<EnemyControllerEvent, { kind: K }> => event.kind === kind);
}

describe('enemy controller', () => {
  test('wakes, patrols, suspects, chases last seen, and retreats by monotonic deadlines', () => {
    const enemy = harness('briar-scrapper', target({ x: 220, y: 300 }));
    expect(enemy.controller.snapshot().state).toBe('sleep');
    expect(enemy.controller.update(0, 17).state).toBe('idle');
    expect(enemy.controller.update(17, 17).state).toBe('chase');

    enemy.setTarget(null);
    expect(enemy.controller.update(34, 17).state).toBe('chase');
    expect(enemy.controller.update(783, 749).state).toBe('chase');
    expect(enemy.controller.update(784, 1).state).toBe('suspect');
    expect(enemy.controller.update(1_284, 500).state).toBe('retreat');

    enemy.setTarget(target({ x: 180, y: 300 }));
    expect(enemy.controller.update(1_301, 17).state).toBe('chase');
  });

  test('checks target leash before attacking or moving and keeps retreat dominant beyond it', () => {
    const enemy = harness('briar-scrapper', target({ x: 220, y: 300 }));
    enemy.controller.update(0, 17);
    expect(enemy.controller.update(17, 17).state).toBe('chase');
    enemy.setTarget(target({ x: 450, y: 300 }));

    expect(enemy.controller.update(34, 17)).toMatchObject({
      state: 'retreat',
      position: { x: 120, y: 300 },
      attack: null,
    });
    expect(enemy.director.snapshot().pressure).toBe(0);
    expect(enemy.controller.update(51, 17).state).toBe('retreat');

    enemy.setTarget(target({ x: 220, y: 300 }));
    expect(enemy.controller.update(68, 17).state).toBe('chase');
  });

  test('does not pursue an out-of-leash last-seen point after losing the target', () => {
    const enemy = harness('briar-scrapper', target({ x: 220, y: 300 }));
    enemy.controller.update(0, 17);
    enemy.controller.update(17, 17);
    enemy.setTarget(target({ x: 450, y: 300 }));
    expect(enemy.controller.update(34, 17).state).toBe('retreat');
    enemy.setTarget(null);

    expect(enemy.controller.update(51, 17)).toMatchObject({
      state: 'retreat',
      position: { x: 120, y: 300 },
      velocity: { x: 0, y: 0 },
    });
  });

  test('requires a displaced enemy and its target to both be inside leash before leaving retreat', () => {
    const enemy = harness('briar-scrapper', target({ x: 220, y: 300 }));
    enemy.controller.update(0, 17);
    enemy.controller.receiveImpact(
      incoming(enemy.controller, 0, { knockback: { x: 2_000, y: 0 } }),
    );

    expect(enemy.controller.update(180, 180)).toMatchObject({
      state: 'retreat',
      position: { x: 480, y: 300 },
    });
    const movingHome = enemy.controller.update(197, 17);
    expect(movingHome.state).toBe('retreat');
    expect(movingHome.position.x).toBeLessThan(480);
    const inside = enemy.controller.update(1_197, 1_000);
    expect(inside.state).toBe('retreat');
    expect(Math.abs(inside.position.x - 120)).toBeLessThanOrEqual(300);
    expect(enemy.controller.update(1_214, 17).state).toBe('chase');
  });

  test.each([
    ['duskwing', 150],
    ['spore-scribe', 200],
  ] as const)(
    '%s backs away when the target is below its minimum attack range',
    (actorId, targetX) => {
      const enemy = harness(actorId, target({ x: targetX, y: 300 }));
      enemy.controller.update(0, 17);
      enemy.controller.update(17, 17);

      const spaced = enemy.controller.update(34, 17);
      expect(spaced.state).toBe('chase');
      expect(spaced.position.x).toBeLessThan(120);
      expect(spaced.facing).toBe('left');
    },
  );

  test('patrol respects walls, ledges, authored patrol limits, and leash', () => {
    const enemy = harness('briar-scrapper', target({ x: 150, y: 300 }));
    enemy.controller.update(0, 17);
    enemy.setTarget(null);
    expect(enemy.controller.update(17, 17).state).toBe('patrol');
    enemy.setSurfaces([
      floor({ x: 0, y: 300, width: 150, height: 120 }),
      wall({ x: 148, y: 180, width: 20, height: 120 }),
    ]);
    const blocked = enemy.controller.update(34, 17);
    expect(blocked.position.x).toBe(120);
    expect(blocked.facing).toBe('left');

    enemy.setSurfaces([floor({ x: -500, y: 300, width: 2000, height: 120 })]);
    let snapshot = blocked;
    for (let now = 51; now <= 4_000; now += 17) snapshot = enemy.controller.update(now, 17);
    expect(snapshot.position.x).toBeGreaterThanOrEqual(-20);
    expect(snapshot.position.x).toBeLessThanOrEqual(260);
    expect(Math.abs(snapshot.position.x - 120)).toBeLessThanOrEqual(300);
  });

  test('locks facing in telegraph, samples an authored attack, then releases its lease on recovery', () => {
    const enemy = harness('briar-scrapper', target({ x: 190, y: 300 }));
    const telegraph = driveToTelegraph(enemy);
    expect(telegraph).toMatchObject({
      state: 'telegraph',
      facing: 'right',
      attack: { attackId: 'briar-scrapper-lunge', phase: 'telegraph', deadlineMs: 234 },
    });
    enemy.setTarget(target({ x: 50, y: 300 }));
    expect(enemy.controller.update(200, 166).facing).toBe('right');
    enemy.setTarget(target({ x: 190, y: 300 }));

    const active = enemy.controller.update(234, 34);
    expect(active).toMatchObject({ state: 'attack', attack: { phase: 'active', deadlineMs: 314 } });
    expect(enemy.impacts).toHaveLength(1);
    expect(enemy.impacts[0]).toMatchObject({
      attackId: 'briar-scrapper-lunge',
      targetId: 'mara',
      source: { ownerId: 'briar-scrapper-one', teamId: 'hostile', facing: 'right' },
      occurredAtMs: 234,
      delivery: 'melee',
      projectile: null,
    });
    expect(enemy.controller.update(314, 80).state).toBe('recover');
    expect(enemy.director.snapshot().pressure).toBe(0);
  });

  test('a parried melee resolution routes punish-attacker back to the owner and interrupts into stagger', () => {
    const enemy = harness('briar-scrapper', target({ x: 190, y: 300 }), { x: 120, y: 300 }, () => ({
      kind: 'parried',
      guard: 'parry',
      manaSpent: 0,
      projectileDisposition: 'continue',
      commands: [
        {
          kind: 'punish-attacker',
          statusId: stableId<'status'>('staggered'),
        },
      ],
    }));
    const telegraph = driveToTelegraph(enemy);
    const activeAt = telegraph.attack!.deadlineMs;

    expect(enemy.controller.update(activeAt, activeAt - 34)).toMatchObject({
      state: 'stagger',
      stateDeadlineMs: activeAt + 650,
      attack: null,
    });
    expect(enemy.director.snapshot().pressure).toBe(0);
  });

  test('exposes a typed resolution-command seam for owner-routed planted ordnance', () => {
    const enemy = harness('spore-scribe', target({ x: 300, y: 300 }));
    enemy.controller.update(0, 17);
    const punish: CombatResolutionCommand = {
      kind: 'punish-attacker',
      statusId: stableId<'status'>('staggered'),
    };

    expect(enemy.controller.applyResolutionCommand(punish, 0)).toBe(true);
    expect(enemy.controller.snapshot()).toMatchObject({ state: 'stagger', stateDeadlineMs: 650 });
    expect(enemy.controller.applyResolutionCommand({ kind: 'guard-break' }, 0)).toBe(false);
  });

  test('expanded-camera exit sleeps, withdraws, and emits no attack or ordnance', () => {
    const enemy = harness('spore-scribe', target({ x: 360, y: 300 }));
    driveToTelegraph(enemy);
    expect(enemy.director.snapshot().pressure).toBe(1);
    enemy.controller.drainEvents();
    enemy.setCamera({ x: 2_000, y: 0, width: 1_280, height: 720 });

    expect(enemy.controller.update(100, 66).state).toBe('sleep');
    expect(enemy.director.snapshot().pressure).toBe(0);
    expect(enemy.impacts).toEqual([]);
    expect(enemy.controller.drainEvents().filter((event) => event.kind === 'ordnance')).toEqual([]);
  });

  test('ranged attacks require their origin inside the authored camera inset', () => {
    const enemy = harness('spore-scribe', target({ x: 280, y: 300 }), { x: 50, y: 300 });
    enemy.controller.update(0, 17);
    enemy.controller.update(17, 17);
    expect(enemy.controller.update(34, 17).state).toBe('chase');
    expect(enemy.director.snapshot().pressure).toBe(0);
  });

  test.each(['briar-scrapper', 'thorn-sentinel'] as const)(
    '%s does not begin a close or elite telegraph until its authored body is camera-visible',
    (actorId) => {
      const enemy = harness(actorId, target({ x: 90, y: 300 }), { x: 20, y: 300 });
      enemy.controller.update(0, 17);
      enemy.controller.update(17, 17);

      expect(enemy.controller.update(34, 17)).toMatchObject({ state: 'chase', attack: null });
      expect(enemy.director.snapshot().pressure).toBe(0);
    },
  );

  test('Briar Scrapper advances through its authored forward lunge before recoil', () => {
    const enemy = harness('briar-scrapper', target({ x: 190, y: 300 }));
    const telegraph = driveToTelegraph(enemy);
    const activeAt = telegraph.attack!.deadlineMs;
    enemy.controller.update(activeAt, activeAt - 34);

    expect(enemy.controller.update(activeAt + 40, 40).position.x).toBeCloseTo(130.4, 5);
    const recovery = enemy.controller.update(activeAt + 80, 40);
    expect(recovery.state).toBe('recover');
    expect(recovery.position.x).toBeCloseTo(140.8, 5);
  });

  test('Duskwing follows the authored quadratic dive arc', () => {
    const enemy = harness('duskwing', target({ x: 320, y: 200 }), { x: 120, y: 200 });
    const telegraph = driveToTelegraph(enemy);
    expect(telegraph.attack?.attackId).toBe('duskwing-hook-dive');
    const activeAt = telegraph.attack!.deadlineMs;
    enemy.controller.update(activeAt, activeAt - 34);
    const midpoint = enemy.controller.update(activeAt + 120, 120);
    expect(midpoint.position.y).toBeCloseTo(264, 5);
  });

  test('Duskwing hovers for 150 ms after its dive then returns to the attack origin', () => {
    const enemy = harness('duskwing', target({ x: 320, y: 200 }), { x: 120, y: 200 });
    const telegraph = driveToTelegraph(enemy);
    const activeAt = telegraph.attack!.deadlineMs;
    enemy.controller.update(activeAt, activeAt - 34);
    const recoveryAt = activeAt + 240;
    expect(enemy.controller.update(recoveryAt, 240)).toMatchObject({
      state: 'recover',
      position: { x: 320, y: 200 },
    });
    expect(enemy.controller.update(recoveryAt + 100, 100).position).toEqual({ x: 320, y: 200 });
    expect(enemy.controller.update(recoveryAt + 285, 185).position.x).toBeCloseTo(220, 5);
    const returned = enemy.controller.update(recoveryAt + 420, 135);
    expect(returned.position).toEqual({ x: 120, y: 200 });
  });

  test('Spore Scribe emits one planted projectile command with arming/lifetime/cap metadata', () => {
    const enemy = harness('spore-scribe', target({ x: 360, y: 300 }));
    const telegraph = driveToTelegraph(enemy);
    const activeAt = telegraph.attack!.deadlineMs;
    enemy.controller.drainEvents();
    enemy.controller.update(activeAt, activeAt - 34);
    const commands = eventsOfKind(enemy.controller, 'ordnance');
    expect(commands).toHaveLength(1);
    expect(commands[0]?.command).toEqual(
      expect.objectContaining({
        kind: 'plant',
        attackId: 'spore-scribe-pollen-plant',
        ownerId: 'spore-scribe-one',
        teamId: 'hostile',
        armsAtMs: activeAt + 350,
        expiresAtMs: activeAt + 1_250,
        roomCap: 6,
        maxHits: 1,
        delivery: 'projectile',
        tags: ['blockable', 'parryable', 'projectile'],
      }),
    );
    expect(commands[0]?.command).not.toHaveProperty('speed');
  });

  test('Spore Scribe respects its six-per-room ordnance cap', () => {
    const enemy = harness('spore-scribe', target({ x: 360, y: 300 }));
    enemy.setOrdnanceCount(6);
    const telegraph = driveToTelegraph(enemy);
    enemy.controller.drainEvents();
    enemy.controller.update(telegraph.attack!.deadlineMs, telegraph.attack!.deadlineMs - 34);
    expect(eventsOfKind(enemy.controller, 'ordnance')).toEqual([]);
  });

  test('Rootlurker is untargetable while sleeping and during hidden recovery', () => {
    const enemy = harness('rootlurker', target({ x: 220, y: 300 }));
    expect(enemy.controller.hurtboxTarget().hurtboxes).toEqual([]);
    const telegraph = driveToTelegraph(enemy);
    const activeAt = telegraph.attack!.deadlineMs;
    enemy.controller.update(activeAt, activeAt - 34);
    const recovery = enemy.controller.update(activeAt + 120, 120);
    expect(recovery).toMatchObject({ state: 'recover', hidden: true });
    expect(enemy.controller.hurtboxTarget().hurtboxes).toEqual([]);
  });

  test('Barkbound front defense reduces damage and exposes a staggered core for 900 ms', () => {
    const enemy = harness('barkbound', target({ x: 250, y: 300 }));
    enemy.controller.update(0, 17);
    enemy.setTarget(null);
    const guarded = enemy.controller.receiveImpact(incoming(enemy.controller, 0));
    expect(guarded).toMatchObject({
      kind: 'resolved',
      guard: 'block',
      damage: { healthDamage: 2 },
      remainingHealth: 70,
      staggered: true,
    });
    expect(enemy.controller.snapshot()).toMatchObject({
      state: 'stagger',
      coreExposedUntilMs: 900,
    });

    const exposed = enemy.controller.receiveImpact(incoming(enemy.controller, 0));
    expect(exposed).toMatchObject({
      kind: 'resolved',
      guard: 'none',
      damage: { healthDamage: 11 },
    });
  });

  test('Thorn Sentinel front guard reduces damage without exposing its core', () => {
    const enemy = harness('thorn-sentinel', target({ x: 250, y: 300 }));
    enemy.controller.update(0, 17);
    enemy.setTarget(null);
    expect(enemy.controller.receiveImpact(incoming(enemy.controller, 0))).toMatchObject({
      kind: 'resolved',
      guard: 'block',
      damage: { healthDamage: 3 },
    });
    expect(enemy.controller.snapshot().coreExposedUntilMs).toBeNull();
  });

  test('uses exact armour, resistance, poise, hurt/stagger deadlines, and actual damage', () => {
    const enemy = harness('briar-scrapper', target({ x: 250, y: 300 }));
    enemy.controller.update(0, 17);
    enemy.setTarget(null);
    const hurt = enemy.controller.receiveImpact(incoming(enemy.controller, 0));
    expect(hurt).toMatchObject({
      kind: 'resolved',
      damage: { healthDamage: 19, remainingPoise: 15, staggered: false },
      remainingHealth: 23,
    });
    expect(enemy.controller.snapshot()).toMatchObject({ state: 'hurt', stateDeadlineMs: 180 });
    expect(enemy.controller.update(180, 180).state).toBe('idle');

    const stagger = enemy.controller.receiveImpact(
      incoming(enemy.controller, 180, {
        damage: {
          baseDamage: 1,
          damageType: damageTypeId('physical'),
          poiseDamage: 30,
          critical: { kind: 'excluded' },
        },
      }),
    );
    expect(stagger).toMatchObject({ kind: 'resolved', staggered: true, remainingPoise: 0 });
    expect(enemy.controller.snapshot()).toMatchObject({ state: 'stagger', stateDeadlineMs: 830 });
    expect(enemy.controller.update(830, 650).vitality.currentPoise).toBe(20);
  });

  test('applies world-facing knockback for a deterministic hurt interval without remirroring', () => {
    const enemy = harness('briar-scrapper', target({ x: 250, y: 300 }));
    enemy.controller.update(0, 17);
    enemy.setTarget(null);
    enemy.controller.receiveImpact(incoming(enemy.controller, 0, { knockback: { x: -120, y: 0 } }));

    expect(enemy.controller.snapshot()).toMatchObject({
      velocity: { x: -120, y: 0 },
      knockbackUntilMs: 180,
    });
    expect(enemy.controller.update(17, 17).position.x).toBeCloseTo(117.96, 5);
    const released = enemy.controller.update(180, 163);
    expect(released.position.x).toBeCloseTo(98.4, 5);
    expect(released).toMatchObject({ state: 'idle', velocity: { x: 0, y: 0 } });
  });

  test('stops knockback at authored solid geometry instead of tunnelling the body through it', () => {
    const enemy = harness('briar-scrapper', target({ x: 250, y: 300 }));
    enemy.controller.update(0, 17);
    enemy.setTarget(null);
    enemy.setSurfaces([
      floor({ x: -500, y: 300, width: 2_000, height: 120 }),
      wall({ x: 70, y: 180, width: 26, height: 120 }),
    ]);
    enemy.controller.receiveImpact(incoming(enemy.controller, 0, { knockback: { x: -300, y: 0 } }));

    expect(enemy.controller.update(17, 17)).toMatchObject({
      position: { x: 120, y: 300 },
      velocity: { x: 0, y: 0 },
    });
  });

  test('lands downward knockback on a thin one-way platform top', () => {
    const enemy = harness('briar-scrapper', target({ x: 250, y: 260 }), { x: 120, y: 260 });
    enemy.controller.update(0, 17);
    enemy.setTarget(null);
    enemy.setSurfaces([oneWay({ x: 0, y: 280, width: 400, height: 16 })]);
    enemy.controller.receiveImpact(incoming(enemy.controller, 0, { knockback: { x: 0, y: 300 } }));

    expect(enemy.controller.update(100, 100)).toMatchObject({
      position: { x: 120, y: 280 },
      velocity: { x: 0, y: 0 },
    });
  });

  test.each(['solid', 'one-way'] as const)(
    'real upward player knockback returns a ground enemy to its %s support under deterministic gravity',
    (kind) => {
      const enemy = harness('briar-scrapper', target({ x: 250, y: 300 }));
      enemy.controller.update(0, 17);
      enemy.setTarget(null);
      enemy.setSurfaces([
        kind === 'solid'
          ? floor({ x: -500, y: 300, width: 2_000, height: 120 })
          : oneWay({ x: -500, y: 300, width: 2_000, height: 16 }),
      ]);
      enemy.controller.receiveImpact(
        incoming(enemy.controller, 0, { knockback: { x: 180, y: -80 } }),
      );

      expect(enemy.controller.update(17, 17).position.y).toBeLessThan(300);
      expect(enemy.controller.update(180, 163)).toMatchObject({
        state: 'idle',
        position: { y: 300 },
        velocity: { x: 0, y: 0 },
        knockbackUntilMs: null,
      });
    },
  );

  test('death releases slots and emits its typed guaranteed drop exactly once', () => {
    const enemy = harness('thorn-sentinel', target({ x: 190, y: 300 }));
    driveToTelegraph(enemy);
    enemy.controller.drainEvents();
    const lethal = incoming(enemy.controller, 34, {
      damage: {
        baseDamage: 1_000,
        damageType: damageTypeId('resonance'),
        poiseDamage: 100,
        critical: { kind: 'excluded' },
      },
    });
    expect(enemy.controller.receiveImpact(lethal)).toMatchObject({ defeated: true });
    expect(enemy.controller.snapshot().state).toBe('dead');
    expect(enemy.director.snapshot().pressure).toBe(0);
    expect(eventsOfKind(enemy.controller, 'drop-request')).toEqual([
      expect.objectContaining({
        combatantId: 'thorn-sentinel-one',
        dropTableId: 'thorn-sentinel-briar-core',
        position: expect.any(Object),
      }),
    ]);
    enemy.controller.receiveImpact(lethal);
    expect(eventsOfKind(enemy.controller, 'drop-request')).toEqual([]);
  });

  test('rotates Thorn Sentinel press and paired sweep patterns in authored order', () => {
    const enemy = harness('thorn-sentinel', target({ x: 190, y: 300 }));
    const ids: string[] = [];
    let snapshot = driveToTelegraph(enemy);
    for (let index = 0; index < 3; index += 1) {
      ids.push(snapshot.attack!.attackId);
      const activeAt = snapshot.attack!.deadlineMs;
      snapshot = enemy.controller.update(
        activeAt,
        Math.max(1, activeAt - snapshot.simulationTimeMs),
      );
      const recoverAt = snapshot.attack!.deadlineMs;
      snapshot = enemy.controller.update(
        recoverAt,
        Math.max(1, recoverAt - snapshot.simulationTimeMs),
      );
      const chaseAt = Math.max(recoverAt + 1, snapshot.stateDeadlineMs ?? recoverAt + 1);
      enemy.controller.update(chaseAt, Math.max(1, chaseAt - snapshot.simulationTimeMs));
      snapshot = enemy.controller.update(chaseAt + 17, 17);
    }
    expect(ids).toEqual([
      'thorn-sentinel-press',
      'thorn-sentinel-sweep-one',
      'thorn-sentinel-sweep-two',
    ]);
  });

  test('incoming hurt interrupts telegraph and dispose idempotently releases all ownership', () => {
    const enemy = harness('briar-scrapper', target({ x: 190, y: 300 }));
    driveToTelegraph(enemy);
    expect(enemy.director.snapshot().pressure).toBe(1);
    enemy.controller.receiveImpact(incoming(enemy.controller, 34));
    expect(enemy.controller.snapshot().state).toBe('hurt');
    expect(enemy.director.snapshot().pressure).toBe(0);

    enemy.controller.dispose();
    enemy.controller.dispose();
    expect(enemy.controller.hurtboxTarget().hurtboxes).toEqual([]);
    expect(enemy.controller.snapshot().disposed).toBe(true);
    expect(() => enemy.controller.update(51, 17)).toThrow(/disposed/i);
  });

  test('rejects non-monotonic updates and impacts from a different fixed time', () => {
    const enemy = harness('briar-scrapper', null);
    enemy.controller.update(10, 10);
    expect(() => enemy.controller.update(9, 1)).toThrow(RangeError);
    expect(() => enemy.controller.receiveImpact(incoming(enemy.controller, 9))).toThrow(RangeError);
  });
});
