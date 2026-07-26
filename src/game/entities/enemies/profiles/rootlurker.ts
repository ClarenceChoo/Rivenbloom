import type { EnemyProfile } from '../EnemyProfile';

// Ambush tells: stays concealed until the player crosses the burrow, then bites.
export const rootlurkerProfile: EnemyProfile = {
  id: 'rootlurker-ai',
  actorId: 'rootlurker',
  locomotion: 'ambush',
  chase: { speed: 0, stopGapX: 0, leashDistance: 240 },
  attacks: [{ attackId: 'rootlurker-bite', kind: 'melee', triggerRange: 150, cooldownFrames: 78 }],
  ambush: { emergeRange: 150 },
  suspicion: { framesToAlert: 1, decayPerFrame: 1 },
  staggerPoiseThreshold: 24,
  hurtFrames: 14,
  staggerFrames: 40,
  sightVerticalRange: 140,
  rearRange: 150
};
