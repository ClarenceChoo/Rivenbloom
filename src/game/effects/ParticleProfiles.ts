import type { AccessibilitySettings } from '../config/accessibility';

export const PARTICLE_PROFILES = {
  slash: {
    colour: 0xf5c96a,
    maximumMembers: 8,
    lifetimeMs: 180
  },
  impact: {
    colour: 0xf0e3c0,
    accentColour: 0xee765f,
    maximumMembers: 12,
    lifetimeMs: 140
  },
  lumen: {
    colour: 0x9ee7d7,
    maximumMembers: 8,
    lifetimeMs: 720
  }
} as const;

export type CombatFeedbackInput = {
  readonly hitStopMs: number;
  readonly amount: number;
  readonly direction: -1 | 1;
};

export type CombatFeedbackProfile = {
  readonly hitStopMs: number;
  readonly shake: { readonly x: number; readonly y: number };
  readonly flashAlpha: number;
  readonly particleCount: number;
  readonly showDamageLabel: boolean;
  readonly highContrastHoldFrames: number;
};

const ratio = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

export const combatFeedbackFor = (
  input: CombatFeedbackInput,
  settings: AccessibilitySettings
): CombatFeedbackProfile => {
  const reduced = settings.reducedMotion;
  const shakeScale = reduced ? 0 : ratio(settings.screenShake);
  const flashScale = ratio(settings.screenFlash) * (reduced ? 0.35 : 1);
  return {
    hitStopMs: reduced ? Math.min(35, Math.max(0, input.hitStopMs)) : Math.max(0, input.hitStopMs),
    shake: {
      x: input.direction * 6 * shakeScale,
      y: shakeScale === 0 ? 0 : -2 * shakeScale
    },
    flashAlpha: flashScale,
    particleCount: reduced ? 2 : 6,
    showDamageLabel: settings.damageNumbers,
    highContrastHoldFrames: settings.highContrastPrompts ? 6 : 0
  };
};
