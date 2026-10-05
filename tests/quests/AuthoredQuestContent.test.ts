import { describe, expect, it } from 'vitest';

import { questFlagId, questId, questStageId } from '../../src/game/core/StableId';
import { QUESTS } from '../../src/game/data/quests';
import { QuestStore } from '../../src/game/quests/QuestStore';

describe('authored quest progression', () => {
  it('hydrates an old empty schema-v1 snapshot with every known initial stage', () => {
    const store = QuestStore.hydrate(
      QUESTS.map(({ definition }) => definition),
      { stages: [], flags: [] },
      QUESTS.flatMap(({ declaredFacts }) => declaredFacts),
    );

    expect(store.snapshot()).toEqual({
      stages: [
        { questId: 'lanterns-for-the-absent', stageId: 'unlit' },
        { questId: 'lost-folio', stageId: 'missing' },
        { questId: 'the-silent-bloom', stageId: 'unheard' },
      ],
      flags: [],
    });
  });

  it('preserves present state and rejects unknown quests, stages, facts, and impossible stages', () => {
    const definitions = QUESTS.map(({ definition }) => definition);
    const facts = QUESTS.flatMap(({ declaredFacts }) => declaredFacts);
    const present = QuestStore.hydrate(
      definitions,
      {
        stages: [
          { questId: questId('the-silent-bloom'), stageId: questStageId('seek-briar-core') },
        ],
        flags: [
          questFlagId('listening-arch-traced'),
          questFlagId('root-memory-delivered'),
          questFlagId('silent-bloom-accepted'),
        ],
      },
      facts,
    );
    expect(present.snapshot().stages).toContainEqual({
      questId: 'the-silent-bloom',
      stageId: 'seek-briar-core',
    });

    expect(() =>
      QuestStore.hydrate(
        definitions,
        {
          stages: [{ questId: questId('unknown-quest'), stageId: questStageId('unheard') }],
          flags: [],
        },
        facts,
      ),
    ).toThrow(/unknown quest/i);
    expect(() =>
      QuestStore.hydrate(
        definitions,
        {
          stages: [
            { questId: questId('the-silent-bloom'), stageId: questStageId('unknown-stage') },
          ],
          flags: [],
        },
        facts,
      ),
    ).toThrow(/unknown stage/i);
    expect(() =>
      QuestStore.hydrate(definitions, { stages: [], flags: [questFlagId('unknown-fact')] }, facts),
    ).toThrow(/unknown fact/i);
    expect(() =>
      QuestStore.hydrate(
        definitions,
        {
          stages: [{ questId: questId('the-silent-bloom'), stageId: questStageId('complete') }],
          flags: [],
        },
        facts,
      ),
    ).toThrow(/impossible/i);
  });

  it('advances every main-quest fact through the exact stable stage contract', () => {
    const store = new QuestStore(QUESTS.map(({ definition }) => definition));
    const facts = [
      'silent-bloom-accepted',
      'listening-arch-traced',
      'root-memory-delivered',
      'briar-core-claimed',
      'surveyor-edge-reforged',
      'rootglass-reliquary-entered',
      'pallid-cantor-defeated',
      'silent-bloom-restored',
    ] as const;
    const stages = [
      'trace-listening-arch',
      'bring-root-memory-to-piri',
      'seek-briar-core',
      'ask-orin-to-reforge',
      'enter-rootglass-reliquary',
      'silence-the-cantor',
      'return-to-sela',
      'complete',
    ];

    facts.forEach((fact, index) => {
      store.apply({ factId: questFlagId(fact) });
      expect(store.snapshot().stages).toContainEqual({
        questId: 'the-silent-bloom',
        stageId: stages[index],
      });
    });
  });

  it.each([
    ['absent-lantern-trail-lit', 'absent-lantern-hollows-lit', 'absent-lantern-reliquary-lit'],
    ['absent-lantern-trail-lit', 'absent-lantern-reliquary-lit', 'absent-lantern-hollows-lit'],
    ['absent-lantern-hollows-lit', 'absent-lantern-trail-lit', 'absent-lantern-reliquary-lit'],
    ['absent-lantern-hollows-lit', 'absent-lantern-reliquary-lit', 'absent-lantern-trail-lit'],
    ['absent-lantern-reliquary-lit', 'absent-lantern-trail-lit', 'absent-lantern-hollows-lit'],
    ['absent-lantern-reliquary-lit', 'absent-lantern-hollows-lit', 'absent-lantern-trail-lit'],
  ] as const)('accepts lantern facts in order %s, %s, %s', (...order) => {
    const store = new QuestStore(QUESTS.map(({ definition }) => definition));
    order.forEach((fact) => store.apply({ factId: questFlagId(fact) }));
    expect(store.snapshot().stages).toContainEqual({
      questId: 'lanterns-for-the-absent',
      stageId: 'return-to-piri',
    });
  });
});
