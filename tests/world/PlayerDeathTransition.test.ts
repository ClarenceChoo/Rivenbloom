import { describe, expect, it, vi } from 'vitest';

import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { createNewSave, DEFAULT_SAVE_SETTINGS } from '../../src/game/saves/SaveSchema';
import { PlayerDeathTransition } from '../../src/game/world/PlayerDeathTransition';

function restoredSave() {
  const { newGame } = CONTENT_REGISTRY;
  return createNewSave({
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
}

describe('PlayerDeathTransition', () => {
  it('flushes the slot before reloading the world in load mode', async () => {
    const order: string[] = [];
    const transition = new PlayerDeathTransition(
      {
        queueAutosave: (slotId, save) => {
          order.push(`queue:${slotId}:${save.player.currentHealth}`);
        },
        flush: async (slotId) => {
          order.push(`flush:${slotId}`);
        },
      },
      (payload) => order.push(`reload:${payload.mode}:${payload.slotId}`),
    );

    await transition.start({
      slotId: 'slot-1',
      settings: DEFAULT_SAVE_SETTINGS,
      checkpointLabel: 'Village Seed-Lantern',
      save: restoredSave(),
    });

    expect(order).toEqual(['queue:slot-1:100', 'flush:slot-1', 'reload:load:slot-1']);
    expect(transition.snapshot.status).toBe('complete');
  });

  it('keeps a retryable failure card and only reloads after a successful retry', async () => {
    const reload = vi.fn();
    let attempts = 0;
    const transition = new PlayerDeathTransition(
      {
        queueAutosave: () => undefined,
        flush: async () => {
          attempts += 1;
          if (attempts === 1) throw new Error('disk unavailable');
        },
      },
      reload,
    );
    const payload = {
      slotId: 'slot-2' as const,
      settings: DEFAULT_SAVE_SETTINGS,
      checkpointLabel: 'Village Seed-Lantern',
      save: restoredSave(),
    };

    await transition.start(payload);
    expect(transition.snapshot).toMatchObject({ status: 'failed', retryable: true });
    expect(reload).not.toHaveBeenCalled();
    await transition.retry();
    expect(transition.snapshot.status).toBe('complete');
    expect(reload).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'load', slotId: 'slot-2' }),
    );
  });

  it('shows the same retryable card when the restored candidate cannot be queued', async () => {
    const reload = vi.fn();
    const flush = vi.fn(async () => undefined);
    let queueAttempts = 0;
    const transition = new PlayerDeathTransition(
      {
        queueAutosave: () => {
          queueAttempts += 1;
          if (queueAttempts === 1) throw new Error('queue unavailable');
        },
        flush,
      },
      reload,
    );

    await transition.start({
      slotId: 'slot-3',
      settings: DEFAULT_SAVE_SETTINGS,
      checkpointLabel: 'Village Seed-Lantern',
      save: restoredSave(),
    });
    expect(transition.snapshot).toMatchObject({ status: 'failed', retryable: true });
    expect(flush).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();

    await transition.retry();
    expect(flush).toHaveBeenCalledWith('slot-3');
    expect(reload).toHaveBeenCalledWith(expect.objectContaining({ mode: 'load' }));
  });

  it('invalidates async completion after disposal', async () => {
    let finish!: () => void;
    const reload = vi.fn();
    const transition = new PlayerDeathTransition(
      {
        queueAutosave: () => undefined,
        flush: () => new Promise<void>((resolve) => (finish = resolve)),
      },
      reload,
    );
    const pending = transition.start({
      slotId: 'slot-3',
      settings: DEFAULT_SAVE_SETTINGS,
      checkpointLabel: 'Village Seed-Lantern',
      save: restoredSave(),
    });
    transition.dispose();
    finish();
    await pending;
    expect(reload).not.toHaveBeenCalled();
  });
});
