import { describe, expect, it } from 'vitest';
import { applyPlayerItemAction } from '../../src/game/world/PlayerItemActions';
import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { createNewSave } from '../../src/game/saves/SaveSchema';
import { itemId, equipmentSlotId } from '../../src/game/core/StableId';
import type { SaveV1 } from '../../src/game/saves/SaveSchema';
const content = CONTENT_REGISTRY.newGame;
function save() {
  const base = createNewSave({
    nowEpochMs: 100,
    location: {
      regionId: content.initialRegionId,
      areaId: content.initialAreaId,
      checkpointId: content.initialCheckpointId,
      safePosition: { x: 256, y: 608 },
    },
    baseStats: content.baseStats,
    initialQuests: content.initialQuests,
    startingAbilities: content.startingAbilities,
  });
  return {
    ...base,
    player: { ...base.player, currentHealth: 86 },
    inventory: [
      { itemId: itemId('quiet-step'), quantity: 1 },
      { itemId: itemId('sunmoss-draught'), quantity: 1 },
    ],
  };
}
describe('player item actions', () => {
  it('supports every charm slot and replaces an occupied slot without consuming either charm', () => {
    const original = save();
    let candidate: SaveV1 = {
      ...original,
      inventory: [
        { itemId: itemId('echo-thorn'), quantity: 1 },
        { itemId: itemId('quiet-step'), quantity: 1 },
        { itemId: itemId('resin-heart'), quantity: 1 },
        { itemId: itemId('sunmoss-draught'), quantity: 1 },
      ],
    };
    for (const [index, charm] of ['quiet-step', 'resin-heart', 'echo-thorn'].entries()) {
      const slot = ['charm-one', 'charm-two', 'charm-three'][index]!;
      const result = applyPlayerItemAction(
        candidate,
        {
          kind: 'equip-item',
          itemId: itemId(charm),
          slot: equipmentSlotId(slot),
          revision: index,
        },
        index,
      );
      expect(result.kind, result.copy).toBe('accepted');
      candidate = result.save;
    }
    expect(candidate.equipment).toHaveLength(3);
    candidate = applyPlayerItemAction(
      candidate,
      {
        kind: 'unequip-item',
        slot: equipmentSlotId('charm-two'),
        revision: 3,
      },
      3,
    ).save;
    const replaced = applyPlayerItemAction(
      candidate,
      {
        kind: 'equip-item',
        itemId: itemId('resin-heart'),
        slot: equipmentSlotId('charm-one'),
        revision: 4,
      },
      4,
    );
    expect(replaced.kind).toBe('accepted');
    expect(replaced.save.equipment).toContainEqual({ slot: 'charm-one', itemId: 'resin-heart' });
    expect(replaced.save.inventory).toEqual(candidate.inventory);
    expect(original.equipment).toEqual([]);
  });
  it('rejects invalid slots, unowned items, and repeated consumption without mutating the input', () => {
    const base = save();
    const original = { ...base, player: { ...base.player, currentMana: 20 } };
    for (const command of [
      {
        kind: 'equip-item' as const,
        itemId: itemId('quiet-step'),
        slot: equipmentSlotId('missing-slot'),
        revision: 0,
      },
      { kind: 'use-item' as const, itemId: itemId('wellspring-tonic'), revision: 0 },
    ]) {
      const result = applyPlayerItemAction(original, command, 0);
      expect(result.kind).toBe('rejected');
      expect(result.save).toBe(original);
    }
    const command = { kind: 'use-item' as const, itemId: itemId('sunmoss-draught'), revision: 0 };
    const first = applyPlayerItemAction(original, command, 0);
    expect(first.kind).toBe('accepted');
    const repeated = applyPlayerItemAction(first.save, command, 1);
    expect(repeated.kind).toBe('rejected');
    expect(repeated.save).toBe(first.save);
    expect(original.player.currentHealth).toBe(86);
    expect(original.inventory).toContainEqual({ itemId: 'sunmoss-draught', quantity: 1 });
  });
  it('heals and consumes one item atomically, clamped at maximum', () => {
    const result = applyPlayerItemAction(
      save(),
      { kind: 'use-item', itemId: itemId('sunmoss-draught'), revision: 4 },
      4,
    );
    expect(result.kind).toBe('accepted');
    expect(result.save.player.currentHealth).toBe(100);
    expect(result.save.inventory.some((item) => item.itemId === 'sunmoss-draught')).toBe(false);
  });
  it('rejects full health and stale requests without consuming the item', () => {
    const original = save();
    expect(
      applyPlayerItemAction(
        { ...original, player: { ...original.player, currentHealth: 100 } },
        { kind: 'use-item', itemId: itemId('sunmoss-draught'), revision: 4 },
        4,
      ).kind,
    ).toBe('rejected');
    expect(
      applyPlayerItemAction(
        original,
        { kind: 'use-item', itemId: itemId('sunmoss-draught'), revision: 3 },
        4,
      ),
    ).toMatchObject({ kind: 'rejected', save: original });
  });
  it('equips owned charms, rejects duplicate slots, and removes benefits on unequip', () => {
    const command = {
      kind: 'equip-item' as const,
      itemId: itemId('quiet-step'),
      slot: equipmentSlotId('charm-one'),
      revision: 4,
    };
    const result = applyPlayerItemAction(save(), command, 4);
    expect(result.save.equipment).toEqual([{ itemId: 'quiet-step', slot: 'charm-one' }]);
    expect(
      applyPlayerItemAction(result.save, { ...command, slot: equipmentSlotId('charm-two') }, 4)
        .kind,
    ).toBe('rejected');
    expect(
      applyPlayerItemAction(
        result.save,
        { kind: 'unequip-item', slot: command.slot, revision: 4 },
        4,
      ).save.equipment,
    ).toEqual([]);
  });
});
