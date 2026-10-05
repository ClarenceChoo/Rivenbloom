import { stableId } from '../../../core/StableId';
import { deepFreeze } from '../../../data/immutability';
import type { AiProfileDefinition } from '../../../data/types';
import { COMMON_AWARENESS_TIMING } from './shared';

export const THORN_SENTINEL_PROFILE: AiProfileDefinition = deepFreeze({
  aiProfileId: stableId<'ai-profile'>('thorn-sentinel-ai'),
  actorId: stableId<'actor'>('thorn-sentinel'),
  bodyBounds: { x: -42, y: -136, width: 84, height: 136 },
  hurtboxes: [{ x: -36, y: -126, width: 72, height: 126 }],
  eyeOffset: { x: 0, y: -104 },
  awareness: {
    wakeRange: 260,
    sightRange: 520,
    verticalRange: 176,
    ...COMMON_AWARENESS_TIMING,
  },
  territory: { patrolRange: 160, leashRange: 360, ledgeProbe: { ahead: 34, depth: 56 } },
  locomotion: { kind: 'ground', speed: 100 },
  frontalDefense: { multiplier: 0.25, exposeCoreMs: null },
  attacks: [
    {
      attackId: stableId<'attack'>('thorn-sentinel-press'),
      telegraphMs: 300,
      activeMs: 100,
      recoveryMs: 420,
      band: { minimumX: 0, maximumX: 120, vertical: 176 },
      slotClass: 'elite',
      pressureCost: 2,
      cameraInset: 0,
      motion: { kind: 'melee' },
    },
    {
      attackId: stableId<'attack'>('thorn-sentinel-sweep-one'),
      telegraphMs: 420,
      activeMs: 120,
      recoveryMs: 0,
      band: { minimumX: 0, maximumX: 152, vertical: 176 },
      slotClass: 'elite',
      pressureCost: 2,
      cameraInset: 0,
      motion: { kind: 'melee' },
    },
    {
      attackId: stableId<'attack'>('thorn-sentinel-sweep-two'),
      telegraphMs: 550,
      activeMs: 160,
      recoveryMs: 700,
      band: { minimumX: 0, maximumX: 176, vertical: 176 },
      slotClass: 'elite',
      pressureCost: 2,
      cameraInset: 0,
      motion: { kind: 'melee' },
    },
  ],
} satisfies AiProfileDefinition);
