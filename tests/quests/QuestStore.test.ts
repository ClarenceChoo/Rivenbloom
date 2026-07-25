import { describe, expect, it } from 'vitest';
import { QuestStore, questEventId } from '../../src/game/quests/QuestStore';
import { questId, questStageId } from '../../src/game/combat/CombatTypes';

const reliquary = questId('rootglass-reliquary');
const enterHollows = questEventId('entered-singing-hollows');
const findBell = questEventId('found-choir-bell');
const reachHollows = questStageId('reach-hollows');
const collectBell = questStageId('collect-bell');

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
    expect(store().apply({ id: questEventId('opened-supply-cache') })).toEqual([]);
  });

  it('rejects malformed quest event IDs', () => {
    expect(() => questEventId('Opened Supply Cache')).toThrow('lowercase-kebab-case');
  });

  it('keeps equal local stage IDs independent between quests', () => {
    const bloom = questId('bloom-quest');
    const ash = questId('ash-quest');
    const localStage = questStageId('gather-token');
    const bloomEvent = questEventId('bloom-token-found');
    const ashEvent = questEventId('ash-token-found');
    const quests = new QuestStore([
      {
        id: bloom,
        stages: [{ id: localStage, triggerEventId: bloomEvent, prerequisiteStageIds: [] }]
      },
      { id: ash, stages: [{ id: localStage, triggerEventId: ashEvent, prerequisiteStageIds: [] }] }
    ]);

    quests.apply({ id: bloomEvent });
    expect(quests.apply({ id: ashEvent })).toEqual([
      { questId: ash, stageId: localStage, status: 'completed' }
    ]);
  });

  it('rejects duplicate stage IDs within one quest definition', () => {
    expect(
      () =>
        new QuestStore([
          {
            id: reliquary,
            stages: [
              { id: reachHollows, triggerEventId: enterHollows, prerequisiteStageIds: [] },
              { id: reachHollows, triggerEventId: findBell, prerequisiteStageIds: [] }
            ]
          }
        ])
    ).toThrow('duplicate stage ID');
  });

  it('rejects a prerequisite that is not a stage in the same quest', () => {
    expect(
      () =>
        new QuestStore([
          {
            id: reliquary,
            stages: [
              {
                id: collectBell,
                triggerEventId: findBell,
                prerequisiteStageIds: [questStageId('missing-stage')]
              }
            ]
          }
        ])
    ).toThrow('dangling prerequisite');
  });
});
