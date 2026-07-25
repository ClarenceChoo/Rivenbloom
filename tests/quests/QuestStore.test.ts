import { describe, expect, it } from 'vitest';
import { QuestStore } from '../../src/game/quests/QuestStore';
import type { QuestId, QuestStageId, StableId } from '../../src/game/combat/CombatTypes';

const reliquary = 'rootglass-reliquary' as QuestId;
const enterHollows = 'entered-singing-hollows' as StableId<'quest-event'>;
const findBell = 'found-choir-bell' as StableId<'quest-event'>;
const reachHollows = 'reach-hollows' as QuestStageId;
const collectBell = 'collect-bell' as QuestStageId;

const store = () =>
  new QuestStore([
    {
      id: reliquary,
      stages: [
        { id: reachHollows, triggerEventId: enterHollows, prerequisiteStageIds: [] },
        { id: collectBell, triggerEventId: findBell, prerequisiteStageIds: [reachHollows] }
      ]
    }
  ]);

describe('QuestStore', () => {
  it('completes a stage whose matching event has no unmet prerequisites', () => {
    expect(store().apply({ id: enterHollows })).toEqual([
      { questId: reliquary, stageId: reachHollows, status: 'completed' }
    ]);
  });

  it('leaves a stage unchanged when its prerequisite is incomplete', () => {
    expect(store().apply({ id: findBell })).toEqual([]);
  });

  it('does not complete the same stage twice for a repeated event', () => {
    const quests = store();

    quests.apply({ id: enterHollows });
    expect(quests.apply({ id: enterHollows })).toEqual([]);
  });

  it('ignores an event that is not a quest-stage trigger', () => {
    expect(store().apply({ id: 'opened-supply-cache' as StableId<'quest-event'> })).toEqual([]);
  });
});
