import {
  createDefaultSave,
  isSaveSlotId,
  validateSave,
  type SaveSlotId,
  type SaveV1
} from './SaveSchema';

export type MigrationResult =
  | { readonly ok: true; readonly save: SaveV1; readonly migratedFrom?: number }
  | {
      readonly ok: false;
      readonly reason: 'invalid-save' | 'unsupported-version';
      readonly schemaVersion?: number;
      readonly errors?: readonly string[];
    };

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const integer = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fallback;

const position = (value: unknown): { readonly x: number; readonly y: number } => {
  if (!isRecord(value) || typeof value.x !== 'number' || typeof value.y !== 'number')
    return { x: 0, y: 0 };
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y) || value.x < 0 || value.y < 0)
    return { x: 0, y: 0 };
  return { x: value.x, y: value.y };
};

const migrateV0 = (candidate: UnknownRecord): MigrationResult => {
  if (!isSaveSlotId(candidate.slotId))
    return { ok: false, reason: 'invalid-save', errors: ['slotId must identify a save slot'] };
  const savedAt = integer(candidate.savedAt, 0);
  const save = createDefaultSave(candidate.slotId as SaveSlotId, savedAt);
  const migrated = {
    ...save,
    metadata: {
      ...save.metadata,
      updatedAt: savedAt,
      playtimeSeconds: integer(candidate.playtimeSeconds, 0),
      areaId: typeof candidate.areaId === 'string' ? candidate.areaId : save.metadata.areaId,
      ...(typeof candidate.checkpointId === 'string'
        ? { checkpointId: candidate.checkpointId }
        : {}),
      safePosition: position(candidate.position)
    },
    player: {
      ...save.player,
      health: typeof candidate.health === 'number' ? candidate.health : save.player.health,
      mana: typeof candidate.mana === 'number' ? candidate.mana : save.player.mana,
      currency: integer(candidate.currency, save.player.currency)
    }
  };
  const validation = validateSave(migrated);
  return validation.ok
    ? { ok: true, save: validation.save, migratedFrom: 0 }
    : { ok: false, reason: 'invalid-save', errors: validation.errors.map((entry) => entry.path) };
};

export function migrateSaveCandidate(candidate: unknown): MigrationResult {
  if (!isRecord(candidate) || typeof candidate.schemaVersion !== 'number')
    return { ok: false, reason: 'invalid-save', errors: ['schemaVersion is required'] };
  if (candidate.schemaVersion === 1) {
    const validation = validateSave(candidate);
    return validation.ok
      ? { ok: true, save: validation.save }
      : { ok: false, reason: 'invalid-save', errors: validation.errors.map((entry) => entry.path) };
  }
  if (candidate.schemaVersion === 0) return migrateV0(candidate);
  return { ok: false, reason: 'unsupported-version', schemaVersion: candidate.schemaVersion };
}
