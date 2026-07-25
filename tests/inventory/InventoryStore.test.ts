import { describe, expect, it } from 'vitest';
import { EquipmentStore } from '../../src/game/inventory/EquipmentStore';
import { InventoryStore } from '../../src/game/inventory/InventoryStore';
import type { ItemId, StableId } from '../../src/game/combat/CombatTypes';

const seed = 'bracken-seed' as ItemId;
const staff = 'rootglass-staff' as ItemId;
const ward = 'hollow-ward' as ItemId;
const weaponSlot = 'weapon' as StableId<'equipment-slot'>;
const charmSlot = 'charm' as StableId<'equipment-slot'>;

describe('InventoryStore', () => {
  it('adds a positive quantity up to the configured item cap', () => {
    const inventory = new InventoryStore([{ id: seed, maxQuantity: 5 }]);

    expect(inventory.add(seed, 3)).toEqual({
      itemId: seed,
      previousQuantity: 0,
      quantity: 3,
      added: 3
    });
  });

  it('does not exceed an item cap', () => {
    const inventory = new InventoryStore([{ id: seed, maxQuantity: 5 }]);

    inventory.add(seed, 4);
    expect(inventory.add(seed, 3)).toEqual({
      itemId: seed,
      previousQuantity: 4,
      quantity: 5,
      added: 1
    });
  });

  it('normalizes fractional quantities down to preserve discrete inventory counts', () => {
    const inventory = new InventoryStore([{ id: seed, maxQuantity: 5 }]);

    expect(inventory.add(seed, 1.5)).toEqual({
      itemId: seed,
      previousQuantity: 0,
      quantity: 1,
      added: 1
    });
  });

  it('rejects equipment whose compatible slot does not match', () => {
    const equipment = new EquipmentStore([
      { itemId: staff, compatibleSlots: [weaponSlot], bonuses: { power: 4, guard: 2 } }
    ]);

    expect(equipment.equip(charmSlot, staff)).toBe(false);
  });

  it('sums bonuses deterministically across equipped slots', () => {
    const equipment = new EquipmentStore([
      { itemId: staff, compatibleSlots: [weaponSlot], bonuses: { power: 4, guard: 2 } },
      { itemId: ward, compatibleSlots: [charmSlot], bonuses: { power: 1, vitality: 5 } }
    ]);

    equipment.equip(charmSlot, ward);
    equipment.equip(weaponSlot, staff);

    expect(equipment.bonuses).toEqual({ guard: 2, power: 5, vitality: 5 });
  });
});
