import type { EnemyProfile } from '../EnemyProfile';

// Projectile timing: kites away from pressure and scripts delayed pollen from range.
export const sporeScribeProfile: EnemyProfile = {
  id: 'spore-scribe-ai',
  actorId: 'spore-scribe',
  locomotion: 'ground',
  patrol: { speed: 50, spanX: 90, pauseFrames: 70 },
  chase: { speed: 110, stopGapX: 300, leashDistance: 380 },
  attacks: [
    { attackId: 'spore-scribe-pollen', kind: 'ranged', triggerRange: 460, cooldownFrames: 84 }
  ],
  kite: { triggerRange: 180, speed: 120 },
  suspicion: { framesToAlert: 30, decayPerFrame: 0.4 },
  staggerPoiseThreshold: 24,
  hurtFrames: 16,
  staggerFrames: 44,
  sightVerticalRange: 220,
  rearRange: 80
};
