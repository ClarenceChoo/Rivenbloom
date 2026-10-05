import { describe, expect, it } from 'vitest';

import { createSaveEnvelopeJson, decodeSaveEnvelope } from '../../src/game/saves/SaveEnvelope';
import {
  MemoryRawSaveStore,
  MemorySaveRepository,
} from '../../src/game/saves/MemorySaveRepository';
import type { StoredSlotRecord } from '../../src/game/saves/SaveRepository';
import { validateSaveV1 } from '../../src/game/saves/SaveSchema';
import { rawSaveV1 } from './saveFixtures';

function validatedSave(playTimeMs = 30_000) {
  const candidate = rawSaveV1();
  candidate.metadata.playTimeMs = playTimeMs;
  const result = validateSaveV1(candidate);
  if (result.kind !== 'valid') throw new Error('Save fixture must validate.');
  return result.value;
}

describe('MemorySaveRepository recovery', () => {
  it('lists exactly three explicit empty previews in slot order', async () => {
    const repository = new MemorySaveRepository();

    await expect(repository.list()).resolves.toEqual([
      { slotId: 'slot-1', state: 'empty' },
      { slotId: 'slot-2', state: 'empty' },
      { slotId: 'slot-3', state: 'empty' },
    ]);
    await expect(repository.read('slot-2')).resolves.toEqual({ kind: 'empty' });
  });

  it('loads valid current even when backup is corrupt and retains exact diagnostics', async () => {
    const currentJson = await createSaveEnvelopeJson(validatedSave(41_000), 500);
    const backupJson = '{broken-backup';
    const repository = seededRepository({
      slotId: 'slot-1',
      currentJson,
      backupJson,
      quarantine: null,
    });

    const result = await repository.read('slot-1');

    expect(result.kind).toBe('loaded');
    if (result.kind !== 'loaded') return;
    expect(result.source).toBe('current');
    expect(result.writtenAtEpochMs).toBe(500);
    expect(result.save.metadata.playTimeMs).toBe(41_000);
    expect(result.corruptCopies).toEqual([
      {
        source: 'backup',
        rawJson: backupJson,
        issues: [
          {
            path: '/',
            code: 'invalid-json',
            message: 'Save envelope is not valid JSON.',
          },
        ],
      },
    ]);
  });

  it('loads a valid backup when current is missing or corrupt and emits recovery', async () => {
    const backupJson = await createSaveEnvelopeJson(validatedSave(12_000), 400);
    const repository = seededRepository({
      slotId: 'slot-2',
      currentJson: '{broken-current',
      backupJson,
      quarantine: null,
    });

    const result = await repository.read('slot-2');

    expect(result.kind).toBe('loaded');
    if (result.kind !== 'loaded') return;
    expect(result.source).toBe('backup');
    expect(result.writtenAtEpochMs).toBe(400);
    expect(result.notices).toContainEqual({
      path: '/',
      code: 'recovered-from-backup',
      message: 'Recovered slot-2 from its previous valid revision.',
    });
    expect(result.corruptCopies[0]?.rawJson).toBe('{broken-current');
  });

  it('loads a valid backup when current is absent without fabricating corruption or healing', async () => {
    const backupJson = await createSaveEnvelopeJson(validatedSave(13_000), 410);
    const store = new MemoryRawSaveStore([
      {
        slotId: 'slot-2',
        currentJson: null,
        backupJson,
        quarantine: null,
      },
    ]);
    const repository = new MemorySaveRepository({ store, clock: () => 1000 });

    const result = await repository.read('slot-2');

    expect(result).toMatchObject({
      kind: 'loaded',
      source: 'backup',
      writtenAtEpochMs: 410,
      save: { metadata: { playTimeMs: 13_000 } },
      corruptCopies: [],
    });
    if (result.kind !== 'loaded') return;
    expect(result.notices).toContainEqual({
      path: '/',
      code: 'recovered-from-backup',
      message: 'Recovered slot-2 from its previous valid revision.',
    });
    await expect(store.read('slot-2')).resolves.toEqual({
      slotId: 'slot-2',
      currentJson: null,
      backupJson,
      quarantine: null,
    });
  });

  it('returns both exact corrupt byte strings as normal data', async () => {
    const repository = seededRepository({
      slotId: 'slot-3',
      currentJson: ' current garbage ',
      backupJson: ' backup garbage ',
      quarantine: null,
    });

    await expect(repository.read('slot-3')).resolves.toMatchObject({
      kind: 'corrupt',
      corruptCopies: [
        { source: 'current', rawJson: ' current garbage ' },
        { source: 'backup', rawJson: ' backup garbage ' },
      ],
    });
  });

  it('isolates writes and deletion to the selected slot', async () => {
    const repository = new MemorySaveRepository({ clock: () => 900 });

    await repository.write('slot-1', validatedSave(10));
    await repository.write('slot-2', validatedSave(20));
    await repository.write('slot-3', validatedSave(30));
    await repository.delete('slot-2');

    const previews = await repository.list();
    expect(previews.map((preview) => preview.state)).toEqual(['ready', 'empty', 'ready']);
    await expect(repository.read('slot-1')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 10 } },
    });
    await expect(repository.read('slot-3')).resolves.toMatchObject({
      kind: 'loaded',
      save: { metadata: { playTimeMs: 30 } },
    });
  });

  it('rotates only the previous valid generation and retains one backup', async () => {
    let now = 100;
    const store = new MemoryRawSaveStore();
    const repository = new MemorySaveRepository({ store, clock: () => now++ });

    await repository.write('slot-1', validatedSave(1));
    await repository.write('slot-1', validatedSave(2));
    const twoGenerations = await store.read('slot-1');
    if (twoGenerations === null || twoGenerations.backupJson === null) {
      throw new Error('Expected two stored generations.');
    }
    const first = await decodeSaveEnvelope(twoGenerations.backupJson);
    expect(first).toMatchObject({ kind: 'valid', value: { metadata: { playTimeMs: 1 } } });

    await repository.write('slot-1', validatedSave(3));
    const threeGenerations = await store.read('slot-1');
    if (threeGenerations === null || threeGenerations.backupJson === null) {
      throw new Error('Expected current and backup generations.');
    }
    const current = await decodeSaveEnvelope(threeGenerations.currentJson ?? '');
    const backup = await decodeSaveEnvelope(threeGenerations.backupJson);
    expect(current).toMatchObject({ kind: 'valid', value: { metadata: { playTimeMs: 3 } } });
    expect(backup).toMatchObject({ kind: 'valid', value: { metadata: { playTimeMs: 2 } } });
  });

  it('preserves a valid backup and quarantines corrupt copies when writing over corruption', async () => {
    const validBackup = await createSaveEnvelopeJson(validatedSave(7), 70);
    const store = new MemoryRawSaveStore([
      {
        slotId: 'slot-1',
        currentJson: '{bad-current',
        backupJson: validBackup,
        quarantine: null,
      },
    ]);
    const repository = new MemorySaveRepository({ store, clock: () => 80 });

    await repository.write('slot-1', validatedSave(8));

    const record = await store.read('slot-1');
    expect(record?.backupJson).toBe(validBackup);
    expect(record?.quarantine).toEqual({
      capturedAtEpochMs: 80,
      copies: [{ source: 'current', rawJson: '{bad-current' }],
    });
  });
});

function seededRepository(record: StoredSlotRecord): MemorySaveRepository {
  return new MemorySaveRepository({
    store: new MemoryRawSaveStore([record]),
    clock: () => 1000,
  });
}
