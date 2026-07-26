import type { BossMechanismDefinition } from './types';

export const bossMechanismDefinitions: readonly BossMechanismDefinition[] = [
  {
    id: 'cantor-west-lens',
    displayName: 'West Choir Lens',
    kind: 'lens',
    bossActorId: 'pallid-cantor',
    persistentFlagId: 'cantor-west-lens-aligned'
  },
  {
    id: 'cantor-east-lens',
    displayName: 'East Choir Lens',
    kind: 'lens',
    bossActorId: 'pallid-cantor',
    persistentFlagId: 'cantor-east-lens-aligned'
  }
];
