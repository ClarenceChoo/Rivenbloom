import { MemorySaveRepository } from './MemorySaveRepository';
import type { RawSaveStore } from './MemorySaveRepository';
import type { StoredSlotRecord } from './SaveRepository';
import { SaveStorageError } from './SaveRepository';
import type { SaveSlotId } from './SaveSchema';

export type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export class TauriSaveRepository extends MemorySaveRepository {
  public constructor(invoke: TauriInvoke) {
    super({ store: new TauriRawSaveStore(invoke) });
  }
}

export function tauriInvokeFromRuntime(value: unknown = globalThis): TauriInvoke | null {
  if (value === null || typeof value !== 'object') return null;
  const internals = Reflect.get(value, '__TAURI_INTERNALS__');
  if (internals === null || typeof internals !== 'object') return null;
  const invoke = Reflect.get(internals, 'invoke');
  if (typeof invoke !== 'function') return null;
  return (command, args) => Promise.resolve(Reflect.apply(invoke, internals, [command, args]));
}

class TauriRawSaveStore implements RawSaveStore {
  public constructor(private readonly invoke: TauriInvoke) {}

  public async read(slot: SaveSlotId): Promise<StoredSlotRecord | null> {
    try {
      return await this.invoke<StoredSlotRecord | null>('read_save_record', { slotId: slot });
    } catch (error) {
      throw storageError('read', slot, error);
    }
  }

  public async compareAndSwap(
    slot: SaveSlotId,
    expected: StoredSlotRecord | null,
    replacement: StoredSlotRecord,
  ): Promise<boolean> {
    try {
      return await this.invoke<boolean>('compare_and_swap_save_record', {
        slotId: slot,
        expected,
        replacement,
      });
    } catch (error) {
      throw storageError('write', slot, error);
    }
  }

  public async delete(slot: SaveSlotId): Promise<void> {
    try {
      await this.invoke<void>('delete_save_record', { slotId: slot });
    } catch (error) {
      throw storageError('delete', slot, error);
    }
  }
}

function storageError(
  operation: SaveStorageError['operation'],
  slot: SaveSlotId,
  cause: unknown,
): SaveStorageError {
  return new SaveStorageError(operation, `Tauri ${operation} failed for ${slot}.`, { cause });
}
