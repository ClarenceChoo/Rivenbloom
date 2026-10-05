import { stableId } from '../core/StableId';
import type { ParticleProfileId } from '../core/StableId';
import { deepFreeze } from '../data/immutability';

export type ParticleProfile = Readonly<{
  profileId: ParticleProfileId;
  maxParticles: number;
  lifetimeMs: number;
  spreadDegrees: number;
}>;

function particleProfileId(value: string): ParticleProfileId {
  return stableId<'particle-profile'>(value);
}

export const PARTICLE_PROFILES: readonly ParticleProfile[] = deepFreeze([
  {
    profileId: particleProfileId('blade-sedge-spark'),
    maxParticles: 10,
    lifetimeMs: 180,
    spreadDegrees: 55,
  },
  {
    profileId: particleProfileId('lumen-spark'),
    maxParticles: 14,
    lifetimeMs: 240,
    spreadDegrees: 80,
  },
  {
    profileId: particleProfileId('resonance-ring'),
    maxParticles: 18,
    lifetimeMs: 320,
    spreadDegrees: 360,
  },
]);
