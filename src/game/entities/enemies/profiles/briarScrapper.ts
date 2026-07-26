import type { EnemyProfile } from '../EnemyProfile';

// Grounded spacing: patrols a short beat, then presses in for a masked lunge.
export const briarScrapperProfile: EnemyProfile = {
  id: 'briar-scrapper-ai',
  actorId: 'briar-scrapper',
  locomotion: 'ground',
  patrol: { speed: 70, spanX: 140, pauseFrames: 45 },
  chase: { speed: 180, stopGapX: 62, leashDistance: 420 },
  attacks: [
    { attackId: 'briar-scrapper-lunge', kind: 'melee', triggerRange: 96, cooldownFrames: 57 }
  ],
  suspicion: { framesToAlert: 24, decayPerFrame: 0.5 },
  staggerPoiseThreshold: 24,
  hurtFrames: 14,
  staggerFrames: 42,
  sightVerticalRange: 180,
  rearRange: 90
};
