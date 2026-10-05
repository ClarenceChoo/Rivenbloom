import { describe, expect, it } from 'vitest';

import { questFlagId, questId, questStageId, stableId } from '../../src/game/core/StableId';
import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { prepareBossDefeat } from '../../src/game/saves/BossPersistence';
import { createNewSave, validateSaveV1 } from '../../src/game/saves/SaveSchema';
import type { SaveV1 } from '../../src/game/saves/SaveSchema';

function saveAtCantor(): SaveV1 {
  const { newGame } = CONTENT_REGISTRY;
  const created = createNewSave({
    nowEpochMs: 100,
    location: {
      regionId: newGame.initialRegionId,
      areaId: newGame.initialAreaId,
      checkpointId: newGame.initialCheckpointId,
      safePosition: { x: 256, y: 608 },
    },
    baseStats: newGame.baseStats,
    initialQuests: newGame.initialQuests,
    startingAbilities: newGame.startingAbilities,
  });
  return {
    ...created,
    metadata: { ...created.metadata, snapshotAtEpochMs: 200, playTimeMs: 2_000 },
    location: {
      regionId: stableId<'region'>('brackenreach'),
      areaId: stableId<'area'>('hollow-choir'),
      checkpointId: stableId<'checkpoint'>('choir-threshold-lantern'),
      safePosition: { x: 256, y: 900 },
    },
    player: { ...created.player, currentHealth: 90, currentMana: 30, currency: 17 },
    quests: {
      stages: created.quests.stages.map((entry) =>
        entry.questId === 'the-silent-bloom'
          ? { questId: questId('the-silent-bloom'), stageId: questStageId('silence-the-cantor') }
          : entry,
      ),
      flags: [
        'briar-core-claimed',
        'listening-arch-traced',
        'root-memory-delivered',
        'rootglass-reliquary-entered',
        'silent-bloom-accepted',
        'surveyor-edge-reforged',
      ].map(questFlagId),
    },
  };
}

describe('prepareBossDefeat', () => {
  it('prepares the exact durable reward against live vitals and the threshold checkpoint', () => {
    const before = saveAtCantor();
    const result = prepareBossDefeat(before, {
      vitals: { currentHealth: 23, currentMana: 11 },
      stamp: { snapshotAtEpochMs: 300, playTimeMs: 2_750 },
    });

    expect(result.kind).toBe('prepared');
    if (result.kind !== 'prepared') return;
    expect(result.commands).toEqual([
      { kind: 'defeat-boss', bossId: 'pallid-cantor' },
      { kind: 'grant-item', itemId: 'cantor-sigil', quantity: 1 },
      { kind: 'set-fact', factId: 'pallid-cantor-defeated' },
    ]);
    expect(result.save.worldProgress.defeatedBosses).toContain('pallid-cantor');
    expect(result.save.inventory.filter(({ itemId }) => itemId === 'cantor-sigil')).toEqual([
      { itemId: 'cantor-sigil', quantity: 1 },
    ]);
    expect(result.save.quests.stages).toContainEqual({
      questId: 'the-silent-bloom',
      stageId: 'return-to-sela',
    });
    expect(result.save.quests.flags).toContain('pallid-cantor-defeated');
    expect(result.save.quests.flags).not.toContain('silent-bloom-restored');
    expect(result.save.player).toMatchObject({ currentHealth: 23, currentMana: 11, currency: 17 });
    expect(result.save.location).toEqual({
      regionId: 'brackenreach',
      areaId: 'hollow-choir',
      checkpointId: 'choir-threshold-lantern',
      safePosition: { x: 256, y: 900 },
    });
    expect(result.save.metadata).toMatchObject({ snapshotAtEpochMs: 300, playTimeMs: 2_750 });
    expect(validateSaveV1(result.save).kind).toBe('valid');
    expect(Object.isFrozen(result.save)).toBe(true);
  });

  it('returns already-complete without duplicating the sigil or progression events', () => {
    const first = prepareBossDefeat(saveAtCantor(), {
      vitals: { currentHealth: 23, currentMana: 11 },
      stamp: { snapshotAtEpochMs: 300, playTimeMs: 2_750 },
    });
    expect(first.kind).toBe('prepared');
    if (first.kind !== 'prepared') return;

    const repeated = prepareBossDefeat(first.save, {
      vitals: { currentHealth: 20, currentMana: 8 },
      stamp: { snapshotAtEpochMs: 400, playTimeMs: 3_000 },
    });
    expect(repeated).toEqual({ kind: 'already-complete', save: first.save, events: [] });
  });

  it('rejects regressing stamps without mutating the source save', () => {
    const before = saveAtCantor();
    expect(
      prepareBossDefeat(before, {
        vitals: { currentHealth: 23, currentMana: 11 },
        stamp: { snapshotAtEpochMs: 199, playTimeMs: 2_750 },
      }),
    ).toMatchObject({ kind: 'rejected', reason: 'invalid-stamp', save: before });
  });
});
