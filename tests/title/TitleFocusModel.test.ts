import { describe, expect, test } from 'vitest';

import {
  closeFocusModal,
  createFocusModel,
  moveFocus,
  openFocusModal,
  replaceFocusTargets,
} from '../../src/game/title/TitleFocusModel';

const controls = [
  { id: 'journey-1-primary', available: true },
  { id: 'journey-1-secondary', available: false },
  { id: 'journey-2-primary', available: true },
  { id: 'settings', available: true },
];

describe('title focus model', () => {
  test('uses a preferred available target and skips unavailable controls while wrapping', () => {
    let model = createFocusModel(controls, 'journey-1-primary');
    model = moveFocus(model, 'next');
    expect(model.activeId).toBe('journey-2-primary');
    model = moveFocus(model, 'previous');
    expect(model.activeId).toBe('journey-1-primary');
    model = moveFocus(model, 'previous');
    expect(model.activeId).toBe('settings');
  });

  test('falls back to the first available target when the preferred target disappears', () => {
    const model = replaceFocusTargets(createFocusModel(controls, 'journey-2-primary'), [
      { id: 'credits', available: true },
    ]);
    expect(model.activeId).toBe('credits');
  });

  test('focuses modal cancel first and restores the invoker when the modal closes', () => {
    const base = createFocusModel(controls, 'journey-2-primary');
    const modal = openFocusModal(
      base,
      [
        { id: 'dialog-confirm', available: true },
        { id: 'dialog-cancel', available: true },
      ],
      'dialog-cancel',
    );
    expect(modal.activeId).toBe('dialog-cancel');
    expect(closeFocusModal(modal, controls).activeId).toBe('journey-2-primary');
  });
});
