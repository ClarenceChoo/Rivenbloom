import { describe, expect, test } from 'vitest';

import { PARTICLE_PROFILES } from '../../src/game/effects/ParticleProfiles';

describe('logical particle profiles', () => {
  test('are bounded, original data-only feedback definitions', () => {
    expect(PARTICLE_PROFILES.map(({ profileId }) => profileId)).toEqual([
      'blade-sedge-spark',
      'lumen-spark',
      'resonance-ring',
    ]);
    for (const profile of PARTICLE_PROFILES) {
      expect(profile.maxParticles).toBeGreaterThan(0);
      expect(profile.maxParticles).toBeLessThanOrEqual(32);
      expect(profile).not.toHaveProperty('texture');
      expect(Object.isFrozen(profile)).toBe(true);
    }
  });
});
