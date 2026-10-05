import type { SaveSettings, SaveV1 } from '../saves/SaveSchema';

export type AccessibilitySettings = Readonly<
  Pick<
    SaveSettings,
    | 'reducedMotion'
    | 'shakeIntensity'
    | 'flashIntensity'
    | 'subtitles'
    | 'textScale'
    | 'highContrastPrompts'
    | 'damageNumbers'
    | 'sustainedAction'
  >
>;

export type AudioSettings = Readonly<
  Pick<
    SaveSettings,
    'masterVolume' | 'musicVolume' | 'sfxVolume' | 'ambienceVolume' | 'muteWhenUnfocused'
  >
>;

export type SaveSettingsPatch = Readonly<Partial<SaveSettings>>;

export function projectAccessibilitySettings(settings: SaveSettings): AccessibilitySettings {
  return Object.freeze({
    reducedMotion: settings.reducedMotion,
    shakeIntensity: settings.shakeIntensity,
    flashIntensity: settings.flashIntensity,
    subtitles: settings.subtitles,
    textScale: settings.textScale,
    highContrastPrompts: settings.highContrastPrompts,
    damageNumbers: settings.damageNumbers,
    sustainedAction: settings.sustainedAction,
  });
}

export function projectAudioSettings(settings: SaveSettings): AudioSettings {
  return Object.freeze({
    masterVolume: settings.masterVolume,
    musicVolume: settings.musicVolume,
    sfxVolume: settings.sfxVolume,
    ambienceVolume: settings.ambienceVolume,
    muteWhenUnfocused: settings.muteWhenUnfocused,
  });
}

export function patchSaveSettings(save: SaveV1, patch: SaveSettingsPatch): SaveV1 {
  return Object.freeze({
    ...save,
    settings: Object.freeze({ ...save.settings, ...patch }),
  });
}
