import { describe, expect, test, vi } from 'vitest';

import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { DEFAULT_SAVE_SETTINGS } from '../../src/game/saves/SaveSchema';
import type { SaveReadResult } from '../../src/game/saves/SaveRepository';
import { AreaLoader } from '../../src/game/world/AreaLoader';
import { WorldSceneCoordinator } from '../../src/game/world/WorldSceneCoordinator';
import type { WorldScenePublicationPort } from '../../src/game/world/WorldSceneCoordinator';
import { WorldStart } from '../../src/game/world/WorldStart';
import type { WorldStartSavePort } from '../../src/game/world/WorldStart';

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

async function settleAsync(): Promise<void> {
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
}

function publicationPort(): WorldScenePublicationPort {
  return {
    areaLoaded: vi.fn(),
    worldSnapshot: vi.fn(),
    failed: vi.fn(),
  };
}

describe('WorldSceneCoordinator', () => {
  test('publishes the exact area event and world snapshot only after new-save fulfillment', async () => {
    const saving = deferred<void>();
    const savePort: WorldStartSavePort = {
      read: vi.fn(async (): Promise<SaveReadResult> => ({ kind: 'empty' })),
      saveNow: vi.fn(() => saving.promise),
      hasDirtySave: vi.fn(() => false),
    };
    const publications = publicationPort();
    const coordinator = new WorldSceneCoordinator(
      new WorldStart(savePort, new AreaLoader(CONTENT_REGISTRY), CONTENT_REGISTRY, () => 1),
      publications,
    );
    const entering = coordinator.begin({
      mode: 'new',
      slotId: 'slot-1',
      settings: DEFAULT_SAVE_SETTINGS,
    });
    await settleAsync();

    expect(savePort.saveNow).toHaveBeenCalledTimes(1);
    expect(publications.areaLoaded).not.toHaveBeenCalled();
    expect(publications.worldSnapshot).not.toHaveBeenCalled();

    saving.resolve();
    await entering;
    const expected = {
      slotId: 'slot-1',
      mode: 'new',
      areaId: 'wren-rest',
      roomId: 'wren-rest-square',
      checkpointId: 'village-well',
      position: { x: 256, y: 608 },
    };
    expect(publications.areaLoaded).toHaveBeenCalledOnce();
    expect(publications.areaLoaded).toHaveBeenCalledWith(expected);
    expect(publications.worldSnapshot).toHaveBeenCalledOnce();
    expect(publications.worldSnapshot).toHaveBeenCalledWith(expected);
    expect(publications.failed).not.toHaveBeenCalled();
  });

  test('publishes nothing when scene shutdown stops a deferred start', async () => {
    const reading = deferred<SaveReadResult>();
    const savePort: WorldStartSavePort = {
      read: vi.fn(() => reading.promise),
      saveNow: vi.fn(async () => undefined),
      hasDirtySave: vi.fn(() => false),
    };
    const publications = publicationPort();
    const coordinator = new WorldSceneCoordinator(
      new WorldStart(savePort, new AreaLoader(CONTENT_REGISTRY), CONTENT_REGISTRY, () => 1),
      publications,
    );
    const entering = coordinator.begin({
      mode: 'new',
      slotId: 'slot-1',
      settings: DEFAULT_SAVE_SETTINGS,
    });
    coordinator.stop();
    reading.resolve({ kind: 'empty' });
    await entering;

    expect(savePort.saveNow).not.toHaveBeenCalled();
    expect(publications.areaLoaded).not.toHaveBeenCalled();
    expect(publications.worldSnapshot).not.toHaveBeenCalled();
    expect(publications.failed).not.toHaveBeenCalled();
  });

  test('does not update the world bridge when an area-loaded listener shuts the scene down', async () => {
    const savePort: WorldStartSavePort = {
      read: vi.fn(async (): Promise<SaveReadResult> => ({ kind: 'empty' })),
      saveNow: vi.fn(async () => undefined),
      hasDirtySave: vi.fn(() => false),
    };
    const worldSnapshot = vi.fn();
    const publications: WorldScenePublicationPort = {
      areaLoaded: vi.fn(() => coordinator.stop()),
      worldSnapshot,
      failed: vi.fn(),
    };
    const coordinator = new WorldSceneCoordinator(
      new WorldStart(savePort, new AreaLoader(CONTENT_REGISTRY), CONTENT_REGISTRY, () => 1),
      publications,
    );

    await coordinator.begin({
      mode: 'new',
      slotId: 'slot-1',
      settings: DEFAULT_SAVE_SETTINGS,
    });

    expect(publications.areaLoaded).toHaveBeenCalledOnce();
    expect(worldSnapshot).not.toHaveBeenCalled();
  });
});
