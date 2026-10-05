import { describe, expect, it } from 'vitest';

import { stableId } from '../../src/game/core/StableId';
import { DIALOGUE } from '../../src/game/data/dialogue';
import { DialogueController } from '../../src/game/dialogue/DialogueController';
import type { DialogueDefinition } from '../../src/game/data/types';
import { QUESTS } from '../../src/game/data/quests';
import { QuestStore } from '../../src/game/quests/QuestStore';

const emptyQuests = { stages: [], flags: [] } as const;

describe('DialogueController', () => {
  it('selects mutually exclusive before/after-boss entries and returns immutable commands', () => {
    const controller = new DialogueController(DIALOGUE);
    const before = controller.start(stableId<'dialogue'>('sela-village'), {
      quests: emptyQuests,
      defeatedBosses: [],
    });
    expect(before.kind).toBe('started');
    if (before.kind !== 'started') return;
    expect(before.page.text).toContain('root-song');
    const choice = before.page.choices[0]!;
    const chosen = controller.choose(choice.choiceId);
    expect(chosen.kind).toBe('closed');
    if (chosen.kind === 'rejected') return;
    expect(chosen.effects).toContainEqual({ kind: 'set-fact', factId: 'silent-bloom-accepted' });
    expect(Object.isFrozen(chosen.effects)).toBe(true);

    const after = controller.start(stableId<'dialogue'>('sela-village'), {
      quests: emptyQuests,
      defeatedBosses: [stableId<'boss'>('pallid-cantor')],
    });
    expect(after.kind === 'started' ? after.page.text : '').toContain('bloom');
  });

  it('rejects invalid choices, closes and disposes idempotently', () => {
    const controller = new DialogueController(DIALOGUE);
    controller.start(stableId<'dialogue'>('orin-village'), {
      quests: emptyQuests,
      defeatedBosses: [],
    });
    expect(controller.choose(stableId<'dialogue-choice'>('missing-choice'))).toMatchObject({
      kind: 'rejected',
      reason: 'invalid-choice',
    });
    expect(controller.close()).toBe(true);
    expect(controller.close()).toBe(false);
    expect(controller.dispose()).toBe(true);
    expect(controller.dispose()).toBe(false);
  });

  it('reopens Sela on a distinct accepted-quest follow-up with no replay effect', () => {
    const quests = new QuestStore(QUESTS.map(({ definition }) => definition));
    const controller = new DialogueController(DIALOGUE);
    const first = controller.start(stableId<'dialogue'>('sela-village'), {
      quests: quests.snapshot(),
      defeatedBosses: [],
    });
    expect(first.kind).toBe('started');
    if (first.kind !== 'started') return;
    const accepted = controller.choose(first.page.choices[0]!.choiceId);
    expect(accepted.kind).toBe('closed');
    if (accepted.kind === 'rejected') return;
    expect(accepted.effects).toHaveLength(1);
    expect(quests.apply({ factId: stableId<'quest-flag'>('silent-bloom-accepted') })).toHaveLength(
      1,
    );

    const reopened = controller.start(stableId<'dialogue'>('sela-village'), {
      quests: quests.snapshot(),
      defeatedBosses: [],
    });
    expect(reopened.kind).toBe('started');
    if (reopened.kind !== 'started') return;
    expect(reopened.page.nodeId).toBe('sela-silent-bloom-accepted');
    expect(reopened.page.text).not.toBe(first.page.text);
    const followUp = controller.choose(reopened.page.choices[0]!.choiceId);
    expect(followUp.kind).toBe('closed');
    if (followUp.kind === 'rejected') return;
    expect(followUp.effects).toEqual([]);
    expect(quests.apply({ factId: stableId<'quest-flag'>('silent-bloom-accepted') })).toEqual([]);
  });

  it('rejects missing nodes, ambiguous entries, and a cycle with no exit', () => {
    const base = DIALOGUE[0]!;
    expect(
      () =>
        new DialogueController([{ ...base, entryNodeId: stableId<'dialogue-node'>('missing') }]),
    ).toThrow(/entry/i);

    const ambiguous = {
      ...base,
      dialogueId: stableId<'dialogue'>('ambiguous-dialogue'),
      entryNodeIds: [base.nodes[0]!.nodeId, base.nodes[1]!.nodeId],
      nodes: base.nodes.map((node) => ({ ...node, condition: undefined })),
    } satisfies DialogueDefinition;
    expect(() => new DialogueController([ambiguous])).toThrow(/ambiguous/i);

    const cyclic: DialogueDefinition = {
      dialogueId: stableId<'dialogue'>('cyclic-dialogue'),
      entryNodeId: stableId<'dialogue-node'>('cycle-a'),
      nodes: [node('cycle-a', 'to-b', 'cycle-b'), node('cycle-b', 'to-a', 'cycle-a')],
    };
    expect(() => new DialogueController([cyclic])).toThrow(/cycle.*exit/i);
  });

  it('rejects a structurally exiting cycle whose exit is unavailable in an eligible context', () => {
    const trapped: DialogueDefinition = {
      dialogueId: stableId<'dialogue'>('trapped-dialogue'),
      entryNodeId: stableId<'dialogue-node'>('trapped-a'),
      nodes: [
        node('trapped-a', 'trapped-to-b', 'trapped-b'),
        {
          ...node('trapped-b', 'trapped-to-a', 'trapped-a'),
          choices: [
            node('trapped-b', 'trapped-to-a', 'trapped-a').choices[0]!,
            {
              choiceId: stableId<'dialogue-choice'>('trapped-exit'),
              text: 'Exit.',
              targetNodeId: null,
              effects: [],
              condition: { requiresFacts: [stableId<'quest-flag'>('gate-open')] },
            },
          ],
        },
      ],
    };
    expect(() => new DialogueController([trapped])).toThrow(/context.*exit|exit.*context/i);
  });
});

function node(id: string, choice: string, target: string): DialogueDefinition['nodes'][number] {
  return {
    nodeId: stableId<'dialogue-node'>(id),
    speakerActorId: stableId<'actor'>('sela-quill'),
    text: 'A test line.',
    requiresAll: [],
    choices: [
      {
        choiceId: stableId<'dialogue-choice'>(choice),
        text: 'Continue.',
        targetNodeId: stableId<'dialogue-node'>(target),
        effects: [],
      },
    ],
  };
}
