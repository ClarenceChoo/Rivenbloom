import type { SaveNotice, SaveSlotId, SaveV1, SaveValidationIssue } from './SaveSchema';

export type StoredCorruptSource = 'current' | 'backup';

export type StoredSlotRecord = Readonly<{
  slotId: SaveSlotId;
  currentJson: string | null;
  backupJson: string | null;
  quarantine: Readonly<{
    capturedAtEpochMs: number;
    copies: readonly Readonly<{
      source: StoredCorruptSource;
      rawJson: string;
    }>[];
  }> | null;
}>;

export type CorruptSaveCopy = Readonly<{
  source: StoredCorruptSource;
  rawJson: string;
  issues: readonly SaveValidationIssue[];
}>;

export type SaveReadResult =
  | Readonly<{ kind: 'empty' }>
  | Readonly<{
      kind: 'loaded';
      save: SaveV1;
      source: StoredCorruptSource;
      writtenAtEpochMs: number;
      notices: readonly SaveNotice[];
      corruptCopies: readonly CorruptSaveCopy[];
    }>
  | Readonly<{
      kind: 'corrupt';
      corruptCopies: readonly CorruptSaveCopy[];
    }>;

export type SaveSlotPreview =
  | Readonly<{ slotId: SaveSlotId; state: 'empty' }>
  | Readonly<{
      slotId: SaveSlotId;
      state: 'corrupt';
      corruptCopies: readonly CorruptSaveCopy[];
    }>
  | Readonly<{
      slotId: SaveSlotId;
      state: 'ready';
      regionId: SaveV1['location']['regionId'];
      areaId: SaveV1['location']['areaId'];
      playTimeMs: number;
      snapshotAtEpochMs: number;
      writtenAtEpochMs: number;
      healthUpgrades: number;
      manaUpgrades: number;
      recoveryState: 'clean' | 'recovered' | 'has-corrupt-copy';
    }>;

export interface SaveRepository {
  list(): Promise<readonly SaveSlotPreview[]>;
  read(slot: SaveSlotId): Promise<SaveReadResult>;
  write(slot: SaveSlotId, save: SaveV1): Promise<void>;
  delete(slot: SaveSlotId): Promise<void>;
}

export class SaveStorageError extends Error {
  public readonly name = 'SaveStorageError';

  public constructor(
    public readonly operation: 'list' | 'read' | 'write' | 'delete',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export class SaveValidationError extends Error {
  public readonly name = 'SaveValidationError';

  public constructor(public readonly issues: readonly SaveValidationIssue[]) {
    super('Save snapshot failed validation.');
  }
}
