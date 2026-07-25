import { describe, expect, it } from 'vitest';
import { CooldownTracker } from '../../src/game/abilities/CooldownTracker';
import type { AbilityId } from '../../src/game/combat/CombatTypes';

const gust = 'gust-step' as AbilityId;
const ward = 'root-ward' as AbilityId;

describe('CooldownTracker', () => {
  it('allows an ability exactly at its cooldown boundary', () => {
    const tracker = new CooldownTracker([{ id: gust, cooldownMs: 500 }]);

    expect(tracker.tryUse(gust, 1_000)).toBe(true);
    expect(tracker.tryUse(gust, 1_500)).toBe(true);
  });

  it('does not permit an older timestamp to consume another ability', () => {
    const tracker = new CooldownTracker([
      { id: gust, cooldownMs: 500 },
      { id: ward, cooldownMs: 500 }
    ]);

    expect(tracker.tryUse(gust, 1_000)).toBe(true);
    expect(tracker.tryUse(ward, 999)).toBe(false);
  });

  it('keeps time monotonic after a cooldown-rejected attempt', () => {
    const tracker = new CooldownTracker([
      { id: gust, cooldownMs: 500 },
      { id: ward, cooldownMs: 500 }
    ]);

    tracker.tryUse(gust, 1_000);
    expect(tracker.tryUse(gust, 1_200)).toBe(false);
    expect(tracker.tryUse(ward, 1_100)).toBe(false);
  });
});
