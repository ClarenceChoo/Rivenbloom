import { describe, expect, it } from 'vitest';

import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { createNewSave } from '../../src/game/saves/SaveSchema';
import type { StoredSlotRecord } from '../../src/game/saves/SaveRepository';
import {
  TauriSaveRepository,
  tauriInvokeFromRuntime,
} from '../../src/game/saves/TauriSaveRepository';

describe('TauriSaveRepository', () => {
  it('matches repository write, backup, read, list, and delete semantics through invoke', async () => {
    const records = new Map<string, StoredSlotRecord>();
    const repository = new TauriSaveRepository(
      async <T>(command: string, args: Record<string, unknown> = {}) => {
        const slot = String(args.slotId);
        if (command === 'read_save_record') return (records.get(slot) ?? null) as T;
        if (command === 'compare_and_swap_save_record') {
          const current = records.get(slot) ?? null;
          if (JSON.stringify(current) !== JSON.stringify(args.expected ?? null)) return false as T;
          records.set(slot, args.replacement as StoredSlotRecord);
          return true as T;
        }
        if (command === 'delete_save_record') {
          records.delete(slot);
          return undefined as T;
        }
        throw new Error(`Unexpected command ${command}`);
      },
    );
    const { newGame } = CONTENT_REGISTRY;
    const first = createNewSave({
      nowEpochMs: 100,
      location: {
        regionId: newGame.initialRegionId,
        areaId: newGame.initialAreaId,
        checkpointId: newGame.initialCheckpointId,
        safePosition: { x: 256, y: 608 },
      },
      baseStats: newGame.baseStats,
      initialQuests: newGame.initialQuests,
      startingAbilities: newGame.startingAbilities,
    });
    await repository.write('slot-1', first);
    await repository.write('slot-1', { ...first, player: { ...first.player, currency: 8 } });
    expect(await repository.read('slot-1')).toMatchObject({
      kind: 'loaded',
      save: { player: { currency: 8 } },
    });
    expect(await repository.list()).toContainEqual(
      expect.objectContaining({ slotId: 'slot-1', state: 'ready' }),
    );
    await repository.delete('slot-1');
    expect(await repository.read('slot-1')).toEqual({ kind: 'empty' });
  });

  it('detects Tauri only from the narrow runtime invoke capability', () => {
    expect(tauriInvokeFromRuntime({})).toBeNull();
    expect(
      tauriInvokeFromRuntime({ __TAURI_INTERNALS__: { invoke: () => undefined } }),
    ).not.toBeNull();
  });
});
