import {
  SAVE_SLOT_IDS,
  validateSaveEnvelope,
  type SaveEnvelope,
  type SaveSlotId,
  type SaveV1
} from './SaveSchema';

export type SaveSlotRecord = { readonly current?: unknown; readonly backup?: unknown };

export type SaveReadResult =
  | { readonly kind: 'empty' }
  | {
      readonly kind: 'loaded';
      readonly save: SaveV1;
      readonly recoveredFromBackup: boolean;
      readonly notice?: string;
    }
  | { readonly kind: 'corrupt'; readonly reason: string };

export type SaveSlotPreview = {
  readonly slotId: SaveSlotId;
  readonly status: 'empty' | 'available' | 'recoverable' | 'corrupt';
  readonly areaId?: string;
  readonly playtimeSeconds?: number;
  readonly updatedAt?: number;
};

export interface SaveRepository {
  list(): Promise<readonly SaveSlotPreview[]>;
  read(slot: SaveSlotId): Promise<SaveReadResult>;
  write(slot: SaveSlotId, save: SaveV1): Promise<void>;
  delete(slot: SaveSlotId): Promise<void>;
}

export const resolveSaveSlotRecord = (
  slotId: SaveSlotId,
  record: SaveSlotRecord | undefined
): SaveReadResult => {
  if (record === undefined || (record.current === undefined && record.backup === undefined))
    return { kind: 'empty' };
  const current = validateSaveEnvelope(record.current);
  if (current.ok && current.envelope.save.slotId === slotId)
    return { kind: 'loaded', save: current.envelope.save, recoveredFromBackup: false };
  const backup = validateSaveEnvelope(record.backup);
  if (backup.ok && backup.envelope.save.slotId === slotId) {
    return {
      kind: 'loaded',
      save: backup.envelope.save,
      recoveredFromBackup: true,
      notice: 'Recovered save from backup.'
    };
  }
  return { kind: 'corrupt', reason: 'Neither the current save nor its backup passed validation.' };
};

export const previewSaveSlot = (
  slotId: SaveSlotId,
  record: SaveSlotRecord | undefined
): SaveSlotPreview => {
  const result = resolveSaveSlotRecord(slotId, record);
  if (result.kind === 'empty') return { slotId, status: 'empty' };
  if (result.kind === 'corrupt') return { slotId, status: 'corrupt' };
  return {
    slotId,
    status: result.recoveredFromBackup ? 'recoverable' : 'available',
    areaId: result.save.metadata.areaId,
    playtimeSeconds: result.save.metadata.playtimeSeconds,
    updatedAt: result.save.metadata.updatedAt
  };
};

export const saveSlots = (): readonly SaveSlotId[] => SAVE_SLOT_IDS;

export const rotateSaveRecord = (
  record: SaveSlotRecord | undefined,
  next: SaveEnvelope
): SaveSlotRecord => {
  const current = validateSaveEnvelope(record?.current);
  return current.ok
    ? { current: next, backup: current.envelope }
    : { current: next, backup: record?.backup };
};
