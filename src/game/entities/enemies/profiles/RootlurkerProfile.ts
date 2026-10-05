import { stableId } from '../../../core/StableId';
import { deepFreeze } from '../../../data/immutability';
import type { AiProfileDefinition } from '../../../data/types';
import { COMMON_AWARENESS_TIMING } from './shared';

export const ROOTLURKER_PROFILE: AiProfileDefinition = deepFreeze({
  aiProfileId: stableId<'ai-profile'>('rootlurker-ai'),
  actorId: stableId<'actor'>('rootlurker'),
  bodyBounds: { x: -38, y: -96, width: 76, height: 96 },
  hurtboxes: [{ x: -32, y: -88, width: 64, height: 88 }],
  eyeOffset: { x: 0, y: -64 },
  awareness: {
    wakeRange: 150,
    sightRange: 150,
    verticalRange: 128,
    ...COMMON_AWARENESS_TIMING,
  },
  territory: { patrolRange: 0, leashRange: 0, ledgeProbe: null },
  locomotion: { kind: 'stationary', speed: 0 },
  frontalDefense: null,
  attacks: [
    {
      attackId: stableId<'attack'>('rootlurker-bell-eruption'),
      telegraphMs: 550,
      activeMs: 120,
      recoveryMs: 700,
      band: { minimumX: 0, maximumX: 150, vertical: 128 },
      slotClass: 'close',
      pressureCost: 1,
      cameraInset: 0,
      motion: { kind: 'hide' },
    },
  ],
} satisfies AiProfileDefinition);
