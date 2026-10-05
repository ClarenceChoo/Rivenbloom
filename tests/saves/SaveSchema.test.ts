import { describe, expect, it } from 'vitest';

import { abilityId, questId, questStageId, stableId } from '../../src/game/core/StableId';
import {
  DEFAULT_SAVE_SETTINGS,
  createNewSave,
  validateSaveV1,
} from '../../src/game/saves/SaveSchema';
import {
  canonicalJson,
  createSaveEnvelopeJson,
  decodeSaveEnvelope,
} from '../../src/game/saves/SaveEnvelope';
import { rawSaveV1 } from './saveFixtures';

describe('SaveSchema V1', () => {
  it('round-trips a fully populated save and preserves current serializable shapes', () => {
    const candidate = rawSaveV1();

    const result = validateSaveV1(candidate);

    expect(result).toEqual({ kind: 'valid', value: candidate, notices: [] });
  });

  it('defaults missing preferences and malformed settings leaves with explicit notices', () => {
    const candidate = rawSaveV1();
    const settings = candidate.settings;
    Reflect.deleteProperty(candidate, 'bindingOverrides');
    const result = validateSaveV1({
      ...candidate,
      settings: { ...settings, flashIntensity: 'bright', subtitles: undefined },
    });

    expect(result.kind).toBe('valid');
    if (result.kind !== 'valid') return;

    expect(result.value.bindingOverrides).toEqual([]);
    expect(result.value.settings).toEqual({
      ...settings,
      flashIntensity: 1,
      subtitles: true,
    });
    expect(result.notices).toEqual([
      {
        code: 'defaulted-preference',
        path: '/bindingOverrides',
        message: 'Missing binding overrides defaulted to an empty list.',
      },
      {
        code: 'defaulted-preference',
        path: '/settings/flashIntensity',
        message: 'Invalid setting defaulted to its neutral value.',
      },
      {
        code: 'defaulted-preference',
        path: '/settings/subtitles',
        message: 'Invalid setting defaulted to its neutral value.',
      },
    ]);
  });

  it('rejects missing progression instead of treating it as an optional default', () => {
    const candidate = rawSaveV1();
    Reflect.deleteProperty(candidate, 'worldProgress');

    const result = validateSaveV1(candidate);

    expect(result).toEqual({
      kind: 'invalid',
      errors: [
        {
          path: '/worldProgress',
          code: 'missing-required',
          message: 'Required field is missing.',
        },
      ],
    });
  });

  it.each([
    ['unknown fields', { extra: true }, '/extra', 'unknown-field'],
    [
      'invalid stable IDs',
      { location: { ...rawSaveV1().location, areaId: 'Wren Rest' } },
      '/location/areaId',
      'invalid-stable-id',
    ],
    [
      'numeric bounds',
      { player: { ...rawSaveV1().player, currentHealth: 101 } },
      '/player/currentHealth',
      'invalid-relation',
    ],
    [
      'non-finite coordinates',
      { location: { ...rawSaveV1().location, safePosition: { x: Number.NaN, y: 0 } } },
      '/location/safePosition/x',
      'out-of-range',
    ],
  ])('rejects %s deterministically', (_label, override, path, code) => {
    const result = validateSaveV1({ ...rawSaveV1(), ...override });

    expect(result.kind).toBe('invalid');
    if (result.kind !== 'invalid') return;

    expect(result.errors).toContainEqual({
      path,
      code,
      message: expect.any(String),
    });
  });

  it('rejects duplicate and unsorted set-like values instead of normalizing corruption', () => {
    const candidate = rawSaveV1();
    candidate.worldProgress.openedChests = ['well-chest', 'well-chest'];
    candidate.player.spellLevels = [
      { abilityId: 'moth-glimmer', level: 1 },
      { abilityId: 'moth-glimmer', level: 2 },
    ];

    const result = validateSaveV1(candidate);

    expect(result.kind).toBe('invalid');
    if (result.kind !== 'invalid') return;
    expect(result.errors).toEqual([
      {
        path: '/player/spellLevels/1/abilityId',
        code: 'duplicate-id',
        message: 'ID must be unique.',
      },
      {
        path: '/worldProgress/openedChests/1',
        code: 'duplicate-id',
        message: 'ID must be unique.',
      },
    ]);
  });

  it('rejects unknown fields nested inside binding overrides instead of defaulting them', () => {
    const candidate = rawSaveV1();
    const firstBinding = candidate.bindingOverrides[0]?.bindings[0];
    if (firstBinding === undefined) throw new Error('Expected binding fixture.');
    Reflect.set(firstBinding, 'turbo', true);

    const result = validateSaveV1(candidate);

    expect(result).toEqual({
      kind: 'invalid',
      errors: [
        {
          path: '/bindingOverrides/0/bindings/0/turbo',
          code: 'unknown-field',
          message: 'Unknown field is not allowed in this schema version.',
        },
      ],
    });
  });

  it('rejects sparse required arrays at their missing JSON-Pointer index', () => {
    const candidate = rawSaveV1();
    const sparseInventory: unknown[] = [];
    sparseInventory.length = 1;
    Reflect.set(candidate, 'inventory', sparseInventory);

    const result = validateSaveV1(candidate);

    expect(result).toEqual({
      kind: 'invalid',
      errors: [
        {
          path: '/inventory/0',
          code: 'missing-required',
          message: 'Array entry is missing.',
        },
      ],
    });
  });

  it('creates a normalized new save only from authored balance inputs', () => {
    const save = createNewSave({
      nowEpochMs: 1234,
      location: {
        regionId: stableId<'region'>('brackenreach'),
        areaId: stableId<'area'>('wren-rest'),
        checkpointId: stableId<'checkpoint'>('village-well'),
        safePosition: { x: 144.5, y: -32 },
      },
      baseStats: { maxHealth: 80, maxMana: 25, attackPower: 9, armour: 0 },
      initialQuests: {
        stages: [
          {
            questId: questId('hollow-song'),
            stageId: questStageId('find-wren'),
          },
        ],
        flags: [],
      },
      startingAbilities: [abilityId('bramble-bolt')],
    });

    expect(save.player.currentHealth).toBe(80);
    expect(save.player.currentMana).toBe(25);
    expect(save.player.baseStats.attackPower).toBe(9);
    expect(save.metadata).toEqual({
      createdAtEpochMs: 1234,
      snapshotAtEpochMs: 1234,
      playTimeMs: 0,
    });
    expect(save.inventory).toEqual([]);
    expect(save.worldProgress).toEqual({
      defeatedBosses: [],
      openedChests: [],
      activatedShortcuts: [],
      solvedPuzzles: [],
      discoveredRooms: [],
      claimedDiscoveries: [],
    });
    expect(save.settings).toEqual(DEFAULT_SAVE_SETTINGS);
  });
});

describe('canonical save envelopes', () => {
  it('sorts object keys, preserves arrays, and normalizes negative zero', () => {
    expect(canonicalJson({ z: -0, a: [{ y: 2, x: 1 }] })).toBe('{"a":[{"x":1,"y":2}],"z":0}');
  });

  it.each([undefined, 1n, Number.POSITIVE_INFINITY, new Date(0), { missing: undefined }])(
    'rejects non-JSON canonical input %#',
    (candidate) => {
      expect(() => canonicalJson(candidate)).toThrow(TypeError);
    },
  );

  it('rejects cyclic input', () => {
    const candidate: Record<string, unknown> = {};
    candidate.self = candidate;

    expect(() => canonicalJson(candidate)).toThrow(TypeError);
  });

  it('rejects sparse arrays instead of collapsing absent indexes', () => {
    const sparse: unknown[] = [];
    sparse.length = 2;
    sparse[1] = 'present';

    expect(() => canonicalJson(sparse)).toThrow(TypeError);
  });

  it('gives reordered payload keys the same SHA-256 checksum', async () => {
    const first = rawSaveV1();
    const { settings, schemaVersion, ...middle } = first;
    const reordered = { settings, ...middle, schemaVersion };

    const firstJson = await createSaveEnvelopeJson(first, 777);
    const reorderedJson = await createSaveEnvelopeJson(reordered, 777);

    expect(reorderedJson).toBe(firstJson);
    expect(firstJson).toContain('"checksum":"sha256:');
  });

  it('detects payload and timestamp tampering', async () => {
    const envelopeJson = await createSaveEnvelopeJson(rawSaveV1(), 777);
    const parsed: unknown = JSON.parse(envelopeJson);
    if (!isRecord(parsed)) {
      throw new Error('Expected envelope object fixture.');
    }

    const payloadTampered = { ...parsed, payload: { ...rawSaveV1(), schemaVersion: 0 } };
    const timestampTampered = { ...parsed, writtenAtEpochMs: 778 };

    await expect(decodeSaveEnvelope(JSON.stringify(payloadTampered))).resolves.toEqual({
      kind: 'invalid',
      errors: [
        {
          path: '/checksum',
          code: 'checksum-mismatch',
          message: 'Envelope checksum does not match its contents.',
        },
      ],
    });
    await expect(decodeSaveEnvelope(JSON.stringify(timestampTampered))).resolves.toEqual({
      kind: 'invalid',
      errors: [
        {
          path: '/checksum',
          code: 'checksum-mismatch',
          message: 'Envelope checksum does not match its contents.',
        },
      ],
    });
  });
});

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
