import { stableId } from '../core/StableId';
import { deepFreeze } from '../data/immutability';
import { prepareBossDefeat } from '../saves/BossPersistence';
import { validateSaveV1 } from '../saves/SaveSchema';
import type { SaveV1 } from '../saves/SaveSchema';

export function debugPallidCantorSave(source: SaveV1): SaveV1 {
  const candidate: SaveV1 = {
    ...source,
    location: {
      regionId: stableId<'region'>('brackenreach'),
      areaId: stableId<'area'>('hollow-choir'),
      checkpointId: stableId<'checkpoint'>('choir-threshold-lantern'),
      safePosition: { x: 256, y: 900 },
    },
    player: {
      ...source.player,
      baseStats: {
        ...source.player.baseStats,
        maxHealth: 1_000,
        maxMana: 96,
        attackPower: 120,
      },
      currentHealth: 1_000,
      currentMana: 96,
      weaponLevel: 1,
      unlockedAbilities: [
        stableId<'ability'>('aegis-veil'),
        stableId<'ability'>('lumen-bolt'),
        stableId<'ability'>('resonant-pulse'),
        stableId<'ability'>('wayfinder-dash'),
      ],
    },
    quests: {
      stages: source.quests.stages.map((entry) =>
        entry.questId === 'the-silent-bloom'
          ? {
              questId: stableId<'quest'>('the-silent-bloom'),
              stageId: stableId<'quest-stage'>('silence-the-cantor'),
            }
          : entry,
      ),
      flags: [
        'briar-core-claimed',
        'listening-arch-traced',
        'root-memory-delivered',
        'rootglass-reliquary-entered',
        'silent-bloom-accepted',
        'surveyor-edge-reforged',
      ].map((value) => stableId<'quest-flag'>(value)),
    },
  };
  const validated = validateSaveV1(candidate);
  if (validated.kind === 'invalid')
    throw new RangeError('The Pallid Cantor debug save is invalid.');
  return deepFreeze(validated.value);
}

export function debugSilentBloomEndingSave(source: SaveV1): SaveV1 {
  const preparedForBoss = debugPallidCantorSave(source);
  const defeated = prepareBossDefeat(preparedForBoss, {
    vitals: {
      currentHealth: preparedForBoss.player.currentHealth,
      currentMana: preparedForBoss.player.currentMana,
    },
    stamp: {
      snapshotAtEpochMs: preparedForBoss.metadata.snapshotAtEpochMs,
      playTimeMs: preparedForBoss.metadata.playTimeMs,
    },
  });
  if (defeated.kind !== 'prepared') {
    throw new RangeError('The Silent Bloom ending fixture could not defeat the Cantor.');
  }
  const candidate: SaveV1 = {
    ...defeated.save,
    location: {
      regionId: stableId<'region'>('brackenreach'),
      areaId: stableId<'area'>('wren-rest'),
      checkpointId: stableId<'checkpoint'>('village-well'),
      safePosition: { x: 256, y: 608 },
    },
  };
  const validated = validateSaveV1(candidate);
  if (validated.kind === 'invalid') {
    throw new RangeError('The Silent Bloom ending fixture is invalid.');
  }
  return deepFreeze(validated.value);
}
