import { describe, expect, test, vi } from 'vitest';

import { TitleController } from '../../src/game/title/TitleController';
import { commandSlotId } from '../../src/game/title/TitleCommands';
import type { TitleCommand } from '../../src/game/title/TitleCommands';
import type { TitleSavePort } from '../../src/game/title/TitleController';
import type { SaveReadResult } from '../../src/game/saves/SaveRepository';
import { DEFAULT_SAVE_SETTINGS, validateSaveV1 } from '../../src/game/saves/SaveSchema';
import type { SaveSlotId, SaveV1 } from '../../src/game/saves/SaveSchema';
import { rawSaveV1 } from '../saves/saveFixtures';

function validSave(areaId = 'wren-rest'): SaveV1 {
  const result = validateSaveV1({
    ...rawSaveV1(),
    location: { ...rawSaveV1().location, areaId },
  });
  if (result.kind === 'invalid') throw new Error('Fixture must be valid.');
  return result.value;
}

function ready(save = validSave()): SaveReadResult {
  return {
    kind: 'loaded',
    save,
    source: 'current',
    writtenAtEpochMs: 1_700_000_030_000,
    notices: [],
    corruptCopies: [],
  };
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

async function settleAsync(): Promise<void> {
  for (let turn = 0; turn < 6; turn += 1) await Promise.resolve();
}

function importPreview(candidateId: object) {
  return {
    kind: 'ready' as const,
    candidateId,
    preview: {
      regionId: validSave().location.regionId,
      areaId: validSave().location.areaId,
      playTimeMs: 30_000,
      snapshotAtEpochMs: 1_700_000_030_000,
      healthUpgrades: 2,
      manaUpgrades: 1,
    },
    notices: [],
  };
}

function savePort(read: TitleSavePort['read']): TitleSavePort {
  return {
    read: vi.fn(read),
    delete: vi.fn(async () => undefined),
    import: vi.fn(async () => ({ kind: 'invalid' as const, errors: [] })),
    confirmImport: vi.fn(async () => undefined),
    cancelImport: vi.fn(() => false),
    export: vi.fn(async () => '{}'),
    exportCorrupt: vi.fn(async () => '{broken'),
    saveNow: vi.fn(async () => undefined),
    getNotices: vi.fn(() => []),
  };
}

describe('TitleController', () => {
  test('reads the three fixed slots directly and reaches a ready title state', async () => {
    const read = vi.fn(async (slot: SaveSlotId): Promise<SaveReadResult> => {
      void slot;
      return { kind: 'empty' };
    });
    const controller = new TitleController(savePort(read));
    await controller.start();
    expect(read.mock.calls.map(([slot]) => slot)).toEqual(['slot-1', 'slot-2', 'slot-3']);
    expect(controller.snapshot).toMatchObject({
      titleReady: true,
      slots: [{ kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' }],
    });
  });

  test('suppresses stale slot reads after a newer refresh completes', async () => {
    const stale = [
      deferred<SaveReadResult>(),
      deferred<SaveReadResult>(),
      deferred<SaveReadResult>(),
    ];
    let calls = 0;
    const port = savePort(async () => {
      const index = calls;
      calls += 1;
      return index < 3 ? stale[index]!.promise : { kind: 'empty' };
    });
    const controller = new TitleController(port);
    const first = controller.start();
    await controller.refresh();
    stale.forEach((item) => item.resolve(ready()));
    await first;
    expect(controller.snapshot.slots.map(({ kind }) => kind)).toEqual(['empty', 'empty', 'empty']);
  });

  test('keeps a read failure retryable after opening and closing another dialog', async () => {
    let failFirstSlot = true;
    const port = savePort(async (slotId) => {
      if (failFirstSlot && slotId === 'slot-1') throw new Error('read failed');
      return { kind: 'empty' };
    });
    const controller = new TitleController(port);
    await controller.start();

    expect(controller.snapshot.globalError).toBe(
      'Some journeys could not be read. Retry journeys.',
    );
    await expect(controller.issue({ type: 'open-credits' })).resolves.toBe('handled');
    controller.closeDialog();
    expect(controller.snapshot.globalError).toBe(
      'Some journeys could not be read. Retry journeys.',
    );
    await expect(controller.issue({ type: 'open-settings' })).resolves.toBe('handled');
    controller.closeDialog();
    expect(controller.snapshot.globalError).toBe(
      'Some journeys could not be read. Retry journeys.',
    );

    failFirstSlot = false;
    await expect(controller.refresh()).resolves.toBe(true);
    expect(controller.snapshot.globalError).toBeNull();
    expect(controller.snapshot.slots.map(({ kind }) => kind)).toEqual(['empty', 'empty', 'empty']);
  });

  test('keeps a slot read retry while another slot import preview is cancelled', async () => {
    const candidateId = Object.freeze({});
    const port = savePort(async (slotId) => {
      if (slotId === 'slot-1') throw new Error('read failed');
      return { kind: 'empty' };
    });
    port.import = vi.fn(async () => importPreview(candidateId));
    const controller = new TitleController(port);
    await controller.start();

    await controller.previewImport('slot-2', '{}');
    expect(controller.snapshot.dialog).toMatchObject({ kind: 'import-preview', slotId: 'slot-2' });
    expect(controller.snapshot.globalError).toBe(
      'Some journeys could not be read. Retry journeys.',
    );
    controller.closeDialog();

    expect(port.cancelImport).toHaveBeenCalledWith(candidateId);
    expect(controller.snapshot.globalError).toBe(
      'Some journeys could not be read. Retry journeys.',
    );
  });

  test('keeps a slot read retry through a successful settings save', async () => {
    const port = savePort(async (slotId) => {
      if (slotId === 'slot-1') throw new Error('read failed');
      return slotId === 'slot-2' ? ready() : { kind: 'empty' };
    });
    const controller = new TitleController(port);
    await controller.start();

    await controller.issue({ type: 'open-settings' });
    controller.updateSettings({ ...DEFAULT_SAVE_SETTINGS, reducedMotion: true });
    await controller.confirmDialog();

    expect(port.saveNow).toHaveBeenCalledTimes(1);
    expect(controller.snapshot.globalError).toBe(
      'Some journeys could not be read. Retry journeys.',
    );
  });

  test('keeps a slot read retry through a successful export', async () => {
    const port = savePort(async (slotId) => {
      if (slotId === 'slot-1') throw new Error('read failed');
      return slotId === 'slot-2' ? ready() : { kind: 'empty' };
    });
    const controller = new TitleController(port);
    await controller.start();

    await controller.exportSlot('slot-2');

    expect(controller.snapshot.download).toMatchObject({ contents: '{}' });
    expect(controller.snapshot.globalError).toBe(
      'Some journeys could not be read. Retry journeys.',
    );
  });

  test('does not replace a slot read retry with transient command feedback', async () => {
    const controller = new TitleController(
      savePort(async (slotId) => {
        if (slotId === 'slot-1') throw new Error('read failed');
        return slotId === 'slot-2' ? ready(validSave('hidden-route')) : { kind: 'empty' };
      }),
    );
    await controller.start();

    await expect(controller.issue({ type: 'load-slot', slotId: 'slot-2' })).resolves.toBe(
      'refused',
    );
    expect(controller.snapshot.globalError).toBe(
      'Some journeys could not be read. Retry journeys.',
    );
    expect(controller.snapshot.transientError).toBe(
      'Journey 2 points to an area unavailable in this build.',
    );
  });

  test('clears a slot read retry only after a successful refresh settles', async () => {
    const retryReads = [
      deferred<SaveReadResult>(),
      deferred<SaveReadResult>(),
      deferred<SaveReadResult>(),
    ];
    let retryIndex = 0;
    let retrying = false;
    const port = savePort(async (slotId) => {
      if (!retrying) {
        if (slotId === 'slot-1') throw new Error('read failed');
        return { kind: 'empty' };
      }
      return retryReads[retryIndex++]!.promise;
    });
    const controller = new TitleController(port);
    await controller.start();

    retrying = true;
    const refresh = controller.refresh();
    expect(controller.snapshot).toMatchObject({ titleReady: false });
    expect(controller.snapshot.globalError).toBe(
      'Some journeys could not be read. Retry journeys.',
    );

    retryReads.forEach((read) => read.resolve({ kind: 'empty' }));
    await expect(refresh).resolves.toBe(true);
    expect(controller.snapshot.globalError).toBeNull();
  });

  test('refuses settings while slots load and later persists to the resolved selected save', async () => {
    const reads = [
      deferred<SaveReadResult>(),
      deferred<SaveReadResult>(),
      deferred<SaveReadResult>(),
    ];
    let readIndex = 0;
    const port = savePort(() => reads[readIndex++]!.promise);
    const controller = new TitleController(port);
    const starting = controller.start();

    await expect(controller.issue({ type: 'open-settings' })).resolves.toBe('refused');
    expect(controller.snapshot.dialog).toBeNull();

    reads[0]!.resolve(ready());
    reads[1]!.resolve({ kind: 'empty' });
    reads[2]!.resolve({ kind: 'empty' });
    await starting;
    await expect(controller.issue({ type: 'open-settings' })).resolves.toBe('handled');
    expect(controller.snapshot.dialog).toMatchObject({ kind: 'settings', slotId: 'slot-1' });

    controller.updateSettings({ ...DEFAULT_SAVE_SETTINGS, reducedMotion: true });
    await controller.confirmDialog();
    expect(port.saveNow).toHaveBeenCalledWith(
      'slot-1',
      expect.objectContaining({
        settings: expect.objectContaining({ reducedMotion: true }),
      }),
    );
  });

  test('refuses to load an unknown area with readable state', async () => {
    const transitions: unknown[] = [];
    const controller = new TitleController(
      savePort(async () => ready(validSave('hidden-route'))),
      {
        onTransition: (payload) => transitions.push(payload),
      },
    );
    await controller.start();
    const result = await controller.issue({ type: 'load-slot', slotId: 'slot-1' });
    expect(result).toBe('refused');
    expect(controller.snapshot.transientError).toBe(
      'Journey 1 points to an area unavailable in this build.',
    );
    expect(controller.snapshot.globalError).toBeNull();
    expect(transitions).toEqual([]);
  });

  test('locks repeated delete confirmation and refreshes slots after success', async () => {
    const pendingDelete = deferred<void>();
    const port = savePort(async () => ready());
    port.delete = vi.fn(() => pendingDelete.promise);
    const controller = new TitleController(port);
    await controller.start();
    await controller.issue({ type: 'delete-slot', slotId: 'slot-1' });
    const first = controller.confirmDialog();
    const second = controller.confirmDialog();
    expect(port.delete).toHaveBeenCalledTimes(1);
    pendingDelete.resolve();
    await Promise.all([first, second]);
    expect(port.read).toHaveBeenCalledTimes(6);
  });

  test('keeps delete locked through post-delete reads so stale settings cannot resurrect the save', async () => {
    const postDeleteReads = [
      deferred<SaveReadResult>(),
      deferred<SaveReadResult>(),
      deferred<SaveReadResult>(),
    ];
    let reads = 0;
    const port = savePort(async () => {
      const index = reads;
      reads += 1;
      return index < 3 ? ready() : postDeleteReads[index - 3]!.promise;
    });
    const controller = new TitleController(port);
    await controller.start();
    await controller.issue({ type: 'delete-slot', slotId: 'slot-1' });
    const deleting = controller.confirmDialog();
    await settleAsync();

    expect(port.read).toHaveBeenCalledTimes(6);
    expect(controller.snapshot.submitting).toBe(true);
    await expect(controller.issue({ type: 'open-settings' })).resolves.toBe('refused');
    expect(port.saveNow).not.toHaveBeenCalled();

    postDeleteReads[0]!.resolve({ kind: 'empty' });
    postDeleteReads[1]!.resolve(ready());
    postDeleteReads[2]!.resolve(ready());
    await deleting;
    expect(controller.snapshot.submitting).toBe(false);
    expect(controller.snapshot.slots[0]).toMatchObject({ kind: 'empty' });
  });

  test('cancels an unconfirmed import preview when its dialog closes', async () => {
    const candidateId = Object.freeze({});
    const port = savePort(async () => ({ kind: 'empty' }));
    port.import = vi.fn(async () => importPreview(candidateId));
    const controller = new TitleController(port);
    await controller.start();
    await controller.previewImport('slot-1', '{}');
    controller.closeDialog();
    expect(port.cancelImport).toHaveBeenCalledWith(candidateId);
  });

  test('carries empty-slot settings into a new-game transition without writing a save', async () => {
    const transitions: unknown[] = [];
    const port = savePort(async () => ({ kind: 'empty' }));
    const controller = new TitleController(port, {
      onTransition: (payload) => transitions.push(payload),
    });
    await controller.start();
    await controller.issue({ type: 'open-settings' });
    controller.updateSettings({ ...DEFAULT_SAVE_SETTINGS, reducedMotion: true, textScale: 1.25 });
    await controller.confirmDialog();
    await controller.issue({ type: 'new-game', slotId: 'slot-1' });
    await controller.confirmDialog();
    expect(port.saveNow).not.toHaveBeenCalled();
    expect(transitions).toEqual([
      {
        mode: 'new',
        slotId: 'slot-1',
        settings: { ...DEFAULT_SAVE_SETTINGS, reducedMotion: true, textScale: 1.25 },
      },
    ]);
  });

  test('does not refresh or publish state when delete resolves after stop', async () => {
    const deletion = deferred<void>();
    const onState = vi.fn();
    const port = savePort(async () => ready());
    port.delete = vi.fn(() => deletion.promise);
    const controller = new TitleController(port, { onState });
    await controller.start();
    await controller.issue({ type: 'delete-slot', slotId: 'slot-1' });
    const operation = controller.confirmDialog();
    const publishedBeforeStop = onState.mock.calls.length;
    controller.stop();
    deletion.resolve();
    await operation;

    expect(port.read).toHaveBeenCalledTimes(3);
    expect(onState).toHaveBeenCalledTimes(publishedBeforeStop);
  });

  test('does not refresh or publish state when import confirmation resolves after stop', async () => {
    const candidateId = Object.freeze({});
    const confirmation = deferred<void>();
    const onState = vi.fn();
    const port = savePort(async () => ({ kind: 'empty' }));
    port.import = vi.fn(async () => importPreview(candidateId));
    port.confirmImport = vi.fn(() => confirmation.promise);
    const controller = new TitleController(port, { onState });
    await controller.start();
    await controller.previewImport('slot-1', '{}');
    const operation = controller.confirmDialog();
    const publishedBeforeStop = onState.mock.calls.length;
    controller.stop();
    confirmation.resolve();
    await operation;

    expect(port.read).toHaveBeenCalledTimes(3);
    expect(onState).toHaveBeenCalledTimes(publishedBeforeStop);
  });

  test('does not update cached settings or publish state when saveNow resolves after stop', async () => {
    const saving = deferred<void>();
    const onState = vi.fn();
    const port = savePort(async () => ready());
    port.saveNow = vi.fn(() => saving.promise);
    const controller = new TitleController(port, { onState });
    await controller.start();
    await controller.issue({ type: 'open-settings' });
    controller.updateSettings({ ...DEFAULT_SAVE_SETTINGS, reducedMotion: true });
    const operation = controller.confirmDialog();
    const publishedBeforeStop = onState.mock.calls.length;
    controller.stop();
    saving.resolve();
    await operation;

    expect(port.read).toHaveBeenCalledTimes(3);
    expect(onState).toHaveBeenCalledTimes(publishedBeforeStop);
  });

  test('does not create a download or publish state when export resolves after stop', async () => {
    const exporting = deferred<string>();
    const onState = vi.fn();
    const port = savePort(async () => ready());
    port.export = vi.fn(() => exporting.promise);
    const controller = new TitleController(port, { onState });
    await controller.start();
    controller.openManage('slot-1');
    const operation = controller.exportSlot('slot-1');
    const publishedBeforeStop = onState.mock.calls.length;
    controller.stop();
    exporting.resolve('{}');
    await operation;

    expect(controller.snapshot.download).toBeNull();
    expect(onState).toHaveBeenCalledTimes(publishedBeforeStop);
  });

  test('keeps operation failures visible inside the active modal', async () => {
    const port = savePort(async () => ready());
    port.delete = vi.fn(async () => {
      throw new Error('disk failed');
    });
    const controller = new TitleController(port);
    await controller.start();
    await controller.issue({ type: 'delete-slot', slotId: 'slot-1' });
    await controller.confirmDialog();

    expect(controller.snapshot.dialog).toMatchObject({ kind: 'delete' });
    expect(controller.snapshot.dialogError).toBe(
      'That save operation did not finish. Your existing journey is unchanged.',
    );
    expect(controller.snapshot.globalError).toBeNull();
    expect(controller.snapshot.submitting).toBe(false);
  });
});

describe('title command exhaustiveness', () => {
  test.each<[TitleCommand, string | null]>([
    [{ type: 'new-game', slotId: 'slot-1' }, 'slot-1'],
    [{ type: 'load-slot', slotId: 'slot-2' }, 'slot-2'],
    [{ type: 'delete-slot', slotId: 'slot-3' }, 'slot-3'],
    [{ type: 'open-settings' }, null],
    [{ type: 'open-credits' }, null],
  ])('maps every public command to its optional slot', (command, expected) => {
    expect(commandSlotId(command)).toBe(expected);
  });
});
