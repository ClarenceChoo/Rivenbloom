import { describe, expect, it } from 'vitest';

import { DEFAULT_SAVE_SETTINGS } from '../../src/game/saves/SaveSchema';
import { createSaveEnvelopeJson, decodeSaveEnvelope } from '../../src/game/saves/SaveEnvelope';
import { migrateSave } from '../../src/game/saves/migrations';
import { rawSaveV0, rawSaveV1 } from './saveFixtures';

describe('save migrations', () => {
  it('returns current V1 saves without migration steps', () => {
    const result = migrateSave(rawSaveV1());

    expect(result).toEqual({ kind: 'current', value: rawSaveV1(), notices: [] });
  });

  it('migrates V0 seconds safely and adds preferences in one ordered step', () => {
    const result = migrateSave(rawSaveV0());

    expect(result.kind).toBe('migrated');
    if (result.kind !== 'migrated') return;
    expect(result.fromVersion).toBe(0);
    expect(result.appliedSteps).toEqual(['0-to-1']);
    expect(result.value.schemaVersion).toBe(1);
    expect(result.value.metadata.playTimeMs).toBe(30_000);
    expect(result.value.settings).toEqual(DEFAULT_SAVE_SETTINGS);
    expect(result.value.bindingOverrides).toEqual([]);
    expect(result.notices).toEqual([
      {
        path: '/schemaVersion',
        code: 'migration-applied',
        message: 'Migrated save schema from version 0 to version 1.',
      },
    ]);
  });

  it('rejects malformed V0 before arithmetic can overflow', () => {
    const candidate = rawSaveV0();
    candidate.metadata.playTimeSeconds = Number.MAX_SAFE_INTEGER;

    const result = migrateSave(candidate);

    expect(result).toEqual({
      kind: 'invalid',
      errors: [
        {
          path: '/metadata/playTimeSeconds',
          code: 'out-of-range',
          message: 'Seconds cannot be represented as safe milliseconds.',
        },
      ],
    });
  });

  it('rejects malformed V0 structural fields with final V1 validation', () => {
    const candidate = rawSaveV0();
    candidate.location.areaId = 'Bad Area';

    const result = migrateSave(candidate);

    expect(result.kind).toBe('invalid');
    if (result.kind !== 'invalid') return;
    expect(result.errors).toContainEqual({
      path: '/location/areaId',
      code: 'invalid-stable-id',
      message: expect.any(String),
    });
  });

  it.each([
    [{ metadata: {} }, 'missing-required'],
    [{ schemaVersion: 99 }, 'unsupported-version'],
  ])('rejects missing and future versions %#', (candidate, code) => {
    const result = migrateSave(candidate);

    expect(result).toEqual({
      kind: 'invalid',
      errors: [
        {
          path: '/schemaVersion',
          code,
          message: expect.any(String),
        },
      ],
    });
  });

  it('decodes checksummed V0 envelopes through the migration registry', async () => {
    const envelope = await createSaveEnvelopeJson(rawSaveV0(), 555);

    const result = await decodeSaveEnvelope(envelope);

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') return;
    expect(result.value.schemaVersion).toBe(1);
    expect(result.value.metadata.playTimeMs).toBe(30_000);
    expect(result.notices).toEqual([
      {
        path: '/schemaVersion',
        code: 'migration-applied',
        message: 'Migrated save schema from version 0 to version 1.',
      },
    ]);
  });
});
