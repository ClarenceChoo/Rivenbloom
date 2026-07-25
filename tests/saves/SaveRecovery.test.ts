import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemorySaveRepository } from '../../src/game/saves/MemorySaveRepository';
import { SaveService } from '../../src/game/saves/SaveService';
import type {
  SaveReadResult,
  SaveRepository,
  SaveSlotPreview
} from '../../src/game/saves/SaveRepository';
import {
  createDefaultSave,
  createSaveEnvelope,
  type SaveSlotId
} from '../../src/game/saves/SaveSchema';

const slot1 = 'slot-1' as SaveSlotId;
const slot2 = 'slot-2' as SaveSlotId;
const slot3 = 'slot-3' as SaveSlotId;

afterEach(() => vi.useRealTimers());

type Deferred = {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
};

const deferred = (): Deferred => {
  let resolve = (): void => undefined;
  let reject = (_error: Error): void => undefined;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

class DelayedSaveRepository implements SaveRepository {
  public readonly writes: Array<{ readonly slot: SaveSlotId; readonly gate: Deferred }> = [];
  private readonly memory = new MemorySaveRepository();

  public list(): Promise<readonly SaveSlotPreview[]> {
    return this.memory.list();
  }

  public read(slot: SaveSlotId): Promise<SaveReadResult> {
    return this.memory.read(slot);
  }

  public async write(slot: SaveSlotId, save: ReturnType<typeof createDefaultSave>): Promise<void> {
    const gate = deferred();
    this.writes.push({ slot, gate });
    await gate.promise;
    await this.memory.write(slot, save);
  }

  public delete(slot: SaveSlotId): Promise<void> {
    return this.memory.delete(slot);
  }
}

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

  it('does not cross-load an envelope that belongs to another slot', async () => {
    const wrongSlotEnvelope = createSaveEnvelope(createDefaultSave(slot2, 10), 10);
    const repository = new MemorySaveRepository({
      [slot1]: { current: wrongSlotEnvelope, backup: wrongSlotEnvelope }
    });

    await expect(repository.read(slot1)).resolves.toMatchObject({ kind: 'corrupt' });
  });

  it('uses a same-slot backup rather than a valid envelope from another slot', async () => {
    const wrongSlotEnvelope = createSaveEnvelope(createDefaultSave(slot2, 10), 10);
    const backup = createSaveEnvelope(createDefaultSave(slot1, 11), 11);
    const repository = new MemorySaveRepository({
      [slot1]: { current: wrongSlotEnvelope, backup }
    });

    await expect(repository.read(slot1)).resolves.toMatchObject({
      kind: 'loaded',
      recoveredFromBackup: true,
      save: { slotId: slot1, metadata: { createdAt: 11 } }
    });
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

  it('waits for a started autosave before importing so stale state cannot overwrite it', async () => {
    vi.useFakeTimers();
    const repository = new DelayedSaveRepository();
    const service = new SaveService(repository, { autosaveDelayMs: 1 });
    const stale = createDefaultSave(slot1, 10);
    const imported = {
      ...createDefaultSave(slot1, 20),
      player: { ...createDefaultSave(slot1, 20).player, currency: 88 }
    };

    service.scheduleAutosave(slot1, stale);
    await vi.advanceTimersByTimeAsync(1);
    const preview = await service.import(JSON.stringify(imported));
    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') throw new Error('Expected a valid import preview.');

    const confirmation = service.confirmImport(preview, slot1);
    expect(repository.writes).toHaveLength(1);
    repository.writes[0]?.gate.resolve();
    await vi.waitFor(() => expect(repository.writes).toHaveLength(2));
    repository.writes[1]?.gate.resolve();
    await confirmation;

    await expect(repository.read(slot1)).resolves.toMatchObject({
      kind: 'loaded',
      save: { player: { currency: 88 } }
    });
  });

  it('does not resolve flushAutosaves before a started write finishes', async () => {
    vi.useFakeTimers();
    const repository = new DelayedSaveRepository();
    const service = new SaveService(repository, { autosaveDelayMs: 1 });

    service.scheduleAutosave(slot1, createDefaultSave(slot1, 10));
    await vi.advanceTimersByTimeAsync(1);
    let flushed = false;
    const flushing = service.flushAutosaves().then(() => {
      flushed = true;
    });
    await Promise.resolve();
    expect(flushed).toBe(false);

    repository.writes[0]?.gate.resolve();
    await flushing;
    expect(flushed).toBe(true);
  });

  it('waits for a started autosave before deleting its slot', async () => {
    vi.useFakeTimers();
    const repository = new DelayedSaveRepository();
    const service = new SaveService(repository, { autosaveDelayMs: 1 });

    service.scheduleAutosave(slot1, createDefaultSave(slot1, 10));
    await vi.advanceTimersByTimeAsync(1);
    const deleting = service.delete(slot1);
    expect(repository.writes).toHaveLength(1);
    repository.writes[0]?.gate.resolve();
    await deleting;

    await expect(repository.read(slot1)).resolves.toEqual({ kind: 'empty' });
  });

  it('returns autosave failures to callers instead of leaving them unhandled', async () => {
    vi.useFakeTimers();
    const repository = new DelayedSaveRepository();
    const service = new SaveService(repository, { autosaveDelayMs: 1 });

    const scheduled = service.scheduleAutosave(slot1, createDefaultSave(slot1, 10));
    await vi.advanceTimersByTimeAsync(1);
    repository.writes[0]?.gate.reject(new Error('disk full'));

    await expect(scheduled).rejects.toThrow('disk full');
    await expect(service.flushAutosaves()).rejects.toThrow('disk full');
  });

  it('does not return an import preview for a malformed V0 payload', async () => {
    const service = new SaveService(new MemorySaveRepository());

    await expect(
      service.import(
        JSON.stringify({
          schemaVersion: 0,
          slotId: 'slot-1',
          savedAt: -1,
          playtimeSeconds: 1,
          areaId: 'wrens-rest',
          position: { x: 0, y: 0 },
          health: 100,
          mana: 50,
          currency: 0
        })
      )
    ).resolves.toEqual({ kind: 'invalid', reason: 'invalid-save' });
  });
});
