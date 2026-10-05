import { afterEach, describe, expect, it } from 'vitest';

import { decodeSaveEnvelope } from '../../src/game/saves/SaveEnvelope';
import { IndexedDbSaveRepository } from '../../src/game/saves/IndexedDbSaveRepository';
import type { IndexedDbTransactionHooks } from '../../src/game/saves/IndexedDbSaveRepository';
import { SaveStorageError } from '../../src/game/saves/SaveRepository';
import { validateSaveV1 } from '../../src/game/saves/SaveSchema';
import type { SaveV1 } from '../../src/game/saves/SaveSchema';
import { rawSaveV1 } from './saveFixtures';

const openRepositories: IndexedDbSaveRepository[] = [];
const databaseNames: string[] = [];

afterEach(async () => {
  openRepositories.splice(0).forEach((repository) => repository.close());
  await Promise.all(databaseNames.splice(0).map((name) => deleteDatabase(name)));
});

function databaseName(label: string): string {
  const name = `rivenbloom-test-${label}-${crypto.randomUUID()}`;
  databaseNames.push(name);
  return name;
}

function repository(
  name: string,
  clock: () => number,
  transactionHooks?: IndexedDbTransactionHooks,
): IndexedDbSaveRepository {
  const value = new IndexedDbSaveRepository({ databaseName: name, clock, transactionHooks });
  openRepositories.push(value);
  return value;
}

function save(playTimeMs: number): SaveV1 {
  const candidate = rawSaveV1();
  candidate.metadata.playTimeMs = playTimeMs;
  const result = validateSaveV1(candidate);
  if (result.kind !== 'valid') throw new Error('Save fixture must validate.');
  return result.value;
}

describe('IndexedDbSaveRepository in Chromium', () => {
  it('rotates two and three generations with one retained backup', async () => {
    const name = databaseName('rotation');
    let now = 100;
    const saves = repository(name, () => now++);

    await saves.write('slot-1', save(1));
    await saves.write('slot-1', save(2));
    await expect(readStoredPlayTimes(name, 'slot-1')).resolves.toEqual([2, 1]);

    await saves.write('slot-1', save(3));
    await expect(readStoredPlayTimes(name, 'slot-1')).resolves.toEqual([3, 2]);
  });

  it('rolls back when the adapter transaction is forcibly aborted after put', async () => {
    const name = databaseName('abort');
    const seed = repository(name, () => 100);
    await seed.write('slot-1', save(4));
    let aborted = false;
    const aborting = repository(name, () => 200, {
      afterPut(_slot, transaction) {
        if (aborted) return;
        aborted = true;
        transaction.abort();
      },
    });

    await expect(aborting.write('slot-1', save(5))).rejects.toBeInstanceOf(SaveStorageError);
    await expect(seed.read('slot-1')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 4 } },
    });
  });

  it('forces and observes a stale-CAS conflict before preserving both generations', async () => {
    const name = databaseName('same-slot');
    let arrivals = 0;
    let conflicts = 0;
    let releaseBarrier: (() => void) | null = null;
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    const hooks: IndexedDbTransactionHooks = {
      async beforeCompareAndSwap(_slot, expected) {
        if (expected !== null) return;
        arrivals += 1;
        if (arrivals === 2) releaseBarrier?.();
        await barrier;
      },
      onCompareAndSwapConflict() {
        conflicts += 1;
      },
    };
    const first = repository(name, () => 101, hooks);
    const second = repository(name, () => 102, hooks);

    await Promise.all([first.write('slot-1', save(21)), second.write('slot-1', save(22))]);

    expect(arrivals).toBe(2);
    expect(conflicts).toBe(1);
    const playTimes = await readStoredPlayTimes(name, 'slot-1');
    expect([...playTimes].sort((left, right) => left - right)).toEqual([21, 22]);
  });

  it('clears a rejected blocked-open cache and closes its late successful connection', async () => {
    const name = databaseName('blocked-open');
    const blocker = await openDatabase(name, 1);
    blocker.onversionchange = () => undefined;
    const saves = new IndexedDbSaveRepository({
      databaseName: name,
      factory: new FixedVersionFactory(indexedDB, 2),
    });
    openRepositories.push(saves);

    await expect(saves.read('slot-1')).rejects.toBeInstanceOf(SaveStorageError);
    blocker.close();
    const probe = await openDatabase(name, 2);
    probe.close();

    await expect(saves.read('slot-1')).resolves.toEqual({ kind: 'empty' });
  });

  it('reopens after versionchange closes the cached connection', async () => {
    const name = databaseName('version-change');
    const saves = repository(name, () => 100);
    await expect(saves.read('slot-1')).resolves.toEqual({ kind: 'empty' });

    await deleteDatabase(name);

    await expect(saves.read('slot-1')).resolves.toEqual({ kind: 'empty' });
  });

  it('keeps concurrent separate-slot writes isolated', async () => {
    const name = databaseName('separate-slots');
    const first = repository(name, () => 101);
    const second = repository(name, () => 102);

    await Promise.all([first.write('slot-1', save(31)), second.write('slot-3', save(33))]);

    await expect(first.read('slot-1')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 31 } },
    });
    await expect(second.read('slot-3')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 33 } },
    });
    await expect(first.read('slot-2')).resolves.toEqual({ kind: 'empty' });
  });

  it('deletes only the selected slot record', async () => {
    const name = databaseName('delete');
    const saves = repository(name, () => 100);
    await saves.write('slot-1', save(41));
    await saves.write('slot-2', save(42));
    await saves.write('slot-3', save(43));

    await saves.delete('slot-2');

    expect((await saves.list()).map((preview) => preview.state)).toEqual([
      'ready',
      'empty',
      'ready',
    ]);
  });
});

async function readStoredPlayTimes(
  name: string,
  slotId: 'slot-1' | 'slot-2' | 'slot-3',
): Promise<readonly number[]> {
  const database = await openDatabase(name);
  try {
    const transaction = database.transaction('slots', 'readonly');
    const raw: unknown = await requestResult(transaction.objectStore('slots').get(slotId));
    await transactionDone(transaction);
    if (!isRecord(raw)) throw new Error('Expected a stored slot record.');
    const currentJson = raw.currentJson;
    const backupJson = raw.backupJson;
    if (typeof currentJson !== 'string') throw new Error('Expected current JSON.');
    const current = await decodeSaveEnvelope(currentJson);
    if (current.kind !== 'valid') throw new Error('Expected valid current JSON.');
    const result = [current.value.metadata.playTimeMs];
    if (typeof backupJson === 'string') {
      const backup = await decodeSaveEnvelope(backupJson);
      if (backup.kind !== 'valid') throw new Error('Expected valid backup JSON.');
      result.push(backup.value.metadata.playTimeMs);
    }
    return result;
  } finally {
    database.close();
  }
}

function openDatabase(name: string, version = 1): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('slots')) {
        request.result.createObjectStore('slots', { keyPath: 'slotId' });
      }
    };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed.'));
    request.onsuccess = () => resolve(request.result);
  });
}

class FixedVersionFactory implements IDBFactory {
  public constructor(
    private readonly inner: IDBFactory,
    private readonly version: number,
  ) {}

  public cmp(first: IDBValidKey, second: IDBValidKey): number {
    return this.inner.cmp(first, second);
  }

  public databases(): Promise<IDBDatabaseInfo[]> {
    return this.inner.databases();
  }

  public deleteDatabase(name: string): IDBOpenDBRequest {
    return this.inner.deleteDatabase(name);
  }

  public open(name: string, _version?: number): IDBOpenDBRequest {
    void _version;
    return this.inner.open(name, this.version);
  }
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB deletion failed.'));
    request.onblocked = () => reject(new Error(`IndexedDB deletion blocked for ${name}.`));
    request.onsuccess = () => resolve();
  });
}

function requestResult<Value>(request: IDBRequest<Value>): Promise<Value> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new DOMException('Transaction aborted.', 'AbortError'));
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
