import { describe, expect, it } from 'vitest';

import { InputService } from '../../src/game/input/InputService';
import type {
  GamepadDeviceSnapshot,
  InputDevicePort,
  InputDeviceSnapshot,
  KeyboardDeviceSnapshot,
} from '../../src/game/input/InputService';

class FakeInputDevicePort implements InputDevicePort {
  public reads = 0;
  public clears = 0;
  public snapshot: InputDeviceSnapshot = snapshot();

  public read(): InputDeviceSnapshot {
    this.reads += 1;
    return this.snapshot;
  }

  public clearTransient(): void {
    this.clears += 1;
    this.snapshot = {
      ...this.snapshot,
      keyboard: { ...this.snapshot.keyboard, pressed: [], released: [] },
    };
  }
}

function gamepad(input: Partial<GamepadDeviceSnapshot> = {}): GamepadDeviceSnapshot {
  return {
    id: 'pad-1',
    connected: true,
    buttons: [],
    axes: [],
    activityAtMs: null,
    ...input,
  };
}

function snapshot(
  keyboard: Partial<KeyboardDeviceSnapshot> = {},
  gamepad: InputDeviceSnapshot['gamepad'] = null,
  focused = true,
): InputDeviceSnapshot {
  return {
    focused,
    keyboard: {
      heldCodes: [],
      pressed: [],
      released: [],
      activityAtMs: null,
      ...keyboard,
    },
    gamepad,
  };
}

describe('InputService keyboard sampling and buffers', () => {
  it('aggregates aliases, ignores repeat presses, and releases only after the last alias', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port);
    input.sample(0);

    port.snapshot = snapshot({
      heldCodes: ['KeyA'],
      pressed: [{ code: 'KeyA', atMs: 10 }],
      activityAtMs: 10,
    });
    expect(input.sample(10).actions['move-left']).toMatchObject({
      value: 1,
      held: true,
      pressed: true,
      released: false,
    });

    port.snapshot = snapshot({
      heldCodes: ['KeyA', 'ArrowLeft'],
      pressed: [
        { code: 'KeyA', atMs: 15 },
        { code: 'ArrowLeft', atMs: 20 },
      ],
      activityAtMs: 20,
    });
    expect(input.sample(20).actions['move-left']).toMatchObject({ held: true, pressed: false });

    port.snapshot = snapshot({
      heldCodes: ['ArrowLeft'],
      released: [{ code: 'KeyA', atMs: 30 }],
      activityAtMs: 30,
    });
    expect(input.sample(30).actions['move-left']).toMatchObject({
      held: true,
      released: false,
    });

    port.snapshot = snapshot({
      released: [{ code: 'ArrowLeft', atMs: 40 }],
      activityAtMs: 40,
    });
    expect(input.sample(40).actions['move-left']).toMatchObject({
      value: 0,
      held: false,
      released: true,
    });
  });

  it('preserves a quick tap between samples and keeps its buffer through exactly 120 ms', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port);
    input.sample(0);
    port.snapshot = snapshot({
      pressed: [{ code: 'Space', atMs: 10 }],
      released: [{ code: 'Space', atMs: 15 }],
      activityAtMs: 15,
    });

    const tap = input.sample(20).actions.jump;

    expect(tap).toMatchObject({ held: false, pressed: true, released: true });
    expect(tap.bufferedPressId).toBe(1);
    port.snapshot = snapshot();
    expect(input.sample(130).actions.jump.bufferedPressId).toBe(1);
    expect(input.sample(131).actions.jump.bufferedPressId).toBeNull();
    expect(input.consume('jump', 1)).toBe(false);
  });

  it('replaces an unconsumed buffer with a later physical press', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port);
    input.sample(0);
    port.snapshot = snapshot({
      heldCodes: ['KeyJ'],
      pressed: [{ code: 'KeyJ', atMs: 10 }],
      activityAtMs: 10,
    });
    expect(input.sample(10).actions['attack-light'].bufferedPressId).toBe(1);
    port.snapshot = snapshot({
      released: [{ code: 'KeyJ', atMs: 20 }],
      activityAtMs: 20,
    });
    input.sample(20);
    port.snapshot = snapshot({
      heldCodes: ['KeyJ'],
      pressed: [{ code: 'KeyJ', atMs: 30 }],
      activityAtMs: 30,
    });

    expect(input.sample(30).actions['attack-light'].bufferedPressId).toBe(2);
    expect(input.consume('attack-light', 1)).toBe(false);
    expect(input.consume('attack-light', 2)).toBe(true);
  });

  it('caches equal-time samples, rejects invalid or backward time, and deep-freezes frames', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port);
    const first = input.sample(5);
    port.snapshot = snapshot({ heldCodes: ['Space'] });
    const cached = input.sample(5);

    expect(cached).toBe(first);
    expect(port.reads).toBe(1);
    expect(() => input.sample(4)).toThrow(RangeError);
    expect(() => new InputService(port).sample(-1)).toThrow(RangeError);
    expect(() => new InputService(port).sample(Number.NaN)).toThrow(RangeError);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.actions)).toBe(true);
    expect(Object.isFrozen(first.actions.jump)).toBe(true);
    expect(Object.isFrozen(first.move)).toBe(true);
    expect(Object.isFrozen(first.navigation)).toBe(true);
  });
});

describe('InputService gamepad normalization and device activity', () => {
  it('applies the exact axis deadzone/rescale, sign, clamping, and non-finite normalization', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port);
    port.snapshot = snapshot({}, gamepad({ axes: [0.2, 0] }));
    expect(input.sample(0).actions['move-right'].value).toBe(0);
    port.snapshot = snapshot({}, gamepad({ axes: [0.6, 0] }));
    expect(input.sample(10).actions['move-right'].value).toBeCloseTo(0.5);
    port.snapshot = snapshot({}, gamepad({ axes: [-1, 0] }));
    const negative = input.sample(20);
    expect(negative.actions['move-left'].value).toBe(1);
    expect(negative.actions['move-right'].value).toBe(0);
    port.snapshot = snapshot({}, gamepad({ axes: [Number.NaN, Number.POSITIVE_INFINITY] }));
    const nonFinite = input.sample(30);
    expect(nonFinite.actions['move-right'].value).toBe(0);
    expect(nonFinite.actions['move-down'].value).toBe(0);
  });

  it('uses button hysteresis and supports D-pad buttons', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port);
    const buttons = (value: number) => {
      const values = Array.from({ length: 15 }, () => 0);
      values[14] = value;
      return values;
    };
    port.snapshot = snapshot({}, gamepad({ buttons: buttons(0.54) }));
    expect(input.sample(0).actions['move-left']).toMatchObject({ value: 0.54, held: false });
    port.snapshot = snapshot({}, gamepad({ buttons: buttons(0.55) }));
    expect(input.sample(10).actions['move-left']).toMatchObject({ held: true, pressed: true });
    port.snapshot = snapshot({}, gamepad({ buttons: buttons(0.5) }));
    expect(input.sample(20).actions['move-left']).toMatchObject({ held: true, released: false });
    port.snapshot = snapshot({}, gamepad({ buttons: buttons(0.45) }));
    expect(input.sample(30).actions['move-left']).toMatchObject({ held: false, released: true });
    port.snapshot = snapshot({}, gamepad({ buttons: buttons(Number.NaN) }));
    expect(input.sample(40).actions['move-left'].value).toBe(0);
  });

  it('resolves opposites by recency and restores the older held direction', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port);
    port.snapshot = snapshot({
      heldCodes: ['KeyA'],
      pressed: [{ code: 'KeyA', atMs: 10 }],
      activityAtMs: 10,
    });
    expect(input.sample(10).move.x).toBe(-1);
    const buttons = Array.from({ length: 16 }, () => 0);
    buttons[15] = 1;
    port.snapshot = snapshot({ heldCodes: ['KeyA'] }, gamepad({ buttons }));
    const newerRight = input.sample(20);
    expect(newerRight.move.x).toBe(1);
    expect(newerRight.navigation.x).toBe(1);
    port.snapshot = snapshot({ heldCodes: ['KeyA'] }, gamepad());
    const restoredLeft = input.sample(30);
    expect(restoredLeft.move.x).toBe(-1);
    expect(restoredLeft.navigation.x).toBe(-1);
  });

  it('restores opposition recency from an older keyboard alias when the newer alias releases', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port);
    port.snapshot = snapshot({
      heldCodes: ['KeyA'],
      pressed: [{ code: 'KeyA', atMs: 10 }],
      activityAtMs: 10,
    });
    expect(input.sample(10).move.x).toBe(-1);
    port.snapshot = snapshot({
      heldCodes: ['KeyA', 'KeyD'],
      pressed: [{ code: 'KeyD', atMs: 20 }],
      activityAtMs: 20,
    });
    expect(input.sample(20).move.x).toBe(1);
    port.snapshot = snapshot({
      heldCodes: ['ArrowLeft', 'KeyA', 'KeyD'],
      pressed: [{ code: 'ArrowLeft', atMs: 30 }],
      activityAtMs: 30,
    });
    expect(input.sample(30).move.x).toBe(-1);
    port.snapshot = snapshot({
      heldCodes: ['KeyA', 'KeyD'],
      released: [{ code: 'ArrowLeft', atMs: 40 }],
      activityAtMs: 40,
    });

    expect(input.sample(40).move.x).toBe(1);
  });

  it('restores opposition recency across keyboard and gamepad aliases', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port);
    port.snapshot = snapshot({
      heldCodes: ['KeyA'],
      pressed: [{ code: 'KeyA', atMs: 10 }],
      activityAtMs: 10,
    });
    input.sample(10);
    port.snapshot = snapshot({
      heldCodes: ['KeyA', 'KeyD'],
      pressed: [{ code: 'KeyD', atMs: 20 }],
      activityAtMs: 20,
    });
    expect(input.sample(20).move.x).toBe(1);
    const dpadLeft = Array.from({ length: 15 }, () => 0);
    dpadLeft[14] = 1;
    port.snapshot = snapshot(
      { heldCodes: ['KeyA', 'KeyD'] },
      gamepad({ buttons: dpadLeft, activityAtMs: 30 }),
    );
    expect(input.sample(30).move.x).toBe(-1);
    port.snapshot = snapshot({ heldCodes: ['KeyA', 'KeyD'] }, gamepad());

    expect(input.sample(40).move.x).toBe(1);
  });

  it('restores older opposition when a newer gamepad alias reaches the release threshold', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port);
    port.snapshot = snapshot({
      heldCodes: ['KeyA'],
      pressed: [{ code: 'KeyA', atMs: 10 }],
      activityAtMs: 10,
    });
    input.sample(10);
    port.snapshot = snapshot({
      heldCodes: ['KeyA', 'KeyD'],
      pressed: [{ code: 'KeyD', atMs: 20 }],
      activityAtMs: 20,
    });
    expect(input.sample(20).move.x).toBe(1);
    const dpadLeft = Array.from({ length: 15 }, () => 0);
    dpadLeft[14] = 1;
    port.snapshot = snapshot(
      { heldCodes: ['KeyA', 'KeyD'] },
      gamepad({ buttons: dpadLeft, activityAtMs: 30 }),
    );
    expect(input.sample(30).move.x).toBe(-1);
    dpadLeft[14] = 0.45;
    port.snapshot = snapshot(
      { heldCodes: ['KeyA', 'KeyD'] },
      gamepad({ buttons: dpadLeft, activityAtMs: 40 }),
    );
    const releasedAtBoundary = input.sample(40);
    expect(releasedAtBoundary.move.x).toBe(1);
    expect(releasedAtBoundary).toMatchObject({
      activeDevice: 'gamepad',
      deviceChangedAtMs: 30,
    });
    dpadLeft[14] = 0.44;
    port.snapshot = snapshot({ heldCodes: ['KeyA', 'KeyD'] }, gamepad({ buttons: dpadLeft }));

    expect(input.sample(50).move.x).toBe(1);
  });

  it('uses an axis deadzone crossing as direction activation before the held threshold', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port);
    port.snapshot = snapshot({
      heldCodes: ['KeyA'],
      pressed: [{ code: 'KeyA', atMs: 10 }],
      activityAtMs: 10,
    });
    input.sample(10);
    port.snapshot = snapshot({ heldCodes: ['KeyA'] }, gamepad({ axes: [0.3, 0] }));

    expect(input.sample(20).move.x).toBeCloseTo(0.125);
  });

  it('makes exact opposition activation ties neutral', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port);
    const buttons = Array.from({ length: 16 }, () => 0);
    buttons[15] = 1;
    port.snapshot = snapshot(
      {
        heldCodes: ['KeyA'],
        pressed: [{ code: 'KeyA', atMs: 10 }],
        activityAtMs: 10,
      },
      gamepad({ buttons, activityAtMs: 10 }),
    );

    const tied = input.sample(10);

    expect(tied.actions['move-left'].held).toBe(true);
    expect(tied.actions['move-right'].held).toBe(true);
    expect(tied.move.x).toBe(0);
    expect(tied.navigation.x).toBe(0);
  });

  it('switches active device only on meaningful edges or deadzone crossings', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port);
    port.snapshot = snapshot({
      heldCodes: ['KeyJ'],
      pressed: [{ code: 'KeyJ', atMs: 10 }],
      activityAtMs: 10,
    });
    expect(input.sample(10)).toMatchObject({ activeDevice: 'keyboard', deviceChangedAtMs: 10 });
    port.snapshot = snapshot({ heldCodes: ['KeyJ'] }, gamepad({ axes: [0.1, 0] }));
    expect(input.sample(20)).toMatchObject({ activeDevice: 'keyboard', deviceChangedAtMs: 10 });
    port.snapshot = snapshot({ heldCodes: ['KeyJ'] }, gamepad({ axes: [0.21, 0] }));
    expect(input.sample(30)).toMatchObject({ activeDevice: 'gamepad', deviceChangedAtMs: 30 });
    port.snapshot = snapshot({ heldCodes: ['KeyJ'] }, gamepad({ axes: [0.22, 0] }));
    expect(input.sample(40)).toMatchObject({ activeDevice: 'gamepad', deviceChangedAtMs: 30 });
    port.snapshot = snapshot(
      { released: [{ code: 'KeyJ', atMs: 50 }], activityAtMs: 50 },
      gamepad({ axes: [0.22, 0] }),
    );
    expect(input.sample(50)).toMatchObject({ activeDevice: 'keyboard', deviceChangedAtMs: 50 });
  });

  it('treats null and disconnected gamepads as neutral', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port);
    expect(input.sample(0).actions.jump.held).toBe(false);
    port.snapshot = snapshot({}, gamepad({ connected: false, buttons: [1], axes: [1, 1] }));
    const disconnected = input.sample(10);
    expect(disconnected.actions.jump.held).toBe(false);
    expect(disconnected.move).toEqual({ x: 0, y: 0 });
  });
});

describe('InputService sustained actions and transient clearing', () => {
  it('keeps hold mode physical and makes cast an instantaneous press', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port, { sustainedAction: 'hold' });
    input.sample(0);
    port.snapshot = snapshot({
      heldCodes: ['KeyL', 'KeyQ'],
      pressed: [
        { code: 'KeyL', atMs: 10 },
        { code: 'KeyQ', atMs: 10 },
      ],
      activityAtMs: 10,
    });
    const pressed = input.sample(10);
    expect(pressed.actions.block).toMatchObject({ held: true, pressed: true });
    expect(pressed.actions.cast).toMatchObject({ value: 1, held: false, pressed: true });
    port.snapshot = snapshot({ heldCodes: ['KeyL', 'KeyQ'] });
    const continued = input.sample(20);
    expect(continued.actions.block).toMatchObject({ held: true, pressed: false });
    expect(continued.actions.cast).toMatchObject({ value: 0, held: false, pressed: false });
  });

  it('toggles block and heavy on physical presses while physical releases do nothing', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port, { sustainedAction: 'toggle' });
    input.sample(0);
    port.snapshot = snapshot({
      heldCodes: ['KeyL', 'KeyK'],
      pressed: [
        { code: 'KeyL', atMs: 10 },
        { code: 'KeyK', atMs: 10 },
      ],
      activityAtMs: 10,
    });
    const firstPress = input.sample(10);
    expect(firstPress.actions.block).toMatchObject({ held: true, pressed: true, released: false });
    expect(firstPress.actions['attack-heavy']).toMatchObject({ held: true, pressed: true });
    port.snapshot = snapshot({
      released: [
        { code: 'KeyL', atMs: 20 },
        { code: 'KeyK', atMs: 20 },
      ],
      activityAtMs: 20,
    });
    const physicalRelease = input.sample(20);
    expect(physicalRelease.actions.block).toMatchObject({
      held: true,
      pressed: false,
      released: false,
    });
    port.snapshot = snapshot({
      heldCodes: ['KeyL', 'KeyK'],
      pressed: [
        { code: 'KeyL', atMs: 30 },
        { code: 'KeyK', atMs: 30 },
      ],
      activityAtMs: 30,
    });
    const secondPress = input.sample(30);
    expect(secondPress.actions.block).toMatchObject({
      held: false,
      pressed: false,
      released: true,
    });
    expect(secondPress.actions['attack-heavy']).toMatchObject({
      held: false,
      pressed: false,
      released: true,
    });
  });

  it('clears one latch independently and clears all latches on mode changes', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port, { sustainedAction: 'toggle' });
    input.sample(0);
    port.snapshot = snapshot({
      heldCodes: ['KeyL', 'KeyK'],
      pressed: [
        { code: 'KeyL', atMs: 10 },
        { code: 'KeyK', atMs: 10 },
      ],
      activityAtMs: 10,
    });
    input.sample(10);

    input.clearLatch('block');
    port.snapshot = snapshot({ heldCodes: ['KeyL', 'KeyK'] });
    const oneCleared = input.sample(20);
    expect(oneCleared.actions.block.held).toBe(false);
    expect(oneCleared.actions['attack-heavy'].held).toBe(true);
    input.setSustainedActionMode('hold');
    port.snapshot = snapshot();
    const modeChanged = input.sample(30);
    expect(modeChanged.actions.block.held).toBe(false);
    expect(modeChanged.actions['attack-heavy'].held).toBe(false);
  });

  it('clears without synthetic releases and suppresses held controls until neutral after focus loss', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port, { sustainedAction: 'toggle' });
    input.sample(0);
    port.snapshot = snapshot({
      heldCodes: ['KeyL'],
      pressed: [{ code: 'KeyL', atMs: 10 }],
      activityAtMs: 10,
    });
    expect(input.sample(10).actions.block.held).toBe(true);
    const activeBeforeBlur = input.sample(10).activeDevice;

    port.snapshot = snapshot({ heldCodes: ['KeyL'] }, null, false);
    const blurred = input.sample(20);
    expect(blurred.actions.block).toMatchObject({ held: false, pressed: false, released: false });
    expect(blurred.activeDevice).toBe(activeBeforeBlur);
    port.snapshot = snapshot({ heldCodes: ['KeyL'] });
    expect(input.sample(30).actions.block.held).toBe(false);
    port.snapshot = snapshot();
    expect(input.sample(40).actions.block.held).toBe(false);
    port.snapshot = snapshot({
      heldCodes: ['KeyL'],
      pressed: [{ code: 'KeyL', atMs: 50 }],
      activityAtMs: 50,
    });
    expect(input.sample(50).actions.block).toMatchObject({ held: true, pressed: true });
  });

  it('replaces the equal-time cache with a neutral frame when transients clear without repolling', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port);
    port.snapshot = snapshot({
      heldCodes: ['Space'],
      pressed: [{ code: 'Space', atMs: 10 }],
      activityAtMs: 10,
    });
    const active = input.sample(10);
    expect(active.actions.jump.held).toBe(true);

    input.clearTransient();
    const cleared = input.sample(10);

    expect(cleared).not.toBe(active);
    expect(cleared.actions.jump).toEqual({
      value: 0,
      held: false,
      pressed: false,
      released: false,
      bufferedPressId: null,
    });
    expect(port.reads).toBe(1);
    expect(port.clears).toBe(1);
  });

  it('updates an equal-time cached toggle action when its latch clears without repolling', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port, { sustainedAction: 'toggle' });
    port.snapshot = snapshot({
      heldCodes: ['KeyL'],
      pressed: [{ code: 'KeyL', atMs: 10 }],
      activityAtMs: 10,
    });
    const latched = input.sample(10);
    expect(latched.actions.block.held).toBe(true);

    input.clearLatch('block');
    const cleared = input.sample(10);

    expect(cleared).not.toBe(latched);
    expect(cleared.actions.block).toEqual({
      value: 0,
      held: false,
      pressed: false,
      released: false,
      bufferedPressId: null,
    });
    expect(port.reads).toBe(1);
  });

  it('clears an active toggle latch on an equal-time mode change without repolling', () => {
    const port = new FakeInputDevicePort();
    const input = new InputService(port, { sustainedAction: 'toggle' });
    port.snapshot = snapshot({
      heldCodes: ['KeyK'],
      pressed: [{ code: 'KeyK', atMs: 10 }],
      activityAtMs: 10,
    });
    input.sample(10);
    port.snapshot = snapshot({
      released: [{ code: 'KeyK', atMs: 20 }],
      activityAtMs: 20,
    });
    const latched = input.sample(20);
    expect(latched.actions['attack-heavy'].held).toBe(true);

    input.setSustainedActionMode('hold');
    const changed = input.sample(20);

    expect(changed).not.toBe(latched);
    expect(changed.actions['attack-heavy']).toMatchObject({
      value: 0,
      held: false,
      pressed: false,
      released: false,
    });
    expect(port.reads).toBe(2);
  });
});
