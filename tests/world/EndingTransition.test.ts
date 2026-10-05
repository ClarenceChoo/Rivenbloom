import { describe, expect, test } from 'vitest';

import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { createNewSave, DEFAULT_SAVE_SETTINGS } from '../../src/game/saves/SaveSchema';
import { EndingTransition } from '../../src/game/world/EndingTransition';

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
  return { slotId: 'slot-1' as const, settings: DEFAULT_SAVE_SETTINGS, save };
}

describe('EndingTransition', () => {
  test('confirms the exact final save before publishing completion', async () => {
    const order: string[] = [];
    const ending = new EndingTransition(
      {
        queueAutosave: (slotId, save) =>
          order.push(`queue:${slotId}:${save.metadata.snapshotAtEpochMs}`),
        flush: async (slotId) => {
          order.push(`flush:${slotId}`);
        },
      },
      ({ status }) => order.push(`state:${status}`),
    );

    await ending.start(payload());

    expect(order).toEqual(['state:flushing', 'queue:slot-1:100', 'flush:slot-1', 'state:complete']);
    expect(ending.snapshot).toEqual({ status: 'complete', retryable: false });
  });

  test('retains a failed ending for one exact retry and ignores stale completion after disposal', async () => {
    let finish!: () => void;
    let attempts = 0;
    const ending = new EndingTransition({
      queueAutosave: () => undefined,
      flush: () => {
        attempts += 1;
        if (attempts === 1) return Promise.reject(new Error('offline'));
        return new Promise<void>((resolve) => (finish = resolve));
      },
    });

    await ending.start(payload());
    expect(ending.snapshot).toEqual({ status: 'failed', retryable: true });
    const retry = ending.retry();
    ending.dispose();
    finish();
    await retry;
    expect(ending.snapshot).toEqual({ status: 'flushing', retryable: false });
  });
});
