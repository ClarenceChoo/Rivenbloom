import { describe, expect, test } from 'vitest';

import {
  formatPlayTime,
  formatSnapshotTime,
  formatUpgrades,
  mapAreaLabel,
  mapSlotError,
  mapSlotResult,
} from '../../src/game/title/TitleSlotModel';
import type { CorruptSaveCopy, SaveReadResult } from '../../src/game/saves/SaveRepository';
import { validateSaveV1 } from '../../src/game/saves/SaveSchema';
import type { SaveV1 } from '../../src/game/saves/SaveSchema';
import { rawSaveV1 } from '../saves/saveFixtures';

function saveWithArea(areaId: string): SaveV1 {
  const result = validateSaveV1({
    ...rawSaveV1(),
    location: { ...rawSaveV1().location, areaId },
  });
  if (result.kind === 'invalid') throw new Error('Fixture must be valid.');
  return result.value;
}

function corruptCopy(source: 'current' | 'backup' = 'current'): CorruptSaveCopy {
  return { source, rawJson: '{broken', issues: [] };
}

function loaded(
  overrides: Partial<Extract<SaveReadResult, { kind: 'loaded' }>> = {},
): Extract<SaveReadResult, { kind: 'loaded' }> {
  return {
    kind: 'loaded',
    save: saveWithArea('wren-rest'),
    source: 'current',
    writtenAtEpochMs: Date.UTC(2026, 7, 8, 14, 3, 5),
    notices: [],
    corruptCopies: [],
    ...overrides,
  };
}

describe('title slot result mapping', () => {
  test('maps empty, clean, recovered, retained-corruption, and corrupt results', () => {
    expect(mapSlotResult('slot-1', { kind: 'empty' })).toMatchObject({
      kind: 'empty',
      slotId: 'slot-1',
      label: 'Journey 1',
    });
    expect(mapSlotResult('slot-1', loaded())).toMatchObject({
      kind: 'ready',
      recoveryState: 'clean',
      areaLabel: "Wren's Rest",
      canLoad: true,
    });
    expect(mapSlotResult('slot-2', loaded({ source: 'backup' }))).toMatchObject({
      kind: 'ready',
      recoveryState: 'recovered',
      label: 'Journey 2',
    });
    expect(mapSlotResult('slot-3', loaded({ corruptCopies: [corruptCopy()] }))).toMatchObject({
      kind: 'ready',
      recoveryState: 'has-corrupt-copy',
      corruptCopyCount: 1,
    });
    expect(
      mapSlotResult('slot-2', { kind: 'corrupt', corruptCopies: [corruptCopy()] }),
    ).toMatchObject({
      kind: 'corrupt',
      label: 'Journey 2',
      corruptCopyCount: 1,
    });
  });

  test('maps unexpected failures to a readable retryable slot error', () => {
    expect(mapSlotError('slot-3')).toEqual({
      kind: 'error',
      slotId: 'slot-3',
      label: 'Journey 3',
      message: 'This journey could not be read.',
    });
  });

  test('never exposes unknown area IDs and blocks loading them', () => {
    expect(mapAreaLabel('rootglass-reliquary')).toEqual({
      label: 'Rootglass Reliquary',
      known: true,
    });
    expect(mapAreaLabel('unreleased-route')).toEqual({ label: 'Unknown area', known: false });
    const slot = mapSlotResult('slot-1', loaded({ save: saveWithArea('unreleased-route') }));
    expect(slot).toMatchObject({ kind: 'ready', areaLabel: 'Unknown area', canLoad: false });
    expect(JSON.stringify(slot)).not.toContain('unreleased-route');
  });

  test.each([
    ['brackenreach', 'Brackenreach'],
    ['singing-hollows', 'Singing Hollows'],
    ['rootglass-reliquary', 'Rootglass Reliquary'],
    ['hollow-choir', 'Hollow Choir'],
  ])('shows implemented route %s as loadable', (areaId, areaLabel) => {
    const slot = mapSlotResult('slot-1', loaded({ save: saveWithArea(areaId) }));
    expect(mapAreaLabel(areaId)).toEqual({ label: areaLabel, known: true });
    expect(slot).toMatchObject({ kind: 'ready', areaLabel, canLoad: true });
  });

  test('loads every authored area and keeps unknown routes private', () => {
    expect(mapSlotResult('slot-1', loaded({ save: saveWithArea('wren-rest') }))).toMatchObject({
      areaLabel: "Wren's Rest",
      canLoad: true,
    });
    expect(mapAreaLabel('unreleased-route')).toEqual({ label: 'Unknown area', known: false });
    expect(mapAreaLabel('constructor')).toEqual({ label: 'Unknown area', known: false });
    expect(mapSlotResult('slot-1', loaded({ save: saveWithArea('constructor') }))).toMatchObject({
      areaLabel: 'Unknown area',
      canLoad: false,
    });
  });
});

describe('deterministic title formatting', () => {
  test.each([
    [0, '00:00:00'],
    [3_723_000, '01:02:03'],
    [363_600_000, '101:00:00'],
  ])('formats %i milliseconds without locale-sensitive output', (milliseconds, expected) => {
    expect(formatPlayTime(milliseconds)).toBe(expected);
  });

  test('formats upgrades with the approved names', () => {
    expect(formatUpgrades(2, 1)).toBe('Heart Petals +2 · Wellspring Seeds +1');
  });

  test('formats snapshot time in fixed UTC text and machine-readable ISO', () => {
    expect(formatSnapshotTime(Date.UTC(2026, 7, 8, 14, 3, 5))).toEqual({
      dateTime: '2026-08-08T14:03:05.000Z',
      label: '08 Aug 2026 · 14:03 UTC',
    });
  });
});
