import { stableId } from '../../../core/StableId';
import { deepFreeze } from '../../../data/immutability';
import type { AiProfileDefinition } from '../../../data/types';
import { COMMON_AWARENESS_TIMING } from './shared';

export const DUSKWING_PROFILE: AiProfileDefinition = deepFreeze({
  aiProfileId: stableId<'ai-profile'>('duskwing-ai'),
  actorId: stableId<'actor'>('duskwing'),
  bodyBounds: { x: -30, y: -60, width: 60, height: 60 },
  hurtboxes: [{ x: -26, y: -56, width: 52, height: 48 }],
  eyeOffset: { x: 0, y: -42 },
  awareness: {
    wakeRange: 260,
    sightRange: 520,
    verticalRange: 280,
    ...COMMON_AWARENESS_TIMING,
  },
  territory: { patrolRange: 220, leashRange: 360, ledgeProbe: null },
  locomotion: { kind: 'aerial', speed: 230 },
  frontalDefense: null,
  attacks: [
    {
      attackId: stableId<'attack'>('duskwing-hook-dive'),
      telegraphMs: 300,
      activeMs: 240,
      recoveryMs: 420,
      band: { minimumX: 72, maximumX: 300, vertical: 240 },
      slotClass: 'close',
      pressureCost: 1,
      cameraInset: 0,
      motion: { kind: 'dive', hoverMs: 150, arcDepth: 64 },
    },
  ],
} satisfies AiProfileDefinition);
