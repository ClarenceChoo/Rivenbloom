import { describe, expect, it } from 'vitest';

import { questFlagId, questId, questStageId } from '../../src/game/core/StableId';
import { QuestStore } from '../../src/game/quests/QuestStore';
import type { QuestDefinition } from '../../src/game/quests/QuestStore';

const findKey = questFlagId('find-key');
const openGate = questFlagId('open-gate');
const amberQuest = questId('amber-quest');
const zedQuest = questId('zed-quest');
const start = questStageId('start');
const middle = questStageId('middle');
const complete = questStageId('complete');
const alternate = questStageId('alternate');

function definition(
  questIdValue: typeof amberQuest | typeof zedQuest,
  stages: QuestDefinition['stages'],
  initialStageId = start,
): QuestDefinition {
  return { questId: questIdValue, initialStageId, stages };
}

describe('QuestStore', () => {
  it('waits for every prerequisite fact before advancing a quest', () => {
    const store = new QuestStore([
      definition(amberQuest, [
        {
          stageId: start,
          transitions: [{ toStageId: complete, requiresAll: [findKey, openGate] }],
        },
        { stageId: complete, transitions: [] },
      ]),
    ]);

    expect(store.apply({ factId: findKey })).toEqual([]);
    expect(store.snapshot()).toEqual({
      stages: [{ questId: amberQuest, stageId: start }],
      flags: [findKey],
    });
    expect(store.apply({ factId: openGate })).toEqual([
      {
        questId: amberQuest,
        fromStageId: start,
        toStageId: complete,
        causingFactId: openGate,
      },
    ]);
  });

  it('treats a duplicate fact as idempotent without reevaluating quest transitions', () => {
    const store = new QuestStore([
      definition(amberQuest, [
        { stageId: start, transitions: [{ toStageId: complete, requiresAll: [findKey] }] },
        { stageId: complete, transitions: [] },
      ]),
    ]);

    expect(store.apply({ factId: findKey })).toHaveLength(1);
    expect(store.apply({ factId: findKey })).toEqual([]);
    expect(store.snapshot().stages).toEqual([{ questId: amberQuest, stageId: complete }]);
  });

  it('advances every newly eligible quest in stable quest-ID order', () => {
    const simpleStages = [
      { stageId: start, transitions: [{ toStageId: complete, requiresAll: [findKey] }] },
      { stageId: complete, transitions: [] },
    ] as const;
    const store = new QuestStore([
      definition(zedQuest, simpleStages),
      definition(amberQuest, simpleStages),
    ]);

    expect(store.apply({ factId: findKey })).toEqual([
      {
        questId: amberQuest,
        fromStageId: start,
        toStageId: complete,
        causingFactId: findKey,
      },
      {
        questId: zedQuest,
        fromStageId: start,
        toStageId: complete,
        causingFactId: findKey,
      },
    ]);
  });

  it('advances a quest to a fixed point when one fact satisfies a stage chain', () => {
    const store = new QuestStore([
      definition(amberQuest, [
        { stageId: start, transitions: [{ toStageId: middle, requiresAll: [findKey] }] },
        { stageId: middle, transitions: [{ toStageId: complete, requiresAll: [findKey] }] },
        { stageId: complete, transitions: [] },
      ]),
    ]);

    expect(store.apply({ factId: findKey })).toEqual([
      {
        questId: amberQuest,
        fromStageId: start,
        toStageId: middle,
        causingFactId: findKey,
      },
      {
        questId: amberQuest,
        fromStageId: middle,
        toStageId: complete,
        causingFactId: findKey,
      },
    ]);
  });

  it('advances the only eligible branch even when it is not the first authored transition', () => {
    const store = new QuestStore([
      definition(amberQuest, [
        {
          stageId: start,
          transitions: [
            { toStageId: middle, requiresAll: [findKey] },
            { toStageId: complete, requiresAll: [openGate] },
          ],
        },
        { stageId: middle, transitions: [] },
        { stageId: complete, transitions: [] },
      ]),
    ]);

    expect(store.apply({ factId: openGate })).toEqual([
      {
        questId: amberQuest,
        fromStageId: start,
        toStageId: complete,
        causingFactId: openGate,
      },
    ]);
  });

  it('rejects simultaneous eligible branches without partially changing quest state', () => {
    const store = new QuestStore([
      definition(amberQuest, [
        { stageId: start, transitions: [{ toStageId: middle, requiresAll: [openGate] }] },
        {
          stageId: middle,
          transitions: [
            { toStageId: complete, requiresAll: [findKey] },
            { toStageId: alternate, requiresAll: [findKey, openGate] },
          ],
        },
        { stageId: complete, transitions: [] },
        { stageId: alternate, transitions: [] },
      ]),
    ]);

    expect(store.apply({ factId: openGate })).toEqual([
      {
        questId: amberQuest,
        fromStageId: start,
        toStageId: middle,
        causingFactId: openGate,
      },
    ]);
    expect(() => store.apply({ factId: findKey })).toThrow(RangeError);
    expect(store.snapshot()).toEqual({
      stages: [{ questId: amberQuest, stageId: middle }],
      flags: [openGate],
    });
  });

  it('rejects cyclic quest stage graphs as a definition error', () => {
    expect(
      () =>
        new QuestStore([
          definition(amberQuest, [
            { stageId: start, transitions: [{ toStageId: middle, requiresAll: [findKey] }] },
            { stageId: middle, transitions: [{ toStageId: start, requiresAll: [openGate] }] },
          ]),
        ]),
    ).toThrow(RangeError);
  });
});
