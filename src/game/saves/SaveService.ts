import type { SaveSettings, SaveSlotId, SaveV1 } from './SaveSchema';
import { migrateSaveCandidate, type MigrationResult } from './migrations';
import type { SaveReadResult, SaveRepository } from './SaveRepository';

export type ImportPreview =
  | {
      readonly kind: 'ready';
      readonly save: SaveV1;
      readonly preview: {
        readonly slotId: SaveSlotId;
        readonly areaId: string;
        readonly playtimeSeconds: number;
        readonly currency: number;
        readonly migratedFrom?: number;
      };
    }
  | { readonly kind: 'invalid'; readonly reason: string };

export type SaveServiceOptions = { readonly autosaveDelayMs?: number };

type Deferred = {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (reason: unknown) => void;
};

type PendingAutosave = {
  readonly save: SaveV1;
  readonly timer: ReturnType<typeof setTimeout>;
  readonly completion: Deferred;
};

const deferred = (): Deferred => {
  let resolve = (): void => undefined;
  let reject = (_reason: unknown): void => undefined;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

export class SaveService {
  private readonly autosaveDelayMs: number;
  private readonly pendingAutosaves = new Map<SaveSlotId, PendingAutosave>();
  private readonly slotOperations = new Map<SaveSlotId, Promise<void>>();

  public constructor(
    private readonly repository: SaveRepository,
    options: SaveServiceOptions = {}
  ) {
    this.autosaveDelayMs = options.autosaveDelayMs ?? 500;
  }

  public async load(slot: SaveSlotId): Promise<SaveReadResult> {
    return this.repository.read(slot);
  }

  public async export(slot: SaveSlotId): Promise<string> {
    const result = await this.repository.read(slot);
    if (result.kind !== 'loaded')
      throw new Error(`Cannot export ${result.kind} save slot ${slot}.`);
    return JSON.stringify(result.save);
  }

  public async import(candidateJson: string): Promise<ImportPreview> {
    let candidate: unknown;
    try {
      candidate = JSON.parse(candidateJson) as unknown;
    } catch {
      return { kind: 'invalid', reason: 'Import is not valid JSON.' };
    }
    return this.previewMigration(migrateSaveCandidate(candidate));
  }

  public async confirmImport(preview: ImportPreview, destination: SaveSlotId): Promise<void> {
    if (preview.kind !== 'ready')
      throw new TypeError('Only a validated import preview can be confirmed.');
    const save: SaveV1 = {
      ...preview.save,
      slotId: destination,
      metadata: { ...preview.save.metadata, updatedAt: Date.now() }
    };
    await this.cancelAndWaitForSlot(destination);
    await this.enqueue(destination, () => this.repository.write(destination, save));
  }

  public async delete(slot: SaveSlotId): Promise<void> {
    await this.cancelAndWaitForSlot(slot);
    await this.enqueue(slot, () => this.repository.delete(slot));
  }

  public async updateSettings(slot: SaveSlotId, settings: SaveSettings): Promise<void> {
    await this.cancelAndWaitForSlot(slot);
    await this.enqueue(slot, async () => {
      const result = await this.repository.read(slot);
      if (result.kind !== 'loaded') return;
      await this.repository.write(slot, {
        ...result.save,
        metadata: { ...result.save.metadata, updatedAt: Date.now() },
        settings: { ...settings, audio: { ...settings.audio } }
      });
    });
  }

  public scheduleAutosave(slot: SaveSlotId, save: SaveV1): Promise<void> {
    this.cancelAutosave(slot);
    const completion = deferred();
    void completion.promise.catch(() => undefined);
    const timer = setTimeout(() => {
      const pending = this.pendingAutosaves.get(slot);
      if (pending === undefined || pending.completion !== completion) return;
      this.pendingAutosaves.delete(slot);
      void this.enqueue(slot, () => this.repository.write(slot, save)).then(
        () => completion.resolve(),
        (reason: unknown) => completion.reject(reason)
      );
    }, this.autosaveDelayMs);
    this.pendingAutosaves.set(slot, { save, timer, completion });
    return completion.promise;
  }

  public async flushAutosaves(): Promise<void> {
    for (const [slot, pending] of [...this.pendingAutosaves]) {
      this.startPendingAutosave(slot, pending);
    }
    await Promise.all([...this.slotOperations.values()]);
  }

  public dispose(): void {
    for (const entry of this.pendingAutosaves.values()) clearTimeout(entry.timer);
    this.pendingAutosaves.clear();
  }

  private cancelAutosave(slot: SaveSlotId): void {
    const pending = this.pendingAutosaves.get(slot);
    if (pending === undefined) return;
    clearTimeout(pending.timer);
    this.pendingAutosaves.delete(slot);
    pending.completion.resolve();
  }

  private async cancelAndWaitForSlot(slot: SaveSlotId): Promise<void> {
    this.cancelAutosave(slot);
    await this.slotOperations.get(slot);
  }

  private startPendingAutosave(slot: SaveSlotId, pending: PendingAutosave): void {
    const active = this.pendingAutosaves.get(slot);
    if (active === undefined || active.completion !== pending.completion) return;
    clearTimeout(pending.timer);
    this.pendingAutosaves.delete(slot);
    void this.enqueue(slot, () => this.repository.write(slot, pending.save)).then(
      () => pending.completion.resolve(),
      (reason: unknown) => pending.completion.reject(reason)
    );
  }

  private enqueue(slot: SaveSlotId, operation: () => Promise<void>): Promise<void> {
    const previous = this.slotOperations.get(slot) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    void next.catch(() => undefined);
    this.slotOperations.set(slot, next);
    void next.then(
      () => {
        if (this.slotOperations.get(slot) === next) this.slotOperations.delete(slot);
      },
      () => undefined
    );
    return next;
  }

  private previewMigration(migration: MigrationResult): ImportPreview {
    if (!migration.ok) return { kind: 'invalid', reason: migration.reason };
    return {
      kind: 'ready',
      save: migration.save,
      preview: {
        slotId: migration.save.slotId,
        areaId: migration.save.metadata.areaId,
        playtimeSeconds: migration.save.metadata.playtimeSeconds,
        currency: migration.save.player.currency,
        ...(migration.migratedFrom === undefined ? {} : { migratedFrom: migration.migratedFrom })
      }
    };
  }
}
