import { describe, expect, it } from 'vitest';
import {
  AccessibilitySettingsState,
  DEFAULT_ACCESSIBILITY_SETTINGS,
  applyInputPreferences,
  normalizeAccessibilitySettings
} from '../../src/game/config/accessibility';
import { InputService } from '../../src/game/input/InputService';
import { MemorySaveRepository } from '../../src/game/saves/MemorySaveRepository';
import { SaveService } from '../../src/game/saves/SaveService';
import { createDefaultSave, type SaveSlotId } from '../../src/game/saves/SaveSchema';

const keyEvent = (type: 'keydown' | 'keyup', code: string): Event => {
  const event = new Event(type);
  Object.defineProperty(event, 'code', { value: code });
  return event;
};

describe('accessibility settings', () => {
  it('keeps valid accessibility and separate audio preferences while rejecting unsafe ratios', () => {
    expect(
      normalizeAccessibilitySettings({
        ...DEFAULT_ACCESSIBILITY_SETTINGS,
        reducedMotion: true,
        textScale: 1.3,
        screenShake: 0.4,
        screenFlash: 0.2,
        audio: { master: 0.8, music: 0.5, effects: 0.3 }
      })
    ).toMatchObject({
      reducedMotion: true,
      textScale: 1.3,
      screenShake: 0.4,
      screenFlash: 0.2,
      audio: { master: 0.8, music: 0.5, effects: 0.3 }
    });
    expect(normalizeAccessibilitySettings({ screenShake: 2 }).screenShake).toBe(1);
  });

  it('persists input preferences through SaveService and restores semantic bindings and settings', async () => {
    const slot = 'slot-1' as SaveSlotId;
    const repository = new MemorySaveRepository();
    const saves = new SaveService(repository, { autosaveDelayMs: 1 });
    const input = new InputService({ gamepads: () => [] });
    input.rebind('attack-light', { kind: 'keyboard', code: 'KeyZ' });
    const settings = normalizeAccessibilitySettings({
      reducedMotion: true,
      holdToToggle: true,
      audio: { master: 0.8, music: 0.5, effects: 0.3 }
    });

    saves.scheduleAutosave(
      slot,
      applyInputPreferences(createDefaultSave(slot, 1), input.serializeBindings(), settings)
    );
    await saves.flushAutosaves();
    const loaded = await saves.load(slot);
    if (loaded.kind !== 'loaded') throw new Error('Expected saved input preferences.');

    const target = new EventTarget();
    const restored = new InputService({
      target,
      gamepads: () => [],
      serializedBindings: loaded.save.bindings,
      settings: loaded.save.settings
    });
    target.dispatchEvent(keyEvent('keydown', 'KeyZ'));
    expect(restored.sample(100).held['attack-light']).toBe(true);
    target.dispatchEvent(keyEvent('keyup', 'KeyZ'));
    restored.sample(101);
    target.dispatchEvent(keyEvent('keydown', 'KeyF'));
    expect(restored.sample(102)).toMatchObject({
      held: { block: true },
      device: 'keyboard'
    });
  });

  it('keeps a live settings state and persists title changes through SaveService', async () => {
    const slot = 'slot-1' as SaveSlotId;
    const repository = new MemorySaveRepository();
    const saves = new SaveService(repository);
    await repository.write(slot, createDefaultSave(slot, 1));
    const state = new AccessibilitySettingsState(DEFAULT_ACCESSIBILITY_SETTINGS, slot);

    const updated = state.update({ reducedMotion: true, textScale: 1.3 });
    await saves.updateSettings(slot, updated);

    expect(state.current).toMatchObject({ reducedMotion: true, textScale: 1.3 });
    const loaded = await saves.load(slot);
    expect(loaded).toMatchObject({
      kind: 'loaded',
      save: { settings: { reducedMotion: true, textScale: 1.3 } }
    });
  });
});
