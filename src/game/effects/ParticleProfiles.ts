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

export type ImpactLeafShape = {
  readonly colour: number;
  readonly alpha: number;
  readonly points: readonly { readonly x: number; readonly y: number }[];
};

const IMPACT_LEAF_SHAPES: readonly ImpactLeafShape[] = [
  {
    colour: PARTICLE_PROFILES.impact.colour,
    alpha: 0.9,
    points: [
      { x: -5, y: 2 },
      { x: -26, y: -15 },
      { x: -13, y: 8 }
    ]
  },
  {
    colour: 0xf5c96a,
    alpha: 0.85,
    points: [
      { x: 2, y: -4 },
      { x: 15, y: -27 },
      { x: 11, y: 3 }
    ]
  },
  {
    colour: PARTICLE_PROFILES.impact.accentColour,
    alpha: 0.8,
    points: [
      { x: 7, y: 5 },
      { x: 31, y: -4 },
      { x: 13, y: 15 }
    ]
  },
  {
    colour: 0xf5c96a,
    alpha: 0.75,
    points: [
      { x: -10, y: 12 },
      { x: -28, y: 26 },
      { x: -16, y: 6 }
    ]
  },
  {
    colour: PARTICLE_PROFILES.impact.colour,
    alpha: 0.7,
    points: [
      { x: 4, y: -12 },
      { x: 0, y: -34 },
      { x: 12, y: -28 }
    ]
  },
  {
    colour: PARTICLE_PROFILES.impact.accentColour,
    alpha: 0.65,
    points: [
      { x: 10, y: 14 },
      { x: 26, y: 28 },
      { x: 18, y: 8 }
    ]
  }
];

export const impactLeafShapes = (count: number): readonly ImpactLeafShape[] => {
  const bounded = Number.isFinite(count)
    ? Math.max(0, Math.min(IMPACT_LEAF_SHAPES.length, Math.floor(count)))
    : 0;
  return IMPACT_LEAF_SHAPES.slice(0, bounded);
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
