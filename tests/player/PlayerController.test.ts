import { describe, expect, test } from 'vitest';

import { PLAYER_STATES, PlayerStateMachine } from '../../src/game/entities/player/PlayerState';
import { PlayerController } from '../../src/game/entities/player/PlayerController';
import { playerVisualCenter } from '../../src/game/entities/player/PlayerView';
import { damageTypeId, stableId } from '../../src/game/core/StableId';
import { abilityId } from '../../src/game/core/StableId';
import { InputService } from '../../src/game/input/InputService';
import type { InputDevicePort, InputDeviceSnapshot } from '../../src/game/input/InputService';
import type { SurfaceDefinition } from '../../src/game/data/types';
import { DEFAULT_SAVE_SETTINGS } from '../../src/game/saves/SaveSchema';
import type { CombatImpact, CombatImpactResolution } from '../../src/game/combat/CombatImpact';

class FixedInputPort implements InputDevicePort {
  public reads = 0;

  public constructor(public snapshot: InputDeviceSnapshot) {}

  public read(): InputDeviceSnapshot {
    this.reads += 1;
    return this.snapshot;
  }

  public clearTransient(): void {}
}

function inputSnapshot(heldCodes: readonly string[] = []): InputDeviceSnapshot {
  return Object.freeze({
    focused: true,
    keyboard: Object.freeze({
      heldCodes: Object.freeze([...heldCodes]),
      pressed: Object.freeze([]),
      released: Object.freeze([]),
      activityAtMs: null,
    }),
    gamepad: null,
  });
}

const GROUND: SurfaceDefinition = Object.freeze({
  surfaceId: stableId<'surface'>('test-ground'),
  kind: 'solid',
  roomId: stableId<'room'>('test-room'),
  bounds: Object.freeze({ x: 0, y: 608, width: 1_000, height: 112 }),
  materialId: stableId<'material'>('test-stone'),
});
const ONE_WAY: SurfaceDefinition = Object.freeze({ ...GROUND, kind: 'one-way' });
const combatOptions = (patch = {}) => ({
  currentMana: 40,
  unlockedAbilityIds: [abilityId('lumen-bolt')],
  initialFacing: 'right' as const,
  settings: DEFAULT_SAVE_SETTINGS,
  targets: () => [],
  ...patch,
});

function incomingImpact(patch: Partial<CombatImpact> = {}): CombatImpact {
  return {
    attackId: stableId<'attack'>('test-enemy-strike'),
    targetId: stableId<'combatant'>('mara'),
    source: {
      ownerId: stableId<'combatant'>('briar-scrapper'),
      teamId: stableId<'team'>('enemy'),
      position: { x: 320, y: 608 },
      facing: 'left',
    },
    occurredAtMs: 0,
    delivery: 'melee',
    damage: {
      baseDamage: 20,
      damageType: damageTypeId('physical'),
      poiseDamage: 10,
      critical: { kind: 'excluded' },
    },
    knockback: { x: -180, y: -80 },
    hitStopMs: 55,
    tags: ['blockable', 'parryable'],
    projectile: null,
    ...patch,
  };
}

function resolvedImpact(healthDamage = 7): CombatImpactResolution {
  return {
    kind: 'resolved',
    guard: 'none',
    manaSpent: 0,
    damage: {
      healthDamage,
      poiseDamage: 3,
      remainingPoise: 17,
      staggered: false,
      critical: false,
      parried: false,
    },
    remainingHealth: 33,
    remainingPoise: 17,
    staggered: false,
    defeated: false,
    projectileDisposition: 'continue',
    commands: [],
  };
}

describe('PlayerStateMachine', () => {
  test('protects combat, hurt, and dead ownership while allowing explicit combat restoration', () => {
    expect(PLAYER_STATES).toEqual([
      'idle',
      'run',
      'jump',
      'fall',
      'land',
      'attackLight',
      'attackHeavy',
      'airAttack',
      'block',
      'parry',
      'dash',
      'cast',
      'climb',
      'interact',
      'hurt',
      'dead',
    ]);
    const machine = new PlayerStateMachine('idle');

    expect(machine.request('run', 'movement')).toBe(true);
    expect(machine.current).toBe('run');
    expect(machine.request('attackLight', 'movement')).toBe(false);
    expect(machine.current).toBe('run');
    expect(machine.request('attackLight', 'combat')).toBe(true);
    expect(machine.request('fall', 'movement')).toBe(false);
    expect(machine.current).toBe('attackLight');
    expect(machine.request('fall', 'combat')).toBe(true);
    expect(machine.current).toBe('fall');
    expect(machine.request('hurt', 'external')).toBe(true);
    expect(machine.current).toBe('hurt');
    expect(machine.request('attackLight', 'combat')).toBe(false);
    expect(machine.request('run', 'movement')).toBe(false);
    expect(machine.releaseHurt('run')).toBe(true);
    expect(machine.current).toBe('run');
    expect(machine.request('dead', 'external')).toBe(true);
    expect(machine.releaseHurt('idle')).toBe(false);
    expect(machine.request('hurt', 'external')).toBe(false);
    expect(machine.request('idle', 'external')).toBe(false);
    expect(machine.current).toBe('dead');
    expect(machine.request('idle', 'respawn')).toBe(true);
    expect(machine.current).toBe('idle');
  });
});

describe('playerVisualCenter', () => {
  test('maps authored feet coordinates to a centred render origin without shifting spawn feet', () => {
    expect(playerVisualCenter({ x: 256, y: 608 }, 128)).toEqual({ x: 256, y: 544 });
  });
});

describe('PlayerController', () => {
  test('runs fixed 60 Hz movement substeps from one semantic input frame', () => {
    const port = new FixedInputPort(inputSnapshot(['KeyD']));
    const input = new InputService(port);
    const controller = new PlayerController({
      input,
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
    });

    const snapshot = controller.update(100, 0.05);

    expect(snapshot.position.x).toBe(259);
    expect(snapshot.position.y).toBe(608);
    expect(snapshot.state).toBe('run');
    expect(snapshot.animationIntent).toBe('run');
    expect(port.reads).toBe(1);
  });

  test('consumes the InputService jump buffer exactly when movement accepts the jump', () => {
    const input = new InputService(new FixedInputPort(inputSnapshot(['Space'])));
    const controller = new PlayerController({
      input,
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
    });

    const snapshot = controller.update(10, 1 / 60);

    expect(snapshot.state).toBe('jump');
    expect(snapshot.velocity.y).toBe(-680);
    expect(input.consume('jump', 1)).toBe(false);
  });

  test('down plus jump drops through current one-way support instead of spending coyote time on a jump', () => {
    const port = new FixedInputPort(inputSnapshot());
    const input = new InputService(port);
    const controller = new PlayerController({
      input,
      position: { x: 256, y: 608 },
      surfaces: [ONE_WAY],
      zones: [],
    });
    controller.update(0, 1 / 60);
    port.snapshot = inputSnapshot(['ArrowDown', 'Space']);

    const dropped = controller.update(20, 1 / 60);

    expect(dropped.dropThroughRemaining).toBeCloseTo(0.18);
    expect(dropped.position.y).toBeGreaterThan(608);
    expect(dropped.velocity.y).toBeGreaterThan(0);
    expect(dropped.state).toBe('fall');
  });

  test('applies timed knockback without allowing held movement to cancel its impulse', () => {
    const input = new InputService(new FixedInputPort(inputSnapshot(['KeyD'])));
    const controller = new PlayerController({
      input,
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
    });

    controller.applyKnockback({ x: -360, y: -240 }, 0.1);
    const snapshot = controller.update(10, 1 / 60);

    expect(snapshot.state).toBe('hurt');
    expect(snapshot.position.x).toBe(250);
    expect(snapshot.velocity.x).toBe(-360);
    expect(snapshot.velocity.y).toBeCloseTo(-208.333_333, 5);
  });

  test('keeps aim toward the attacker after forced knockback until movement changes direction', () => {
    const port = new FixedInputPort(inputSnapshot());
    const controller = new PlayerController({
      input: new InputService(port),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions(),
    });
    controller.update(0, 0);
    controller.applyKnockback({ x: -360, y: 0 }, 0.1);
    let frame = 1;
    while (frame < 120) {
      const state = controller.update(frame * 17, 1 / 60);
      frame += 1;
      if (state.state === 'idle' && state.knockbackRemaining === 0 && state.velocity.x === 0) break;
    }
    port.snapshot = inputSnapshot(['KeyQ']);
    const cast = controller.update(frame * 17, 1 / 60);
    expect(cast.combat.lastAcceptedAction).toBe('cast');
    port.snapshot = inputSnapshot();
    const projectile = controller.update((frame + 1) * 17, 1 / 60).combat.projectiles[0];
    expect(projectile?.position.x).toBeGreaterThan(cast.position.x);
  });

  test('respawn resets feet, support, timers, knockback, and the owned state machine', () => {
    const input = new InputService(new FixedInputPort(inputSnapshot(['ArrowDown', 'Space'])));
    const controller = new PlayerController({
      input,
      position: { x: 256, y: 608 },
      surfaces: [ONE_WAY],
      zones: [],
    });
    controller.update(10, 1 / 60);
    controller.applyKnockback({ x: 300, y: -200 }, 0.2);

    controller.respawn({ x: 320, y: 480 });
    const snapshot = controller.snapshot();

    expect(snapshot).toMatchObject({
      position: { x: 320, y: 480 },
      velocity: { x: 0, y: 0 },
      state: 'idle',
      grounded: false,
      animationIntent: 'idle',
      pendingSimulationSeconds: 0,
      coyoteRemaining: 0,
      dropThroughRemaining: 0,
      knockbackRemaining: 0,
      climbEngaged: false,
      climbDetachRemaining: 0,
    });
  });

  test('respawning onto authored solid support stays grounded idle after the next fixed step', () => {
    const controller = new PlayerController({
      input: new InputService(new FixedInputPort(inputSnapshot())),
      position: { x: 256, y: 500 },
      surfaces: [GROUND],
      zones: [],
    });

    controller.respawn({ x: 320, y: 608 });
    const snapshot = controller.update(0, 1 / 60);

    expect(snapshot.position).toEqual({ x: 320, y: 608 });
    expect(snapshot.grounded).toBe(true);
    expect(snapshot.state).toBe('idle');
    expect(snapshot.animationIntent).toBe('idle');
    expect(snapshot.landingLockRemaining).toBe(0);
  });

  test('atomically rebinds supported room geometry while preserving the fixed clock and durable combat state', () => {
    const port = new FixedInputPort(inputSnapshot(['KeyQ']));
    const controller = new PlayerController({
      input: new InputService(port),
      roomId: stableId<'room'>('test-room'),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions({
        unlockedAbilityIds: [abilityId('aegis-veil')],
        selectedAbilityId: abilityId('aegis-veil'),
      }),
      vitals: {
        currentHealth: 37,
        maxHealth: 100,
        maxPoise: 40,
        armour: 3,
        resistances: {},
      },
    });
    const before = controller.update(0, 1 / 60);
    controller.requestSharedHitStop(55);
    const targetRoomId = stableId<'room'>('second-room');
    const targetGround = {
      ...GROUND,
      surfaceId: stableId<'surface'>('second-ground'),
      roomId: targetRoomId,
      bounds: { x: 1_000, y: 512, width: 800, height: 208 },
    } satisfies SurfaceDefinition;

    expect(
      controller.rebindRoom({
        roomId: targetRoomId,
        position: { x: 1_200, y: 512 },
        facing: 'left',
        surfaces: [targetGround],
        zones: [],
        movementBounds: { x: 1_000, y: 0, width: 800, height: 720 },
      }),
    ).toBe(true);

    const rebound = controller.snapshot();
    expect(rebound).toMatchObject({
      roomId: 'second-room',
      stepIndex: before.stepIndex,
      position: { x: 1_200, y: 512 },
      velocity: { x: 0, y: 0 },
      state: 'idle',
      grounded: true,
      pendingSimulationSeconds: 0,
      knockbackRemaining: 0,
      combatSimulationTimeMs: before.combatSimulationTimeMs,
      vitality: { currentHealth: 37, maxPoise: 40 },
      combat: {
        currentMana: before.combat.currentMana,
        activeAttackId: null,
        projectileCount: 0,
        hitStopRemainingMs: 0,
        statuses: [{ statusId: 'aegis-veil', expiresAtMs: 5000 }],
      },
    });
    port.snapshot = inputSnapshot();
    expect(controller.update(17, 1 / 60).stepIndex).toBe(before.stepIndex + 1);
  });

  test('leaves the controller unchanged when a room rebind target lacks supported feet geometry', () => {
    const controller = new PlayerController({
      input: new InputService(new FixedInputPort(inputSnapshot())),
      roomId: stableId<'room'>('test-room'),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
    });
    controller.update(0, 1 / 60);
    controller.requestSharedHitStop(34);
    const before = controller.snapshot();

    expect(
      controller.rebindRoom({
        roomId: stableId<'room'>('unsupported-room'),
        position: { x: 400, y: 400 },
        facing: 'left',
        surfaces: [
          {
            ...GROUND,
            surfaceId: stableId<'surface'>('unsupported-ground'),
            roomId: stableId<'room'>('unsupported-room'),
          },
        ],
        zones: [],
        movementBounds: { x: 0, y: 0, width: 1_000, height: 720 },
      }),
    ).toBe(false);
    expect(controller.snapshot()).toEqual(before);
  });

  test('preserves unprocessed frame time when bounded substeps handle a moderate drop', () => {
    const createController = () =>
      new PlayerController({
        input: new InputService(new FixedInputPort(inputSnapshot(['KeyD']))),
        position: { x: 256, y: 608 },
        surfaces: [GROUND],
        zones: [],
      });
    const droppedFrame = createController();
    const reference = createController();

    const bounded = droppedFrame.update(0, 0.25);
    const caughtUp = droppedFrame.update(1, 0);
    reference.update(0, 0.125);
    const expected = reference.update(1, 0.125);

    expect(bounded.pendingSimulationSeconds).toBeCloseTo(7 / 60);
    expect(caughtUp.position.x).toBeCloseTo(expected.position.x, 8);
    expect(caughtUp.position.y).toBe(608);
    expect(caughtUp.pendingSimulationSeconds).toBeCloseTo(0);
  });

  test('held movement cannot push feet or body beyond authored horizontal movement bounds', () => {
    const controller = new PlayerController({
      input: new InputService(new FixedInputPort(inputSnapshot(['KeyD']))),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      movementBounds: { x: 0, y: 0, width: 1_000, height: 720 },
      bodyHalfWidth: 24,
    });

    let snapshot = controller.snapshot();
    for (let frame = 0; frame < 240; frame += 1) {
      snapshot = controller.update(frame * 17, 1 / 60);
    }

    expect(snapshot.position.x).toBe(976);
    expect(snapshot.velocity.x).toBe(0);
    expect(snapshot.position.y).toBe(608);
    expect(snapshot.grounded).toBe(true);
  });

  test('preserves landing intent when a 30 Hz update has another substep after touchdown', () => {
    const controller = new PlayerController({
      input: new InputService(new FixedInputPort(inputSnapshot())),
      position: { x: 256, y: 604 },
      surfaces: [GROUND],
      zones: [],
    });
    controller.applyKnockback({ x: 0, y: 240 }, 0.01);

    const snapshot = controller.update(0, 1 / 30);

    expect(snapshot.position.y).toBe(608);
    expect(snapshot.grounded).toBe(true);
    expect(snapshot.state).toBe('land');
    expect(snapshot.animationIntent).toBe('land');
    expect(snapshot.landingLockRemaining).toBeCloseTo(1 / 30);
  });

  test('consumes light once, cannot repeat while held, and accepts one new physical press', () => {
    const port = new FixedInputPort(inputSnapshot());
    const input = new InputService(port);
    const controller = new PlayerController({
      input,
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions(),
    });
    controller.update(0, 0);
    port.snapshot = inputSnapshot(['KeyJ']);

    expect(controller.update(17, 1 / 60).combat).toMatchObject({
      actionSequence: 1,
      activeAttackId: 'mara-light-one',
      attackFrame: 0,
    });
    let snapshot = controller.snapshot();
    for (let frame = 2; frame <= 25; frame += 1) {
      snapshot = controller.update(frame * 17, 1 / 60);
    }
    expect(snapshot.combat.actionSequence).toBe(1);
    expect(snapshot.combat.activeAttackId).toBeNull();

    port.snapshot = inputSnapshot();
    controller.update(450, 1 / 60);
    port.snapshot = inputSnapshot(['KeyJ']);
    snapshot = controller.update(467, 1 / 60);
    expect(snapshot.combat.actionSequence).toBe(2);
    expect(snapshot.combat.activeAttackId).toBe('mara-light-one');
  });

  test('holds a rejected combo buffer until its authored cancel window and consumes it there', () => {
    const port = new FixedInputPort(inputSnapshot());
    const input = new InputService(port);
    const controller = new PlayerController({
      input,
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions(),
    });
    controller.update(0, 0);
    port.snapshot = inputSnapshot(['KeyJ']);
    controller.update(17, 1 / 60);
    port.snapshot = inputSnapshot();
    controller.update(34, 1 / 60);
    port.snapshot = inputSnapshot(['KeyJ']);
    expect(controller.update(51, 1 / 60).combat.actionSequence).toBe(1);

    let snapshot = controller.snapshot();
    for (let frame = 4; frame <= 8; frame += 1) {
      snapshot = controller.update(frame * 17, 1 / 60);
    }
    expect(snapshot.combat).toMatchObject({
      actionSequence: 2,
      activeAttackId: 'mara-light-two',
    });
    expect(input.consume('attack-light', 2)).toBe(false);
  });

  test('casts from save-derived mana once and advances the pooled projectile on the fixed clock', () => {
    const port = new FixedInputPort(inputSnapshot());
    const controller = new PlayerController({
      input: new InputService(port),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions({ currentMana: 19 }),
    });
    controller.update(0, 0);
    port.snapshot = inputSnapshot(['KeyQ']);
    const cast = controller.update(17, 1 / 60);

    expect(cast.combat).toMatchObject({
      currentMana: 11,
      projectileCount: 1,
      lastAcceptedAction: 'cast',
    });
    expect(controller.drainCombatEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'mana-changed', previousMana: 19, currentMana: 11 }),
      ]),
    );
  });

  test('dashes without gravity or normal control and stops at the first solid wall, not its floor', () => {
    const wall: SurfaceDefinition = Object.freeze({
      ...GROUND,
      surfaceId: stableId<'surface'>('test-wall'),
      bounds: Object.freeze({ x: 950, y: 400, width: 40, height: 220 }),
    });
    const port = new FixedInputPort(inputSnapshot());
    const controller = new PlayerController({
      input: new InputService(port),
      position: { x: 900, y: 608 },
      surfaces: [GROUND, wall],
      zones: [],
      movementBounds: { x: 0, y: 0, width: 1_000, height: 720 },
      bodyHalfWidth: 24,
      bodyHeight: 96,
      combat: combatOptions({ unlockedAbilityIds: [abilityId('wayfinder-dash')] }),
    });
    controller.update(0, 0);
    port.snapshot = inputSnapshot(['ShiftLeft', 'KeyD']);

    let snapshot = controller.snapshot();
    for (let frame = 1; frame <= 3; frame += 1) {
      snapshot = controller.update(frame * 17, 1 / 60);
    }

    expect(snapshot.position).toEqual({ x: 926, y: 608 });
    expect(snapshot.velocity).toEqual({ x: 0, y: 0 });
    expect(snapshot.grounded).toBe(true);
    expect(snapshot.state).not.toBe('hurt');
    expect(snapshot.combat.actionSequence).toBe(1);
  });

  test('travels exactly the authored 160 ms dash distance without a partial-step overshoot', () => {
    const port = new FixedInputPort(inputSnapshot());
    const controller = new PlayerController({
      input: new InputService(port),
      position: { x: 500, y: 608 },
      surfaces: [GROUND],
      zones: [],
      movementBounds: { x: 0, y: 0, width: 1_000, height: 720 },
      combat: combatOptions({ unlockedAbilityIds: [abilityId('wayfinder-dash')] }),
    });
    controller.update(0, 0);
    port.snapshot = inputSnapshot(['ShiftLeft']);

    let snapshot = controller.snapshot();
    for (let frame = 1; frame <= 12; frame += 1) {
      snapshot = controller.update(frame * 17, 1 / 60);
    }

    expect(snapshot.position.x).toBeCloseTo(615.2, 8);
    expect(snapshot.position.y).toBe(608);
    expect(snapshot.state).toBe('idle');
  });

  test('freezes fixed simulation during hit-stop without accumulating catch-up debt', () => {
    const target = {
      targetId: stableId<'combatant'>('training-root'),
      teamId: stableId<'team'>('enemy'),
      hurtboxes: [{ x: 286, y: 520, width: 20, height: 40 }],
    };
    const port = new FixedInputPort(inputSnapshot(['KeyJ']));
    const controller = new PlayerController({
      input: new InputService(port),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions({
        targets: () => [target],
        receiveImpact: () => resolvedImpact(),
      }),
    });

    const snapshot = controller.update(0, 8 / 60);

    expect(snapshot.combat.confirmedHitCount).toBe(1);
    expect(snapshot.combat.hitStopRemainingMs).toBeGreaterThan(0);
    expect(snapshot.pendingSimulationSeconds).toBeCloseTo(0);
    expect(snapshot.combat.attackFrame).toBe(5);
    expect(port.reads).toBe(1);
  });

  test('interrupts and respawns combat idempotently while retaining mana and cooldown', () => {
    const port = new FixedInputPort(inputSnapshot(['KeyQ']));
    const controller = new PlayerController({
      input: new InputService(port, { sustainedAction: 'toggle' }),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions(),
    });
    expect(controller.update(0, 1 / 60).combat.currentMana).toBe(32);
    controller.applyKnockback({ x: -100, y: -100 }, 0.05);
    expect(controller.snapshot().state).toBe('hurt');

    controller.respawn({ x: 320, y: 608 });
    expect(controller.snapshot()).toMatchObject({
      state: 'idle',
      combat: { currentMana: 32, projectileCount: 0, activeAttackId: null },
    });
    expect(controller.dispose()).toBe(true);
    expect(controller.dispose()).toBe(false);
  });

  test('rejects buffered combat while hurt or dead and respawn explicitly restores idle', () => {
    const port = new FixedInputPort(inputSnapshot());
    const controller = new PlayerController({
      input: new InputService(port),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions({
        unlockedAbilityIds: [abilityId('lumen-bolt'), abilityId('wayfinder-dash')],
      }),
    });
    controller.update(0, 0);
    controller.applyKnockback({ x: -100, y: -100 }, 0.2);
    port.snapshot = inputSnapshot(['KeyQ']);

    let snapshot = controller.update(17, 1 / 60);
    expect(snapshot.state).toBe('hurt');
    expect(snapshot.combat).toMatchObject({ actionSequence: 0, currentMana: 40 });
    controller.die();
    port.snapshot = inputSnapshot(['KeyJ']);
    snapshot = controller.update(34, 1 / 60);
    expect(snapshot.state).toBe('dead');
    expect(snapshot.combat.actionSequence).toBe(0);

    controller.respawn({ x: 256, y: 608 });
    expect(controller.snapshot().state).toBe('idle');
  });

  test('ignores knockback while dead and only explicit respawn restores owned state', () => {
    const controller = new PlayerController({
      input: new InputService(new FixedInputPort(inputSnapshot())),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions(),
    });
    controller.die();
    const dead = controller.snapshot();

    controller.applyKnockback({ x: 300, y: -200 }, 0.2);

    expect(controller.snapshot()).toEqual(dead);
    controller.respawn({ x: 320, y: 608 });
    expect(controller.snapshot()).toMatchObject({
      state: 'idle',
      position: { x: 320, y: 608 },
      velocity: { x: 0, y: 0 },
    });
  });

  test('derives an immutable dynamic hurtbox from the authored physics body only while alive', () => {
    const controller = new PlayerController({
      input: new InputService(new FixedInputPort(inputSnapshot())),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      bodyHalfWidth: 24,
      bodyHeight: 96,
      combat: combatOptions(),
    });

    const target = controller.hurtboxTarget();
    expect(target).toEqual({
      targetId: 'mara',
      teamId: 'player',
      hurtboxes: [{ x: 232, y: 512, width: 48, height: 96 }],
    });
    expect(Object.isFrozen(target)).toBe(true);
    expect(Object.isFrozen(target.hurtboxes)).toBe(true);
    expect(Object.isFrozen(target.hurtboxes[0])).toBe(true);

    controller.die();
    expect(controller.hurtboxTarget().hurtboxes).toEqual([]);
    controller.respawn({ x: 320, y: 608 });
    expect(controller.hurtboxTarget().hurtboxes).toEqual([
      { x: 296, y: 512, width: 48, height: 96 },
    ]);
    controller.dispose();
    expect(controller.hurtboxTarget().hurtboxes).toEqual([]);
  });

  test('validates authored vitals and exposes a deeply immutable vitality snapshot', () => {
    const create = (vitals: ConstructorParameters<typeof PlayerController>[0]['vitals']) =>
      new PlayerController({
        input: new InputService(new FixedInputPort(inputSnapshot())),
        position: { x: 256, y: 608 },
        surfaces: [GROUND],
        zones: [],
        combat: combatOptions(),
        vitals,
      });
    const controller = create({
      currentHealth: 80,
      maxHealth: 100,
      maxPoise: 40,
      armour: 3,
      resistances: { [damageTypeId('physical')]: 0.25 },
    });
    const vitality = controller.snapshot().vitality;

    expect(vitality).toEqual({
      currentHealth: 80,
      maxHealth: 100,
      currentPoise: 40,
      maxPoise: 40,
      armour: 3,
      resistances: { physical: 0.25 },
    });
    expect(Object.isFrozen(vitality)).toBe(true);
    expect(Object.isFrozen(vitality.resistances)).toBe(true);
    expect(() => create({ ...vitality, currentHealth: 101 })).toThrow(RangeError);
    expect(() => create({ ...vitality, resistances: { [damageTypeId('physical')]: 2 } })).toThrow(
      RangeError,
    );
  });

  test('synchronizes permanent health and mana rewards before the next checkpoint rest', () => {
    const controller = new PlayerController({
      input: new InputService(new FixedInputPort(inputSnapshot())),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions(),
    });

    expect(
      controller.synchronizeProgressionResources({
        currentHealth: 120,
        maxHealth: 120,
        currentMana: 48,
        maxMana: 48,
      }),
    ).toBe(true);
    expect(controller.snapshot()).toMatchObject({
      vitality: { currentHealth: 120, maxHealth: 120 },
      combat: { currentMana: 48 },
    });
    expect(() =>
      controller.restAtCheckpoint({ x: 320, y: 608 }, { currentHealth: 120, currentMana: 48 }),
    ).not.toThrow();
  });

  test('parries a front impact for zero mana or damage and leaves its projectile active', () => {
    const port = new FixedInputPort(inputSnapshot());
    const controller = new PlayerController({
      input: new InputService(port),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions(),
    });
    controller.update(0, 0);
    port.snapshot = inputSnapshot(['KeyL']);
    controller.update(17, 1 / 60);
    controller.drainCombatEvents();
    const occurredAtMs = controller.snapshot().combatSimulationTimeMs;

    const resolution = controller.receiveImpact(
      incomingImpact({
        occurredAtMs,
        delivery: 'projectile',
        tags: ['blockable', 'parryable', 'projectile'],
        projectile: {
          instanceId: 1,
          projectileId: stableId<'projectile'>('test-thorn'),
        },
      }),
    );

    expect(resolution).toMatchObject({
      kind: 'parried',
      manaSpent: 0,
      projectileDisposition: 'continue',
      commands: [{ kind: 'punish-attacker', statusId: 'staggered' }],
    });
    expect(controller.snapshot()).toMatchObject({
      vitality: { currentHealth: 100, currentPoise: 40 },
      combat: { currentMana: 40 },
    });
  });

  test('Echo Thorn respects an upgraded mana maximum and stops on unequip', () => {
    const port = new FixedInputPort(inputSnapshot());
    const controller = new PlayerController({
      input: new InputService(port),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions(),
    });
    controller.applyItemState({ currentHealth: 100, currentMana: 39 }, ['echo-thorn']);
    controller.synchronizeProgressionResources({
      currentHealth: 100,
      maxHealth: 100,
      currentMana: 47,
      maxMana: 48,
    });
    controller.update(0, 0);
    port.snapshot = inputSnapshot(['KeyL']);
    controller.update(17, 1 / 60);
    const impact = incomingImpact({ occurredAtMs: controller.snapshot().combatSimulationTimeMs });
    expect(controller.receiveImpact(impact).kind).toBe('parried');
    expect(controller.snapshot().combat.currentMana).toBe(48);
    controller.applyItemState({ currentHealth: 100, currentMana: 47 }, []);
    expect(controller.receiveImpact(impact).kind).toBe('parried');
    expect(controller.snapshot().combat.currentMana).toBe(47);
  });

  test('blocks from the front for exactly four mana, 0.35 health damage, and full poise damage', () => {
    const port = new FixedInputPort(inputSnapshot(['KeyL']));
    const controller = new PlayerController({
      input: new InputService(port),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions(),
    });
    for (let frame = 0; frame <= 8; frame += 1) controller.update(frame * 17, 1 / 60);
    controller.drainCombatEvents();
    const resolution = controller.receiveImpact(
      incomingImpact({ occurredAtMs: controller.snapshot().combatSimulationTimeMs }),
    );

    expect(resolution).toMatchObject({
      kind: 'resolved',
      guard: 'block',
      manaSpent: 4,
      damage: { healthDamage: 6, poiseDamage: 10 },
      remainingHealth: 94,
      remainingPoise: 30,
    });
    expect(controller.snapshot().combat.currentMana).toBe(36);
    expect(controller.drainCombatEvents().map(({ kind }) => kind)).toEqual([
      'mana-changed',
      'vitality-changed',
      'incoming-impact',
    ]);
  });

  test('consumes one Aegis barrier and projectile, then resolves the next projectile normally', () => {
    const port = new FixedInputPort(inputSnapshot(['KeyQ']));
    const controller = new PlayerController({
      input: new InputService(port),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions({
        unlockedAbilityIds: [abilityId('aegis-veil')],
        selectedAbilityId: abilityId('aegis-veil'),
      }),
    });
    controller.update(0, 1 / 60);
    port.snapshot = inputSnapshot(['KeyL']);
    for (let frame = 1; frame <= 10; frame += 1) controller.update(frame * 17, 1 / 60);
    controller.drainCombatEvents();
    const occurredAtMs = controller.snapshot().combatSimulationTimeMs;
    const projectile = (instanceId: number) =>
      incomingImpact({
        occurredAtMs,
        delivery: 'projectile',
        tags: ['blockable', 'parryable', 'projectile'],
        projectile: {
          instanceId,
          projectileId: stableId<'projectile'>('test-thorn'),
        },
      });

    expect(controller.receiveImpact(projectile(1))).toMatchObject({
      kind: 'absorbed',
      guard: 'aegis',
      manaSpent: 4,
      consumedStatusId: 'aegis-veil',
      projectileDisposition: 'consume',
    });
    expect(controller.snapshot().combat).toMatchObject({ currentMana: 24, aegisActive: false });
    expect(controller.receiveImpact(projectile(2))).toMatchObject({
      kind: 'resolved',
      guard: 'block',
      projectileDisposition: 'consume',
    });
    expect(controller.snapshot()).toMatchObject({
      vitality: { currentHealth: 94, currentPoise: 30 },
      combat: { currentMana: 20 },
    });
  });

  test('replaces consumed Aegis with one visible charge that keeps the authored expiry', () => {
    const port = new FixedInputPort(inputSnapshot(['KeyQ']));
    const controller = new PlayerController({
      input: new InputService(port),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions({
        unlockedAbilityIds: [abilityId('aegis-veil')],
        selectedAbilityId: abilityId('aegis-veil'),
      }),
    });
    controller.update(0, 1 / 60);
    port.snapshot = inputSnapshot(['KeyL']);
    for (let frame = 1; frame <= 10; frame += 1) controller.update(frame * 17, 1 / 60);
    controller.drainCombatEvents();
    const occurredAtMs = controller.snapshot().combatSimulationTimeMs;

    controller.receiveImpact(
      incomingImpact({
        occurredAtMs,
        delivery: 'projectile',
        tags: ['blockable', 'parryable', 'projectile'],
        projectile: {
          instanceId: 1,
          projectileId: stableId<'projectile'>('test-thorn'),
        },
      }),
    );

    expect(controller.snapshot().combat).toMatchObject({
      aegisActive: false,
      aegisChargeActive: true,
      statuses: [{ statusId: 'aegis-charge', expiresAtMs: 5000 }],
    });
    expect(
      controller.drainCombatEvents().filter(({ kind }) => kind === 'status-transition'),
    ).toEqual([
      {
        kind: 'status-transition',
        removedStatusId: 'aegis-veil',
        appliedStatusId: 'aegis-charge',
        expiresAtMs: 5000,
      },
    ]);

    port.snapshot = inputSnapshot();
    for (let frame = 11; frame <= 310; frame += 1) controller.update(frame * 17, 1 / 60);
    expect(controller.snapshot().combat).toMatchObject({
      aegisChargeActive: false,
      statuses: [],
    });
  });

  test('keeps a projectile active during dash invulnerability', () => {
    const controller = new PlayerController({
      input: new InputService(new FixedInputPort(inputSnapshot(['ShiftLeft']))),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions({ unlockedAbilityIds: [abilityId('wayfinder-dash')] }),
    });
    controller.update(0, 1 / 60);

    expect(
      controller.receiveImpact(
        incomingImpact({
          occurredAtMs: controller.snapshot().combatSimulationTimeMs,
          delivery: 'projectile',
          tags: ['blockable', 'parryable', 'projectile'],
          projectile: {
            instanceId: 1,
            projectileId: stableId<'projectile'>('test-thorn'),
          },
        }),
      ),
    ).toEqual({
      kind: 'ignored',
      reason: 'invulnerable',
      projectileDisposition: 'continue',
      commands: [],
    });
    expect(controller.snapshot().vitality.currentHealth).toBe(100);
  });

  test('bypasses guard from the rear or for unblockable hits and breaks insufficient-mana guard', () => {
    const createBlocking = (currentMana: number) => {
      const controller = new PlayerController({
        input: new InputService(new FixedInputPort(inputSnapshot(['KeyL']))),
        position: { x: 256, y: 608 },
        surfaces: [GROUND],
        zones: [],
        combat: combatOptions({ currentMana }),
      });
      for (let frame = 0; frame <= 8; frame += 1) controller.update(frame * 17, 1 / 60);
      controller.drainCombatEvents();
      return controller;
    };
    const rear = createBlocking(40);
    const rearResult = rear.receiveImpact(
      incomingImpact({
        occurredAtMs: rear.snapshot().combatSimulationTimeMs,
        source: {
          ownerId: stableId<'combatant'>('briar-scrapper'),
          teamId: stableId<'team'>('enemy'),
          position: { x: 200, y: 608 },
          facing: 'right',
        },
      }),
    );
    expect(rearResult).toMatchObject({
      kind: 'resolved',
      guard: 'none',
      manaSpent: 0,
      damage: { healthDamage: 17 },
    });

    const unblockable = createBlocking(40);
    expect(
      unblockable.receiveImpact(
        incomingImpact({
          occurredAtMs: unblockable.snapshot().combatSimulationTimeMs,
          tags: ['unblockable'],
        }),
      ),
    ).toMatchObject({
      kind: 'resolved',
      guard: 'none',
      manaSpent: 0,
      damage: { healthDamage: 17 },
    });

    const broken = createBlocking(3);
    const breakResult = broken.receiveImpact(
      incomingImpact({ occurredAtMs: broken.snapshot().combatSimulationTimeMs }),
    );
    expect(breakResult).toMatchObject({
      kind: 'resolved',
      guard: 'guard-break',
      manaSpent: 0,
      damage: { healthDamage: 17 },
      commands: [{ kind: 'guard-break' }],
    });
    expect(broken.snapshot().combat.currentMana).toBe(3);
  });

  test('guard-break interrupts and clears toggled block even when damage resolves to zero', () => {
    const port = new FixedInputPort(inputSnapshot());
    const input = new InputService(port, { sustainedAction: 'toggle' });
    const controller = new PlayerController({
      input,
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions({ currentMana: 3 }),
      vitals: {
        currentHealth: 40,
        maxHealth: 40,
        maxPoise: 10,
        armour: 100,
        resistances: {},
      },
    });
    controller.update(0, 0);
    port.snapshot = inputSnapshot(['KeyL']);
    controller.update(17, 1 / 60);
    port.snapshot = inputSnapshot();
    for (let frame = 2; frame <= 8; frame += 1) controller.update(frame * 17, 1 / 60);
    expect(controller.snapshot().combat.guarding).toBe(true);
    controller.drainCombatEvents();

    const resolution = controller.receiveImpact(
      incomingImpact({
        occurredAtMs: controller.snapshot().combatSimulationTimeMs,
        damage: {
          baseDamage: 20,
          damageType: damageTypeId('physical'),
          poiseDamage: 0,
          critical: { kind: 'excluded' },
        },
      }),
    );

    expect(resolution).toMatchObject({
      kind: 'resolved',
      guard: 'guard-break',
      damage: { healthDamage: 0, poiseDamage: 0 },
      commands: [{ kind: 'guard-break' }],
    });
    expect(controller.snapshot()).toMatchObject({
      state: 'hurt',
      vitality: { currentHealth: 40, currentPoise: 10 },
      combat: { guarding: false, currentMana: 3 },
    });
    expect(controller.drainCombatEvents().map(({ kind }) => kind)).toEqual(['incoming-impact']);

    for (let frame = 9; frame <= 24; frame += 1) controller.update(frame * 17, 1 / 60);
    const recovered = controller.snapshot();
    expect(['idle', 'run', 'land']).toContain(recovered.state);
    expect(recovered.combat.guarding).toBe(false);
  });

  test('routes incoming hurt through the player state machine and interrupts an active attack', () => {
    const controller = new PlayerController({
      input: new InputService(new FixedInputPort(inputSnapshot(['KeyJ']))),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions(),
    });
    controller.update(0, 1 / 60);
    expect(controller.snapshot()).toMatchObject({
      state: 'attackLight',
      combat: { activeAttackId: 'mara-light-one' },
    });

    controller.receiveImpact(
      incomingImpact({ occurredAtMs: controller.snapshot().combatSimulationTimeMs }),
    );

    expect(controller.snapshot()).toMatchObject({
      state: 'hurt',
      combat: { activeAttackId: null, guarding: false },
    });
  });

  test('resolves armour and resistance, staggers, recovers poise, dies, and restores only on respawn', () => {
    const controller = new PlayerController({
      input: new InputService(new FixedInputPort(inputSnapshot())),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions(),
      vitals: {
        currentHealth: 50,
        maxHealth: 50,
        maxPoise: 10,
        armour: 3,
        resistances: { [damageTypeId('physical')]: 0.25 },
      },
    });
    const stagger = controller.receiveImpact(incomingImpact());

    expect(stagger).toMatchObject({
      kind: 'resolved',
      damage: { healthDamage: 13, poiseDamage: 10, staggered: true },
      remainingHealth: 37,
      remainingPoise: 0,
      staggered: true,
      defeated: false,
    });
    expect(controller.snapshot()).toMatchObject({
      state: 'hurt',
      velocity: { x: -180, y: -80 },
      vitality: { currentHealth: 37, currentPoise: 0 },
      combat: { activeAttackId: null },
    });
    for (let frame = 1; frame <= 60; frame += 1) controller.update(frame * 17, 1 / 60);
    expect(controller.snapshot()).toMatchObject({
      state: 'idle',
      vitality: { currentHealth: 37, currentPoise: 10 },
    });

    controller.receiveImpact(
      incomingImpact({
        occurredAtMs: controller.snapshot().combatSimulationTimeMs,
        damage: {
          baseDamage: 100,
          damageType: damageTypeId('physical'),
          poiseDamage: 0,
          critical: { kind: 'excluded' },
        },
      }),
    );
    expect(controller.snapshot()).toMatchObject({
      state: 'dead',
      vitality: { currentHealth: 0 },
    });
    expect(controller.hurtboxTarget().hurtboxes).toEqual([]);
    expect(
      controller.receiveImpact(
        incomingImpact({ occurredAtMs: controller.snapshot().combatSimulationTimeMs }),
      ),
    ).toMatchObject({ kind: 'ignored', reason: 'dead' });

    controller.respawn({ x: 320, y: 608 });
    expect(controller.snapshot()).toMatchObject({
      state: 'idle',
      vitality: { currentHealth: 50, currentPoise: 10 },
    });
  });

  test('validates incoming fixed time and deeply freezes ordered impact events and results', () => {
    const controller = new PlayerController({
      input: new InputService(new FixedInputPort(inputSnapshot())),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions(),
    });
    expect(() => controller.receiveImpact(incomingImpact({ occurredAtMs: 1 }))).toThrow(RangeError);
    const result = controller.receiveImpact(incomingImpact());
    const events = controller.drainCombatEvents();
    const incoming = events.find(({ kind }) => kind === 'incoming-impact');

    expect(events.map(({ kind }) => kind)).toEqual(['vitality-changed', 'incoming-impact']);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.kind === 'resolved' && Object.isFrozen(result.damage)).toBe(true);
    expect(Object.isFrozen(incoming)).toBe(true);
    expect(incoming?.kind === 'incoming-impact' && Object.isFrozen(incoming.impact.source)).toBe(
      true,
    );
    expect(
      incoming?.kind === 'incoming-impact' && Object.isFrozen(incoming.resolution.commands),
    ).toBe(true);
  });

  test('constructs zero-health saves as dead and noninteractive until explicit respawn', () => {
    const controller = new PlayerController({
      input: new InputService(new FixedInputPort(inputSnapshot(['KeyJ']))),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions(),
      vitals: {
        currentHealth: 0,
        maxHealth: 100,
        maxPoise: 40,
        armour: 3,
        resistances: {},
      },
    });

    expect(controller.snapshot()).toMatchObject({
      state: 'dead',
      vitality: { currentHealth: 0 },
      combat: { actionSequence: 0, activeAttackId: null },
    });
    expect(controller.hurtboxTarget().hurtboxes).toEqual([]);
    expect(controller.update(17, 1 / 60)).toMatchObject({
      state: 'dead',
      combat: { actionSequence: 0, activeAttackId: null },
    });

    controller.respawn({ x: 320, y: 608 });
    expect(controller.snapshot()).toMatchObject({
      state: 'idle',
      vitality: { currentHealth: 100, currentPoise: 40 },
    });
    expect(controller.hurtboxTarget().hurtboxes).toHaveLength(1);
  });

  test('cycles a newly synchronized cast art from the single sampled gameplay frame', () => {
    const port = new FixedInputPort(inputSnapshot(['KeyR']));
    const controller = new PlayerController({
      input: new InputService(port),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions({
        unlockedAbilityIds: [
          abilityId('lumen-bolt'),
          abilityId('wayfinder-dash'),
          abilityId('resonant-pulse'),
        ],
      }),
    });

    expect(
      controller.synchronizeUnlockedAbilities([
        abilityId('lumen-bolt'),
        abilityId('wayfinder-dash'),
        abilityId('resonant-pulse'),
      ]),
    ).toBe(false);
    expect(controller.update(17, 1 / 60).combat.selectedAbilityId).toBe(
      abilityId('resonant-pulse'),
    );
    expect(port.reads).toBe(1);
    expect(controller.drainCombatEvents()).toContainEqual({
      kind: 'ability-selected',
      abilityId: abilityId('resonant-pulse'),
    });
  });
});

describe('live player preferences', () => {
  test.each([
    ['story', 15],
    ['standard', 20],
    ['challenging', 25],
  ] as const)('applies %s difficulty to incoming damage exactly once', (difficulty, expected) => {
    const controller = new PlayerController({
      input: new InputService(new FixedInputPort(inputSnapshot())),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      vitals: { currentHealth: 100, maxHealth: 100, maxPoise: 20, armour: 0, resistances: {} },
      combat: combatOptions(),
    });
    controller.applySettings({ ...DEFAULT_SAVE_SETTINGS, difficulty });
    const result = controller.receiveImpact(incomingImpact());
    expect(result.kind).toBe('resolved');
    if (result.kind === 'resolved') expect(result.damage.healthDamage).toBe(expected);
  });
  test('synchronizes consumable vitals without resetting combat or position', () => {
    const controller = new PlayerController({
      input: new InputService(new FixedInputPort(inputSnapshot())),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: combatOptions(),
    });
    const before = controller.snapshot();
    controller.applyItemState({ currentHealth: 90, currentMana: 20 }, []);
    expect(controller.snapshot()).toMatchObject({
      position: before.position,
      vitality: { currentHealth: 90 },
      combat: { currentMana: 20 },
    });
  });
});

test.each(['melee', 'projectile', 'radial', 'hazard'] as const)(
  'scales %s incoming damage through the same difficulty boundary',
  (delivery) => {
    const controller = new PlayerController({
      input: new InputService(new FixedInputPort(inputSnapshot())),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      vitals: { currentHealth: 100, maxHealth: 100, maxPoise: 40, armour: 0, resistances: {} },
      combat: combatOptions(),
    });
    controller.applySettings({ ...DEFAULT_SAVE_SETTINGS, difficulty: 'story' });
    const result = controller.receiveImpact(
      incomingImpact({
        delivery,
        projectile:
          delivery === 'projectile'
            ? { instanceId: 1, projectileId: stableId<'projectile'>('test-note') }
            : null,
      }),
    );
    expect(result).toMatchObject({ kind: 'resolved', damage: { healthDamage: 15 } });
  },
);

test('every damaging hit gives recovery protection and Resin Heart extends it while equipped', () => {
  const controller = new PlayerController({
    input: new InputService(new FixedInputPort(inputSnapshot())),
    position: { x: 256, y: 608 },
    surfaces: [GROUND],
    zones: [],
    vitals: { currentHealth: 100, maxHealth: 100, maxPoise: 40, armour: 0, resistances: {} },
    combat: combatOptions(),
  });
  controller.applyItemState({ currentHealth: 100, currentMana: 40 }, ['quiet-step', 'resin-heart']);
  const hit = incomingImpact({
    delivery: 'hazard',
    attackId: stableId<'attack'>('bramble-thorn-contact'),
  });
  expect(controller.receiveImpact(hit)).toMatchObject({
    kind: 'resolved',
    damage: { healthDamage: 16 },
  });
  controller.update(0, 0);
  for (let i = 1; i <= 17; i++) controller.update(i * 17, 1 / 60);
  const occurredAtMs = controller.snapshot().combatSimulationTimeMs;
  expect(controller.receiveImpact({ ...hit, occurredAtMs }).kind).toBe('ignored');
  controller.applyItemState({ currentHealth: 84, currentMana: 40 }, []);
  expect(controller.receiveImpact({ ...hit, occurredAtMs }).kind).toBe('ignored');
  for (let i = 18; i <= 58; i++) controller.update(i * 17, 1 / 60);
  const afterBaseProtection = controller.snapshot().combatSimulationTimeMs;
  expect(controller.receiveImpact({ ...hit, occurredAtMs: afterBaseProtection })).toMatchObject({
    kind: 'resolved',
    damage: { healthDamage: 20 },
  });
});
