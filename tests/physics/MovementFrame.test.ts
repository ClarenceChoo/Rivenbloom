import { describe, expect, it } from 'vitest';
import type {
  CollisionBodyDefinition,
  RectDefinition,
  SurfaceDefinition
} from '../../src/game/data/types';
import {
  createMovementState,
  type MovementInput,
  type MovementTuning
} from '../../src/game/physics/MovementModel';
import { advanceMovementFrame } from '../../src/game/physics/MovementFrame';
import { PlatformRules } from '../../src/game/physics/PlatformRules';

const tuning: MovementTuning = {
  maxRunSpeed: 240,
  groundAcceleration: 1200,
  groundBraking: 1800,
  groundFriction: 900,
  airAcceleration: 720,
  gravity: 1800,
  jumpSpeed: 600,
  jumpCutSpeed: 240,
  maxFallSpeed: 900,
  coyoteTime: 0.1,
  jumpBufferTime: 0.12,
  landingLockTime: 0.12,
  climbSpeed: 160,
  dropThroughTime: 0.18,
  dropSpeed: 60,
  knockbackLockTime: 0.16,
  fixedStep: 1 / 60,
  maxFrameTime: 0.05
};

const bounds: RectDefinition = { x: 0, y: 0, width: 400, height: 200 };
const body: CollisionBodyDefinition = {
  offset: { x: -5, y: -20 },
  size: { width: 10, height: 20 }
};
const floor: SurfaceDefinition = {
  id: 'test-floor',
  roomId: 'test-room',
  kind: 'solid',
  collision: { x: 0, y: 100, width: 400, height: 100 },
  materialId: 'stone'
};
const neutralInput: MovementInput = {
  moveX: 0,
  moveY: 0,
  jumpPressed: false,
  jumpHeld: false,
  dropPressed: false,
  respawn: false
};

describe('advanceMovementFrame', () => {
  it('preserves the hand-derived jump trajectory at 30 and 60 Hz', () => {
    const platforms = new PlatformRules([floor], bounds, body);
    const start = createMovementState({ x: 50, y: 100 }, 'right');
    const jumpInput = { ...neutralInput, jumpPressed: true, jumpHeld: true };

    const at30 = advanceMovementFrame(start, jumpInput, platforms, tuning, 1 / 30);
    const first60 = advanceMovementFrame(start, jumpInput, platforms, tuning, 1 / 60);
    const second60 = advanceMovementFrame(
      first60.state,
      { ...neutralInput, jumpHeld: true },
      platforms,
      tuning,
      1 / 60
    );

    expect(at30.state.position).toEqual({ x: 50, y: 80.5 });
    expect(at30.state.velocity).toEqual({ x: 0, y: -570 });
    expect(at30.state.machine.value).toBe('jump');
    expect(at30.events.jumped).toBe(true);
    expect(second60.state.position).toEqual({ x: 50, y: 80.5 });
    expect(second60.state.velocity).toEqual({ x: 0, y: -570 });
  });

  it('uses a buffered edge on the fresh landing contact at 30 and 60 Hz', () => {
    const platforms = new PlatformRules([floor], bounds, body);
    const falling = {
      ...createMovementState({ x: 50, y: 95 }, 'right'),
      velocity: { x: 0, y: 300 },
      machine: { value: 'fall' as const },
      grounded: false
    };
    const bufferedJump = { ...neutralInput, jumpPressed: true, jumpHeld: true };

    const at30 = advanceMovementFrame(falling, bufferedJump, platforms, tuning, 1 / 30);
    const first60 = advanceMovementFrame(falling, bufferedJump, platforms, tuning, 1 / 60);
    const second60 = advanceMovementFrame(
      first60.state,
      { ...neutralInput, jumpHeld: true },
      platforms,
      tuning,
      1 / 60
    );

    expect(at30.state.position).toEqual({ x: 50, y: 90 });
    expect(at30.state.velocity).toEqual({ x: 0, y: -600 });
    expect(at30.state.machine.value).toBe('jump');
    expect(at30.events).toMatchObject({ jumped: true, landed: true });
    expect(second60.state.position).toEqual({ x: 50, y: 90 });
    expect(second60.state.velocity).toEqual({ x: 0, y: -600 });
  });

  it('refreshes support after a ledge departure and preserves the coyote window', () => {
    const ledge = {
      ...floor,
      collision: { ...floor.collision, width: 60 }
    };
    const platforms = new PlatformRules([ledge], bounds, body);
    const running = {
      ...createMovementState({ x: 61, y: 100 }, 'right'),
      velocity: { x: 240, y: 0 },
      machine: { value: 'run' as const }
    };
    const runInput = { ...neutralInput, moveX: 1 };

    const at30 = advanceMovementFrame(running, runInput, platforms, tuning, 1 / 30);
    const first60 = advanceMovementFrame(running, runInput, platforms, tuning, 1 / 60);
    const second60 = advanceMovementFrame(first60.state, runInput, platforms, tuning, 1 / 60);
    const coyoteJump = advanceMovementFrame(
      at30.state,
      { ...neutralInput, jumpPressed: true, jumpHeld: true },
      platforms,
      tuning,
      1 / 60
    );

    expect(at30.state.position).toEqual({ x: 69, y: 100.5 });
    expect(at30.state.velocity).toEqual({ x: 240, y: 30 });
    expect(at30.state.machine.value).toBe('fall');
    expect(at30.state.coyoteRemaining).toBeCloseTo(0.1 - 1 / 60, 8);
    expect(second60.state.position).toEqual({ x: 69, y: 100.5 });
    expect(second60.state.coyoteRemaining).toBeCloseTo(0.1 - 1 / 60, 8);
    expect(coyoteJump.state.velocity.y).toBe(-600);
    expect(coyoteJump.state.machine.value).toBe('jump');
  });

  it('enters a climb zone reached during the first 30 Hz substep', () => {
    const climb: SurfaceDefinition = {
      id: 'test-climb',
      roomId: 'test-room',
      kind: 'climb',
      collision: { x: 60, y: 40, width: 20, height: 60 },
      materialId: 'root'
    };
    const platforms = new PlatformRules([climb], bounds, body);
    const falling = {
      ...createMovementState({ x: 52, y: 80 }, 'right'),
      velocity: { x: 240, y: 0 },
      machine: { value: 'fall' as const },
      grounded: false
    };
    const climbInput = { ...neutralInput, moveX: 1, moveY: -1 };

    const at30 = advanceMovementFrame(falling, climbInput, platforms, tuning, 1 / 30);
    const first60 = advanceMovementFrame(falling, climbInput, platforms, tuning, 1 / 60);
    const second60 = advanceMovementFrame(first60.state, climbInput, platforms, tuning, 1 / 60);

    expect(at30.state.position.x).toBe(60);
    expect(at30.state.position.y).toBeCloseTo(77.83333333, 8);
    expect(at30.state.velocity).toEqual({ x: 240, y: -160 });
    expect(at30.state.machine.value).toBe('climb');
    expect(second60.state.position.x).toBe(60);
    expect(second60.state.position.y).toBeCloseTo(77.83333333, 8);
    expect(second60.state.machine.value).toBe('climb');
  });

  it('consumes a knockback edge once and retains its timer at 30 and 60 Hz', () => {
    const platforms = new PlatformRules([], bounds, body);
    const falling = {
      ...createMovementState({ x: 100, y: 50 }, 'right'),
      machine: { value: 'fall' as const },
      grounded: false
    };
    const knockbackInput = {
      ...neutralInput,
      knockback: { x: -120, y: -60 }
    };

    const at30 = advanceMovementFrame(falling, knockbackInput, platforms, tuning, 1 / 30);
    const first60 = advanceMovementFrame(falling, knockbackInput, platforms, tuning, 1 / 60);
    const second60 = advanceMovementFrame(first60.state, neutralInput, platforms, tuning, 1 / 60);

    expect(at30.state.position).toEqual({ x: 96, y: 48.5 });
    expect(at30.state.velocity).toEqual({ x: -120, y: -30 });
    expect(at30.state.knockbackRemaining).toBeCloseTo(0.16 - 1 / 60, 8);
    expect(at30.state.machine.value).toBe('hurt');
    expect(second60.state.position).toEqual({ x: 96, y: 48.5 });
    expect(second60.state.knockbackRemaining).toBeCloseTo(0.16 - 1 / 60, 8);
    expect(second60.state.machine.value).toBe('hurt');
  });

  it('consumes respawn once and settles at the authored spawn at 30 and 60 Hz', () => {
    const platforms = new PlatformRules([floor], bounds, body);
    const spawned = createMovementState({ x: 50, y: 100 }, 'right');
    const displaced = {
      ...spawned,
      position: { x: 200, y: 50 },
      velocity: { x: -120, y: 300 },
      machine: { value: 'hurt' as const },
      grounded: false,
      knockbackRemaining: 0.1
    };
    const respawnInput = { ...neutralInput, respawn: true };

    const at30 = advanceMovementFrame(displaced, respawnInput, platforms, tuning, 1 / 30);
    const first60 = advanceMovementFrame(displaced, respawnInput, platforms, tuning, 1 / 60);
    const second60 = advanceMovementFrame(first60.state, neutralInput, platforms, tuning, 1 / 60);

    expect(at30.state.position).toEqual({ x: 50, y: 100 });
    expect(at30.state.velocity).toEqual({ x: 0, y: 0 });
    expect(at30.state.machine.value).toBe('idle');
    expect(at30.events.respawned).toBe(true);
    expect(second60.state.position).toEqual({ x: 50, y: 100 });
    expect(second60.state.velocity).toEqual({ x: 0, y: 0 });
    expect(second60.state.machine.value).toBe('idle');
  });

  it('keeps one-way drop-through active across a 30 Hz frame', () => {
    const oneWay = {
      ...floor,
      kind: 'one-way' as const
    };
    const platforms = new PlatformRules([oneWay], bounds, body);

    const result = advanceMovementFrame(
      createMovementState({ x: 50, y: 100 }, 'right'),
      {
        ...neutralInput,
        moveY: 1,
        jumpPressed: true,
        jumpHeld: true,
        dropPressed: true
      },
      platforms,
      tuning,
      1 / 30
    );

    expect(result.state.position).toEqual({ x: 50, y: 102.5 });
    expect(result.state.velocity).toEqual({ x: 0, y: 90 });
    expect(result.state.machine.value).toBe('fall');
    expect(result.state.dropThroughRemaining).toBeCloseTo(0.18 - 1 / 60, 8);
  });

  it('matches the hand-derived half-second run trajectory at 30 and 60 Hz', () => {
    const platforms = new PlatformRules([floor], bounds, body);
    const runInput = { ...neutralInput, moveX: 1 };
    let at60 = createMovementState({ x: 20, y: 100 }, 'right');
    let at30 = createMovementState({ x: 20, y: 100 }, 'right');

    for (let frame = 0; frame < 30; frame += 1) {
      at60 = advanceMovementFrame(at60, runInput, platforms, tuning, 1 / 60).state;
    }
    for (let frame = 0; frame < 15; frame += 1) {
      at30 = advanceMovementFrame(at30, runInput, platforms, tuning, 1 / 30).state;
    }

    expect(at60.position.x).toBeCloseTo(118, 8);
    expect(at60.velocity.x).toBe(240);
    expect(at30.position.x).toBeCloseTo(118, 8);
    expect(at30.velocity.x).toBe(240);
  });

  it('caps oversized frame gaps before taking fixed substeps', () => {
    const platforms = new PlatformRules([floor], bounds, body);

    const result = advanceMovementFrame(
      createMovementState({ x: 20, y: 100 }, 'right'),
      { ...neutralInput, moveX: 1 },
      platforms,
      tuning,
      0.2
    );

    expect(result.state.position.x).toBeCloseTo(22, 8);
    expect(result.state.velocity.x).toBeCloseTo(60, 8);
  });
});
