import { stableId } from '../../../core/StableId';
import { deepFreeze } from '../../../data/immutability';
import type { AiProfileDefinition } from '../../../data/types';
import { COMMON_AWARENESS_TIMING } from './shared';

export const SPORE_SCRIBE_PROFILE: AiProfileDefinition = deepFreeze({
  aiProfileId: stableId<'ai-profile'>('spore-scribe-ai'),
  actorId: stableId<'actor'>('spore-scribe'),
  bodyBounds: { x: -28, y: -96, width: 56, height: 96 },
  hurtboxes: [{ x: -24, y: -88, width: 48, height: 88 }],
  eyeOffset: { x: 0, y: -72 },
  awareness: {
    wakeRange: 260,
    sightRange: 600,
    verticalRange: 160,
    ...COMMON_AWARENESS_TIMING,
  },
  territory: { patrolRange: 120, leashRange: 320, ledgeProbe: { ahead: 24, depth: 48 } },
  locomotion: { kind: 'ground', speed: 90 },
  frontalDefense: null,
  attacks: [
    {
      attackId: stableId<'attack'>('spore-scribe-pollen-plant'),
      telegraphMs: 450,
      activeMs: 50,
      recoveryMs: 400,
      band: { minimumX: 220, maximumX: 480, vertical: 160 },
      slotClass: 'ranged',
      pressureCost: 1,
      cameraInset: 96,
      motion: { kind: 'plant', armsMs: 350, lifetimeMs: 900, roomCap: 6, maxHits: 1 },
    },
  ],
} satisfies AiProfileDefinition);
