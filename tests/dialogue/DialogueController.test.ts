import { describe, expect, it } from 'vitest';
import {
  DialogueController,
  type DialogueContext
} from '../../src/game/dialogue/DialogueController';
import { createVillageNpcs } from '../../src/game/entities/npcs/NpcController';
import type { DialogueDefinition } from '../../src/game/data/types';

const context = (update: Partial<DialogueContext> = {}): DialogueContext => ({
  questStages: {},
  questFlags: [],
  ...update
});

describe('DialogueController', () => {
  it('starts at the entry node, surfaces the quest signal, and walks to the terminal page', () => {
    const controller = new DialogueController();
    const opening = controller.start('sela-silent-bloom', context());
    expect(opening).toMatchObject({
      nodeId: 'silent-route',
      speakerName: 'Sela Quill',
      questSignal: { questId: 'silent-bloom', questStageId: 'speak-with-sela' },
      isTerminal: false
    });
    expect(opening.text).toContain('listening arch');

    const reply = controller.advance(opening, context());
    expect(reply).toMatchObject({
      nodeId: 'mara-will-listen',
      speakerName: 'Mara Vey',
      isTerminal: true
    });
    expect(controller.advance(reply!, context())).toBeUndefined();
  });

  it('filters choices by quest availability and rejects hidden or unknown choices', () => {
    const branching: DialogueDefinition = {
      id: 'test-branching',
      entryNodeId: 'fork',
      nodes: [
        {
          id: 'fork',
          speakerActorId: 'sela-quill',
          text: 'Which way?',
          choices: [
            { id: 'open-route', text: 'The open route.', nextNodeId: 'done' },
            {
              id: 'quest-route',
              text: 'The quest route.',
              nextNodeId: 'done',
              requiredQuestId: 'silent-bloom'
            }
          ]
        },
        { id: 'done', speakerActorId: 'sela-quill', text: 'Then walk it.', choices: [] }
      ]
    };
    const controller = new DialogueController([branching]);

    const hidden = controller.start('test-branching', context());
    expect(hidden.choices.map(({ id }) => id)).toEqual(['open-route']);
    expect(() => controller.advance(hidden, context(), 'quest-route')).toThrow(/not available/);
    expect(() => controller.advance(hidden, context())).toThrow(/requires a choice/);

    const revealed = controller.start(
      'test-branching',
      context({ questStages: { 'silent-bloom': 'speak-with-sela' } })
    );
    expect(revealed.choices.map(({ id }) => id)).toEqual(['open-route', 'quest-route']);
    const walked = controller.advance(
      revealed,
      context({ questStages: { 'silent-bloom': 'speak-with-sela' } }),
      'quest-route'
    );
    expect(walked?.nodeId).toBe('done');
  });

  it('throws on unknown dialogue ids instead of presenting empty pages', () => {
    expect(() => new DialogueController().start('missing-dialogue', context())).toThrow(
      /Unknown dialogue/
    );
  });
});

describe('createVillageNpcs', () => {
  it('selects stage-conditional conversations for Sela and stable ones for Orin and Piri', () => {
    const npcs = createVillageNpcs();
    const sela = npcs.find(({ actorId }) => actorId === 'sela-quill');
    const orin = npcs.find(({ actorId }) => actorId === 'orin-fen');
    const piri = npcs.find(({ actorId }) => actorId === 'piri-moss');

    expect(sela?.dialogueFor(context())).toBe('sela-silent-bloom');
    expect(
      sela?.dialogueFor(context({ questStages: { 'silent-bloom': 'wake-listening-arch' } }))
    ).toBe('sela-arch-awakened');
    expect(
      sela?.dialogueFor(context({ questStages: { 'silent-bloom': 'restore-hollow-choir' } }))
    ).toBe('sela-route-restored');
    expect(orin?.dialogueFor(context())).toBe('orin-first-reforge');
    expect(piri?.dialogueFor(context())).toBe('piri-root-memory');
  });
});
