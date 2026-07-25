import { describe, expect, it } from 'vitest';
import { EquipmentStore, equipmentSlotId } from '../../src/game/inventory/EquipmentStore';
import { InventoryStore } from '../../src/game/inventory/InventoryStore';
import { itemId } from '../../src/game/combat/CombatTypes';

const seed = itemId('bracken-seed');
const staff = itemId('rootglass-staff');
const ward = itemId('hollow-ward');
const weaponSlot = equipmentSlotId('weapon');
const charmSlot = equipmentSlotId('charm');

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

  it('rejects non-finite and negative item caps at construction', () => {
    expect(() => new InventoryStore([{ id: seed, maxQuantity: Number.POSITIVE_INFINITY }])).toThrow(
      'finite non-negative integer cap'
    );
    expect(() => new InventoryStore([{ id: seed, maxQuantity: -1 }])).toThrow(
      'finite non-negative integer cap'
    );
  });

  it('rejects a non-finite quantity at the inventory boundary', () => {
    const inventory = new InventoryStore([{ id: seed, maxQuantity: 5 }]);

    expect(() => inventory.add(seed, Number.NaN)).toThrow('finite quantity');
  });

  it('rejects equipment whose compatible slot does not match', () => {
    const equipment = new EquipmentStore([
      { itemId: staff, compatibleSlots: [weaponSlot], bonuses: { power: 4, guard: 2 } }
    ]);

    expect(equipment.equip(charmSlot, staff)).toBe(false);
  });

  it('rejects malformed equipment slot IDs', () => {
    expect(() => equipmentSlotId('Weapon Slot')).toThrow('lowercase-kebab-case');
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
