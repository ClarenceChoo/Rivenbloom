import { stableId } from '../core/StableId';
import { deepFreeze } from '../data/immutability';
import type { ActorSpawnDefinition } from '../data/types';
import type { RoomId } from '../saves/SaveSchema';
import { validateSaveV1 } from '../saves/SaveSchema';
import type { SaveV1 } from '../saves/SaveSchema';

export type DebugEncounterId = 'briar' | 'mixed' | 'sentinel';

export function debugSentinelSave(source: SaveV1): SaveV1 {
  const validated = validateSaveV1({
    ...source,
    player: {
      ...source.player,
      baseStats: { ...source.player.baseStats, maxHealth: 500 },
      currentHealth: 500,
    },
  });
  if (validated.kind === 'invalid')
    throw new RangeError('The Thorn Sentinel debug save is invalid.');
  return deepFreeze(validated.value);
}

export function debugEncounterSpawns(
  value: string,
  roomId: RoomId,
): readonly ActorSpawnDefinition[] | null {
  if (value === 'briar') {
    return deepFreeze([
      spawn('dev-briar-solo', 'briar-scrapper', roomId, 360, 'dev-briar-encounter'),
    ]);
  }
  if (value === 'mixed') {
    return deepFreeze([
      spawn('dev-mixed-briar', 'briar-scrapper', roomId, 360, 'dev-mixed-encounter'),
      spawn('dev-mixed-scribe', 'spore-scribe', roomId, 500, 'dev-mixed-encounter'),
      spawn('dev-mixed-offscreen', 'briar-scrapper', roomId, 1_800, 'dev-mixed-encounter'),
    ]);
  }
  if (value === 'sentinel') {
    return deepFreeze([
      spawn('verge-thorn-sentinel', 'thorn-sentinel', roomId, 600, 'dev-sentinel-encounter'),
    ]);
  }
  return null;
}

function spawn(
  spawnId: string,
  actorId: string,
  roomId: RoomId,
  x: number,
  encounterId: string,
): ActorSpawnDefinition {
  return {
    spawnId: stableId<'actor-spawn'>(spawnId),
    actorId: stableId<'actor'>(actorId),
    roomId,
    position: { x, y: 608 },
    facing: 'left',
    encounterId: stableId<'encounter'>(encounterId),
  };
}
