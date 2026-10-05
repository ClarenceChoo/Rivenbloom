import { describe, expect, it } from 'vitest';

import { equipmentSlotId, itemId } from '../../src/game/core/StableId';
import { EquipmentStore } from '../../src/game/inventory/EquipmentStore';
import { InventoryStore } from '../../src/game/inventory/InventoryStore';

const rootBlade = itemId('root-blade');
const choirCharm = itemId('choir-charm');
const unownedCrown = itemId('unowned-crown');
const weapon = equipmentSlotId('weapon');
const trinket = equipmentSlotId('trinket');
const crown = equipmentSlotId('crown');

function createEquipmentStore(): { inventory: InventoryStore; equipment: EquipmentStore } {
  const inventory = new InventoryStore({
    [rootBlade]: 1,
    [choirCharm]: 1,
    [unownedCrown]: 1,
  });
  inventory.add(rootBlade, 1);
  inventory.add(choirCharm, 1);

  return {
    inventory,
    equipment: new EquipmentStore(inventory, [
      { itemId: rootBlade, compatibleSlots: [weapon] },
      { itemId: choirCharm, compatibleSlots: [weapon, trinket] },
      { itemId: unownedCrown, compatibleSlots: [crown] },
    ]),
  };
}

describe('EquipmentStore', () => {
  it('rejects an owned equippable item in an incompatible slot', () => {
    const { equipment } = createEquipmentStore();

    expect(equipment.equip(crown, rootBlade)).toEqual({
      kind: 'rejected',
      reason: 'incompatible-slot',
      slot: crown,
      itemId: rootBlade,
    });
    expect(equipment.snapshot()).toEqual([]);
  });

  it('rejects an item that is defined but not owned', () => {
    const { equipment } = createEquipmentStore();

    expect(equipment.equip(crown, unownedCrown)).toEqual({
      kind: 'rejected',
      reason: 'unowned-item',
      slot: crown,
      itemId: unownedCrown,
    });
  });

  it('prevents one item ID from occupying multiple slots', () => {
    const { equipment } = createEquipmentStore();
    equipment.equip(weapon, choirCharm);

    expect(equipment.equip(trinket, choirCharm)).toEqual({
      kind: 'rejected',
      reason: 'item-already-equipped',
      slot: trinket,
      itemId: choirCharm,
    });
    expect(equipment.snapshot()).toEqual([{ slot: weapon, itemId: choirCharm }]);
  });

  it('replaces a slot atomically without consuming either owned item', () => {
    const { inventory, equipment } = createEquipmentStore();
    equipment.equip(weapon, rootBlade);

    expect(equipment.equip(weapon, choirCharm)).toEqual({
      kind: 'equipped',
      slot: weapon,
      itemId: choirCharm,
      replacedItemId: rootBlade,
    });
    expect(equipment.snapshot()).toEqual([{ slot: weapon, itemId: choirCharm }]);
    expect(inventory.snapshot()).toEqual([
      { itemId: choirCharm, quantity: 1 },
      { itemId: rootBlade, quantity: 1 },
    ]);
  });

  it('treats unequipping an empty slot as idempotently unchanged', () => {
    const { equipment } = createEquipmentStore();

    expect(equipment.unequip(weapon)).toEqual({
      kind: 'unchanged',
      reason: 'empty-slot',
      slot: weapon,
    });
    expect(equipment.unequip(weapon)).toEqual({
      kind: 'unchanged',
      reason: 'empty-slot',
      slot: weapon,
    });
  });

  it('rejects invalid loaded equipment snapshots without replacing current equipment', () => {
    const { equipment } = createEquipmentStore();
    equipment.equip(weapon, rootBlade);

    expect(equipment.load([{ slot: crown, itemId: unownedCrown }])).toEqual({
      kind: 'rejected',
      reason: 'unowned-item',
    });
    expect(equipment.snapshot()).toEqual([{ slot: weapon, itemId: rootBlade }]);

    expect(
      equipment.load([
        { slot: weapon, itemId: choirCharm },
        { slot: trinket, itemId: choirCharm },
      ]),
    ).toEqual({ kind: 'rejected', reason: 'duplicate-item' });
  });
});
