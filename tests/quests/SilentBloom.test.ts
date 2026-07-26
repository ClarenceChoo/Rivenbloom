import { describe, expect, it } from 'vitest';
import { questId, questStageId } from '../../src/game/combat/CombatTypes';
import { questEventId } from '../../src/game/quests/QuestStore';
import {
  applyQuestTransition,
  createQuestStore,
  questTriggerEventId
} from '../../src/game/quests/QuestRuntime';
import { createDefaultSave, type SaveSlotId } from '../../src/game/saves/SaveSchema';

const slot = 'slot-1' as SaveSlotId;
const stageEvent = (stage: string) => ({
  id: questEventId(questTriggerEventId('silent-bloom', stage))
});
const completed = (quest: string, stage: string) => ({
  questId: questId(quest),
  stageId: questStageId(stage),
  status: 'completed' as const
});

describe('The Silent Bloom', () => {
  it('progresses through its three stages in order and refuses to skip ahead', () => {
    const store = createQuestStore();

    expect(store.apply(stageEvent('wake-listening-arch'))).toEqual([]);
    expect(store.apply(stageEvent('speak-with-sela'))).toMatchObject([
      { questId: 'silent-bloom', stageId: 'speak-with-sela', status: 'completed' }
    ]);
    expect(store.apply(stageEvent('restore-hollow-choir'))).toEqual([]);
    expect(store.apply(stageEvent('wake-listening-arch'))).toHaveLength(1);
    expect(store.apply(stageEvent('restore-hollow-choir'))).toHaveLength(1);
  });

  it('replays completed stages without duplicate transitions', () => {
    const store = createQuestStore();
    store.apply(stageEvent('speak-with-sela'));
    expect(store.apply(stageEvent('speak-with-sela'))).toEqual([]);
  });

  it('grants the authored abilities and items to the save exactly once', () => {
    let save = createDefaultSave(slot, 100);
    expect(save.unlockedAbilities).toEqual(['lumen-bolt']);

    save = applyQuestTransition(save, completed('silent-bloom', 'speak-with-sela'));
    expect(save.questStages['silent-bloom']).toBe('speak-with-sela');

    save = applyQuestTransition(save, completed('silent-bloom', 'wake-listening-arch'));
    expect(save.unlockedAbilities).toContain('wayfinder-dash');

    save = applyQuestTransition(save, completed('silent-bloom', 'restore-hollow-choir'));
    expect(save.unlockedAbilities).toContain('resonant-pulse');
    expect(save.inventory['cantor-sigil']).toBe(1);

    const replayed = applyQuestTransition(save, completed('silent-bloom', 'restore-hollow-choir'));
    expect(replayed.inventory['cantor-sigil']).toBe(1);
    expect(
      replayed.unlockedAbilities.filter((ability) => ability === 'resonant-pulse')
    ).toHaveLength(1);
  });

  it('keeps the optional discoveries independent of the main quest', () => {
    const store = createQuestStore();
    expect(
      store.apply({ id: questEventId(questTriggerEventId('lost-folio-quest', 'find-lost-folio')) })
    ).toMatchObject([{ questId: 'lost-folio-quest', stageId: 'find-lost-folio' }]);
    expect(
      store.apply({
        id: questEventId(
          questTriggerEventId('lanterns-for-the-absent', 'relight-memorial-lanterns')
        )
      })
    ).toMatchObject([{ questId: 'lanterns-for-the-absent' }]);

    let save = createDefaultSave(slot, 100);
    save = applyQuestTransition(save, completed('lost-folio-quest', 'find-lost-folio'));
    expect(save.inventory['quiet-step']).toBe(1);
  });
});
