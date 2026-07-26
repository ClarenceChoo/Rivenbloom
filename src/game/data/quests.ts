import type { QuestDefinition } from './types';

export const questDefinitions: readonly QuestDefinition[] = [
  {
    id: 'silent-bloom',
    displayName: 'The Silent Bloom',
    kind: 'main',
    initialStageId: 'speak-with-sela',
    prerequisiteQuestIds: [],
    stages: [
      {
        id: 'speak-with-sela',
        objective: 'Ask Sela why the navigation chimes have fallen silent.',
        dialogueId: 'sela-silent-bloom',
        requiredItemIds: [],
        grantedItemIds: [],
        grantedAbilityIds: []
      },
      {
        id: 'wake-listening-arch',
        objective: 'Follow the old trail and listen at the Brackenreach arch.',
        dialogueId: 'sela-arch-awakened',
        requiredItemIds: [],
        grantedItemIds: [],
        grantedAbilityIds: ['wayfinder-dash']
      },
      {
        id: 'restore-hollow-choir',
        objective: 'Reach the Hollow Choir and release its damaged guardian.',
        dialogueId: 'sela-route-restored',
        requiredItemIds: [],
        grantedItemIds: ['cantor-sigil'],
        grantedAbilityIds: ['resonant-pulse']
      }
    ]
  },
  {
    id: 'lost-folio-quest',
    displayName: 'Lost Folio',
    kind: 'discovery',
    initialStageId: 'find-lost-folio',
    prerequisiteQuestIds: [],
    stages: [
      {
        id: 'find-lost-folio',
        objective: 'Recover the cartographer’s pages from the Flooded Stacks.',
        requiredItemIds: ['lost-folio'],
        grantedItemIds: ['quiet-step'],
        grantedAbilityIds: []
      }
    ]
  },
  {
    id: 'lanterns-for-the-absent',
    displayName: 'Lanterns for the Absent',
    kind: 'discovery',
    initialStageId: 'relight-memorial-lanterns',
    prerequisiteQuestIds: [],
    stages: [
      {
        id: 'relight-memorial-lanterns',
        objective: 'Relight the three memorial seed-lanterns.',
        requiredItemIds: [],
        grantedItemIds: ['wellspring-seed'],
        grantedAbilityIds: []
      }
    ]
  }
];
