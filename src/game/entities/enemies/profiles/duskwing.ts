import type { EnemyProfile } from '../EnemyProfile';

// Aerial tracking: hovers above the trail and commits to a hooked dive.
export const duskwingProfile: EnemyProfile = {
  id: 'duskwing-ai',
  actorId: 'duskwing',
  locomotion: 'air',
  chase: { speed: 150, stopGapX: 24, leashDistance: 460 },
  attacks: [{ attackId: 'duskwing-dive', kind: 'melee', triggerRange: 220, cooldownFrames: 66 }],
  air: { hoverHeight: 150, bobAmplitude: 14, bobFramePeriod: 90, diveSpeedPerFrame: 9 },
  suspicion: { framesToAlert: 18, decayPerFrame: 0.6 },
  staggerPoiseThreshold: 24,
  hurtFrames: 12,
  staggerFrames: 36,
  sightVerticalRange: 320,
  rearRange: 120
};
