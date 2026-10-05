import { questFlagId, stableId } from '../core/StableId';
import { deepFreeze } from './immutability';
import type { DialogueCondition, DialogueDefinition } from './types';

const defeatedCantor: DialogueCondition = {
  requiresDefeatedBosses: [stableId<'boss'>('pallid-cantor')],
};
const beforeCantor: DialogueCondition = {
  excludesDefeatedBosses: [stableId<'boss'>('pallid-cantor')],
};

const authoredDialogue = [
  selaDialogue(),
  villageDialogue(
    'orin-village',
    'orin-fen',
    'orin-before-cantor',
    'Bring me a briar core and fifty Resin. I can teach that Surveyor Edge to bite roots.',
    'orin-after-cantor',
    'That edge carries a cleaner note now. You brought it home without letting it rule your hand.',
    [],
  ),
  {
    dialogueId: stableId<'dialogue'>('piri-village'),
    entryNodeId: stableId<'dialogue-node'>('piri-before-cantor'),
    entryNodeIds: [
      stableId<'dialogue-node'>('piri-root-memory'),
      stableId<'dialogue-node'>('piri-awaiting-root-memory'),
      stableId<'dialogue-node'>('piri-lantern-return'),
      stableId<'dialogue-node'>('piri-root-memory-delivered'),
      stableId<'dialogue-node'>('piri-after-cantor'),
      stableId<'dialogue-node'>('piri-before-cantor'),
    ],
    nodes: [
      simpleNode(
        'piri-root-memory',
        'piri-moss',
        'This root remembers rain from before the Hollows had a name. Let me steep its memory gently.',
        {
          ...beforeCantor,
          requiresFacts: [questFlagId('root-memory-recovered')],
          excludesFacts: [questFlagId('root-memory-delivered')],
          questStages: [
            {
              questId: stableId<'quest'>('the-silent-bloom'),
              stageIds: [stableId<'quest-stage'>('bring-root-memory-to-piri')],
            },
          ],
        },
        [{ kind: 'set-fact', factId: questFlagId('root-memory-delivered') }],
        'aegis-veil',
        'Let its memory teach me.',
      ),
      simpleNode(
        'piri-awaiting-root-memory',
        'piri-moss',
        'The root-memory will feel cool even in sunlight. Bring it when the Listening Arch yields.',
        {
          ...beforeCantor,
          excludesFacts: [
            questFlagId('root-memory-recovered'),
            questFlagId('root-memory-delivered'),
          ],
          questStages: [
            {
              questId: stableId<'quest'>('the-silent-bloom'),
              stageIds: [stableId<'quest-stage'>('bring-root-memory-to-piri')],
            },
          ],
        },
      ),
      simpleNode(
        'piri-lantern-return',
        'piri-moss',
        'Three lanterns burn through the quiet. The absent heard you, and so did the living.',
        {
          questStages: [
            {
              questId: stableId<'quest'>('lanterns-for-the-absent'),
              stageIds: [stableId<'quest-stage'>('return-to-piri')],
            },
          ],
          excludesQuestStages: [
            {
              questId: stableId<'quest'>('the-silent-bloom'),
              stageIds: [stableId<'quest-stage'>('bring-root-memory-to-piri')],
            },
          ],
        },
        [],
        'lanterns-for-the-absent',
        'Their light belongs with you.',
      ),
      simpleNode(
        'piri-root-memory-delivered',
        'piri-moss',
        'The memory rests safely in the kettle now. Its rain-song will keep until you need it.',
        {
          ...beforeCantor,
          requiresFacts: [questFlagId('root-memory-delivered')],
          excludesQuestStages: [
            {
              questId: stableId<'quest'>('lanterns-for-the-absent'),
              stageIds: [stableId<'quest-stage'>('return-to-piri')],
            },
          ],
        },
      ),
      simpleNode(
        'piri-after-cantor',
        'piri-moss',
        'The quiet has changed. It is the listening kind now, with room for every living root.',
        {
          ...defeatedCantor,
          excludesQuestStages: [
            {
              questId: stableId<'quest'>('the-silent-bloom'),
              stageIds: [stableId<'quest-stage'>('bring-root-memory-to-piri')],
            },
            {
              questId: stableId<'quest'>('lanterns-for-the-absent'),
              stageIds: [stableId<'quest-stage'>('return-to-piri')],
            },
          ],
        },
      ),
      simpleNode(
        'piri-before-cantor',
        'piri-moss',
        'Plants listen longer than people. If the roots answer you, bring their memory here.',
        {
          ...beforeCantor,
          excludesFacts: [questFlagId('root-memory-delivered')],
          excludesQuestStages: [
            {
              questId: stableId<'quest'>('the-silent-bloom'),
              stageIds: [stableId<'quest-stage'>('bring-root-memory-to-piri')],
            },
            {
              questId: stableId<'quest'>('lanterns-for-the-absent'),
              stageIds: [stableId<'quest-stage'>('return-to-piri')],
            },
          ],
        },
      ),
    ],
  },
] satisfies readonly DialogueDefinition[];

export const DIALOGUE: readonly DialogueDefinition[] = deepFreeze(authoredDialogue);

function selaDialogue(): DialogueDefinition {
  const acceptedFact = questFlagId('silent-bloom-accepted');
  return {
    dialogueId: stableId<'dialogue'>('sela-village'),
    entryNodeId: stableId<'dialogue-node'>('sela-before-cantor'),
    entryNodeIds: [
      stableId<'dialogue-node'>('sela-silent-bloom-return'),
      stableId<'dialogue-node'>('sela-lost-folio-return'),
      stableId<'dialogue-node'>('sela-silent-bloom-complete'),
      stableId<'dialogue-node'>('sela-after-cantor'),
      stableId<'dialogue-node'>('sela-silent-bloom-accepted'),
      stableId<'dialogue-node'>('sela-before-cantor'),
    ],
    nodes: [
      simpleNode(
        'sela-silent-bloom-return',
        'sela-quill',
        'The Cantor is silent, and the root-song carries again. Let us mark the bloom’s return together.',
        {
          ...defeatedCantor,
          excludesFacts: [questFlagId('silent-bloom-restored')],
          questStages: [
            {
              questId: stableId<'quest'>('the-silent-bloom'),
              stageIds: [stableId<'quest-stage'>('return-to-sela')],
            },
          ],
        },
        [{ kind: 'set-fact', factId: questFlagId('silent-bloom-restored') }],
        null,
        'Mark the song returned.',
      ),
      simpleNode(
        'sela-lost-folio-return',
        'sela-quill',
        'Those are my missing pages. Even the rain-marks are still legible.',
        {
          questStages: [
            {
              questId: stableId<'quest'>('lost-folio'),
              stageIds: [stableId<'quest-stage'>('return-to-sela')],
            },
          ],
          excludesQuestStages: [
            {
              questId: stableId<'quest'>('the-silent-bloom'),
              stageIds: [stableId<'quest-stage'>('return-to-sela')],
            },
          ],
        },
        [],
        'lost-folio',
        'The folio is yours.',
      ),
      simpleNode(
        'sela-silent-bloom-complete',
        'sela-quill',
        'The bloom is open again. Even the oldest roads have begun to remember their names.',
        {
          ...defeatedCantor,
          requiresFacts: [questFlagId('silent-bloom-restored')],
          questStages: [
            {
              questId: stableId<'quest'>('the-silent-bloom'),
              stageIds: [stableId<'quest-stage'>('complete')],
            },
          ],
          excludesQuestStages: [
            {
              questId: stableId<'quest'>('lost-folio'),
              stageIds: [stableId<'quest-stage'>('return-to-sela')],
            },
          ],
        },
      ),
      simpleNode(
        'sela-after-cantor',
        'sela-quill',
        'The Cantor is silent. The bloom is waiting for the road home.',
        {
          ...defeatedCantor,
          excludesFacts: [questFlagId('silent-bloom-restored')],
          excludesQuestStages: [
            {
              questId: stableId<'quest'>('the-silent-bloom'),
              stageIds: [
                stableId<'quest-stage'>('return-to-sela'),
                stableId<'quest-stage'>('complete'),
              ],
            },
            {
              questId: stableId<'quest'>('lost-folio'),
              stageIds: [stableId<'quest-stage'>('return-to-sela')],
            },
          ],
        },
      ),
      simpleNode(
        'sela-silent-bloom-accepted',
        'sela-quill',
        'The Listening Arch lies east of the old briar mile. Trust the root-song when the ink fails.',
        {
          ...beforeCantor,
          requiresFacts: [acceptedFact],
          questStages: [
            {
              questId: stableId<'quest'>('the-silent-bloom'),
              stageIds: [
                'trace-listening-arch',
                'bring-root-memory-to-piri',
                'seek-briar-core',
                'ask-orin-to-reforge',
                'enter-rootglass-reliquary',
                'silence-the-cantor',
              ].map((stageId) => stableId<'quest-stage'>(stageId)),
            },
          ],
          excludesQuestStages: [
            {
              questId: stableId<'quest'>('lost-folio'),
              stageIds: [stableId<'quest-stage'>('return-to-sela')],
            },
          ],
        },
      ),
      simpleNode(
        'sela-before-cantor',
        'sela-quill',
        'The root-song has gone thin beneath my maps. Will you follow where the ink trembles?',
        {
          ...beforeCantor,
          excludesFacts: [acceptedFact],
          excludesQuestStages: [
            {
              questId: stableId<'quest'>('lost-folio'),
              stageIds: [stableId<'quest-stage'>('return-to-sela')],
            },
          ],
        },
        [{ kind: 'set-fact', factId: acceptedFact }],
      ),
    ],
  };
}

function villageDialogue(
  dialogue: string,
  speaker: string,
  beforeNode: string,
  beforeText: string,
  afterNode: string,
  afterText: string,
  effects: DialogueDefinition['nodes'][number]['choices'][number]['effects'],
): DialogueDefinition {
  return {
    dialogueId: stableId<'dialogue'>(dialogue),
    entryNodeId: stableId<'dialogue-node'>(beforeNode),
    entryNodeIds: [stableId<'dialogue-node'>(afterNode), stableId<'dialogue-node'>(beforeNode)],
    nodes: [
      simpleNode(afterNode, speaker, afterText, defeatedCantor),
      simpleNode(beforeNode, speaker, beforeText, beforeCantor, effects),
    ],
  };
}

function simpleNode(
  node: string,
  speaker: string,
  text: string,
  condition: DialogueCondition,
  effects: DialogueDefinition['nodes'][number]['choices'][number]['effects'] = [],
  rewardId: DialogueDefinition['nodes'][number]['choices'][number]['rewardId'] = null,
  choiceText?: string,
): DialogueDefinition['nodes'][number] {
  return {
    nodeId: stableId<'dialogue-node'>(node),
    speakerActorId: stableId<'actor'>(speaker),
    text,
    requiresAll: [],
    condition,
    choices: [
      {
        choiceId: stableId<'dialogue-choice'>(`${node}-continue`),
        text:
          choiceText ??
          (speaker === 'orin-fen' || speaker === 'piri-moss'
            ? 'Browse wares'
            : effects.length > 0 || rewardId !== null
              ? 'I will listen.'
              : 'Until next time.'),
        targetNodeId: null,
        effects,
        rewardId,
      },
      ...(speaker === 'orin-fen' || speaker === 'piri-moss'
        ? [
            {
              choiceId: stableId<'dialogue-choice'>(`${node}-leave`),
              text: 'Until next time.',
              targetNodeId: null,
              effects: [],
              rewardId: null,
            },
          ]
        : []),
    ],
  };
}
