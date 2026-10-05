import type { DigestProvider } from './SaveEnvelope';
import { MemorySaveRepository } from './MemorySaveRepository';
import type { MemorySaveRepositoryOptions, RawSaveStore } from './MemorySaveRepository';
import type { StoredSlotRecord } from './SaveRepository';
import { SaveStorageError } from './SaveRepository';
import type { SaveSlotId } from './SaveSchema';

export const DEFAULT_SAVE_DATABASE_NAME = 'rivenbloom-saves';
export const SAVE_DATABASE_VERSION = 1;
export const SAVE_OBJECT_STORE_NAME = 'slots';

export type IndexedDbSaveRepositoryOptions = Readonly<{
  databaseName?: string;
  clock?: () => number;
  digestProvider?: DigestProvider;
  maxWriteConflicts?: number;
  factory?: IDBFactory;
  transactionHooks?: IndexedDbTransactionHooks;
}>;

export type IndexedDbTransactionHooks = Readonly<{
  beforeCompareAndSwap?: (
    slot: SaveSlotId,
    expected: StoredSlotRecord | null,
  ) => void | Promise<void>;
  afterPut?: (slot: SaveSlotId, transaction: IDBTransaction) => void;
  onCompareAndSwapConflict?: (slot: SaveSlotId) => void;
}>;

export class IndexedDbSaveRepository extends MemorySaveRepository {
  private readonly indexedDbStore: IndexedDbRawSaveStore;

  public constructor(options: IndexedDbSaveRepositoryOptions = {}) {
    const indexedDbStore = new IndexedDbRawSaveStore({
      databaseName: options.databaseName,
      factory: options.factory,
      transactionHooks: options.transactionHooks,
    });
    const memoryOptions: MemorySaveRepositoryOptions = {
      store: indexedDbStore,
      clock: options.clock,
      digestProvider: options.digestProvider,
      maxWriteConflicts: options.maxWriteConflicts,
    };
    super(memoryOptions);
    this.indexedDbStore = indexedDbStore;
  }

  public close(): void {
    this.indexedDbStore.close();
  }
}

type IndexedDbRawSaveStoreOptions = Readonly<{
  databaseName?: string;
  factory?: IDBFactory;
  transactionHooks?: IndexedDbTransactionHooks;
}>;

class IndexedDbRawSaveStore implements RawSaveStore {
  private readonly databaseName: string;
  private readonly factory: IDBFactory;
  private readonly transactionHooks: IndexedDbTransactionHooks;
  private databasePromise: Promise<IDBDatabase> | null = null;
  private connectionEpoch = 0;

  public constructor(options: IndexedDbRawSaveStoreOptions) {
    this.databaseName = options.databaseName ?? DEFAULT_SAVE_DATABASE_NAME;
    const factory = options.factory ?? globalThis.indexedDB;
    if (factory === undefined) {
      throw new SaveStorageError('read', 'IndexedDB is unavailable in this runtime.');
    }
    this.factory = factory;
    this.transactionHooks = options.transactionHooks ?? {};
  }

  public async read(slot: SaveSlotId): Promise<StoredSlotRecord | null> {
    const database = await this.database();
    const transaction = database.transaction(SAVE_OBJECT_STORE_NAME, 'readonly');
    const done = transactionDone(transaction);
    try {
      const raw: unknown = await requestResult(
        transaction.objectStore(SAVE_OBJECT_STORE_NAME).get(slot),
      );
      await done;
      return raw === undefined ? null : decodeStoredSlotRecord(raw, slot);
    } catch (error) {
      await done.catch(() => undefined);
      throw error;
    }
  }

  public async compareAndSwap(
    slot: SaveSlotId,
    expected: StoredSlotRecord | null,
    replacement: StoredSlotRecord,
  ): Promise<boolean> {
    if (replacement.slotId !== slot) {
      throw new SaveStorageError('write', 'IndexedDB replacement slot does not match its key.');
    }
    await this.transactionHooks.beforeCompareAndSwap?.(slot, expected);
    const database = await this.database();
    const transaction = database.transaction(SAVE_OBJECT_STORE_NAME, 'readwrite');
    const done = transactionDone(transaction);
    const objectStore = transaction.objectStore(SAVE_OBJECT_STORE_NAME);
    try {
      const raw: unknown = await requestResult(objectStore.get(slot));
      const current = raw === undefined ? null : decodeStoredSlotRecord(raw, slot);
      if (!recordsEqual(current, expected)) {
        this.transactionHooks.onCompareAndSwapConflict?.(slot);
        transaction.abort();
        await done.catch((error: unknown) => {
          if (!isAbortError(error)) throw error;
        });
        return false;
      }
      objectStore.put(replacement);
      this.transactionHooks.afterPut?.(slot, transaction);
      await done;
      return true;
    } catch (error) {
      await done.catch(() => undefined);
      throw error;
    }
  }

  public async delete(slot: SaveSlotId): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(SAVE_OBJECT_STORE_NAME, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(SAVE_OBJECT_STORE_NAME).delete(slot);
    await done;
  }

  public close(): void {
    const pending = this.databasePromise;
    this.databasePromise = null;
    this.connectionEpoch += 1;
    if (pending !== null) {
      void pending.then(
        (database) => database.close(),
        () => undefined,
      );
    }
  }

  private database(): Promise<IDBDatabase> {
    if (this.databasePromise !== null) return this.databasePromise;

    const openingEpoch = this.connectionEpoch;
    const opening = openDatabase(this.factory, this.databaseName)
      .then((database) => {
        if (openingEpoch !== this.connectionEpoch) {
          database.close();
          throw new SaveStorageError('read', 'IndexedDB connection closed while opening.');
        }
        database.onversionchange = () => {
          database.close();
          if (this.databasePromise === opening) {
            this.databasePromise = null;
            this.connectionEpoch += 1;
          }
        };
        return database;
      })
      .catch((error: unknown) => {
        if (this.databasePromise === opening) this.databasePromise = null;
        throw error;
      });
    this.databasePromise = opening;
    return this.databasePromise;
  }
}

function openDatabase(factory: IDBFactory, databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(databaseName, SAVE_DATABASE_VERSION);
    let settled = false;
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SAVE_OBJECT_STORE_NAME)) {
        database.createObjectStore(SAVE_OBJECT_STORE_NAME, { keyPath: 'slotId' });
      }
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(request.error ?? new Error('Failed to open the save database.'));
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new Error(`Opening IndexedDB database ${databaseName} was blocked.`));
    };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      settled = true;
      resolve(database);
    };
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
      reject(transaction.error ?? new DOMException('IndexedDB transaction aborted.', 'AbortError'));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
  });
}

function decodeStoredSlotRecord(value: unknown, expectedSlot: SaveSlotId): StoredSlotRecord {
  if (!isPlainRecord(value)) throw malformedRecord(expectedSlot);
  const keys = Object.keys(value).sort();
  if (keys.join(',') !== 'backupJson,currentJson,quarantine,slotId')
    throw malformedRecord(expectedSlot);
  if (value.slotId !== expectedSlot) throw malformedRecord(expectedSlot);
  if (!isNullableString(value.currentJson) || !isNullableString(value.backupJson)) {
    throw malformedRecord(expectedSlot);
  }
  const quarantine = decodeQuarantine(value.quarantine, expectedSlot);
  return {
    slotId: expectedSlot,
    currentJson: value.currentJson,
    backupJson: value.backupJson,
    quarantine,
  };
}

function decodeQuarantine(value: unknown, slot: SaveSlotId): StoredSlotRecord['quarantine'] {
  if (value === null) return null;
  if (!isPlainRecord(value)) throw malformedRecord(slot);
  const keys = Object.keys(value).sort();
  if (keys.join(',') !== 'capturedAtEpochMs,copies') throw malformedRecord(slot);
  if (
    typeof value.capturedAtEpochMs !== 'number' ||
    !Number.isSafeInteger(value.capturedAtEpochMs) ||
    value.capturedAtEpochMs < 0 ||
    !Array.isArray(value.copies)
  )
    throw malformedRecord(slot);
  const copies: { source: 'current' | 'backup'; rawJson: string }[] = [];
  for (const candidate of value.copies) {
    if (!isPlainRecord(candidate)) throw malformedRecord(slot);
    const copyKeys = Object.keys(candidate).sort();
    if (
      copyKeys.join(',') !== 'rawJson,source' ||
      (candidate.source !== 'current' && candidate.source !== 'backup') ||
      typeof candidate.rawJson !== 'string'
    )
      throw malformedRecord(slot);
    copies.push({ source: candidate.source, rawJson: candidate.rawJson });
  }
  return { capturedAtEpochMs: value.capturedAtEpochMs, copies };
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function malformedRecord(slot: SaveSlotId): SaveStorageError {
  return new SaveStorageError('read', `Stored IndexedDB record for ${slot} is malformed.`);
}

function recordsEqual(left: StoredSlotRecord | null, right: StoredSlotRecord | null): boolean {
  if (left === null || right === null) return left === right;
  if (
    left.slotId !== right.slotId ||
    left.currentJson !== right.currentJson ||
    left.backupJson !== right.backupJson
  )
    return false;
  if (left.quarantine === null || right.quarantine === null) {
    return left.quarantine === right.quarantine;
  }
  if (
    left.quarantine.capturedAtEpochMs !== right.quarantine.capturedAtEpochMs ||
    left.quarantine.copies.length !== right.quarantine.copies.length
  )
    return false;
  return left.quarantine.copies.every((copy, index) => {
    const other = right.quarantine?.copies[index];
    return other !== undefined && copy.source === other.source && copy.rawJson === other.rawJson;
  });
}

function isAbortError(value: unknown): boolean {
  return value instanceof DOMException && value.name === 'AbortError';
}
