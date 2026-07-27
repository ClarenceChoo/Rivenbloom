import { describe, expect, it } from 'vitest';
import { createDefaultSave, type SaveSlotId } from '../../src/game/saves/SaveSchema';
import type { PuzzleResult } from '../../src/game/world/PuzzleSystem';
import {
  advanceQuests,
  applyPuzzleResult,
  awardEnemyDefeat,
  claimDiscovery,
  discoverRoom,
  nextQuestStageId,
  recordBrokenBreakable,
  seedQuestStore
} from '../../src/game/world/WorldProgress';

const slot = 'slot-1' as SaveSlotId;
const freshSave = () => createDefaultSave(slot, 100);

const solvedResult = (overrides: Partial<Extract<PuzzleResult, { kind: 'solved' }>>) =>
  ({
    kind: 'solved',
    mechanismId: 'brackenreach-listening-arch',
    mechanismKind: 'listening-arch',
    persistentFlagId: 'listening-arch-awakened',
    firstSolve: true,
    ...overrides
  }) as PuzzleResult;

describe('WorldProgress', () => {
  it('discovers rooms and claims discoveries exactly once', () => {
    const first = discoverRoom(freshSave(), 'brackenreach-trailhead');
    expect(first.first).toBe(true);
    expect(first.save.discoveredRoomIds).toContain('brackenreach-trailhead');

    const replay = discoverRoom(first.save, 'brackenreach-trailhead');
    expect(replay.first).toBe(false);
    expect(replay.save.discoveredRoomIds).toHaveLength(1);

    const claimed = claimDiscovery(first.save, 'lost-folio-cache');
    expect(claimed.first).toBe(true);
    expect(claimDiscovery(claimed.save, 'lost-folio-cache').first).toBe(false);
  });

  it('awards authored XP and banks rolled drops on defeat', () => {
    const award = awardEnemyDefeat(freshSave(), 'briar-scrapper', [
      { itemId: 'briar-core', quantity: 1 }
    ]);
    expect(award.xpAwarded).toBe(14);
    expect(award.save.player.xp).toBe(14);
    expect(award.save.inventory['briar-core']).toBe(1);

    const again = awardEnemyDefeat(award.save, 'briar-scrapper', []);
    expect(again.save.player.xp).toBe(28);

    expect(awardEnemyDefeat(freshSave(), 'unknown-actor', []).xpAwarded).toBe(0);
  });

  it('persists broken breakables through the solved-puzzle set once', () => {
    const broken = recordBrokenBreakable(freshSave(), 'hollows-hidden-wall-broken');
    expect(broken.first).toBe(true);
    expect(broken.save.solvedPuzzleIds).toContain('hollows-hidden-wall-broken');
    expect(recordBrokenBreakable(broken.save, 'hollows-hidden-wall-broken').first).toBe(false);
  });

  it('routes solved shortcuts and puzzles to their persistent sets', () => {
    const shortcut = applyPuzzleResult(
      freshSave(),
      solvedResult({ mechanismKind: 'shortcut', persistentFlagId: 'verge-shortcut-open' })
    );
    expect(shortcut.save.activatedShortcutIds).toContain('verge-shortcut-open');
    expect(shortcut.save.solvedPuzzleIds).toHaveLength(0);

    const lens = applyPuzzleResult(
      freshSave(),
      solvedResult({ mechanismKind: 'lens', persistentFlagId: 'gallery-lens-awake' })
    );
    expect(lens.save.solvedPuzzleIds).toContain('gallery-lens-awake');
  });

  it('grants puzzle rewards and quest signals only on the first solve', () => {
    const first = applyPuzzleResult(
      freshSave(),
      solvedResult({ rewardItemId: 'briar-core', questId: 'silent-bloom' })
    );
    expect(first.save.inventory['briar-core']).toBe(1);
    expect(first.questSignal).toEqual({ questId: 'silent-bloom' });

    const replay = applyPuzzleResult(
      first.save,
      solvedResult({ rewardItemId: 'briar-core', questId: 'silent-bloom', firstSolve: false })
    );
    expect(replay.first).toBe(false);
    expect(replay.save.inventory['briar-core']).toBe(1);
    expect(replay.questSignal).toBeUndefined();

    const rejected = applyPuzzleResult(freshSave(), {
      kind: 'rejected',
      reason: 'missing-ability'
    });
    expect(rejected.first).toBe(false);
    expect(rejected.save.solvedPuzzleIds).toHaveLength(0);
  });

  it('resolves the next incomplete quest stage from the save', () => {
    const save = freshSave();
    expect(nextQuestStageId(save, 'silent-bloom')).toBe('speak-with-sela');

    const started = { ...save, questStages: { 'silent-bloom': 'speak-with-sela' } };
    expect(nextQuestStageId(started, 'silent-bloom')).toBe('wake-listening-arch');

    const finished = { ...save, questStages: { 'silent-bloom': 'restore-hollow-choir' } };
    expect(nextQuestStageId(finished, 'silent-bloom')).toBeUndefined();
    expect(nextQuestStageId(save, 'unknown-quest')).toBeUndefined();
  });

  it('seeds the quest store so persisted progress gates later stages', () => {
    const save = { ...freshSave(), questStages: { 'silent-bloom': 'speak-with-sela' } };
    const store = seedQuestStore(save);

    const advance = advanceQuests(store, save, [{ questId: 'silent-bloom' }]);
    expect(advance.transitions).toMatchObject([
      { questId: 'silent-bloom', stageId: 'wake-listening-arch' }
    ]);
    expect(advance.save.unlockedAbilities).toContain('wayfinder-dash');
    expect(advance.save.questStages['silent-bloom']).toBe('wake-listening-arch');
  });

  it('refuses to skip ahead when a signal names a later stage', () => {
    const save = freshSave();
    const store = seedQuestStore(save);
    const skipped = advanceQuests(store, save, [
      { questId: 'silent-bloom', questStageId: 'restore-hollow-choir' }
    ]);
    expect(skipped.transitions).toEqual([]);
    expect(skipped.save).toEqual(save);
  });

  it('advances stageless signals one stage at a time without duplicates', () => {
    const save = freshSave();
    const store = seedQuestStore(save);
    const first = advanceQuests(store, save, [
      { questId: 'silent-bloom' },
      { questId: 'silent-bloom' }
    ]);
    expect(first.transitions).toMatchObject([
      { questId: 'silent-bloom', stageId: 'speak-with-sela' },
      { questId: 'silent-bloom', stageId: 'wake-listening-arch' }
    ]);
  });
});
