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

export class MemorySaveRepository implements SaveRepository {
  private readonly records = new Map<SaveSlotId, SaveSlotRecord>();

  public constructor(initialRecords: Partial<Record<SaveSlotId, SaveSlotRecord>> = {}) {
    for (const slotId of saveSlots()) {
      const record = initialRecords[slotId];
      if (record !== undefined) this.records.set(slotId, structuredClone(record));
    }
  }

  public async list(): Promise<readonly SaveSlotPreview[]> {
    return saveSlots().map((slotId) => previewSaveSlot(slotId, this.records.get(slotId)));
  }

  public async read(slot: SaveSlotId): Promise<SaveReadResult> {
    return resolveSaveSlotRecord(slot, this.records.get(slot));
  }

  public async write(slot: SaveSlotId, save: SaveV1): Promise<void> {
    const validation = validateSave(save);
    if (!validation.ok)
      throw new TypeError(
        `Cannot write invalid save: ${validation.errors[0]?.path ?? 'unknown error'}`
      );
    if (validation.save.slotId !== slot)
      throw new TypeError('Save slot does not match the write destination.');
    this.records.set(
      slot,
      rotateSaveRecord(this.records.get(slot), createSaveEnvelope(validation.save))
    );
  }

  public async delete(slot: SaveSlotId): Promise<void> {
    this.records.delete(slot);
  }
}
