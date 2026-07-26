import type { ItemDefinition } from './types';

export const itemDefinitions: readonly ItemDefinition[] = [
  {
    id: 'surveyor-edge',
    displayName: 'Surveyor Edge',
    kind: 'weapon',
    description: 'Mara’s crescent field blade, balanced for close trail work.',
    maxStack: 1,
    value: 0,
    abilityIds: []
  },
  {
    id: 'briar-core',
    displayName: 'Briar Core',
    kind: 'quest',
    description: 'A warm rootglass knot taken from a guardian of the old route.',
    maxStack: 9,
    value: 80,
    abilityIds: []
  },
  {
    id: 'quiet-step',
    displayName: 'Quiet Step',
    kind: 'charm',
    description: 'Softens landings and the rustle of disturbed leaves.',
    maxStack: 1,
    value: 120,
    abilityIds: []
  },
  {
    id: 'resin-heart',
    displayName: 'Resin Heart',
    kind: 'charm',
    description: 'A seed-pod charm that steadies recovery after a hard impact.',
    maxStack: 1,
    value: 160,
    abilityIds: []
  },
  {
    id: 'echo-thorn',
    displayName: 'Echo Thorn',
    kind: 'charm',
    description: 'Returns a small pulse of resonance after a precise parry.',
    maxStack: 1,
    value: 190,
    abilityIds: ['resonant-pulse']
  },
  {
    id: 'heart-petal',
    displayName: 'Heart Petal',
    kind: 'upgrade',
    description: 'One of three living petals that deepen Mara’s vitality.',
    maxStack: 3,
    value: 0,
    abilityIds: []
  },
  {
    id: 'wellspring-seed',
    displayName: 'Wellspring Seed',
    kind: 'upgrade',
    description: 'A moon-mint seed that expands Mara’s reservoir of mana.',
    maxStack: 3,
    value: 0,
    abilityIds: []
  },
  {
    id: 'lost-folio',
    displayName: 'Cartographer’s Folio',
    kind: 'quest',
    description: 'Water-stained route pages carrying Sela’s careful annotations.',
    maxStack: 1,
    value: 0,
    abilityIds: []
  },
  {
    id: 'cantor-sigil',
    displayName: 'Cantor Sigil',
    kind: 'quest',
    description: 'A listening mark released when the damaged guardian falls quiet.',
    maxStack: 1,
    value: 0,
    abilityIds: []
  }
];
