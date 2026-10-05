import { describe, expect, test } from 'vitest';

import {
  DEFAULT_MOVEMENT_TUNING,
  createMovementState,
  stepMovement,
} from '../../src/game/physics/MovementModel';

const NO_CONTACTS = Object.freeze({
  groundY: null,
  groundedSurface: null,
  ceilingY: null,
  climbZone: false,
  climbCenterX: null,
});

describe('stepMovement', () => {
  test('accelerates toward authored run speed instead of changing velocity instantly', () => {
    const state = createMovementState({ x: 100, y: 300 });

    const step = stepMovement(
      state,
      { moveX: 1, moveY: 0, jumpPressed: false, jumpHeld: false, dropPressed: false },
      NO_CONTACTS,
      DEFAULT_MOVEMENT_TUNING,
      1 / 60,
    );

    expect(step.state.velocity.x).toBe(30);
    expect(step.state.velocity.x).toBeLessThan(280);
  });

  test('applies ground friction when movement is released instead of coasting', () => {
    const state = {
      ...createMovementState({ x: 100, y: 300 }),
      velocity: { x: 120, y: 0 },
      grounded: true,
    };

    const step = stepMovement(
      state,
      { moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, dropPressed: false },
      { ...NO_CONTACTS, groundY: 300, groundedSurface: 'solid' },
      DEFAULT_MOVEMENT_TUNING,
      1 / 60,
    );

    expect(step.state.velocity.x).toBeCloseTo(83.333_333, 5);
  });

  test('starts a jump during coyote time after support disappears', () => {
    const leftGround = stepMovement(
      { ...createMovementState({ x: 100, y: 300 }), grounded: true },
      { moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, dropPressed: false },
      NO_CONTACTS,
      DEFAULT_MOVEMENT_TUNING,
      1 / 60,
    ).state;

    const step = stepMovement(
      leftGround,
      { moveX: 0, moveY: 0, jumpPressed: true, jumpHeld: true, dropPressed: false },
      NO_CONTACTS,
      DEFAULT_MOVEMENT_TUNING,
      1 / 60,
    );

    expect(step.jumped).toBe(true);
    expect(step.state.velocity.y).toBe(-680);
    expect(step.animationIntent).toBe('jump');
  });

  test('uses a buffered jump on the same step that a falling player reaches ground', () => {
    const state = {
      ...createMovementState({ x: 100, y: 295 }),
      velocity: { x: 0, y: 300 },
    };

    const step = stepMovement(
      state,
      { moveX: 0, moveY: 0, jumpPressed: true, jumpHeld: true, dropPressed: false },
      { ...NO_CONTACTS, groundY: 300, groundedSurface: 'solid' },
      DEFAULT_MOVEMENT_TUNING,
      1 / 60,
    );

    expect(step.jumped).toBe(true);
    expect(step.state.position.y).toBeLessThan(300);
    expect(step.state.velocity.y).toBe(-680);
  });

  test('cuts upward velocity once when jump is released for a shorter jump', () => {
    const state = {
      ...createMovementState({ x: 100, y: 250 }),
      velocity: { x: 0, y: -600 },
    };

    const cut = stepMovement(
      state,
      { moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, dropPressed: false },
      NO_CONTACTS,
      DEFAULT_MOVEMENT_TUNING,
      1 / 60,
    );
    const next = stepMovement(
      cut.state,
      { moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, dropPressed: false },
      NO_CONTACTS,
      DEFAULT_MOVEMENT_TUNING,
      1 / 60,
    );

    expect(cut.state.velocity.y).toBe(-270);
    expect(next.state.velocity.y).toBeCloseTo(-238.333_333, 5);
  });

  test('keeps jump animation intent throughout ascent instead of reporting ground locomotion', () => {
    const state = {
      ...createMovementState({ x: 100, y: 250 }),
      velocity: { x: 120, y: -400 },
      jumpCutApplied: true,
    };

    const step = stepMovement(
      state,
      { moveX: 1, moveY: 0, jumpPressed: false, jumpHeld: true, dropPressed: false },
      NO_CONTACTS,
      DEFAULT_MOVEMENT_TUNING,
      1 / 60,
    );

    expect(step.animationIntent).toBe('jump');
  });

  test('caps falling velocity so long falls do not accelerate without limit', () => {
    const state = {
      ...createMovementState({ x: 100, y: 250 }),
      velocity: { x: 0, y: 890 },
      jumpCutApplied: true,
    };

    const step = stepMovement(
      state,
      { moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, dropPressed: false },
      NO_CONTACTS,
      DEFAULT_MOVEMENT_TUNING,
      1 / 60,
    );

    expect(step.state.velocity.y).toBe(900);
  });

  test('reports landing and clamps feet to ground instead of sinking through it', () => {
    const state = {
      ...createMovementState({ x: 100, y: 298 }),
      velocity: { x: 0, y: 240 },
      jumpCutApplied: true,
    };

    const step = stepMovement(
      state,
      { moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, dropPressed: false },
      { ...NO_CONTACTS, groundY: 300, groundedSurface: 'solid' },
      DEFAULT_MOVEMENT_TUNING,
      1 / 60,
    );

    expect(step.landed).toBe(true);
    expect(step.state.position.y).toBe(300);
    expect(step.state.velocity.y).toBe(0);
    expect(step.state.landingLockRemaining).toBe(0.05);
    expect(step.animationIntent).toBe('land');
  });

  test('lands when a small upward knockback reverses before crossing the ground', () => {
    const state = {
      ...createMovementState({ x: 100, y: 608 }),
      velocity: { x: 0, y: -20 },
      knockbackRemaining: 0.2,
    };

    const step = stepMovement(
      state,
      { moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, dropPressed: false },
      { ...NO_CONTACTS, groundY: 608, groundedSurface: 'solid' },
      DEFAULT_MOVEMENT_TUNING,
      1 / 60,
    );

    expect(step.landed).toBe(true);
    expect(step.state.position.y).toBe(608);
    expect(step.state.velocity.y).toBe(0);
    expect(step.state.grounded).toBe(true);
  });

  test('moves at climb speed inside a ladder zone without applying gravity', () => {
    const state = createMovementState({ x: 100, y: 300 });

    const step = stepMovement(
      state,
      { moveX: 0, moveY: -1, jumpPressed: false, jumpHeld: false, dropPressed: false },
      { ...NO_CONTACTS, climbZone: true },
      DEFAULT_MOVEMENT_TUNING,
      1 / 60,
    );

    expect(step.state.velocity.y).toBe(-180);
    expect(step.state.position.y).toBe(297);
    expect(step.animationIntent).toBe('climb');
  });

  test('stops running momentum and aligns with a nearby ladder while holding up', () => {
    const state = {
      ...createMovementState({ x: 4660, y: 1688 }),
      velocity: { x: 280, y: 0 },
      grounded: true,
    };
    const step = stepMovement(
      state,
      { moveX: 0, moveY: -1, jumpPressed: false, jumpHeld: false, dropPressed: false },
      { ...NO_CONTACTS, climbZone: true, climbCenterX: 4576 },
      DEFAULT_MOVEMENT_TUNING,
      1 / 60,
    );
    expect(step.state.velocity.x).toBeLessThan(0);
    expect(step.state.position.x).toBeLessThan(4660);
    expect(step.state.climbEngaged).toBe(true);
  });

  test('continues falling through an overlapping climb zone until vertical intent engages it', () => {
    const state = {
      ...createMovementState({ x: 100, y: 300 }),
      velocity: { x: 0, y: 200 },
      jumpCutApplied: true,
    };

    const step = stepMovement(
      state,
      { moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, dropPressed: false },
      { ...NO_CONTACTS, climbZone: true },
      DEFAULT_MOVEMENT_TUNING,
      1 / 60,
    );

    expect(step.state.velocity.y).toBeCloseTo(231.666_667, 5);
    expect(step.animationIntent).toBe('fall');
  });

  test('jumping from an engaged ladder detaches long enough to preserve the jump arc', () => {
    const engaged = stepMovement(
      createMovementState({ x: 100, y: 300 }),
      { moveX: 0, moveY: -1, jumpPressed: false, jumpHeld: false, dropPressed: false },
      { ...NO_CONTACTS, climbZone: true },
      DEFAULT_MOVEMENT_TUNING,
      1 / 60,
    );
    expect(engaged.state.climbEngaged).toBe(true);

    const detached = stepMovement(
      engaged.state,
      { moveX: 0, moveY: -1, jumpPressed: true, jumpHeld: true, dropPressed: false },
      { ...NO_CONTACTS, climbZone: true },
      DEFAULT_MOVEMENT_TUNING,
      1 / 60,
    );
    const next = stepMovement(
      detached.state,
      { moveX: 0, moveY: -1, jumpPressed: false, jumpHeld: true, dropPressed: false },
      { ...NO_CONTACTS, climbZone: true },
      DEFAULT_MOVEMENT_TUNING,
      1 / 60,
    );

    expect(detached.jumped).toBe(true);
    expect(detached.state.velocity.y).toBe(-680);
    expect(detached.state.climbEngaged).toBe(false);
    expect(detached.state.climbDetachRemaining).toBeCloseTo(0.12);
    expect(next.state.velocity.y).toBeCloseTo(-648.333_333, 5);
    expect(next.state.climbEngaged).toBe(false);
    expect(next.animationIntent).toBe('jump');
  });

  test('arms drop-through only while supported by a one-way platform', () => {
    const state = {
      ...createMovementState({ x: 100, y: 300 }),
      grounded: true,
    };

    const dropped = stepMovement(
      state,
      { moveX: 0, moveY: 1, jumpPressed: false, jumpHeld: false, dropPressed: true },
      { ...NO_CONTACTS, groundY: 300, groundedSurface: 'one-way' },
      DEFAULT_MOVEMENT_TUNING,
      1 / 60,
    );
    const solid = stepMovement(
      state,
      { moveX: 0, moveY: 1, jumpPressed: false, jumpHeld: false, dropPressed: true },
      { ...NO_CONTACTS, groundY: 300, groundedSurface: 'solid' },
      DEFAULT_MOVEMENT_TUNING,
      1 / 60,
    );

    expect(dropped.state.grounded).toBe(false);
    expect(dropped.state.dropThroughRemaining).toBeCloseTo(0.18);
    expect(dropped.state.position.y).toBeGreaterThan(300);
    expect(solid.state.grounded).toBe(true);
    expect(solid.state.dropThroughRemaining).toBe(0);
  });
});
