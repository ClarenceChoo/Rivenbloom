import type { EnemyProfile } from '../EnemyProfile';

// Elite pressure: quick thrust up close, delayed halo sweep as the spacing punish.
export const thornSentinelProfile: EnemyProfile = {
  id: 'thorn-sentinel-ai',
  actorId: 'thorn-sentinel',
  locomotion: 'ground',
  chase: { speed: 160, stopGapX: 96, leashDistance: 520 },
  attacks: [
    { attackId: 'thorn-sentinel-thrust', kind: 'melee', triggerRange: 170, cooldownFrames: 69 },
    { attackId: 'thorn-sentinel-sweep', kind: 'melee', triggerRange: 130, cooldownFrames: 108 }
  ],
  suspicion: { framesToAlert: 12, decayPerFrame: 0.8 },
  staggerPoiseThreshold: 70,
  hurtFrames: 8,
  staggerFrames: 78,
  sightVerticalRange: 220,
  rearRange: 130
};
