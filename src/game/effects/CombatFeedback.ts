import type { SaveSettings } from '../saves/SaveSchema';
import type { AudioCueId, ParticleProfileId } from '../core/StableId';

type FeedbackImpact =
  | Readonly<{ kind: 'invulnerable' }>
  | Readonly<{
      kind: 'damaging';
      class: 'ordinary' | 'heavy' | 'parry';
      damage: number;
      particleProfileId: ParticleProfileId;
      audioCueId: AudioCueId;
    }>;

export type FeedbackCommand =
  | Readonly<{ kind: 'shake'; intensity: number }>
  | Readonly<{ kind: 'flash'; intensity: number }>
  | Readonly<{ kind: 'trail' }>
  | Readonly<{ kind: 'particles'; profileId: ParticleProfileId; drift: boolean }>
  | Readonly<{ kind: 'damage-label'; damage: number }>
  | Readonly<{ kind: 'audio-cue'; cueId: AudioCueId }>;

export type CombatFeedback = Readonly<{
  hitStopMs: number;
  commands: readonly FeedbackCommand[];
}>;

export function combatFeedback(impact: FeedbackImpact, settings: SaveSettings): CombatFeedback {
  if (impact.kind === 'invulnerable')
    return Object.freeze({ hitStopMs: 0, commands: Object.freeze([]) });
  const reduced = settings.reducedMotion;
  const commands: FeedbackCommand[] = [
    Object.freeze({ kind: 'shake', intensity: reduced ? 0 : clamp(settings.shakeIntensity) }),
    Object.freeze({ kind: 'flash', intensity: clamp(settings.flashIntensity) }),
  ];
  if (!reduced) commands.push(Object.freeze({ kind: 'trail' }));
  commands.push(
    Object.freeze({ kind: 'particles', profileId: impact.particleProfileId, drift: !reduced }),
  );
  if (settings.damageNumbers) {
    commands.push(Object.freeze({ kind: 'damage-label', damage: impact.damage }));
  }
  commands.push(Object.freeze({ kind: 'audio-cue', cueId: impact.audioCueId }));
  return Object.freeze({
    hitStopMs: impact.class === 'ordinary' ? 55 : 70,
    commands: Object.freeze(commands),
  });
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
