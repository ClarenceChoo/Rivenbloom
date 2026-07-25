import type { SaveSettings, SaveV1 } from '../saves/SaveSchema';

export type AccessibilitySettings = SaveSettings;
export type AccessibilitySettingsUpdate = Omit<Partial<AccessibilitySettings>, 'audio'> & {
  readonly audio?: Partial<AccessibilitySettings['audio']>;
};

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  subtitles: true,
  reducedMotion: false,
  textScale: 1,
  highContrastPrompts: false,
  screenShake: 1,
  screenFlash: 1,
  damageNumbers: true,
  holdToToggle: false,
  audio: { master: 1, music: 1, effects: 1 }
};

const booleanSetting = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const ratioSetting = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;

const scaleSetting = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

export const normalizeAccessibilitySettings = (
  settings: AccessibilitySettingsUpdate = {}
): AccessibilitySettings => ({
  subtitles: booleanSetting(settings.subtitles, DEFAULT_ACCESSIBILITY_SETTINGS.subtitles),
  reducedMotion: booleanSetting(
    settings.reducedMotion,
    DEFAULT_ACCESSIBILITY_SETTINGS.reducedMotion
  ),
  textScale: scaleSetting(settings.textScale, DEFAULT_ACCESSIBILITY_SETTINGS.textScale),
  highContrastPrompts: booleanSetting(
    settings.highContrastPrompts,
    DEFAULT_ACCESSIBILITY_SETTINGS.highContrastPrompts
  ),
  screenShake: ratioSetting(settings.screenShake, DEFAULT_ACCESSIBILITY_SETTINGS.screenShake),
  screenFlash: ratioSetting(settings.screenFlash, DEFAULT_ACCESSIBILITY_SETTINGS.screenFlash),
  damageNumbers: booleanSetting(
    settings.damageNumbers,
    DEFAULT_ACCESSIBILITY_SETTINGS.damageNumbers
  ),
  holdToToggle: booleanSetting(settings.holdToToggle, DEFAULT_ACCESSIBILITY_SETTINGS.holdToToggle),
  audio: {
    master: ratioSetting(settings.audio?.master, DEFAULT_ACCESSIBILITY_SETTINGS.audio.master),
    music: ratioSetting(settings.audio?.music, DEFAULT_ACCESSIBILITY_SETTINGS.audio.music),
    effects: ratioSetting(settings.audio?.effects, DEFAULT_ACCESSIBILITY_SETTINGS.audio.effects)
  }
});

export const applyInputPreferences = (
  save: SaveV1,
  bindings: Readonly<Record<string, string>>,
  settings: AccessibilitySettings
): SaveV1 => ({
  ...save,
  bindings: { ...bindings },
  settings: { ...settings, audio: { ...settings.audio } }
});
