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

  it('clears held and buffered intents when the browser loses focus', () => {
    const target = new EventTarget();
    const input = new InputService({ target, gamepads: () => [] });
    target.dispatchEvent(keyEvent('keydown', 'Space'));
    input.sample(100);

    target.dispatchEvent(new Event('blur'));

    expect(input.sample(101)).toMatchObject({ held: { jump: false }, buffered: [] });
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
