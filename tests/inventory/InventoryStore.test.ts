import { describe, expect, it } from 'vitest';

import { itemId } from '../../src/game/core/StableId';
import { InventoryStore } from '../../src/game/inventory/InventoryStore';

const rootKey = itemId('root-key');
const moonSalt = itemId('moon-salt');

describe('InventoryStore', () => {
  it('accepts an addition that reaches an item stack cap exactly', () => {
    const inventory = new InventoryStore({ [rootKey]: 5 });

    expect(inventory.add(rootKey, 5)).toEqual({
      kind: 'added',
      itemId: rootKey,
      quantity: 5,
      totalQuantity: 5,
    });
    expect(inventory.snapshot()).toEqual([{ itemId: rootKey, quantity: 5 }]);
  });

  it('rejects a stack overflow atomically without changing the owned quantity', () => {
    const inventory = new InventoryStore({ [rootKey]: 5 });
    inventory.add(rootKey, 4);

    expect(inventory.add(rootKey, 2)).toEqual({
      kind: 'rejected',
      reason: 'stack-cap-exceeded',
      itemId: rootKey,
      quantity: 2,
      currentQuantity: 4,
    });
    expect(inventory.snapshot()).toEqual([{ itemId: rootKey, quantity: 4 }]);
  });

  it('returns an explicit unchanged result for an unknown item', () => {
    const inventory = new InventoryStore({ [rootKey]: 5 });

    expect(inventory.add(moonSalt, 1)).toEqual({
      kind: 'rejected',
      reason: 'unknown-item',
      itemId: moonSalt,
      quantity: 1,
      currentQuantity: 0,
    });
    expect(inventory.snapshot()).toEqual([]);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects malformed add quantity %p',
    (quantity) => {
      const inventory = new InventoryStore({ [rootKey]: 5 });

      expect(() => inventory.add(rootKey, quantity)).toThrow(RangeError);
      expect(inventory.snapshot()).toEqual([]);
    },
  );
});
