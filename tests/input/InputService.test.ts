import { describe, expect, it } from 'vitest';
import { GameEvents } from '../../src/game/core/GameEvents';
import { InputService } from '../../src/game/input/InputService';

const keyEvent = (type: 'keydown' | 'keyup', code: string): Event => {
  const event = new Event(type);
  Object.defineProperty(event, 'code', { value: code });
  return event;
};

describe('InputService', () => {
  it('samples keyboard aliases as semantic movement intents', () => {
    const target = new EventTarget();
    const input = new InputService({ target, gamepads: () => [] });

    target.dispatchEvent(keyEvent('keydown', 'ArrowLeft'));

    expect(input.sample(100)).toMatchObject({
      movement: { x: -1, y: 0 },
      held: { 'move-left': true },
      pressed: ['move-left'],
      device: 'keyboard'
    });
  });

  it('preserves a quick semantic key tap that begins and ends between samples', () => {
    const target = new EventTarget();
    const input = new InputService({ target, gamepads: () => [] });

    target.dispatchEvent(keyEvent('keydown', 'ArrowDown'));
    target.dispatchEvent(keyEvent('keyup', 'ArrowDown'));

    expect(input.sample(100)).toMatchObject({
      held: { 'move-down': false },
      pressed: ['move-down'],
      device: 'keyboard'
    });
    expect(input.sample(101).pressed).toEqual([]);
  });

  it('uses gamepad axes only once they clear the semantic deadzone', () => {
    const pad = { axes: [-0.24, 0], buttons: [] };
    const input = new InputService({ gamepads: () => [pad] });

    expect(input.sample(100).held['move-left']).toBe(false);
    pad.axes[0] = -0.25;

    expect(input.sample(101)).toMatchObject({
      movement: { x: -1, y: 0 },
      held: { 'move-left': true },
      device: 'gamepad'
    });
  });

  it('keeps a pressed action available for the configured input buffer window', () => {
    const target = new EventTarget();
    const input = new InputService({ target, gamepads: () => [] });
    target.dispatchEvent(keyEvent('keydown', 'Space'));
    input.sample(100);
    target.dispatchEvent(keyEvent('keyup', 'Space'));

    expect(input.sample(220).buffered).toContain('jump');
    expect(input.sample(221).buffered).not.toContain('jump');
  });

  it('rejects a rebind that would steal another action and accepts a free binding', () => {
    const target = new EventTarget();
    const input = new InputService({ target, gamepads: () => [] });

    expect(input.rebind('attack-light', { kind: 'keyboard', code: 'KeyC' })).toEqual({
      kind: 'conflict',
      action: 'attack-heavy'
    });
    expect(input.rebind('attack-light', { kind: 'keyboard', code: 'KeyZ' })).toEqual({
      kind: 'rebound',
      action: 'attack-light'
    });

    target.dispatchEvent(keyEvent('keydown', 'KeyZ'));
    expect(input.sample(300).held['attack-light']).toBe(true);
  });

  it('keeps the other device binding active when an action is remapped', () => {
    const target = new EventTarget();
    const buttons = Array.from({ length: 9 }, () => ({ pressed: false, value: 0 }));
    const input = new InputService({
      target,
      gamepads: () => [{ axes: [], buttons }]
    });

    expect(input.rebind('attack-light', { kind: 'keyboard', code: 'KeyZ' })).toMatchObject({
      kind: 'rebound'
    });
    buttons[2] = { pressed: true, value: 1 };
    expect(input.sample(400).held['attack-light']).toBe(true);
    const restored = new InputService({
      gamepads: () => [{ axes: [], buttons }],
      serializedBindings: input.serializeBindings()
    });
    expect(restored.sample(400).held['attack-light']).toBe(true);
    buttons[2] = { pressed: false, value: 0 };

    expect(input.rebind('attack-light', { kind: 'gamepad-button', button: 8 })).toMatchObject({
      kind: 'rebound'
    });
    target.dispatchEvent(keyEvent('keydown', 'KeyZ'));
    expect(input.sample(401).held['attack-light']).toBe(true);
  });

  it('requires a neutral gamepad sample after focus loss before accepting input again', () => {
    const target = new EventTarget();
    const buttons = [{ pressed: true, value: 1 }];
    const input = new InputService({
      target,
      gamepads: () => [{ axes: [], buttons }]
    });
    target.dispatchEvent(keyEvent('keydown', 'Space'));
    input.sample(100);

    target.dispatchEvent(new Event('blur'));

    expect(input.sample(101)).toMatchObject({ held: { jump: false }, buffered: [] });
    buttons[0] = { pressed: false, value: 0 };
    input.sample(102);
    buttons[0] = { pressed: true, value: 1 };
    expect(input.sample(103).held.jump).toBe(true);
  });

  it('turns block into a toggle only when hold-to-toggle is enabled', () => {
    const target = new EventTarget();
    const input = new InputService({
      target,
      gamepads: () => [],
      settings: { holdToToggle: true }
    });
    target.dispatchEvent(keyEvent('keydown', 'KeyF'));
    expect(input.sample(100).held.block).toBe(true);
    target.dispatchEvent(keyEvent('keyup', 'KeyF'));
    expect(input.sample(101).held.block).toBe(true);
    target.dispatchEvent(keyEvent('keydown', 'KeyF'));
    expect(input.sample(102).held.block).toBe(false);
  });

  it('degrades haptic feedback safely when the active gamepad has no actuator', async () => {
    const input = new InputService({ gamepads: () => [{ axes: [], buttons: [] }] });

    await expect(input.pulseHaptics(30, 0.7)).resolves.toBe(false);
  });

  it('notifies consumers about a successful semantic rebinding', () => {
    const events = new GameEvents();
    let changed: { readonly actionId: string; readonly binding: string } | undefined;
    events.subscribe('input:binding-changed', (event) => {
      changed = event;
    });
    const input = new InputService({ events, gamepads: () => [] });

    input.rebind('attack-light', { kind: 'keyboard', code: 'KeyZ' });

    expect(changed).toEqual({ actionId: 'attack-light', binding: 'keyboard:KeyZ' });
  });
});
