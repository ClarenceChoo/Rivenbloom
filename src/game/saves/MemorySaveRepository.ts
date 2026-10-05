import { createSaveEnvelopeJson, decodeSaveEnvelope } from './SaveEnvelope';
import type { DigestProvider } from './SaveEnvelope';
import type {
  CorruptSaveCopy,
  SaveReadResult,
  SaveRepository,
  SaveSlotPreview,
  StoredSlotRecord,
} from './SaveRepository';
import { SaveStorageError, SaveValidationError } from './SaveRepository';
import { SAVE_SLOT_IDS, validateSaveV1 } from './SaveSchema';
import type { SaveSlotId, SaveV1 } from './SaveSchema';

export interface RawSaveStore {
  read(slot: SaveSlotId): Promise<StoredSlotRecord | null>;
  compareAndSwap(
    slot: SaveSlotId,
    expected: StoredSlotRecord | null,
    replacement: StoredSlotRecord,
  ): Promise<boolean>;
  delete(slot: SaveSlotId): Promise<void>;
}

export class MemoryRawSaveStore implements RawSaveStore {
  private readonly records = new Map<SaveSlotId, StoredSlotRecord>();

  public constructor(initialRecords: readonly StoredSlotRecord[] = []) {
    for (const record of initialRecords) this.records.set(record.slotId, cloneRecord(record));
  }

  public async read(slot: SaveSlotId): Promise<StoredSlotRecord | null> {
    const record = this.records.get(slot);
    return record === undefined ? null : cloneRecord(record);
  }

  public async compareAndSwap(
    slot: SaveSlotId,
    expected: StoredSlotRecord | null,
    replacement: StoredSlotRecord,
  ): Promise<boolean> {
    const current = this.records.get(slot) ?? null;
    if (!recordsEqual(current, expected)) return false;
    this.records.set(slot, cloneRecord(replacement));
    return true;
  }

  public async delete(slot: SaveSlotId): Promise<void> {
    this.records.delete(slot);
  }
}

export type MemorySaveRepositoryOptions = Readonly<{
  store?: RawSaveStore;
  clock?: () => number;
  digestProvider?: DigestProvider;
  maxWriteConflicts?: number;
}>;

export class MemorySaveRepository implements SaveRepository {
  private readonly store: RawSaveStore;
  private readonly clock: () => number;
  private readonly digestProvider: DigestProvider | undefined;
  private readonly maxWriteConflicts: number;

  public constructor(options: MemorySaveRepositoryOptions = {}) {
    this.store = options.store ?? new MemoryRawSaveStore();
    this.clock = options.clock ?? Date.now;
    this.digestProvider = options.digestProvider;
    this.maxWriteConflicts = options.maxWriteConflicts ?? 8;
  }

  public async list(): Promise<readonly SaveSlotPreview[]> {
    try {
      return await Promise.all(
        SAVE_SLOT_IDS.map(async (slot) => previewFor(slot, await this.read(slot))),
      );
    } catch (error) {
      if (error instanceof SaveStorageError) throw error;
      throw new SaveStorageError('list', 'Failed to list save slots.', { cause: error });
    }
  }

  public async read(slot: SaveSlotId): Promise<SaveReadResult> {
    try {
      const record = await this.store.read(slot);
      if (record === null) return { kind: 'empty' };
      return await decodeRecord(record, this.digestProvider);
    } catch (error) {
      if (error instanceof SaveStorageError) throw error;
      throw new SaveStorageError('read', `Failed to read ${slot}.`, { cause: error });
    }
  }

  public async write(slot: SaveSlotId, save: SaveV1): Promise<void> {
    const normalized = validateSaveV1(save);
    if (normalized.kind === 'invalid') throw new SaveValidationError(normalized.errors);

    const writtenAtEpochMs = this.clock();
    let currentJson: string;
    try {
      currentJson = await createSaveEnvelopeJson(
        normalized.value,
        writtenAtEpochMs,
        this.digestProvider,
      );
    } catch (error) {
      throw new SaveStorageError('write', `Failed to encode ${slot}.`, { cause: error });
    }

    for (let attempt = 0; attempt <= this.maxWriteConflicts; attempt += 1) {
      try {
        const previous = await this.store.read(slot);
        const replacement = await rotateRecord(
          slot,
          previous,
          currentJson,
          writtenAtEpochMs,
          this.digestProvider,
        );
        if (await this.store.compareAndSwap(slot, previous, replacement)) return;
      } catch (error) {
        if (error instanceof SaveStorageError) throw error;
        throw new SaveStorageError('write', `Failed to write ${slot}.`, { cause: error });
      }
    }

    throw new SaveStorageError('write', `Write conflict limit exceeded for ${slot}.`);
  }

  public async delete(slot: SaveSlotId): Promise<void> {
    try {
      await this.store.delete(slot);
    } catch (error) {
      throw new SaveStorageError('delete', `Failed to delete ${slot}.`, { cause: error });
    }
  }
}

async function rotateRecord(
  slotId: SaveSlotId,
  previous: StoredSlotRecord | null,
  currentJson: string,
  capturedAtEpochMs: number,
  digestProvider: DigestProvider | undefined,
): Promise<StoredSlotRecord> {
  if (previous === null) {
    return { slotId, currentJson, backupJson: null, quarantine: null };
  }

  const current =
    previous.currentJson === null
      ? null
      : await decodeSaveEnvelope(previous.currentJson, digestProvider);
  const backup =
    previous.backupJson === null
      ? null
      : await decodeSaveEnvelope(previous.backupJson, digestProvider);

  const corruptCopies: { source: 'current' | 'backup'; rawJson: string }[] = [];
  if (current?.kind === 'invalid' && previous.currentJson !== null) {
    corruptCopies.push({ source: 'current', rawJson: previous.currentJson });
  }
  if (backup?.kind === 'invalid' && previous.backupJson !== null) {
    corruptCopies.push({ source: 'backup', rawJson: previous.backupJson });
  }

  return {
    slotId,
    currentJson,
    backupJson:
      current?.kind === 'valid'
        ? previous.currentJson
        : backup?.kind === 'valid'
          ? previous.backupJson
          : null,
    quarantine:
      corruptCopies.length > 0 ? { capturedAtEpochMs, copies: corruptCopies } : previous.quarantine,
  };
}

async function decodeRecord(
  record: StoredSlotRecord,
  digestProvider: DigestProvider | undefined,
): Promise<SaveReadResult> {
  const current =
    record.currentJson === null
      ? null
      : await decodeSaveEnvelope(record.currentJson, digestProvider);
  const backup =
    record.backupJson === null ? null : await decodeSaveEnvelope(record.backupJson, digestProvider);
  const corruptCopies: CorruptSaveCopy[] = [];

  if (current?.kind === 'invalid' && record.currentJson !== null) {
    corruptCopies.push({ source: 'current', rawJson: record.currentJson, issues: current.errors });
  }
  if (backup?.kind === 'invalid' && record.backupJson !== null) {
    corruptCopies.push({ source: 'backup', rawJson: record.backupJson, issues: backup.errors });
  }
  if (record.quarantine !== null) {
    for (const copy of record.quarantine.copies) {
      if (
        corruptCopies.some(
          (present) => present.source === copy.source && present.rawJson === copy.rawJson,
        )
      )
        continue;
      const decoded = await decodeSaveEnvelope(copy.rawJson, digestProvider);
      if (decoded.kind === 'invalid') {
        corruptCopies.push({ ...copy, issues: decoded.errors });
      }
    }
  }

  if (current?.kind === 'valid') {
    return {
      kind: 'loaded',
      save: current.value,
      source: 'current',
      writtenAtEpochMs: current.writtenAtEpochMs,
      notices: current.notices,
      corruptCopies,
    };
  }
  if (backup?.kind === 'valid') {
    return {
      kind: 'loaded',
      save: backup.value,
      source: 'backup',
      writtenAtEpochMs: backup.writtenAtEpochMs,
      notices: [
        ...backup.notices,
        {
          path: '/',
          code: 'recovered-from-backup',
          message: `Recovered ${record.slotId} from its previous valid revision.`,
        },
      ],
      corruptCopies,
    };
  }
  if (record.currentJson === null && record.backupJson === null && corruptCopies.length === 0) {
    return { kind: 'empty' };
  }
  return { kind: 'corrupt', corruptCopies };
}

function previewFor(slotId: SaveSlotId, result: SaveReadResult): SaveSlotPreview {
  if (result.kind === 'empty') return { slotId, state: 'empty' };
  if (result.kind === 'corrupt')
    return { slotId, state: 'corrupt', corruptCopies: result.corruptCopies };
  return {
    slotId,
    state: 'ready',
    regionId: result.save.location.regionId,
    areaId: result.save.location.areaId,
    playTimeMs: result.save.metadata.playTimeMs,
    snapshotAtEpochMs: result.save.metadata.snapshotAtEpochMs,
    writtenAtEpochMs: result.writtenAtEpochMs,
    healthUpgrades: result.save.player.healthUpgrades,
    manaUpgrades: result.save.player.manaUpgrades,
    recoveryState:
      result.source === 'backup'
        ? 'recovered'
        : result.corruptCopies.length > 0
          ? 'has-corrupt-copy'
          : 'clean',
  };
}

function cloneRecord(record: StoredSlotRecord): StoredSlotRecord {
  return {
    slotId: record.slotId,
    currentJson: record.currentJson,
    backupJson: record.backupJson,
    quarantine:
      record.quarantine === null
        ? null
        : {
            capturedAtEpochMs: record.quarantine.capturedAtEpochMs,
            copies: record.quarantine.copies.map((copy) => ({ ...copy })),
          },
  };
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
