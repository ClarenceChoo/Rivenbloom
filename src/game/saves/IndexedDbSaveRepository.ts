import { createSaveEnvelope, validateSave, type SaveSlotId, type SaveV1 } from './SaveSchema';
import {
  previewSaveSlot,
  resolveSaveSlotRecord,
  rotateSaveRecord,
  saveSlots,
  type SaveReadResult,
  type SaveRepository,
  type SaveSlotPreview,
  type SaveSlotRecord
} from './SaveRepository';

const STORE_NAME = 'save-slots';

type StoredSlotRecord = SaveSlotRecord & { readonly slotId: SaveSlotId };

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });

const transactionResult = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });

const asSaveSlotRecord = (value: unknown): SaveSlotRecord | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const candidate = value as { readonly current?: unknown; readonly backup?: unknown };
  return { current: candidate.current, backup: candidate.backup };
};

export class IndexedDbSaveRepository implements SaveRepository {
  private databasePromise: Promise<IDBDatabase> | undefined;

  public constructor(
    private readonly databaseName = 'rivenbloom-saves',
    private readonly indexedDb: IDBFactory = globalThis.indexedDB
  ) {}

  public async list(): Promise<readonly SaveSlotPreview[]> {
    const records = await Promise.all(
      saveSlots().map(async (slotId) => [slotId, await this.readRecord(slotId)] as const)
    );
    return records.map(([slotId, record]) => previewSaveSlot(slotId, record));
  }

  public async read(slot: SaveSlotId): Promise<SaveReadResult> {
    return resolveSaveSlotRecord(await this.readRecord(slot));
  }

  public async write(slot: SaveSlotId, save: SaveV1): Promise<void> {
    const validation = validateSave(save);
    if (!validation.ok)
      throw new TypeError(
        `Cannot write invalid save: ${validation.errors[0]?.path ?? 'unknown error'}`
      );
    if (validation.save.slotId !== slot)
      throw new TypeError('Save slot does not match the write destination.');

    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const previous = store.get(slot);
    previous.onerror = () => transaction.abort();
    previous.onsuccess = () => {
      const record = asSaveSlotRecord(previous.result);
      store.put({
        slotId: slot,
        ...rotateSaveRecord(record, createSaveEnvelope(validation.save))
      } satisfies StoredSlotRecord);
    };
    await transactionResult(transaction);
  }

  public async delete(slot: SaveSlotId): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(slot);
    await transactionResult(transaction);
  }

  public async close(): Promise<void> {
    if (this.databasePromise === undefined) return;
    const database = await this.databasePromise;
    database.close();
    this.databasePromise = undefined;
  }

  private async readRecord(slot: SaveSlotId): Promise<SaveSlotRecord | undefined> {
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const value = await requestResult(transaction.objectStore(STORE_NAME).get(slot));
    return asSaveSlotRecord(value);
  }

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise !== undefined) return this.databasePromise;
    if (this.indexedDb === undefined)
      throw new Error('IndexedDB is unavailable in this environment.');
    this.databasePromise = new Promise((resolve, reject) => {
      const request = this.indexedDb.open(this.databaseName);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: 'slotId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error('Unable to open the save database.'));
    });
    return this.databasePromise;
  }
}
