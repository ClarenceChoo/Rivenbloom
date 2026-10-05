import { describe, expect, test } from 'vitest';

import { combatFeedback } from '../../src/game/effects/CombatFeedback';
import { DEFAULT_SAVE_SETTINGS } from '../../src/game/saves/SaveSchema';
import { stableId } from '../../src/game/core/StableId';

const impact = {
  kind: 'damaging' as const,
  class: 'ordinary' as const,
  damage: 12,
  particleProfileId: stableId<'particle-profile'>('lumen-spark'),
  audioCueId: stableId<'audio-cue'>('blade-impact'),
};

describe('combatFeedback', () => {
  test('requests logical ordinary and heavy feedback with authored hit-stop', () => {
    expect(combatFeedback(impact, DEFAULT_SAVE_SETTINGS)).toMatchObject({ hitStopMs: 55 });
    expect(combatFeedback({ ...impact, class: 'heavy' }, DEFAULT_SAVE_SETTINGS)).toMatchObject({
      hitStopMs: 70,
    });
  });

  test('scales shake and flash, while reduced motion removes shake, drift, and trails', () => {
    const result = combatFeedback(impact, {
      ...DEFAULT_SAVE_SETTINGS,
      reducedMotion: true,
      shakeIntensity: 0.5,
      flashIntensity: 0.25,
    });
    expect(result.commands).toContainEqual({ kind: 'shake', intensity: 0 });
    expect(result.commands).toContainEqual({ kind: 'flash', intensity: 0.25 });
    expect(result.commands.some((command) => command.kind === 'trail')).toBe(false);
    expect(result.commands).toContainEqual(
      expect.objectContaining({ kind: 'particles', profileId: 'lumen-spark', drift: false }),
    );
  });

  test('disabled damage numbers emit no label request and invulnerability emits no feedback', () => {
    const hidden = combatFeedback(impact, { ...DEFAULT_SAVE_SETTINGS, damageNumbers: false });
    expect(hidden.commands.some((command) => command.kind === 'damage-label')).toBe(false);
    expect(combatFeedback({ kind: 'invulnerable' }, DEFAULT_SAVE_SETTINGS)).toEqual({
      hitStopMs: 0,
      commands: [],
    });
  });

  test('clamps malformed external intensity settings to the supported range', () => {
    const result = combatFeedback(impact, {
      ...DEFAULT_SAVE_SETTINGS,
      shakeIntensity: 3,
      flashIntensity: -2,
    });
    expect(result.commands).toContainEqual({ kind: 'shake', intensity: 1 });
    expect(result.commands).toContainEqual({ kind: 'flash', intensity: 0 });
  });
});
