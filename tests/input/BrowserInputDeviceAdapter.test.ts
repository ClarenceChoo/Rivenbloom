import { describe, expect, it } from 'vitest';

import { BrowserInputDeviceAdapter } from '../../src/game/input/BrowserInputDeviceAdapter';

class FakeBrowserWindow extends EventTarget {}

class FakeBrowserDocument extends EventTarget {
  public visibilityState: DocumentVisibilityState = 'visible';
  public focused = true;

  public hasFocus(): boolean {
    return this.focused;
  }
}

function keyboardEvent(type: 'keydown' | 'keyup', code: string, repeat = false): Event {
  return Object.assign(new Event(type), { code, repeat });
}

function browserGamepad(
  id: string,
  mapping: GamepadMappingType,
  buttonValues: readonly number[],
  axes: readonly number[],
): Gamepad {
  return {
    id,
    connected: true,
    mapping,
    index: 0,
    timestamp: 0,
    buttons: buttonValues.map((value) => ({
      value,
      pressed: value >= 0.55,
      touched: value > 0,
    })),
    axes,
    vibrationActuator: {
      playEffect: async () => 'complete',
      reset: async () => 'complete',
    },
  };
}

describe('BrowserInputDeviceAdapter', () => {
  it('uses KeyboardEvent.code, ignores repeats, and timestamps edges with its injected clock', () => {
    let nowMs = 12;
    const target = new FakeBrowserWindow();
    const adapter = new BrowserInputDeviceAdapter(
      { nowMs: () => nowMs },
      {
        window: target,
        document: new FakeBrowserDocument(),
        getGamepads: () => [],
      },
    );
    target.dispatchEvent(keyboardEvent('keydown', 'KeyA'));
    target.dispatchEvent(keyboardEvent('keydown', 'KeyA', true));

    expect(adapter.read().keyboard).toEqual({
      heldCodes: ['KeyA'],
      pressed: [{ code: 'KeyA', atMs: 12 }],
      released: [],
      activityAtMs: 12,
    });
    nowMs = 20;
    target.dispatchEvent(keyboardEvent('keyup', 'KeyA'));
    expect(adapter.read().keyboard.released).toEqual([{ code: 'KeyA', atMs: 20 }]);
    adapter.shutdown();
  });

  it('copies the first connected standard gamepad and treats null or unmapped slots as neutral', () => {
    const target = new FakeBrowserWindow();
    const unmapped = browserGamepad('unmapped', '', [1], [1]);
    const mapped = browserGamepad('standard-pad', 'standard', [0.75], [-0.5]);
    const adapter = new BrowserInputDeviceAdapter(
      { nowMs: () => 0 },
      {
        window: target,
        document: new FakeBrowserDocument(),
        getGamepads: () => [null, unmapped, mapped],
      },
    );

    expect(adapter.read().gamepad).toEqual({
      id: 'standard-pad',
      connected: true,
      buttons: [0.75],
      axes: [-0.5],
      activityAtMs: null,
    });
    adapter.shutdown();
  });

  it('reports blur and hidden visibility as unfocused and clears keyboard state', () => {
    const target = new FakeBrowserWindow();
    const documentTarget = new FakeBrowserDocument();
    const adapter = new BrowserInputDeviceAdapter(
      { nowMs: () => 5 },
      { window: target, document: documentTarget, getGamepads: () => [] },
    );
    target.dispatchEvent(keyboardEvent('keydown', 'Space'));
    documentTarget.visibilityState = 'hidden';
    documentTarget.dispatchEvent(new Event('visibilitychange'));

    expect(adapter.read()).toMatchObject({
      focused: false,
      keyboard: { heldCodes: [], pressed: [], released: [] },
    });
    adapter.shutdown();
  });

  it('restores focus across hidden and visible event orderings without phantom edges', () => {
    const target = new FakeBrowserWindow();
    const documentTarget = new FakeBrowserDocument();
    const adapter = new BrowserInputDeviceAdapter(
      { nowMs: () => 5 },
      {
        window: target,
        document: documentTarget,
        getGamepads: () => [],
      },
    );
    documentTarget.visibilityState = 'hidden';
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    target.dispatchEvent(new Event('focus'));
    expect(adapter.read()).toMatchObject({
      focused: false,
      keyboard: { pressed: [], released: [] },
    });

    documentTarget.visibilityState = 'visible';
    documentTarget.focused = true;
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    expect(adapter.read()).toMatchObject({
      focused: true,
      keyboard: { pressed: [], released: [] },
    });

    target.dispatchEvent(new Event('blur'));
    documentTarget.focused = false;
    documentTarget.visibilityState = 'hidden';
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    documentTarget.visibilityState = 'visible';
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    expect(adapter.read().focused).toBe(false);
    documentTarget.focused = true;
    target.dispatchEvent(new Event('focus'));
    expect(adapter.read().focused).toBe(true);
    adapter.shutdown();
  });

  it('tears down listeners so later key, focus, and visibility events cannot mutate state', () => {
    const target = new FakeBrowserWindow();
    const documentTarget = new FakeBrowserDocument();
    const adapter = new BrowserInputDeviceAdapter(
      { nowMs: () => 8 },
      {
        window: target,
        document: documentTarget,
        getGamepads: () => [],
      },
    );
    adapter.shutdown();
    const afterShutdown = adapter.read();

    target.dispatchEvent(keyboardEvent('keydown', 'KeyA'));
    expect(adapter.read()).toEqual(afterShutdown);
    documentTarget.focused = true;
    target.dispatchEvent(new Event('focus'));
    expect(adapter.read()).toEqual(afterShutdown);
    documentTarget.visibilityState = 'hidden';
    documentTarget.dispatchEvent(new Event('visibilitychange'));

    expect(adapter.read()).toEqual(afterShutdown);
  });
});
