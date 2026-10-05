import { describe, expect, it } from 'vitest';

import {
  patchSaveSettings,
  projectAccessibilitySettings,
  projectAudioSettings,
} from '../../src/game/config/accessibility';
import { InputService } from '../../src/game/input/InputService';
import {
  createInputServiceFromSave,
  queueInputPreferences,
} from '../../src/game/input/InputPreferences';
import { MemorySaveRepository } from '../../src/game/saves/MemorySaveRepository';
import { SaveService } from '../../src/game/saves/SaveService';
import { DEFAULT_SAVE_SETTINGS, validateSaveV1 } from '../../src/game/saves/SaveSchema';
import type { InputDevicePort, InputDeviceSnapshot } from '../../src/game/input/InputService';
import { rawSaveV1 } from '../saves/saveFixtures';

class PreferenceInputPort implements InputDevicePort {
  public transientClears = 0;
  public snapshot: InputDeviceSnapshot = {
    focused: true,
    keyboard: { heldCodes: [], pressed: [], released: [], activityAtMs: null },
    gamepad: null,
  };

  public read(): InputDeviceSnapshot {
    return this.snapshot;
  }

  public clearTransient(): void {
    this.transientClears += 1;
  }
}

describe('input settings and persistence composition', () => {
  it('projects accessibility and audio settings without redefining save defaults', () => {
    expect(projectAccessibilitySettings(DEFAULT_SAVE_SETTINGS)).toEqual({
      reducedMotion: false,
      shakeIntensity: 1,
      flashIntensity: 1,
      subtitles: true,
      textScale: 1,
      highContrastPrompts: false,
      damageNumbers: true,
      sustainedAction: 'hold',
    });
    expect(projectAudioSettings(DEFAULT_SAVE_SETTINGS)).toEqual({
      masterVolume: 1,
      musicVolume: 1,
      sfxVolume: 1,
      ambienceVolume: 1,
      muteWhenUnfocused: true,
    });
  });

  it('patches immutable save settings while preserving unrelated save state', () => {
    const decoded = validateSaveV1(rawSaveV1());
    if (decoded.kind !== 'valid') throw new Error('Fixture must be valid.');

    const patched = patchSaveSettings(decoded.value, {
      reducedMotion: true,
      masterVolume: 0.25,
    });

    expect(patched).not.toBe(decoded.value);
    expect(patched.settings).not.toBe(decoded.value.settings);
    expect(patched.settings.reducedMotion).toBe(true);
    expect(patched.settings.masterVolume).toBe(0.25);
    expect(patched.settings.musicVolume).toBe(decoded.value.settings.musicVolume);
    expect(patched.player).toBe(decoded.value.player);
  });

  it('round-trips effective bindings and settings through the real save service boundary', async () => {
    const decoded = validateSaveV1(rawSaveV1());
    if (decoded.kind !== 'valid') throw new Error('Fixture must be valid.');
    const port = new PreferenceInputPort();
    const input = createInputServiceFromSave(decoded.value, port);
    const repository = new MemorySaveRepository();
    const saves = new SaveService(repository);
    const result = input.rebind('jump', { kind: 'keyboard', code: 'KeyZ' });
    expect(result).toMatchObject({ kind: 'applied', changed: true });

    const queued = queueInputPreferences(saves, 'slot-1', decoded.value, input, {
      sustainedAction: 'toggle',
      reducedMotion: true,
    });
    await saves.flush('slot-1');
    const stored = await saves.read('slot-1');

    expect(queued.settings.sustainedAction).toBe('toggle');
    expect(stored.kind).toBe('loaded');
    if (stored.kind !== 'loaded') throw new Error('Queued preferences must be readable.');
    expect(stored.save.bindingOverrides).toContainEqual({
      actionId: 'jump',
      bindings: [
        { kind: 'keyboard', code: 'KeyZ' },
        { kind: 'gamepad-button', button: 0 },
      ],
    });
    expect(stored.save.settings.reducedMotion).toBe(true);
    const reloaded = createInputServiceFromSave(stored.save, new PreferenceInputPort());
    expect(reloaded.getBindings('jump')).toEqual([
      { kind: 'keyboard', code: 'KeyZ' },
      { kind: 'gamepad-button', button: 0 },
    ]);
  });

  it('exposes rebind atomically through InputService and clears transients only when applied', () => {
    const port = new PreferenceInputPort();
    const input = new InputService(port);
    const conflict = input.rebind('attack-light', { kind: 'keyboard', code: 'KeyK' });
    expect(conflict).toEqual({ kind: 'conflict', conflictingActions: ['attack-heavy'] });
    expect(port.transientClears).toBe(0);
    expect(input.getBindings('attack-light')).toEqual([
      { kind: 'keyboard', code: 'KeyJ' },
      { kind: 'gamepad-button', button: 2 },
    ]);
    const applied = input.rebind('attack-light', { kind: 'keyboard', code: 'KeyZ' });
    expect(applied).toMatchObject({ kind: 'applied', changed: true });
    expect(port.transientClears).toBe(1);
  });
});
