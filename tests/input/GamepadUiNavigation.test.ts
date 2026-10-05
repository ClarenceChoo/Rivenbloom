import { describe, expect, test } from 'vitest';

import { gamepadUiActions } from '../../src/game/input/GamepadUiNavigation';
import { INPUT_ACTIONS } from '../../src/game/input/InputActions';
import type { InputAction } from '../../src/game/input/InputActions';
import type { InputFrame } from '../../src/game/input/InputService';

function frame(activeDevice: 'keyboard' | 'gamepad', pressed: readonly InputAction[]): InputFrame {
  const pressedActions = new Set(pressed);
  const actions = Object.fromEntries(
    INPUT_ACTIONS.map((action) => [
      action,
      {
        value: pressedActions.has(action) ? 1 : 0,
        held: pressedActions.has(action),
        pressed: pressedActions.has(action),
        released: false,
        bufferedPressId: null,
      },
    ]),
  ) as InputFrame['actions'];
  return {
    sampledAtMs: 10,
    actions,
    move: { x: 0, y: 0 },
    navigation: { x: 0, y: 0 },
    activeDevice,
    deviceChangedAtMs: 10,
  };
}

describe('gamepad UI navigation', () => {
  test('does not duplicate native keyboard navigation', () => {
    expect(gamepadUiActions(frame('keyboard', ['ui-down', 'ui-confirm']))).toEqual([]);
  });

  test('maps every gamepad menu direction, adjustment, confirm, and cancel deterministically', () => {
    expect(
      gamepadUiActions(
        frame('gamepad', ['ui-up', 'ui-down', 'ui-left', 'ui-right', 'ui-confirm', 'ui-cancel']),
      ),
    ).toEqual(['previous', 'next', 'decrease', 'increase', 'confirm', 'cancel']);
  });
});
