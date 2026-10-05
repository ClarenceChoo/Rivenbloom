import { stableId } from '../../../core/StableId';
import { deepFreeze } from '../../../data/immutability';
import type { AiProfileDefinition } from '../../../data/types';
import { COMMON_AWARENESS_TIMING } from './shared';

export const BRIAR_SCRAPPER_PROFILE: AiProfileDefinition = deepFreeze({
  aiProfileId: stableId<'ai-profile'>('briar-scrapper-ai'),
  actorId: stableId<'actor'>('briar-scrapper'),
  bodyBounds: { x: -28, y: -88, width: 56, height: 88 },
  hurtboxes: [{ x: -24, y: -82, width: 48, height: 82 }],
  eyeOffset: { x: 0, y: -66 },
  awareness: {
    wakeRange: 220,
    sightRange: 420,
    verticalRange: 112,
    ...COMMON_AWARENESS_TIMING,
  },
  territory: { patrolRange: 140, leashRange: 300, ledgeProbe: { ahead: 28, depth: 48 } },
  locomotion: { kind: 'ground', speed: 145 },
  frontalDefense: null,
  attacks: [
    {
      attackId: stableId<'attack'>('briar-scrapper-lunge'),
      telegraphMs: 200,
      activeMs: 80,
      recoveryMs: 320,
      band: { minimumX: 0, maximumX: 96, vertical: 112 },
      slotClass: 'close',
      pressureCost: 1,
      cameraInset: 0,
      motion: { kind: 'lunge', recoilSpeed: 260 },
    },
  ],
} satisfies AiProfileDefinition);
