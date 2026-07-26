import type { AbilityDefinition } from './types';

export const abilityDefinitions: readonly AbilityDefinition[] = [
  {
    id: 'lumen-bolt',
    displayName: 'Lumen Bolt',
    kind: 'spell',
    manaCost: 12,
    cooldownMs: 480,
    attackId: 'lumen-bolt-burst'
  },
  {
    id: 'wayfinder-dash',
    displayName: 'Wayfinder Dash',
    kind: 'movement',
    manaCost: 0,
    cooldownMs: 420,
    requiredQuestId: 'silent-bloom'
  },
  {
    id: 'aegis-veil',
    displayName: 'Aegis Veil',
    kind: 'guard',
    manaCost: 18,
    cooldownMs: 900,
    requiredQuestId: 'silent-bloom'
  },
  {
    id: 'resonant-pulse',
    displayName: 'Resonant Pulse',
    kind: 'mechanism',
    manaCost: 10,
    cooldownMs: 650,
    requiredQuestId: 'silent-bloom'
  }
];
