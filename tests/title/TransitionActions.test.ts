import { describe, expect, test, vi } from 'vitest';

import { createTransitionActions } from '../../src/game/title/TransitionActions';
import { DEFAULT_SAVE_SETTINGS } from '../../src/game/saves/SaveSchema';
import type { TitleTransitionPayload } from '../../src/game/title/TitleController';

describe('transition actions', () => {
  test('forwards the unchanged payload through Enter exactly once', () => {
    const payload: TitleTransitionPayload = Object.freeze({
      mode: 'new',
      slotId: 'slot-1',
      settings: DEFAULT_SAVE_SETTINGS,
    });
    const onEnter = vi.fn();
    const onReturn = vi.fn();
    const actions = createTransitionActions(payload, { onEnter, onReturn });

    expect(actions.enter()).toBe(true);
    expect(actions.enter()).toBe(false);
    expect(actions.returnToTitle()).toBe(false);
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onEnter.mock.calls[0]![0]).toBe(payload);
    expect(onReturn).not.toHaveBeenCalled();
  });

  test('Return closes the card without invoking any world entry callback', () => {
    const payload: TitleTransitionPayload = {
      mode: 'load',
      slotId: 'slot-2',
      settings: DEFAULT_SAVE_SETTINGS,
    };
    const onEnter = vi.fn();
    const onReturn = vi.fn();
    const actions = createTransitionActions(payload, { onEnter, onReturn });

    expect(actions.returnToTitle()).toBe(true);
    expect(actions.returnToTitle()).toBe(false);
    expect(actions.enter()).toBe(false);
    expect(onReturn).toHaveBeenCalledTimes(1);
    expect(onEnter).not.toHaveBeenCalled();
  });
});
