import type { EquipmentSlotId, ItemId } from '../core/StableId';
import { ITEMS } from '../data/items';
import { InventoryStore } from '../inventory/InventoryStore';
import { EquipmentStore } from '../inventory/EquipmentStore';
import { validateSaveV1 } from '../saves/SaveSchema';
import type { SaveV1 } from '../saves/SaveSchema';
import { applyProgressionTransaction } from './WorldProgression';
export type PlayerItemCommand =
  | Readonly<{ kind: 'use-item'; itemId: ItemId; revision: number }>
  | Readonly<{ kind: 'equip-item'; itemId: ItemId; slot: EquipmentSlotId; revision: number }>
  | Readonly<{ kind: 'unequip-item'; slot: EquipmentSlotId; revision: number }>;
export type PlayerItemResult = Readonly<{
  kind: 'accepted' | 'rejected';
  save: SaveV1;
  copy: string;
}>;
export function applyPlayerItemAction(
  save: SaveV1,
  command: PlayerItemCommand,
  revision: number,
): PlayerItemResult {
  const reject = (copy: string): PlayerItemResult => ({ kind: 'rejected', save, copy });
  if (command.revision !== revision) return reject('The satchel changed. Try again.');
  if (validateSaveV1(save).kind === 'invalid' || save.player.currentHealth === 0)
    return reject('Items are unavailable right now.');
  if (command.kind === 'use-item') {
    const item = ITEMS.find((item) => item.itemId === command.itemId);
    const recovery = item?.recovery;
    if (item === undefined || recovery === undefined) return reject('This item cannot be used.');
    const key = recovery.resource === 'health' ? 'currentHealth' : 'currentMana';
    const max =
      recovery.resource === 'health'
        ? save.player.baseStats.maxHealth
        : save.player.baseStats.maxMana;
    if (save.player[key] >= max) return reject(`Your ${recovery.resource} is already full.`);
    const consumed = applyProgressionTransaction(save, {
      commands: [{ kind: 'consume-item', itemId: command.itemId, quantity: 1 }],
    });
    if (consumed.kind !== 'accepted') return reject('There are none left in the satchel.');
    const amount = Math.min(recovery.amount, max - save.player[key]);
    return {
      kind: 'accepted',
      save: {
        ...consumed.save,
        player: { ...consumed.save.player, [key]: save.player[key] + amount },
      },
      copy: `${item.displayName}: restored ${amount} ${recovery.resource}.`,
    };
  }
  const inventory = new InventoryStore(
    Object.fromEntries(ITEMS.map((item) => [item.itemId, item.maxStack])),
  );
  for (const item of save.inventory) inventory.add(item.itemId, item.quantity);
  const equipment = new EquipmentStore(
    inventory,
    ITEMS.flatMap((item) =>
      item.equipment === null
        ? []
        : [
            {
              itemId: item.itemId,
              compatibleSlots:
                'slotIds' in item.equipment ? item.equipment.slotIds : [item.equipment.slotId],
            },
          ],
    ),
  );
  if (equipment.load(save.equipment).kind !== 'loaded')
    return reject('Saved equipment could not be loaded.');
  const result =
    command.kind === 'equip-item'
      ? equipment.equip(command.slot, command.itemId)
      : equipment.unequip(command.slot);
  if (result.kind === 'rejected') return reject(result.reason.replaceAll('-', ' '));
  const candidate = { ...save, equipment: [...equipment.snapshot()] };
  if (validateSaveV1(candidate).kind === 'invalid')
    return reject('That equipment slot is unavailable.');
  return {
    kind: 'accepted',
    save: candidate,
    copy: command.kind === 'equip-item' ? 'Charm equipped.' : 'Charm removed.',
  };
}
