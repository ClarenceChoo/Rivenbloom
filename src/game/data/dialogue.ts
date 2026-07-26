import type { DialogueDefinition } from './types';

export const dialogueDefinitions: readonly DialogueDefinition[] = [
  {
    id: 'sela-silent-bloom',
    entryNodeId: 'silent-route',
    nodes: [
      {
        id: 'silent-route',
        speakerActorId: 'sela-quill',
        text: 'Brackenreach used to answer every traveller. Now even the listening arch is still.',
        nextNodeId: 'mara-will-listen',
        choices: [],
        questId: 'silent-bloom',
        questStageId: 'speak-with-sela'
      },
      {
        id: 'mara-will-listen',
        speakerActorId: 'mara-vey',
        text: 'I will follow the quiet and find where the route breaks.',
        choices: []
      }
    ]
  },
  {
    id: 'sela-arch-awakened',
    entryNodeId: 'arch-remembers',
    nodes: [
      {
        id: 'arch-remembers',
        speakerActorId: 'sela-quill',
        text: 'That chime is older than our maps. The Hollows must still remember a way through.',
        choices: [],
        questId: 'silent-bloom',
        questStageId: 'wake-listening-arch'
      }
    ]
  },
  {
    id: 'sela-route-restored',
    entryNodeId: 'living-map',
    nodes: [
      {
        id: 'living-map',
        speakerActorId: 'sela-quill',
        text: 'Listen—the whole route is drawing breath again. We will map it as something living.',
        choices: [],
        questId: 'silent-bloom',
        questStageId: 'restore-hollow-choir'
      }
    ]
  },
  {
    id: 'orin-first-reforge',
    entryNodeId: 'blade-memory',
    nodes: [
      {
        id: 'blade-memory',
        speakerActorId: 'orin-fen',
        text: 'Bring me a briar core and I can teach that edge to hold its line.',
        choices: [],
        questId: 'silent-bloom'
      }
    ]
  },
  {
    id: 'piri-root-memory',
    entryNodeId: 'roots-keep-voices',
    nodes: [
      {
        id: 'roots-keep-voices',
        speakerActorId: 'piri-moss',
        text: 'Roots keep voices in their rings. Touch the trace gently and let it arrive.',
        choices: [],
        questId: 'silent-bloom'
      }
    ]
  }
];
