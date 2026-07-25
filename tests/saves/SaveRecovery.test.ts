import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemorySaveRepository } from '../../src/game/saves/MemorySaveRepository';
import { SaveService } from '../../src/game/saves/SaveService';
import {
  createDefaultSave,
  createSaveEnvelope,
  type SaveSlotId
} from '../../src/game/saves/SaveSchema';

const slot1 = 'slot-1' as SaveSlotId;
const slot2 = 'slot-2' as SaveSlotId;
const slot3 = 'slot-3' as SaveSlotId;

afterEach(() => vi.useRealTimers());

describe('MemorySaveRepository', () => {
  it('keeps all three slots isolated', async () => {
    const repository = new MemorySaveRepository();
    const first = createDefaultSave(slot1, 1);
    const second = createDefaultSave(slot2, 2);

    await repository.write(slot1, { ...first, player: { ...first.player, currency: 4 } });
    await repository.write(slot2, { ...second, player: { ...second.player, currency: 9 } });

    await expect(repository.read(slot1)).resolves.toMatchObject({
      kind: 'loaded',
      save: { slotId: slot1, player: { currency: 4 } }
    });
    await expect(repository.read(slot2)).resolves.toMatchObject({
      kind: 'loaded',
      save: { slotId: slot2, player: { currency: 9 } }
    });
    await expect(repository.read(slot3)).resolves.toEqual({ kind: 'empty' });
  });

  it('recovers the previous valid payload when the current record is corrupt', async () => {
    const backup = createSaveEnvelope(createDefaultSave(slot1, 10), 10);
    const repository = new MemorySaveRepository({
      [slot1]: { current: { ...backup, checksum: 'tampered' }, backup }
    });

    await expect(repository.read(slot1)).resolves.toMatchObject({
      kind: 'loaded',
      recoveredFromBackup: true,
      notice: 'Recovered save from backup.',
      save: { metadata: { createdAt: 10 } }
    });
  });

  it('reports corruption when neither current nor backup is valid', async () => {
    const repository = new MemorySaveRepository({
      [slot1]: {
        current: { schemaVersion: 1, checksum: 'bad' },
        backup: { schemaVersion: 1, checksum: 'also-bad' }
      }
    });

    await expect(repository.read(slot1)).resolves.toMatchObject({ kind: 'corrupt' });
  });
});

describe('SaveService', () => {
  it('does not write an import candidate until it is explicitly confirmed', async () => {
    const repository = new MemorySaveRepository();
    const service = new SaveService(repository);
    const candidate = {
      ...createDefaultSave(slot1, 10),
      player: { ...createDefaultSave(slot1, 10).player, currency: 77 }
    };

    const preview = await service.import(JSON.stringify(candidate));

    expect(preview).toMatchObject({ kind: 'ready', preview: { slotId: slot1, currency: 77 } });
    await expect(repository.read(slot1)).resolves.toEqual({ kind: 'empty' });

    if (preview.kind === 'ready') {
      await service.confirmImport(preview, slot2);
    }

    await expect(repository.read(slot2)).resolves.toMatchObject({
      kind: 'loaded',
      save: { slotId: slot2, player: { currency: 77 } }
    });
  });

  it('exports a validated current payload and deletes both current and backup records', async () => {
    const repository = new MemorySaveRepository();
    const service = new SaveService(repository);
    await repository.write(slot1, createDefaultSave(slot1, 10));

    expect(JSON.parse(await service.export(slot1))).toMatchObject({
      schemaVersion: 1,
      slotId: slot1
    });
    await service.delete(slot1);
    await expect(repository.read(slot1)).resolves.toEqual({ kind: 'empty' });
  });

  it('debounces autosaves so the most recent pending save is persisted once', async () => {
    vi.useFakeTimers();
    const repository = new MemorySaveRepository();
    const service = new SaveService(repository, { autosaveDelayMs: 100 });
    const initial = createDefaultSave(slot1, 10);
    const latest = { ...initial, player: { ...initial.player, currency: 99 } };

    service.scheduleAutosave(slot1, initial);
    service.scheduleAutosave(slot1, latest);
    await vi.advanceTimersByTimeAsync(99);
    await expect(repository.read(slot1)).resolves.toEqual({ kind: 'empty' });

    await vi.advanceTimersByTimeAsync(1);
    await expect(repository.read(slot1)).resolves.toMatchObject({
      kind: 'loaded',
      save: { player: { currency: 99 } }
    });
  });
});
