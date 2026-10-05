import { isStableId } from '../core/StableId';
import type { ItemId } from '../core/StableId';

export type ItemStackDefinitions = Readonly<Record<ItemId, number>>;

export type InventoryEntry = Readonly<{
  itemId: ItemId;
  quantity: number;
}>;

export type InventoryChange =
  | Readonly<{
      kind: 'added';
      itemId: ItemId;
      quantity: number;
      totalQuantity: number;
    }>
  | Readonly<{
      kind: 'rejected';
      reason: 'unknown-item' | 'stack-cap-exceeded';
      itemId: ItemId;
      quantity: number;
      currentQuantity: number;
    }>;

export class InventoryStore {
  private readonly stackCaps = new Map<ItemId, number>();
  private readonly quantities = new Map<ItemId, number>();

  public constructor(definitions: ItemStackDefinitions) {
    for (const [id, stackCap] of Object.entries(definitions)) {
      if (!isStableId(id)) {
        throw new RangeError('Item ID must be a stable ID.');
      }

      assertPositiveSafeInteger(stackCap, 'Item stack cap');
      this.stackCaps.set(id as ItemId, stackCap);
    }
  }

  public add(itemId: ItemId, quantity: number): InventoryChange {
    assertPositiveSafeInteger(quantity, 'Inventory quantity');

    if (!isStableId(itemId)) {
      throw new RangeError('Item ID must be a stable ID.');
    }

    const stackCap = this.stackCaps.get(itemId);
    const currentQuantity = this.quantities.get(itemId) ?? 0;

    if (stackCap === undefined) {
      return {
        kind: 'rejected',
        reason: 'unknown-item',
        itemId,
        quantity,
        currentQuantity,
      };
    }

    if (quantity > stackCap - currentQuantity) {
      return {
        kind: 'rejected',
        reason: 'stack-cap-exceeded',
        itemId,
        quantity,
        currentQuantity,
      };
    }

    const totalQuantity = currentQuantity + quantity;
    this.quantities.set(itemId, totalQuantity);

    return {
      kind: 'added',
      itemId,
      quantity,
      totalQuantity,
    };
  }

  public isDefined(itemId: ItemId): boolean {
    return isStableId(itemId) && this.stackCaps.has(itemId);
  }

  public owns(itemId: ItemId): boolean {
    return this.quantityOf(itemId) > 0;
  }

  public quantityOf(itemId: ItemId): number {
    if (!isStableId(itemId)) {
      return 0;
    }

    return this.quantities.get(itemId) ?? 0;
  }

  public snapshot(): readonly InventoryEntry[] {
    return [...this.quantities.entries()]
      .map(([itemId, quantity]) => ({ itemId, quantity }))
      .sort(compareInventoryEntries);
  }
}

function assertPositiveSafeInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer.`);
  }
}

function compareInventoryEntries(left: InventoryEntry, right: InventoryEntry): number {
  if (left.itemId < right.itemId) {
    return -1;
  }

  if (left.itemId > right.itemId) {
    return 1;
  }

  return 0;
}
