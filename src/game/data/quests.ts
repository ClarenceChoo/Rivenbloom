import { questFlagId, questId, questStageId } from '../core/StableId';
import { deepFreeze } from './immutability';
import type { QuestContentDefinition } from './types';

const fact = questFlagId;
const stage = questStageId;

const authoredQuests = [
  {
    definition: {
      questId: questId('the-silent-bloom'),
      displayName: 'The Silent Bloom',
      initialStageId: stage('unheard'),
      stages: [
        questStage(
          'unheard',
          'A Quiet Map',
          'Speak with Sela at her chart table.',
          'trace-listening-arch',
          'silent-bloom-accepted',
        ),
        questStage(
          'trace-listening-arch',
          'The Listening Arch',
          'Trace the root-song beneath Brackenreach.',
          'bring-root-memory-to-piri',
          'listening-arch-traced',
        ),
        questStage(
          'bring-root-memory-to-piri',
          'A Root Remembers',
          'Bring the recovered root-memory to Piri.',
          'seek-briar-core',
          'root-memory-delivered',
        ),
        questStage(
          'seek-briar-core',
          'Heart of the Briar',
          'Claim a briar core from the Thorn Sentinel east of the Root-Memory Chamber.',
          'ask-orin-to-reforge',
          'briar-core-claimed',
        ),
        questStage(
          'ask-orin-to-reforge',
          "Orin's Reforge",
          'Ask Orin to reforge the Surveyor Edge.',
          'enter-rootglass-reliquary',
          'surveyor-edge-reforged',
        ),
        questStage(
          'enter-rootglass-reliquary',
          'The Sealed Reliquary',
          'Enter the Rootglass Reliquary.',
          'silence-the-cantor',
          'rootglass-reliquary-entered',
        ),
        questStage(
          'silence-the-cantor',
          'The Hollow Choir',
          'Silence the Pallid Cantor.',
          'return-to-sela',
          'pallid-cantor-defeated',
        ),
        questStage(
          'return-to-sela',
          'A Song Returned',
          'Return to Sela in Wren’s Rest.',
          'complete',
          'silent-bloom-restored',
        ),
        {
          stageId: stage('complete'),
          title: 'Bloom Restored',
          objective: 'The root-song carries freely again.',
          transitions: [],
        },
      ],
    },
    declaredFacts: [
      'aegis-veil-learned',
      'briar-core-claimed',
      'echo-thorn-purchased',
      'heart-petal-claimed',
      'listening-arch-traced',
      'pallid-cantor-defeated',
      'resonant-pulse-awakened',
      'resin-heart-purchased',
      'root-memory-delivered',
      'root-memory-recovered',
      'rootglass-edge-forged',
      'rootglass-reliquary-entered',
      'silent-bloom-accepted',
      'silent-bloom-restored',
      'surveyor-edge-reforged',
      'wayfinder-dash-awakened',
      'wellspring-seed-claimed',
    ].map(fact),
  },
  {
    definition: {
      questId: questId('lost-folio'),
      displayName: 'The Lost Folio',
      initialStageId: stage('missing'),
      stages: [
        questStage(
          'missing',
          'A Missing Page',
          'Search Brackenreach for Sela’s lost folio.',
          'return-to-sela',
          'cartographers-folio-found',
        ),
        questStage(
          'return-to-sela',
          'Ink Comes Home',
          'Return the cartographer’s folio to Sela.',
          'complete',
          'cartographers-folio-returned',
        ),
        {
          stageId: stage('complete'),
          title: 'Routes Remembered',
          objective: 'Sela has restored the folio.',
          transitions: [],
        },
      ],
    },
    declaredFacts: ['cartographers-folio-found', 'cartographers-folio-returned'].map(fact),
  },
  {
    definition: {
      questId: questId('lanterns-for-the-absent'),
      displayName: 'Lanterns for the Absent',
      initialStageId: stage('unlit'),
      stages: [
        {
          stageId: stage('unlit'),
          title: 'Three Dark Lanterns',
          objective: 'Light a memorial lantern beyond Wren’s Rest.',
          transitions: [
            {
              toStageId: stage('gathering-light'),
              requiresAll: [],
              requiresAny: [
                fact('absent-lantern-trail-lit'),
                fact('absent-lantern-hollows-lit'),
                fact('absent-lantern-reliquary-lit'),
              ],
            },
          ],
        },
        questStage(
          'gathering-light',
          'Gathering Light',
          'Light the remaining memorial lanterns.',
          'return-to-piri',
          'absent-lantern-trail-lit',
          ['absent-lantern-hollows-lit', 'absent-lantern-reliquary-lit'],
        ),
        questStage(
          'return-to-piri',
          'The Absent Remembered',
          'Return to Piri at the herb stall.',
          'complete',
          'lanterns-for-the-absent-complete',
        ),
        {
          stageId: stage('complete'),
          title: 'Lanternsong',
          objective: 'Three lights answer across the valley.',
          transitions: [],
        },
      ],
    },
    declaredFacts: [
      'absent-lantern-hollows-lit',
      'absent-lantern-reliquary-lit',
      'absent-lantern-trail-lit',
      'lanterns-for-the-absent-complete',
    ].map(fact),
  },
] satisfies readonly QuestContentDefinition[];

export const QUESTS: readonly QuestContentDefinition[] = deepFreeze(authoredQuests);

function questStage(
  id: string,
  title: string,
  objective: string,
  to: string,
  required: string,
  moreRequired: readonly string[] = [],
) {
  return {
    stageId: stage(id),
    title,
    objective,
    transitions: [
      {
        toStageId: stage(to),
        requiresAll: [required, ...moreRequired].map(fact),
      },
    ],
  };
}

// Known main-quest destinations; the map only reveals a marker once its room is discovered.
export const MAIN_QUEST_DESTINATIONS: Readonly<Record<string, string>> = Object.freeze({
  unheard: 'wren-rest-square',
  'trace-listening-arch': 'listening-arch',
  'bring-root-memory-to-piri': 'wren-rest-square',
  'seek-briar-core': 'reliquary-verge',
  'ask-orin-to-reforge': 'wren-rest-square',
  'enter-rootglass-reliquary': 'rootglass-vestibule',
  'silence-the-cantor': 'hollow-choir-arena',
  'return-to-sela': 'wren-rest-square',
});

export const ROOT_MEMORY_RECOVERY_OBJECTIVE = 'Recover the root-memory in the Singing Hollows.';
export const WAYFINDER_DASH_OBJECTIVE =
  'Learn Wayfinder Dash in the trial beneath the Root-Memory Chamber.';

export function isRecoveringRootMemory(
  stageId: string | undefined,
  flags: readonly string[],
): boolean {
  return stageId === 'bring-root-memory-to-piri' && !flags.includes('root-memory-recovered');
}

export function isSeekingWayfinderDash(
  stageId: string | undefined,
  flags: readonly string[],
): boolean {
  return stageId === 'seek-briar-core' && !flags.includes('wayfinder-dash-awakened');
}
