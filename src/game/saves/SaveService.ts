import type { SaveSlotId, SaveV1 } from './SaveSchema';
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

type PendingAutosave = { readonly save: SaveV1; readonly timer: ReturnType<typeof setTimeout> };

export class SaveService {
  private readonly autosaveDelayMs: number;
  private readonly pendingAutosaves = new Map<SaveSlotId, PendingAutosave>();

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
    await this.repository.write(destination, save);
  }

  public async delete(slot: SaveSlotId): Promise<void> {
    this.cancelAutosave(slot);
    await this.repository.delete(slot);
  }

  public scheduleAutosave(slot: SaveSlotId, save: SaveV1): void {
    this.cancelAutosave(slot);
    const timer = setTimeout(() => {
      this.pendingAutosaves.delete(slot);
      void this.repository.write(slot, save);
    }, this.autosaveDelayMs);
    this.pendingAutosaves.set(slot, { save, timer });
  }

  public async flushAutosaves(): Promise<void> {
    const pending = [...this.pendingAutosaves.entries()];
    this.pendingAutosaves.clear();
    await Promise.all(
      pending.map(async ([slot, entry]) => {
        clearTimeout(entry.timer);
        await this.repository.write(slot, entry.save);
      })
    );
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
