import { equipmentSlotId, itemId } from '../core/StableId';
import { deepFreeze } from './immutability';
import type { ItemDefinition } from './types';

export const ITEMS: readonly ItemDefinition[] = deepFreeze([
  {
    itemId: itemId('briar-core'),
    displayName: 'Briar Core',
    category: 'material',
    description: 'A resin-bright heart cut from an elder briar guardian.',
    maxStack: 1,
    equipment: null,
  },
  {
    itemId: itemId('cartographers-folio'),
    displayName: "Cartographer's Folio",
    category: 'quest',
    description: 'Sela’s weathered field notes, crowded with paths that no longer exist.',
    maxStack: 1,
    equipment: null,
  },
  {
    itemId: itemId('rootglass-index-key'),
    displayName: 'Rootglass Index Key',
    category: 'quest',
    description: 'A copper index tooth veined with dormant glass.',
    maxStack: 1,
    equipment: null,
  },
  {
    itemId: itemId('cantor-sigil'),
    displayName: 'Cantor Sigil',
    category: 'quest',
    description: 'A pale rootglass seal, warm with the last true note of the Hollow Choir.',
    maxStack: 1,
    equipment: null,
  },
  charm('quiet-step', 'Quiet Step', 'Reduces damage from briar hazards by 20% while equipped.', {
    kind: 'briar-damage',
    amount: 0.8,
  }),
  charm(
    'resin-heart',
    'Resin Heart',
    'Extends protection after a damaging hit by 300 ms while equipped.',
    { kind: 'hit-protection', amount: 300 },
  ),
  charm('echo-thorn', 'Echo Thorn', 'Restores 2 mana on a successful parry while equipped.', {
    kind: 'parry-mana',
    amount: 2,
  }),
  {
    itemId: itemId('sunmoss-draught'),
    recovery: { resource: 'health', amount: 30 },
    displayName: 'Sunmoss Draught',
    category: 'recovery',
    description: 'Restores 30 health, up to your maximum.',
    maxStack: 5,
    equipment: null,
  },
  {
    itemId: itemId('wellspring-tonic'),
    recovery: { resource: 'mana', amount: 20 },
    displayName: 'Wellspring Tonic',
    category: 'recovery',
    description: 'Restores 20 mana, up to your maximum.',
    maxStack: 5,
    equipment: null,
  },
]);

function charm(
  id: string,
  displayName: string,
  description: string,
  charmEffect: NonNullable<ItemDefinition['charmEffect']>,
): ItemDefinition {
  return {
    itemId: itemId(id),
    displayName,
    category: 'charm',
    charmEffect,
    description,
    maxStack: 1,
    equipment: {
      slotIds: [
        equipmentSlotId('charm-one'),
        equipmentSlotId('charm-two'),
        equipmentSlotId('charm-three'),
      ],
    },
  };
}
