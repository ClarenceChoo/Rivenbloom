import { ServiceRegistry } from './ServiceRegistry';
import { IndexedDbSaveRepository } from '../saves/IndexedDbSaveRepository';
import { MemorySaveRepository } from '../saves/MemorySaveRepository';
import type { SaveReadResult, SaveRepository, SaveSlotPreview } from '../saves/SaveRepository';
import { SaveStorageError } from '../saves/SaveRepository';
import { SaveService } from '../saves/SaveService';
import { TauriSaveRepository } from '../saves/TauriSaveRepository';
import type { TauriInvoke } from '../saves/TauriSaveRepository';

type ServiceCleanup = () => void | Promise<void>;

export class AppServiceRuntime<Services extends object> {
  private disposal: Promise<void> | null = null;

  public constructor(
    public readonly services: ServiceRegistry<Services>,
    private readonly cleanups: readonly ServiceCleanup[] = [],
  ) {}

  public dispose(): Promise<void> {
    if (this.disposal !== null) return this.disposal;

    const pending: Promise<unknown>[] = [];
    for (const cleanup of this.cleanups) {
      try {
        pending.push(Promise.resolve(cleanup()));
      } catch (error) {
        pending.push(Promise.reject(error));
      }
    }
    this.disposal = Promise.allSettled(pending).then(() => undefined);
    return this.disposal;
  }
}

export function replaceAppServiceRuntime<Services extends object>(
  previous: unknown,
  next: AppServiceRuntime<Services>,
): AppServiceRuntime<Services> {
  if (previous instanceof AppServiceRuntime) void previous.dispose();
  return next;
}

export type BootSaveServices = Readonly<{
  repository: SaveRepository;
  saveService: SaveService;
  close(): void;
}>;

export function createBootSaveServices(options: {
  indexedDbFactory?: IDBFactory;
  tauriInvoke?: TauriInvoke | null;
}): BootSaveServices {
  const factory = options.indexedDbFactory;
  const indexedRepository = factory === undefined ? null : new IndexedDbSaveRepository({ factory });
  const tauriRepository =
    options.tauriInvoke === undefined || options.tauriInvoke === null
      ? null
      : new TauriSaveRepository(options.tauriInvoke);
  const repository: SaveRepository =
    tauriRepository ?? indexedRepository ?? new UnavailableSaveRepository();
  const saveService = new SaveService(repository, { fallback: new MemorySaveRepository() });
  let closed = false;

  return Object.freeze({
    repository,
    saveService,
    close: () => {
      if (closed) return;
      closed = true;
      indexedRepository?.close();
    },
  });
}

class UnavailableSaveRepository implements SaveRepository {
  public async list(): Promise<readonly SaveSlotPreview[]> {
    throw unavailable('list');
  }

  public async read(): Promise<SaveReadResult> {
    throw unavailable('read');
  }

  public async write(): Promise<void> {
    throw unavailable('write');
  }

  public async delete(): Promise<void> {
    throw unavailable('delete');
  }
}

function unavailable(operation: SaveStorageError['operation']): SaveStorageError {
  return new SaveStorageError(operation, 'IndexedDB is unavailable in this runtime.');
}
