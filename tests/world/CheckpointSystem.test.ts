import { describe, expect, it } from 'vitest';
import { maxHealthFor, maxManaFor } from '../../src/game/config/balance';
import { getAreaDefinition, INITIAL_WORLD_AREA_ID } from '../../src/game/data/areas';
import { createDefaultSave, type SaveSlotId } from '../../src/game/saves/SaveSchema';
import { CheckpointSystem } from '../../src/game/world/CheckpointSystem';

const area = getAreaDefinition(INITIAL_WORLD_AREA_ID);
if (area === undefined) throw new Error('Missing Brackenreach trail definition.');
const slot = 'slot-1' as SaveSlotId;

describe('CheckpointSystem', () => {
  it('activates a seed-lantern idempotently, refilling vitality and recording the flag', () => {
    const system = new CheckpointSystem(area);
    const wounded = {
      ...createDefaultSave(slot, 100),
      player: { ...createDefaultSave(slot, 100).player, health: 12, mana: 3 }
    };

    const first = system.activate(wounded, 'trail-seed-lantern', 200);
    expect(first.firstActivation).toBe(true);
    expect(first.save.player.health).toBe(maxHealthFor(0));
    expect(first.save.player.mana).toBe(maxManaFor(0));
    expect(first.save.metadata.safePosition).toEqual({ x: 278, y: 566 });
    expect(first.save.questFlags).toContain('checkpoint-trail-seed-lantern');

    const second = system.activate(first.save, 'trail-seed-lantern', 300);
    expect(second.firstActivation).toBe(false);
    expect(
      second.save.questFlags.filter((flag) => flag === 'checkpoint-trail-seed-lantern')
    ).toHaveLength(1);

    expect(() => system.activate(wounded, 'missing-lantern', 100)).toThrow(/Unknown checkpoint/);
  });

  it('restores at an activated checkpoint and falls back to the default spawn otherwise', () => {
    const system = new CheckpointSystem(area);
    const fresh = system.restore(createDefaultSave(slot, 100));
    expect(fresh.fromCheckpoint).toBe(false);
    expect(fresh.spawn.id).toBe('trail-west');

    const rested = system.activate(createDefaultSave(slot, 100), 'trail-seed-lantern', 200).save;
    const restored = system.restore(rested);
    expect(restored.fromCheckpoint).toBe(true);
    expect(restored.spawn.position).toEqual({ x: 278, y: 566 });
    expect(restored.spawn.roomId).toBe('trailhead');

    const foreign = {
      ...rested,
      metadata: { ...rested.metadata, areaId: 'somewhere-else' }
    };
    expect(system.restore(foreign).fromCheckpoint).toBe(false);
  });

  it('respawns a dead player at the checkpoint with vitality refilled and progress intact', () => {
    const system = new CheckpointSystem(area);
    const rested = system.activate(createDefaultSave(slot, 100), 'trail-seed-lantern', 200).save;
    const dead = {
      ...rested,
      player: { ...rested.player, health: 0, mana: 0 },
      openedChestIds: ['trail-chest-1']
    };

    const { save, restored } = system.respawnAfterDeath(dead, 400);
    expect(save.player.health).toBe(maxHealthFor(0));
    expect(save.player.mana).toBe(maxManaFor(0));
    expect(save.openedChestIds).toEqual(['trail-chest-1']);
    expect(restored.fromCheckpoint).toBe(true);
    expect(restored.spawn.position).toEqual({ x: 278, y: 566 });
  });
});
