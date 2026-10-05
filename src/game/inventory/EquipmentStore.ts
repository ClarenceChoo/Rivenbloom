import { isStableId } from '../core/StableId';
import type { EquipmentSlotId, ItemId } from '../core/StableId';
import { InventoryStore } from './InventoryStore';

export type EquipmentDefinition = Readonly<{
  itemId: ItemId;
  compatibleSlots: readonly EquipmentSlotId[];
}>;

export type EquippedItem = Readonly<{
  slot: EquipmentSlotId;
  itemId: ItemId;
}>;

export type EquipmentSnapshot = readonly EquippedItem[];

type EquipmentRejectReason =
  | 'unknown-item'
  | 'not-equippable'
  | 'unowned-item'
  | 'incompatible-slot'
  | 'item-already-equipped'
  | 'duplicate-slot'
  | 'duplicate-item'
  | 'invalid-snapshot';

export type EquipmentChange =
  | Readonly<{
      kind: 'equipped';
      slot: EquipmentSlotId;
      itemId: ItemId;
      replacedItemId: ItemId | null;
    }>
  | Readonly<{
      kind: 'unequipped';
      slot: EquipmentSlotId;
      itemId: ItemId;
    }>
  | Readonly<{
      kind: 'unchanged';
      reason: 'empty-slot' | 'already-equipped';
      slot: EquipmentSlotId;
    }>
  | Readonly<{
      kind: 'rejected';
      reason: EquipmentRejectReason;
      slot: EquipmentSlotId;
      itemId: ItemId;
    }>;

export type EquipmentLoadResult =
  | Readonly<{
      kind: 'loaded';
      snapshot: EquipmentSnapshot;
    }>
  | Readonly<{
      kind: 'rejected';
      reason: EquipmentRejectReason;
    }>;

export class EquipmentStore {
  private readonly definitions = new Map<ItemId, EquipmentDefinition>();
  private readonly equipped = new Map<EquipmentSlotId, ItemId>();

  public constructor(
    private readonly inventory: InventoryStore,
    definitions: readonly EquipmentDefinition[],
  ) {
    for (const definition of definitions) {
      validateDefinition(definition, inventory, this.definitions);
      this.definitions.set(definition.itemId, {
        itemId: definition.itemId,
        compatibleSlots: [...definition.compatibleSlots],
      });
    }
  }

  public equip(slot: EquipmentSlotId, itemId: ItemId): EquipmentChange {
    assertStableEquipmentId(slot, 'Equipment slot');
    assertStableEquipmentId(itemId, 'Item');

    const equippedItem = this.equipped.get(slot);

    if (equippedItem === itemId) {
      return { kind: 'unchanged', reason: 'already-equipped', slot };
    }

    const rejection = this.validateCandidate(slot, itemId, this.equipped);

    if (rejection !== null) {
      return { kind: 'rejected', reason: rejection, slot, itemId };
    }

    this.equipped.set(slot, itemId);

    return {
      kind: 'equipped',
      slot,
      itemId,
      replacedItemId: equippedItem ?? null,
    };
  }

  public unequip(slot: EquipmentSlotId): EquipmentChange {
    assertStableEquipmentId(slot, 'Equipment slot');

    const equippedItem = this.equipped.get(slot);

    if (equippedItem === undefined) {
      return { kind: 'unchanged', reason: 'empty-slot', slot };
    }

    this.equipped.delete(slot);
    return { kind: 'unequipped', slot, itemId: equippedItem };
  }

  public load(snapshot: EquipmentSnapshot): EquipmentLoadResult {
    if (!Array.isArray(snapshot)) {
      throw new RangeError('Equipment snapshot must be an array.');
    }

    const nextEquipped = new Map<EquipmentSlotId, ItemId>();

    for (const entry of snapshot) {
      if (!isEquippedItem(entry)) {
        return { kind: 'rejected', reason: 'invalid-snapshot' };
      }

      if (nextEquipped.has(entry.slot)) {
        return { kind: 'rejected', reason: 'duplicate-slot' };
      }

      if (containsItem(nextEquipped, entry.itemId)) {
        return { kind: 'rejected', reason: 'duplicate-item' };
      }

      const rejection = this.validateCandidate(entry.slot, entry.itemId, nextEquipped);

      if (rejection !== null) {
        return { kind: 'rejected', reason: rejection };
      }

      nextEquipped.set(entry.slot, entry.itemId);
    }

    this.equipped.clear();
    nextEquipped.forEach((itemId, slot) => this.equipped.set(slot, itemId));

    return { kind: 'loaded', snapshot: this.snapshot() };
  }

  public snapshot(): EquipmentSnapshot {
    return [...this.equipped.entries()]
      .map(([slot, itemId]) => ({ slot, itemId }))
      .sort(compareEquippedItems);
  }

  private validateCandidate(
    slot: EquipmentSlotId,
    itemId: ItemId,
    equipped: ReadonlyMap<EquipmentSlotId, ItemId>,
  ): EquipmentRejectReason | null {
    if (!this.inventory.isDefined(itemId)) {
      return 'unknown-item';
    }

    const definition = this.definitions.get(itemId);

    if (definition === undefined) {
      return 'not-equippable';
    }

    if (!this.inventory.owns(itemId)) {
      return 'unowned-item';
    }

    if (!definition.compatibleSlots.includes(slot)) {
      return 'incompatible-slot';
    }

    for (const equippedItem of equipped.values()) {
      if (equippedItem === itemId) {
        return 'item-already-equipped';
      }
    }

    return null;
  }
}

function validateDefinition(
  definition: EquipmentDefinition,
  inventory: InventoryStore,
  existingDefinitions: ReadonlyMap<ItemId, EquipmentDefinition>,
): void {
  assertStableEquipmentId(definition.itemId, 'Equipment definition item');

  if (!inventory.isDefined(definition.itemId)) {
    throw new RangeError('Equipment definition item must be defined in the inventory.');
  }

  if (existingDefinitions.has(definition.itemId)) {
    throw new RangeError('Equipment definitions cannot repeat an item ID.');
  }

  if (definition.compatibleSlots.length === 0) {
    throw new RangeError('Equipment definitions require a compatible slot.');
  }

  const slots = new Set<EquipmentSlotId>();

  for (const slot of definition.compatibleSlots) {
    assertStableEquipmentId(slot, 'Equipment definition slot');

    if (slots.has(slot)) {
      throw new RangeError('Equipment definitions cannot repeat a compatible slot.');
    }

    slots.add(slot);
  }
}

function isEquippedItem(value: unknown): value is EquippedItem {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const entry = value as Readonly<Record<string, unknown>>;
  return isStableId(entry.slot) && isStableId(entry.itemId);
}

function assertStableEquipmentId(value: unknown, label: string): asserts value is string {
  if (!isStableId(value)) {
    throw new RangeError(`${label} must be a stable ID.`);
  }
}

function compareEquippedItems(left: EquippedItem, right: EquippedItem): number {
  if (left.slot < right.slot) {
    return -1;
  }

  if (left.slot > right.slot) {
    return 1;
  }

  return 0;
}

function containsItem(equipped: ReadonlyMap<EquipmentSlotId, ItemId>, candidate: ItemId): boolean {
  for (const itemId of equipped.values()) {
    if (itemId === candidate) {
      return true;
    }
  }

  return false;
}
