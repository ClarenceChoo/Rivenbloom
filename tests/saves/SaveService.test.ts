import { describe, expect, it } from 'vitest';

import { createSaveEnvelopeJson, decodeSaveEnvelope } from '../../src/game/saves/SaveEnvelope';
import {
  MemoryRawSaveStore,
  MemorySaveRepository,
} from '../../src/game/saves/MemorySaveRepository';
import type {
  SaveReadResult,
  SaveRepository,
  SaveSlotPreview,
} from '../../src/game/saves/SaveRepository';
import { SaveStorageError } from '../../src/game/saves/SaveRepository';
import { SaveExportError, SaveImportError, SaveService } from '../../src/game/saves/SaveService';
import type { SaveCommitScheduler, SaveScheduler } from '../../src/game/saves/SaveService';
import type { SaveSlotId, SaveV1 } from '../../src/game/saves/SaveSchema';
import { validateSaveV1 } from '../../src/game/saves/SaveSchema';
import { rawSaveV1 } from './saveFixtures';

class ManualScheduler implements SaveScheduler {
  private nextId = 1;
  private readonly callbacks = new Map<number, () => void>();

  public schedule(_delayMs: number, callback: () => void): number {
    const id = this.nextId++;
    this.callbacks.set(id, callback);
    return id;
  }

  public cancel(handle: unknown): void {
    if (typeof handle === 'number') this.callbacks.delete(handle);
  }

  public runAll(): void {
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    callbacks.forEach((callback) => callback());
  }

  public get pendingCount(): number {
    return this.callbacks.size;
  }
}

class GateNextCommitScheduler implements SaveCommitScheduler {
  private shouldBlockNext = false;
  private blockedResolve: (() => void) | null = null;
  private releaseBlocked: (() => void) | null = null;

  public blockNext(): Promise<void> {
    this.shouldBlockNext = true;
    return new Promise<void>((resolve) => {
      this.blockedResolve = resolve;
    });
  }

  public async waitForCommitTurn(): Promise<void> {
    if (!this.shouldBlockNext) return;
    this.shouldBlockNext = false;
    this.blockedResolve?.();
    await new Promise<void>((resolve) => {
      this.releaseBlocked = resolve;
    });
  }

  public release(): void {
    this.releaseBlocked?.();
  }
}

class GateRepository implements SaveRepository {
  private releaseFirstWrite: (() => void) | null = null;
  private firstWriteStartedResolve: (() => void) | null = null;
  public readonly firstWriteStarted = new Promise<void>((resolve) => {
    this.firstWriteStartedResolve = resolve;
  });
  private writeCount = 0;

  public constructor(private readonly inner: SaveRepository) {}

  public list(): Promise<readonly SaveSlotPreview[]> {
    return this.inner.list();
  }

  public read(slot: SaveSlotId): Promise<SaveReadResult> {
    return this.inner.read(slot);
  }

  public async write(slot: SaveSlotId, save: SaveV1): Promise<void> {
    this.writeCount += 1;
    if (this.writeCount === 1) {
      this.firstWriteStartedResolve?.();
      await new Promise<void>((resolve) => {
        this.releaseFirstWrite = resolve;
      });
    }
    await this.inner.write(slot, save);
  }

  public delete(slot: SaveSlotId): Promise<void> {
    return this.inner.delete(slot);
  }

  public release(): void {
    this.releaseFirstWrite?.();
  }
}

class GateDeleteRepository implements SaveRepository {
  private releaseDelete: (() => void) | null = null;
  private deleteStartedResolve: (() => void) | null = null;
  public readonly deleteStarted = new Promise<void>((resolve) => {
    this.deleteStartedResolve = resolve;
  });

  public constructor(private readonly inner: SaveRepository) {}

  public list(): Promise<readonly SaveSlotPreview[]> {
    return this.inner.list();
  }

  public read(slot: SaveSlotId): Promise<SaveReadResult> {
    return this.inner.read(slot);
  }

  public write(slot: SaveSlotId, value: SaveV1): Promise<void> {
    return this.inner.write(slot, value);
  }

  public async delete(slot: SaveSlotId): Promise<void> {
    this.deleteStartedResolve?.();
    await new Promise<void>((resolve) => {
      this.releaseDelete = resolve;
    });
    await this.inner.delete(slot);
  }

  public release(): void {
    this.releaseDelete?.();
  }
}

class FailingRepository implements SaveRepository {
  public constructor(private readonly message: string) {}

  public async list(): Promise<readonly SaveSlotPreview[]> {
    throw new SaveStorageError('list', this.message);
  }

  public async read(_slot: SaveSlotId): Promise<SaveReadResult> {
    void _slot;
    throw new SaveStorageError('read', this.message);
  }

  public async write(_slot: SaveSlotId, _save: SaveV1): Promise<void> {
    void _slot;
    void _save;
    throw new SaveStorageError('write', this.message);
  }

  public async delete(_slot: SaveSlotId): Promise<void> {
    void _slot;
    throw new SaveStorageError('delete', this.message);
  }
}

class ToggleRepository implements SaveRepository {
  public failing = false;

  public constructor(private readonly inner: SaveRepository) {}

  public list(): Promise<readonly SaveSlotPreview[]> {
    return this.requireAvailable('list', () => this.inner.list());
  }

  public read(slot: SaveSlotId): Promise<SaveReadResult> {
    return this.requireAvailable('read', () => this.inner.read(slot));
  }

  public write(slot: SaveSlotId, value: SaveV1): Promise<void> {
    return this.requireAvailable('write', () => this.inner.write(slot, value));
  }

  public delete(slot: SaveSlotId): Promise<void> {
    return this.requireAvailable('delete', () => this.inner.delete(slot));
  }

  private requireAvailable<Value>(
    operation: SaveStorageError['operation'],
    action: () => Promise<Value>,
  ): Promise<Value> {
    if (this.failing) {
      return Promise.reject(new SaveStorageError(operation, 'disk offline'));
    }
    return action();
  }
}

class DelayedPrimaryRepository implements SaveRepository {
  private releaseSlotOneWrite: (() => void) | null = null;
  private slotOneWriteStartedResolve: (() => void) | null = null;
  public readonly slotOneWriteStarted = new Promise<void>((resolve) => {
    this.slotOneWriteStartedResolve = resolve;
  });

  public constructor(private readonly inner: SaveRepository) {}

  public list(): Promise<readonly SaveSlotPreview[]> {
    return this.inner.list();
  }

  public read(slot: SaveSlotId): Promise<SaveReadResult> {
    return this.inner.read(slot);
  }

  public async write(slot: SaveSlotId, value: SaveV1): Promise<void> {
    if (slot === 'slot-2') throw new SaveStorageError('write', 'slot-2 failed');
    if (slot === 'slot-1') {
      this.slotOneWriteStartedResolve?.();
      await new Promise<void>((resolve) => {
        this.releaseSlotOneWrite = resolve;
      });
    }
    await this.inner.write(slot, value);
  }

  public delete(slot: SaveSlotId): Promise<void> {
    return this.inner.delete(slot);
  }

  public releaseSlotOne(): void {
    this.releaseSlotOneWrite?.();
  }
}

class SelectiveFailureRepository implements SaveRepository {
  public failSlotTwo = false;

  public constructor(private readonly inner: SaveRepository) {}

  public list(): Promise<readonly SaveSlotPreview[]> {
    return this.inner.list();
  }

  public read(slot: SaveSlotId): Promise<SaveReadResult> {
    return this.inner.read(slot);
  }

  public write(slot: SaveSlotId, value: SaveV1): Promise<void> {
    if (this.failSlotTwo && slot === 'slot-2') {
      return Promise.reject(new SaveStorageError('write', 'slot-2 failed'));
    }
    return this.inner.write(slot, value);
  }

  public delete(slot: SaveSlotId): Promise<void> {
    return this.inner.delete(slot);
  }
}

class GateFirstWriteRepository implements SaveRepository {
  private releaseFirstWrite: (() => void) | null = null;
  private firstWriteStartedResolve: (() => void) | null = null;
  public readonly firstWriteStarted = new Promise<void>((resolve) => {
    this.firstWriteStartedResolve = resolve;
  });
  private writeCount = 0;

  public constructor(private readonly inner: SaveRepository) {}

  public list(): Promise<readonly SaveSlotPreview[]> {
    return this.inner.list();
  }

  public read(slot: SaveSlotId): Promise<SaveReadResult> {
    return this.inner.read(slot);
  }

  public async write(slot: SaveSlotId, value: SaveV1): Promise<void> {
    this.writeCount += 1;
    if (this.writeCount === 1) {
      this.firstWriteStartedResolve?.();
      await new Promise<void>((resolve) => {
        this.releaseFirstWrite = resolve;
      });
    }
    await this.inner.write(slot, value);
  }

  public delete(slot: SaveSlotId): Promise<void> {
    return this.inner.delete(slot);
  }

  public release(): void {
    this.releaseFirstWrite?.();
  }
}

class FailFirstWriteRepository implements SaveRepository {
  private rejectFirstWrite: (() => void) | null = null;
  private firstWriteStartedResolve: (() => void) | null = null;
  public readonly firstWriteStarted = new Promise<void>((resolve) => {
    this.firstWriteStartedResolve = resolve;
  });
  private writeCount = 0;

  public constructor(private readonly inner: SaveRepository) {}

  public list(): Promise<readonly SaveSlotPreview[]> {
    return this.inner.list();
  }

  public read(slot: SaveSlotId): Promise<SaveReadResult> {
    return this.inner.read(slot);
  }

  public async write(slot: SaveSlotId, value: SaveV1): Promise<void> {
    this.writeCount += 1;
    if (this.writeCount === 1) {
      this.firstWriteStartedResolve?.();
      await new Promise<void>((_resolve, reject) => {
        this.rejectFirstWrite = () => reject(new SaveStorageError('write', 'first failed'));
      });
    }
    await this.inner.write(slot, value);
  }

  public delete(slot: SaveSlotId): Promise<void> {
    return this.inner.delete(slot);
  }

  public rejectFirst(): void {
    this.rejectFirstWrite?.();
  }
}

class DelayedFailureRepository implements SaveRepository {
  private rejectWrite: (() => void) | null = null;
  private writeStartedResolve: (() => void) | null = null;
  public readonly writeStarted = new Promise<void>((resolve) => {
    this.writeStartedResolve = resolve;
  });

  public async list(): Promise<readonly SaveSlotPreview[]> {
    throw new SaveStorageError('list', 'delayed failure');
  }

  public async read(_slot: SaveSlotId): Promise<SaveReadResult> {
    void _slot;
    throw new SaveStorageError('read', 'delayed failure');
  }

  public async write(_slot: SaveSlotId, _value: SaveV1): Promise<void> {
    void _slot;
    void _value;
    this.writeStartedResolve?.();
    await new Promise<void>((_resolve, reject) => {
      this.rejectWrite = () => reject(new SaveStorageError('write', 'delayed failure'));
    });
  }

  public async delete(_slot: SaveSlotId): Promise<void> {
    void _slot;
    throw new SaveStorageError('delete', 'delayed failure');
  }

  public reject(): void {
    this.rejectWrite?.();
  }
}

function save(playTimeMs: number): SaveV1 {
  const candidate = rawSaveV1();
  candidate.metadata.playTimeMs = playTimeMs;
  const result = validateSaveV1(candidate);
  if (result.kind !== 'valid') throw new Error('Save fixture must validate.');
  return result.value;
}

describe('SaveService', () => {
  it('debounces per slot, keeps the latest immutable queued snapshot, and writes distinct slots independently', async () => {
    const scheduler = new ManualScheduler();
    const repository = new MemorySaveRepository({ clock: () => 100 });
    const service = new SaveService(repository, { scheduler, debounceMs: 500 });
    const mutable = save(1);

    service.queueAutosave('slot-1', mutable);
    Reflect.set(mutable.metadata, 'playTimeMs', 999);
    service.queueAutosave('slot-1', save(2));
    service.queueAutosave('slot-2', save(3));

    expect(scheduler.pendingCount).toBe(2);
    scheduler.runAll();
    await service.flush();
    await expect(repository.read('slot-1')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 2 } },
    });
    await expect(repository.read('slot-2')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 3 } },
    });
  });

  it('flush cancels a debounce and writes pending work immediately', async () => {
    const scheduler = new ManualScheduler();
    const repository = new MemorySaveRepository({ clock: () => 100 });
    const service = new SaveService(repository, { scheduler });
    service.queueAutosave('slot-1', save(4));

    await service.flush('slot-1');

    expect(scheduler.pendingCount).toBe(0);
    await expect(repository.read('slot-1')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 4 } },
    });
  });

  it('serializes same-slot writes and preserves a snapshot queued during an in-flight write', async () => {
    const scheduler = new ManualScheduler();
    const inner = new MemorySaveRepository({ clock: () => 100 });
    const repository = new GateRepository(inner);
    const service = new SaveService(repository, { scheduler });
    service.queueAutosave('slot-1', save(5));
    scheduler.runAll();
    await repository.firstWriteStarted;

    service.queueAutosave('slot-1', save(6));
    scheduler.runAll();
    repository.release();
    await service.flush('slot-1');

    await expect(inner.read('slot-1')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 6 } },
    });
  });

  it('prepares import without writes, confirms exactly once, and rejects reuse', async () => {
    const repository = new MemorySaveRepository({ clock: () => 200 });
    const service = new SaveService(repository);
    const candidateJson = await createSaveEnvelopeJson(save(7), 150);

    const prepared = await service.import(candidateJson);

    expect(prepared.kind).toBe('ready');
    await expect(repository.read('slot-1')).resolves.toEqual({ kind: 'empty' });
    if (prepared.kind !== 'ready') return;
    await service.confirmImport(prepared.candidateId, 'slot-1');
    await expect(repository.read('slot-1')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 7 } },
    });
    await expect(service.confirmImport(prepared.candidateId, 'slot-2')).rejects.toBeInstanceOf(
      SaveImportError,
    );
  });

  it('import confirmation and deletion cancel stale autosaves', async () => {
    const scheduler = new ManualScheduler();
    const repository = new MemorySaveRepository({ clock: () => 200 });
    const service = new SaveService(repository, { scheduler });
    service.queueAutosave('slot-1', save(8));
    const prepared = await service.import(await createSaveEnvelopeJson(save(9), 180));
    if (prepared.kind !== 'ready') throw new Error('Expected valid import fixture.');

    await service.confirmImport(prepared.candidateId, 'slot-1');
    scheduler.runAll();
    await service.flush('slot-1');
    await expect(repository.read('slot-1')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 9 } },
    });

    service.queueAutosave('slot-1', save(10));
    await service.delete('slot-1');
    scheduler.runAll();
    await service.flush('slot-1');
    await expect(repository.read('slot-1')).resolves.toEqual({ kind: 'empty' });
  });

  it('switches once to memory fallback, seeds last-known saves, and retries the failed snapshot', async () => {
    const primary = new ToggleRepository(new MemorySaveRepository({ clock: () => 100 }));
    const fallback = new MemorySaveRepository({ clock: () => 200 });
    const service = new SaveService(primary, { fallback });
    await service.saveNow('slot-1', save(11));
    await service.read('slot-1');
    primary.failing = true;

    await service.saveNow('slot-2', save(12));
    expect(service.getSaveState('slot-1')).toBe('session-only');
    expect(service.getSaveState('slot-2')).toBe('session-only');

    await expect(fallback.read('slot-1')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 11 } },
    });
    await expect(fallback.read('slot-2')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 12 } },
    });
    expect(service.getNotices()).toContainEqual({
      code: 'storage-fallback',
      persistent: true,
      message: 'Persistent save storage failed; this session is using memory storage.',
    });
  });

  it('retains dirty work and rejects a typed error when fallback also fails', async () => {
    const service = new SaveService(new FailingRepository('primary failed'), {
      fallback: new FailingRepository('fallback failed'),
    });

    await expect(service.saveNow('slot-1', save(13))).rejects.toBeInstanceOf(SaveStorageError);
    expect(service.hasDirtySave('slot-1')).toBe(true);
    expect(service.getNotices()).toContainEqual({
      code: 'autosave-failed',
      slotId: 'slot-1',
      persistent: false,
      message: 'Save failed; progress remains queued for retry.',
    });
  });

  it('retries simultaneous primary failures through the same one-time fallback switch', async () => {
    const primary = new ToggleRepository(new MemorySaveRepository());
    primary.failing = true;
    const fallback = new MemorySaveRepository({ clock: () => 300 });
    const service = new SaveService(primary, { fallback });

    await Promise.all([service.saveNow('slot-1', save(51)), service.saveNow('slot-2', save(52))]);

    await expect(fallback.read('slot-1')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 51 } },
    });
    await expect(fallback.read('slot-2')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 52 } },
    });
    expect(
      service.getNotices().filter((notice) => notice.code === 'storage-fallback'),
    ).toHaveLength(1);
  });

  it('mirrors a delayed primary success when another slot starts fallback cutover', async () => {
    const primary = new DelayedPrimaryRepository(new MemorySaveRepository({ clock: () => 100 }));
    const fallback = new MemorySaveRepository({ clock: () => 200 });
    const service = new SaveService(primary, { fallback });

    const delayed = service.saveNow('slot-1', save(53));
    await primary.slotOneWriteStarted;
    await service.saveNow('slot-2', save(54));
    primary.releaseSlotOne();
    await delayed;

    await expect(fallback.read('slot-1')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 53 } },
    });
    await expect(fallback.read('slot-2')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 54 } },
    });
  });

  it('blocks operations that begin during fallback seeding so stale seed data cannot win', async () => {
    const primary = new SelectiveFailureRepository(new MemorySaveRepository({ clock: () => 100 }));
    const fallbackInner = new MemorySaveRepository({ clock: () => 200 });
    const fallback = new GateFirstWriteRepository(fallbackInner);
    const service = new SaveService(primary, { fallback });
    await service.saveNow('slot-1', save(55));
    primary.failSlotTwo = true;

    const cutover = service.saveNow('slot-2', save(56));
    await fallback.firstWriteStarted;
    const duringSeed = service.saveNow('slot-1', save(57));
    await Promise.resolve();
    fallback.release();
    await Promise.all([cutover, duringSeed]);

    await expect(fallbackInner.read('slot-1')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 57 } },
    });
  });

  it('does not omit a write when cutover starts after primary success but before bookkeeping', async () => {
    const primary = new SelectiveFailureRepository(new MemorySaveRepository({ clock: () => 100 }));
    const fallback = new MemorySaveRepository({ clock: () => 200 });
    const commitScheduler = new GateNextCommitScheduler();
    const service = new SaveService(primary, { commitScheduler, fallback });

    const commitBlocked = commitScheduler.blockNext();
    const write = service.saveNow('slot-1', save(63));
    await commitBlocked;
    primary.failSlotTwo = true;
    await service.saveNow('slot-2', save(64));
    commitScheduler.release();
    await write;

    await expect(fallback.read('slot-1')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 63 } },
    });
  });

  it('does not resurrect a delete when cutover starts after primary success but before bookkeeping', async () => {
    const primary = new SelectiveFailureRepository(new MemorySaveRepository({ clock: () => 100 }));
    const fallback = new MemorySaveRepository({ clock: () => 200 });
    const commitScheduler = new GateNextCommitScheduler();
    const service = new SaveService(primary, { commitScheduler, fallback });
    await service.saveNow('slot-1', save(65));

    const commitBlocked = commitScheduler.blockNext();
    const deletion = service.delete('slot-1');
    await commitBlocked;
    primary.failSlotTwo = true;
    await service.saveNow('slot-2', save(66));
    commitScheduler.release();
    await deletion;

    await expect(fallback.read('slot-1')).resolves.toEqual({ kind: 'empty' });
  });

  it('does not requeue an older failed write after a newer queued write succeeds', async () => {
    const scheduler = new ManualScheduler();
    const fallbackInner = new MemorySaveRepository({ clock: () => 300 });
    const fallback = new FailFirstWriteRepository(fallbackInner);
    const service = new SaveService(new FailingRepository('primary failed'), {
      fallback,
      scheduler,
    });

    const older = service.saveNow('slot-1', save(58));
    await fallback.firstWriteStarted;
    service.queueAutosave('slot-1', save(59));
    scheduler.runAll();
    fallback.rejectFirst();
    await expect(older).rejects.toBeInstanceOf(SaveStorageError);
    await service.flush('slot-1');

    await expect(fallbackInner.read('slot-1')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 59 } },
    });
    expect(service.hasDirtySave('slot-1')).toBe(false);
  });

  it('flush rejects when an in-flight write known at invocation fails', async () => {
    const scheduler = new ManualScheduler();
    const primary = new DelayedFailureRepository();
    const service = new SaveService(primary, {
      fallback: new FailingRepository('fallback failed'),
      scheduler,
    });
    service.queueAutosave('slot-1', save(62));
    scheduler.runAll();
    await primary.writeStarted;

    const flushing = service.flush('slot-1');
    primary.reject();

    await expect(flushing).rejects.toBeInstanceOf(SaveStorageError);
    expect(service.hasDirtySave('slot-1')).toBe(true);
  });

  it('keeps a new autosave queued while deletion is in flight', async () => {
    const scheduler = new ManualScheduler();
    const inner = new MemorySaveRepository({ clock: () => 400 });
    await inner.write('slot-1', save(60));
    const repository = new GateDeleteRepository(inner);
    const service = new SaveService(repository, { scheduler });

    const deletion = service.delete('slot-1');
    await repository.deleteStarted;
    service.queueAutosave('slot-1', save(61));
    repository.release();
    await deletion;
    scheduler.runAll();
    await service.flush('slot-1');

    await expect(inner.read('slot-1')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 61 } },
    });
  });

  it('flushes before export and exports normalized recovered backup data', async () => {
    const scheduler = new ManualScheduler();
    const backup = await createSaveEnvelopeJson(save(14), 140);
    const store = new MemoryRawSaveStore([
      {
        slotId: 'slot-1',
        currentJson: '{bad',
        backupJson: backup,
        quarantine: null,
      },
    ]);
    const repository = new MemorySaveRepository({ store, clock: () => 200 });
    const service = new SaveService(repository, { scheduler });

    const recoveredExport = await service.export('slot-1');
    const recovered = await decodeSaveEnvelope(recoveredExport);
    expect(recovered).toMatchObject({
      kind: 'valid',
      value: { metadata: { playTimeMs: 14 } },
      writtenAtEpochMs: 140,
    });
    expect(await service.exportCorrupt('slot-1', 0)).toBe('{bad');

    service.queueAutosave('slot-2', save(15));
    const flushedExport = await service.export('slot-2');
    expect(scheduler.pendingCount).toBe(0);
    await expect(decodeSaveEnvelope(flushedExport)).resolves.toMatchObject({
      kind: 'valid',
      value: { metadata: { playTimeMs: 15 } },
    });
  });

  it('returns typed import/export errors for invalid, empty, and corrupt candidates', async () => {
    const repository = new MemorySaveRepository({
      store: new MemoryRawSaveStore([
        {
          slotId: 'slot-2',
          currentJson: '{bad',
          backupJson: null,
          quarantine: null,
        },
      ]),
    });
    const service = new SaveService(repository);

    const preview = await service.import('not-json');
    expect(preview).toMatchObject({ kind: 'invalid', errors: [{ code: 'invalid-json' }] });
    await expect(service.export('slot-1')).rejects.toBeInstanceOf(SaveExportError);
    await expect(service.export('slot-2')).rejects.toBeInstanceOf(SaveExportError);
  });
});

describe('observable autosave completion', () => {
  it('does not let a late completion acknowledge a newer queued generation', async () => {
    const gate = new GateNextCommitScheduler();
    const service = new SaveService(new MemorySaveRepository(), {
      scheduler: new ManualScheduler(),
      commitScheduler: gate,
    });
    const started = gate.blockNext();
    service.queueAutosave('slot-1', save(10));
    const first = service.flush('slot-1');
    await started;
    expect(service.getSaveState('slot-1')).toBe('saving');
    service.queueAutosave('slot-1', save(20));
    gate.release();
    await first;
    expect(service.getSaveState('slot-1')).toBe('queued');
    await service.saveNow('slot-2', save(30));
    expect(service.getSaveState('slot-1')).toBe('queued');
    await service.flush('slot-1');
    expect(service.getSaveState('slot-1')).toBe('idle');
  });
});
