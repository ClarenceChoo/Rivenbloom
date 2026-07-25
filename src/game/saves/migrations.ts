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

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isNonNegativeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isStableId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

const invalidV0 = (errors: readonly string[]): MigrationResult => ({
  ok: false,
  reason: 'invalid-save',
  errors
});

const migrateV0 = (candidate: UnknownRecord): MigrationResult => {
  if (!isSaveSlotId(candidate.slotId))
    return { ok: false, reason: 'invalid-save', errors: ['slotId must identify a save slot'] };
  const errors: string[] = [];
  if (candidate.savedAt !== undefined && !isNonNegativeInteger(candidate.savedAt))
    errors.push('savedAt');
  if (candidate.playtimeSeconds !== undefined && !isNonNegativeInteger(candidate.playtimeSeconds))
    errors.push('playtimeSeconds');
  if (candidate.currency !== undefined && !isNonNegativeInteger(candidate.currency))
    errors.push('currency');
  if (candidate.areaId !== undefined && !isStableId(candidate.areaId)) errors.push('areaId');
  if (candidate.checkpointId !== undefined && !isStableId(candidate.checkpointId))
    errors.push('checkpointId');
  if (candidate.health !== undefined && !isNonNegativeNumber(candidate.health))
    errors.push('health');
  if (candidate.mana !== undefined && !isNonNegativeNumber(candidate.mana)) errors.push('mana');
  if (candidate.position !== undefined) {
    if (!isRecord(candidate.position) || !isNonNegativeNumber(candidate.position.x))
      errors.push('position.x');
    if (!isRecord(candidate.position) || !isNonNegativeNumber(candidate.position.y))
      errors.push('position.y');
  }
  if (errors.length > 0) return invalidV0(errors);

  const savedAt = isNonNegativeInteger(candidate.savedAt) ? candidate.savedAt : 0;
  const save = createDefaultSave(candidate.slotId as SaveSlotId, savedAt);
  const migrated = {
    ...save,
    metadata: {
      ...save.metadata,
      updatedAt: savedAt,
      playtimeSeconds: isNonNegativeInteger(candidate.playtimeSeconds)
        ? candidate.playtimeSeconds
        : 0,
      areaId: isStableId(candidate.areaId) ? candidate.areaId : save.metadata.areaId,
      ...(isStableId(candidate.checkpointId) ? { checkpointId: candidate.checkpointId } : {}),
      safePosition:
        isRecord(candidate.position) &&
        isNonNegativeNumber(candidate.position.x) &&
        isNonNegativeNumber(candidate.position.y)
          ? { x: candidate.position.x, y: candidate.position.y }
          : save.metadata.safePosition
    },
    player: {
      ...save.player,
      health: isNonNegativeNumber(candidate.health) ? candidate.health : save.player.health,
      mana: isNonNegativeNumber(candidate.mana) ? candidate.mana : save.player.mana,
      currency: isNonNegativeInteger(candidate.currency) ? candidate.currency : save.player.currency
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
