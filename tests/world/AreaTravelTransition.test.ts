import { describe, expect, test, vi } from 'vitest';

import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { createNewSave, DEFAULT_SAVE_SETTINGS } from '../../src/game/saves/SaveSchema';
import { AreaTravelTransition } from '../../src/game/world/AreaTravelTransition';

function payload() {
  const { newGame } = CONTENT_REGISTRY;
  const save = createNewSave({
    nowEpochMs: 100,
    location: {
      regionId: newGame.initialRegionId,
      areaId: newGame.initialAreaId,
      checkpointId: newGame.initialCheckpointId,
      safePosition: { x: 256, y: 608 },
    },
    baseStats: newGame.baseStats,
    initialQuests: newGame.initialQuests,
    startingAbilities: newGame.startingAbilities,
  });
  return {
    slotId: 'slot-1' as const,
    settings: DEFAULT_SAVE_SETTINGS,
    save,
    sourceLabel: "Wren's Rest",
    targetLabel: 'Brackenreach',
    revision: 3,
  };
}

describe('AreaTravelTransition', () => {
  test('queues and flushes the exact candidate before loading the destination', async () => {
    const order: string[] = [];
    const travel = new AreaTravelTransition(
      {
        queueAutosave: (slotId, save) =>
          order.push(`queue:${slotId}:${save.metadata.snapshotAtEpochMs}`),
        flush: async (slotId) => {
          order.push(`flush:${slotId}`);
        },
      },
      (entry) => order.push(`load:${entry.mode}:${entry.slotId}`),
    );

    await travel.start(payload());

    expect(order).toEqual(['queue:slot-1:100', 'flush:slot-1', 'load:load:slot-1']);
    expect(travel.snapshot).toMatchObject({ status: 'complete', revision: 3 });
  });

  test('keeps a retryable card on failure and invalidates stale completion after disposal', async () => {
    const reload = vi.fn();
    let finish!: () => void;
    let attempts = 0;
    const travel = new AreaTravelTransition(
      {
        queueAutosave: () => undefined,
        flush: () => {
          attempts += 1;
          if (attempts === 1) return Promise.reject(new Error('offline'));
          return new Promise<void>((resolve) => (finish = resolve));
        },
      },
      reload,
    );

    await travel.start(payload());
    expect(travel.snapshot).toMatchObject({ status: 'failed', retryable: true });
    const retry = travel.retry();
    travel.dispose();
    finish();
    await retry;
    expect(reload).not.toHaveBeenCalled();
  });
});
