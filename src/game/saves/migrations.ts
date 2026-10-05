import { DEFAULT_SAVE_SETTINGS, SAVE_SCHEMA_VERSION, validateSaveV1 } from './SaveSchema';
import type { SaveNotice, SaveV1, SaveValidationIssue } from './SaveSchema';

export type MigrationStepId = '0-to-1';

export type SaveMigrationResult =
  | Readonly<{
      kind: 'current';
      value: SaveV1;
      notices: readonly SaveNotice[];
    }>
  | Readonly<{
      kind: 'migrated';
      fromVersion: number;
      appliedSteps: readonly MigrationStepId[];
      value: SaveV1;
      notices: readonly SaveNotice[];
    }>
  | Readonly<{
      kind: 'invalid';
      errors: readonly SaveValidationIssue[];
    }>;

type MigrationStepResult =
  | Readonly<{ kind: 'next'; raw: unknown; stepId: MigrationStepId }>
  | Readonly<{ kind: 'invalid'; errors: readonly SaveValidationIssue[] }>;

type MigrationStep = (candidate: unknown) => MigrationStepResult;

const migrationRegistry: ReadonlyMap<number, MigrationStep> = new Map([[0, migrateV0ToV1]]);

export function migrateSave(candidate: unknown): SaveMigrationResult {
  if (!isPlainRecord(candidate)) {
    return invalid('/', 'invalid-type', 'Save payload must be a plain object.');
  }
  if (!hasOwn(candidate, 'schemaVersion')) {
    return invalid('/schemaVersion', 'missing-required', 'Required field is missing.');
  }
  if (
    typeof candidate.schemaVersion !== 'number' ||
    !Number.isSafeInteger(candidate.schemaVersion)
  ) {
    return invalid('/schemaVersion', 'unsupported-version', 'Save schema version is unsupported.');
  }
  if (candidate.schemaVersion > SAVE_SCHEMA_VERSION || candidate.schemaVersion < 0) {
    return invalid('/schemaVersion', 'unsupported-version', 'Save schema version is unsupported.');
  }
  if (candidate.schemaVersion === SAVE_SCHEMA_VERSION) {
    const current = validateSaveV1(candidate);
    return current.kind === 'valid'
      ? { kind: 'current', value: current.value, notices: current.notices }
      : current;
  }

  const fromVersion = candidate.schemaVersion;
  let version = fromVersion;
  let raw: unknown = candidate;
  const appliedSteps: MigrationStepId[] = [];

  while (version < SAVE_SCHEMA_VERSION) {
    const step = migrationRegistry.get(version);
    if (step === undefined) {
      return invalid(
        '/schemaVersion',
        'unsupported-version',
        'No migration path exists for this save schema version.',
      );
    }
    const result = step(raw);
    if (result.kind === 'invalid') return result;
    raw = result.raw;
    appliedSteps.push(result.stepId);
    version += 1;
  }

  const validation = validateSaveV1(raw);
  if (validation.kind === 'invalid') return validation;
  const notices: SaveNotice[] = [
    {
      path: '/schemaVersion',
      code: 'migration-applied',
      message: `Migrated save schema from version ${fromVersion} to version ${SAVE_SCHEMA_VERSION}.`,
    },
    ...validation.notices,
  ];
  return {
    kind: 'migrated',
    fromVersion,
    appliedSteps,
    value: validation.value,
    notices,
  };
}

function migrateV0ToV1(candidate: unknown): MigrationStepResult {
  if (!isPlainRecord(candidate) || candidate.schemaVersion !== 0) {
    return invalid(
      '/schemaVersion',
      'unsupported-version',
      'Migration step 0-to-1 requires schema version 0.',
    );
  }
  const allowedRoot = new Set([
    'schemaVersion',
    'metadata',
    'location',
    'player',
    'inventory',
    'equipment',
    'quests',
    'worldProgress',
  ]);
  const unknownRoot = Object.keys(candidate)
    .filter((key) => !allowedRoot.has(key))
    .sort();
  if (unknownRoot.length > 0) {
    const key = unknownRoot[0];
    return invalid(
      `/${escapePointer(key ?? '')}`,
      'unknown-field',
      'Unknown field is not allowed in schema version 0.',
    );
  }
  if (!isPlainRecord(candidate.metadata)) {
    return invalid(
      '/metadata',
      candidate.metadata === undefined ? 'missing-required' : 'invalid-type',
      'V0 metadata must be a plain object.',
    );
  }
  const allowedMetadata = new Set(['createdAtEpochMs', 'snapshotAtEpochMs', 'playTimeSeconds']);
  const unknownMetadata = Object.keys(candidate.metadata)
    .filter((key) => !allowedMetadata.has(key))
    .sort();
  if (unknownMetadata.length > 0) {
    const key = unknownMetadata[0];
    return invalid(
      `/metadata/${escapePointer(key ?? '')}`,
      'unknown-field',
      'Unknown field is not allowed in schema version 0 metadata.',
    );
  }
  if (!hasOwn(candidate.metadata, 'playTimeSeconds')) {
    return invalid('/metadata/playTimeSeconds', 'missing-required', 'Required field is missing.');
  }
  const seconds = candidate.metadata.playTimeSeconds;
  if (typeof seconds !== 'number') {
    return invalid(
      '/metadata/playTimeSeconds',
      'invalid-type',
      'Play time seconds must be a number.',
    );
  }
  if (!Number.isSafeInteger(seconds) || seconds < 0) {
    return invalid(
      '/metadata/playTimeSeconds',
      'out-of-range',
      'Play time seconds must be a non-negative safe integer.',
    );
  }
  if (seconds > Math.floor(Number.MAX_SAFE_INTEGER / 1000)) {
    return invalid(
      '/metadata/playTimeSeconds',
      'out-of-range',
      'Seconds cannot be represented as safe milliseconds.',
    );
  }

  return {
    kind: 'next',
    stepId: '0-to-1',
    raw: {
      ...candidate,
      schemaVersion: 1,
      metadata: {
        createdAtEpochMs: candidate.metadata.createdAtEpochMs,
        snapshotAtEpochMs: candidate.metadata.snapshotAtEpochMs,
        playTimeMs: seconds * 1000,
      },
      bindingOverrides: [],
      settings: { ...DEFAULT_SAVE_SETTINGS },
    },
  };
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(record: Readonly<Record<string, unknown>>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function invalid(
  path: string,
  code: SaveValidationIssue['code'],
  message: string,
): Readonly<{ kind: 'invalid'; errors: readonly SaveValidationIssue[] }> {
  return { kind: 'invalid', errors: [{ path, code, message }] };
}

function escapePointer(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}
