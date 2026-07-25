import type { ItemId, StableId } from '../combat/CombatTypes';

export type EquipmentSlotId = StableId<'equipment-slot'>;
export type EquipmentBonuses = Readonly<Record<string, number>>;

export type EquipmentDefinition = {
  readonly itemId: ItemId;
  readonly compatibleSlots: readonly EquipmentSlotId[];
  readonly bonuses: EquipmentBonuses;
};

export class EquipmentStore {
  private readonly definitions: ReadonlyMap<ItemId, EquipmentDefinition>;
  private readonly equipped = new Map<EquipmentSlotId, ItemId>();

  public constructor(definitions: readonly EquipmentDefinition[]) {
    this.definitions = new Map(definitions.map((definition) => [definition.itemId, definition]));
  }

  public equip(slot: EquipmentSlotId, itemId: ItemId): boolean {
    const definition = this.definitions.get(itemId);
    if (definition === undefined || !definition.compatibleSlots.includes(slot)) {
      return false;
    }

    this.equipped.set(slot, itemId);
    return true;
  }

  public get bonuses(): EquipmentBonuses {
    const total = new Map<string, number>();

    for (const itemId of this.equipped.values()) {
      const definition = this.definitions.get(itemId);
      if (definition === undefined) {
        continue;
      }

      for (const [stat, value] of Object.entries(definition.bonuses)) {
        total.set(stat, (total.get(stat) ?? 0) + value);
      }
    }

    return Object.fromEntries(
      [...total.entries()].sort(([left], [right]) => left.localeCompare(right))
    );
  }
}
