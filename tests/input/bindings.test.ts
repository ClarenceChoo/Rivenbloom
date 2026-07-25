import { describe, expect, it } from 'vitest';
import {
  AXIS_DEADZONE,
  DEFAULT_BINDINGS,
  INPUT_BUFFER_MS,
  applySerializedBindings,
  deserializeBinding,
  serializeBinding
} from '../../src/game/input/bindings';

describe('bindings', () => {
  it('round-trips keyboard and directional gamepad bindings without losing their input', () => {
    expect(deserializeBinding(serializeBinding({ kind: 'keyboard', code: 'KeyQ' }))).toEqual({
      kind: 'keyboard',
      code: 'KeyQ'
    });
    expect(
      deserializeBinding(
        serializeBinding({ kind: 'gamepad-axis', axis: 0, direction: -1, threshold: 0.4 })
      )
    ).toEqual({ kind: 'gamepad-axis', axis: 0, direction: -1, threshold: 0.4 });
  });

  it('provides keyboard aliases and conventional gamepad controls for semantic movement', () => {
    expect(DEFAULT_BINDINGS['move-left']).toEqual(
      expect.arrayContaining([
        { kind: 'keyboard', code: 'KeyA' },
        { kind: 'keyboard', code: 'ArrowLeft' },
        { kind: 'gamepad-axis', axis: 0, direction: -1, threshold: 0.25 },
        { kind: 'gamepad-button', button: 14 }
      ])
    );
    expect(DEFAULT_BINDINGS.jump).toEqual(
      expect.arrayContaining([
        { kind: 'keyboard', code: 'Space' },
        { kind: 'gamepad-button', button: 0 }
      ])
    );
    expect(AXIS_DEADZONE).toBe(0.25);
    expect(INPUT_BUFFER_MS).toBe(120);
  });

  it('applies valid saved overrides without erasing aliases for other actions', () => {
    const bindings = applySerializedBindings({
      'attack-light': 'keyboard:KeyZ',
      jump: 'malformed'
    });

    expect(bindings['attack-light']).toEqual(
      expect.arrayContaining([
        { kind: 'keyboard', code: 'KeyZ' },
        { kind: 'gamepad-button', button: 2 }
      ])
    );
    expect(bindings.jump).toEqual(DEFAULT_BINDINGS.jump);
  });

  it('rejects a saved override that would collide with another action', () => {
    const bindings = applySerializedBindings({ 'attack-light': 'keyboard:KeyC' });

    expect(bindings['attack-light']).toEqual(DEFAULT_BINDINGS['attack-light']);
    expect(bindings['attack-heavy']).toEqual(DEFAULT_BINDINGS['attack-heavy']);
  });
});
