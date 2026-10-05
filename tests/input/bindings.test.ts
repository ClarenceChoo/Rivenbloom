import { describe, expect, it } from 'vitest';

import { INPUT_ACTIONS, inputActionContext } from '../../src/game/input/InputActions';
import {
  DEFAULT_BINDINGS,
  createBindingMap,
  rebindBindings,
  serializeBindingOverrides,
} from '../../src/game/input/bindings';
import type { Binding } from '../../src/game/input/bindings';
import type { BindingOverride } from '../../src/game/saves/SaveSchema';

describe('input bindings', () => {
  it('provides the complete semantic action set and simultaneous defaults', () => {
    expect(INPUT_ACTIONS).toEqual([
      'move-left',
      'move-right',
      'move-up',
      'move-down',
      'jump',
      'attack-light',
      'attack-heavy',
      'block',
      'dash',
      'cast',
      'cycle-ability',
      'interact',
      'pause',
      'ui-left',
      'ui-right',
      'ui-up',
      'ui-down',
      'ui-confirm',
      'ui-cancel',
    ]);
    expect(inputActionContext('pause')).toBe('system');
    expect(inputActionContext('ui-confirm')).toBe('ui');
    expect(inputActionContext('attack-light')).toBe('gameplay');
    expect(DEFAULT_BINDINGS['move-left']).toEqual([
      { kind: 'keyboard', code: 'ArrowLeft' },
      { kind: 'keyboard', code: 'KeyA' },
      { kind: 'gamepad-button', button: 14 },
      { kind: 'gamepad-axis', axis: 0, direction: -1 },
    ]);
    expect(DEFAULT_BINDINGS.jump).toEqual([
      { kind: 'keyboard', code: 'Space' },
      { kind: 'gamepad-button', button: 0 },
    ]);
    expect(DEFAULT_BINDINGS['attack-light']).toEqual([
      { kind: 'keyboard', code: 'KeyJ' },
      { kind: 'gamepad-button', button: 2 },
    ]);
    expect(DEFAULT_BINDINGS['attack-heavy']).toEqual([
      { kind: 'keyboard', code: 'KeyK' },
      { kind: 'gamepad-button', button: 3 },
    ]);
    expect(DEFAULT_BINDINGS['cycle-ability']).toEqual([
      { kind: 'keyboard', code: 'KeyR' },
      { kind: 'gamepad-button', button: 6 },
    ]);
    expect(DEFAULT_BINDINGS['ui-confirm']).toEqual([
      { kind: 'keyboard', code: 'Enter' },
      { kind: 'keyboard', code: 'Space' },
      { kind: 'gamepad-button', button: 0 },
    ]);
    expect(DEFAULT_BINDINGS['ui-cancel']).toEqual([
      { kind: 'keyboard', code: 'Backspace' },
      { kind: 'keyboard', code: 'Escape' },
      { kind: 'gamepad-button', button: 1 },
    ]);
  });

  it('loads complete known overrides, ignores unknown actions, and leaves new known actions defaulted', () => {
    const overrides = [
      {
        actionId: 'attack-light',
        bindings: [{ kind: 'keyboard', code: 'KeyF' }],
      },
      {
        actionId: 'future-action',
        bindings: [{ kind: 'keyboard', code: 'KeyZ' }],
      },
    ] as unknown as readonly BindingOverride[];

    const bindings = createBindingMap(overrides);

    expect(bindings['attack-light']).toEqual([{ kind: 'keyboard', code: 'KeyF' }]);
    expect(bindings.jump).toEqual(DEFAULT_BINDINGS.jump);
    expect(Object.isFrozen(bindings)).toBe(true);
    expect(Object.isFrozen(bindings['attack-light'])).toBe(true);
  });

  it('rejects invalid and same-context conflicts atomically', () => {
    const original = createBindingMap([]);

    const invalid = rebindBindings(original, 'attack-light', {
      kind: 'gamepad-axis',
      axis: -1,
      direction: 1,
    });
    const conflict = rebindBindings(original, 'attack-light', {
      kind: 'keyboard',
      code: 'KeyK',
    });

    expect(invalid).toEqual({ kind: 'invalid' });
    expect(conflict).toEqual({ kind: 'conflict', conflictingActions: ['attack-heavy'] });
    expect(original).toEqual(DEFAULT_BINDINGS);
  });

  it('allows cross-context reuse and replaces only the rebound device family', () => {
    const original = createBindingMap([]);

    const result = rebindBindings(original, 'attack-light', {
      kind: 'keyboard',
      code: 'Enter',
    });

    expect(result).toEqual({
      kind: 'applied',
      changed: true,
      bindings: [
        { kind: 'keyboard', code: 'Enter' },
        { kind: 'gamepad-button', button: 2 },
      ],
      bindingMap: expect.any(Object),
    });
    if (result.kind !== 'applied') throw new Error('Expected binding to be applied.');
    expect(result.bindingMap['ui-confirm']).toEqual(DEFAULT_BINDINGS['ui-confirm']);
  });

  it('serializes canonical deduped overrides, elides defaults, and round-trips', () => {
    const unorderedBindings: readonly Binding[] = [
      { kind: 'gamepad-axis', axis: 2, direction: 1 },
      { kind: 'keyboard', code: 'KeyZ' },
      { kind: 'gamepad-button', button: 8 },
      { kind: 'keyboard', code: 'KeyB' },
      { kind: 'gamepad-axis', axis: 2, direction: -1 },
      { kind: 'gamepad-button', button: 3 },
      { kind: 'keyboard', code: 'KeyB' },
    ];
    const bindings = createBindingMap([
      { actionId: 'jump' as BindingOverride['actionId'], bindings: DEFAULT_BINDINGS.jump },
      { actionId: 'cast' as BindingOverride['actionId'], bindings: unorderedBindings },
      {
        actionId: 'attack-light' as BindingOverride['actionId'],
        bindings: [{ kind: 'keyboard', code: 'KeyF' }],
      },
    ]);

    const serialized = serializeBindingOverrides(bindings);

    expect(serialized).toEqual([
      { actionId: 'attack-light', bindings: [{ kind: 'keyboard', code: 'KeyF' }] },
      {
        actionId: 'cast',
        bindings: [
          { kind: 'keyboard', code: 'KeyB' },
          { kind: 'keyboard', code: 'KeyZ' },
          { kind: 'gamepad-button', button: 3 },
          { kind: 'gamepad-button', button: 8 },
          { kind: 'gamepad-axis', axis: 2, direction: -1 },
          { kind: 'gamepad-axis', axis: 2, direction: 1 },
        ],
      },
    ]);
    expect(createBindingMap(serialized)).toEqual(bindings);
  });
});
