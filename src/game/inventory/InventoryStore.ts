import type { ItemId } from '../combat/CombatTypes';

export type InventoryItemDefinition = {
  readonly id: ItemId;
  readonly maxQuantity: number;
};

export type InventoryChange = {
  readonly itemId: ItemId;
  readonly previousQuantity: number;
  readonly quantity: number;
  readonly added: number;
};

export class InventoryStore {
  private readonly definitions: ReadonlyMap<ItemId, InventoryItemDefinition>;
  private readonly quantities = new Map<ItemId, number>();

  public constructor(definitions: readonly InventoryItemDefinition[]) {
    this.definitions = new Map(definitions.map((definition) => [definition.id, definition]));
  }

  public add(itemId: ItemId, quantity: number): InventoryChange {
    const definition = this.definitions.get(itemId);
    const previousQuantity = this.quantities.get(itemId) ?? 0;
    const requestedQuantity = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
    const nextQuantity =
      definition === undefined
        ? previousQuantity
        : Math.min(Math.max(0, definition.maxQuantity), previousQuantity + requestedQuantity);

    if (definition !== undefined) {
      this.quantities.set(itemId, nextQuantity);
    }

    return {
      itemId,
      previousQuantity,
      quantity: nextQuantity,
      added: nextQuantity - previousQuantity
    };
  }
}
