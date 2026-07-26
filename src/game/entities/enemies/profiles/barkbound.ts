import type { EnemyProfile } from '../EnemyProfile';

// Guard breaking: advances behind a bark-door shield that must be staggered open.
export const barkboundProfile: EnemyProfile = {
  id: 'barkbound-ai',
  actorId: 'barkbound',
  locomotion: 'ground',
  patrol: { speed: 40, spanX: 80, pauseFrames: 90 },
  chase: { speed: 70, stopGapX: 84, leashDistance: 360 },
  attacks: [
    { attackId: 'barkbound-shield-slam', kind: 'melee', triggerRange: 110, cooldownFrames: 90 }
  ],
  guard: { damageMultiplier: 0.15, poiseMultiplier: 1, knockbackMultiplier: 0.2 },
  suspicion: { framesToAlert: 36, decayPerFrame: 0.3 },
  staggerPoiseThreshold: 60,
  hurtFrames: 10,
  staggerFrames: 66,
  sightVerticalRange: 160,
  rearRange: 70
};
