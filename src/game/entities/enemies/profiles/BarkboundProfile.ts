import { stableId } from '../../../core/StableId';
import { deepFreeze } from '../../../data/immutability';
import type { AiProfileDefinition } from '../../../data/types';
import { COMMON_AWARENESS_TIMING } from './shared';

export const BARKBOUND_PROFILE: AiProfileDefinition = deepFreeze({
  aiProfileId: stableId<'ai-profile'>('barkbound-ai'),
  actorId: stableId<'actor'>('barkbound'),
  bodyBounds: { x: -36, y: -116, width: 72, height: 116 },
  hurtboxes: [{ x: -30, y: -108, width: 60, height: 108 }],
  eyeOffset: { x: 0, y: -88 },
  awareness: {
    wakeRange: 200,
    sightRange: 380,
    verticalRange: 128,
    ...COMMON_AWARENESS_TIMING,
  },
  territory: { patrolRange: 96, leashRange: 240, ledgeProbe: { ahead: 30, depth: 48 } },
  locomotion: { kind: 'ground', speed: 75 },
  frontalDefense: { multiplier: 0.15, exposeCoreMs: 900 },
  attacks: [
    {
      attackId: stableId<'attack'>('barkbound-shield-bash'),
      telegraphMs: 380,
      activeMs: 100,
      recoveryMs: 520,
      band: { minimumX: 0, maximumX: 112, vertical: 128 },
      slotClass: 'close',
      pressureCost: 1,
      cameraInset: 0,
      motion: { kind: 'melee' },
    },
  ],
} satisfies AiProfileDefinition);
