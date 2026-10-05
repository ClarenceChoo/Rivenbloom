import { describe, expect, test } from 'vitest';

import {
  queueCombatManaAutosave,
  queueCombatVitalityAutosave,
} from '../../src/game/saves/CombatSavePatch';
import { validateSaveV1 } from '../../src/game/saves/SaveSchema';
import type { SaveSlotId, SaveV1 } from '../../src/game/saves/SaveSchema';
import { rawSaveV1 } from './saveFixtures';

function validSave(): SaveV1 {
  const result = validateSaveV1(rawSaveV1());
  if (result.kind !== 'valid') throw new Error('Expected valid fixture.');
  return result.value;
}

describe('queueCombatManaAutosave', () => {
  test('patches only mana and advancing metadata while preserving current progression fields', () => {
    const save = validSave();
    const queued: Array<{ slotId: SaveSlotId; save: SaveV1 }> = [];
    const service = {
      queueAutosave: (slotId: SaveSlotId, candidate: SaveV1) =>
        queued.push({ slotId, save: candidate }),
    };

    const patched = queueCombatManaAutosave(service, 'slot-2', save, 11, 1_700_000_040_000, 31_250);

    expect(patched.player).toEqual({ ...save.player, currentMana: 11 });
    expect(patched.metadata).toEqual({
      ...save.metadata,
      snapshotAtEpochMs: 1_700_000_040_000,
      playTimeMs: 31_250,
    });
    expect(patched.inventory).toBe(save.inventory);
    expect(patched.equipment).toBe(save.equipment);
    expect(patched.quests).toBe(save.quests);
    expect(patched.worldProgress).toBe(save.worldProgress);
    expect(patched.player.unlockedAbilities).toEqual(['bramble-bolt', 'moth-glimmer']);
    expect(queued).toEqual([{ slotId: 'slot-2', save: patched }]);
    expect(Object.isFrozen(patched)).toBe(true);
    expect(Object.isFrozen(patched.player)).toBe(true);
    expect(Object.isFrozen(patched.metadata)).toBe(true);
  });

  test('rejects invalid mana or regressed metadata without queuing', () => {
    const save = validSave();
    let calls = 0;
    const service = { queueAutosave: () => (calls += 1) };

    expect(() =>
      queueCombatManaAutosave(service, 'slot-1', save, -1, save.metadata.snapshotAtEpochMs, 30_000),
    ).toThrow(RangeError);
    expect(() =>
      queueCombatManaAutosave(
        service,
        'slot-1',
        save,
        10,
        save.metadata.snapshotAtEpochMs - 1,
        30_000,
      ),
    ).toThrow(RangeError);
    expect(() =>
      queueCombatManaAutosave(service, 'slot-1', save, 10, save.metadata.snapshotAtEpochMs, 29_999),
    ).toThrow(RangeError);
    expect(calls).toBe(0);
  });
});

describe('queueCombatVitalityAutosave', () => {
  test('composes same-frame health and mana patches from the latest immutable save', () => {
    const save = validSave();
    const queued: SaveV1[] = [];
    const service = {
      queueAutosave: (_slotId: SaveSlotId, candidate: SaveV1) => queued.push(candidate),
    };
    const afterHealth = queueCombatVitalityAutosave(
      service,
      'slot-1',
      save,
      { currentHealth: 73, currentMana: save.player.currentMana },
      1_700_000_040_000,
      31_000,
    );
    const afterMana = queueCombatVitalityAutosave(
      service,
      'slot-1',
      afterHealth,
      { currentHealth: afterHealth.player.currentHealth, currentMana: 9 },
      1_700_000_040_000,
      31_000,
    );

    expect(afterMana.player).toEqual({ ...save.player, currentHealth: 73, currentMana: 9 });
    expect(afterMana.inventory).toBe(save.inventory);
    expect(afterMana.quests).toBe(save.quests);
    expect(queued).toEqual([afterHealth, afterMana]);
  });

  test('accepts zero health but rejects out-of-range health transactionally', () => {
    const save = validSave();
    let calls = 0;
    const service = { queueAutosave: () => (calls += 1) };

    const dead = queueCombatVitalityAutosave(
      service,
      'slot-1',
      save,
      { currentHealth: 0, currentMana: save.player.currentMana },
      save.metadata.snapshotAtEpochMs,
      save.metadata.playTimeMs,
    );
    expect(dead.player.currentHealth).toBe(0);
    expect(() =>
      queueCombatVitalityAutosave(
        service,
        'slot-1',
        save,
        {
          currentHealth: save.player.baseStats.maxHealth + 1,
          currentMana: save.player.currentMana,
        },
        save.metadata.snapshotAtEpochMs,
        save.metadata.playTimeMs,
      ),
    ).toThrow(RangeError);
    expect(calls).toBe(1);
  });
});
