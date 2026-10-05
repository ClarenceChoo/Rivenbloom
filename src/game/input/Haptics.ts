export type HapticsPulse = Readonly<{
  durationMs: number;
  weakMagnitude: number;
  strongMagnitude: number;
}>;

export type HapticsResult = 'played' | 'unsupported' | 'failed';

export interface HapticsPort {
  pulse(pulse: HapticsPulse): Promise<HapticsResult>;
  stop(): void;
}

export function normalizeHapticsPulse(pulse: HapticsPulse): HapticsPulse {
  return Object.freeze({
    durationMs: clampFinite(pulse.durationMs, 0, 1_000),
    weakMagnitude: clampFinite(pulse.weakMagnitude, 0, 1),
    strongMagnitude: clampFinite(pulse.strongMagnitude, 0, 1),
  });
}

function clampFinite(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.min(maximum, value));
}
