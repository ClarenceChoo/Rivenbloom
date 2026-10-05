import { describe, expect, it, vi } from 'vitest';

import { questFlagId, questId, questStageId, stableId } from '../../src/game/core/StableId';
import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import type { BossDefeatedEvent } from '../../src/game/entities/bosses/BossEvents';
import { createNewSave } from '../../src/game/saves/SaveSchema';
import type { SaveSlotId, SaveV1 } from '../../src/game/saves/SaveSchema';
import { BossEncounterCoordinator } from '../../src/game/world/BossEncounterCoordinator';
import { RuntimeSaveCoordinator } from '../../src/game/world/RuntimeSaveCoordinator';
import type { WorldCombatJournalEvent } from '../../src/game/world/WorldCombatRuntime';

function saveAtCantor(): SaveV1 {
  const { newGame } = CONTENT_REGISTRY;
  const created = createNewSave({
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
    ...created,
    location: {
      regionId: stableId<'region'>('brackenreach'),
      areaId: stableId<'area'>('hollow-choir'),
      checkpointId: stableId<'checkpoint'>('choir-threshold-lantern'),
      safePosition: { x: 256, y: 900 },
    },
    quests: {
      stages: created.quests.stages.map((entry) =>
        entry.questId === 'the-silent-bloom'
          ? { questId: questId('the-silent-bloom'), stageId: questStageId('silence-the-cantor') }
          : entry,
      ),
      flags: [
        'briar-core-claimed',
        'listening-arch-traced',
        'root-memory-delivered',
        'rootglass-reliquary-entered',
        'silent-bloom-accepted',
        'surveyor-edge-reforged',
      ].map(questFlagId),
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function command(
  sequence: number,
  value: Extract<WorldCombatJournalEvent, { kind: 'boss-command' }>['command'],
): Extract<WorldCombatJournalEvent, { kind: 'boss-command' }> {
  return {
    kind: 'boss-command',
    sequence,
    stepIndex: sequence,
    occurredAtMs: sequence * 17,
    command: value,
  };
}

describe('BossEncounterCoordinator', () => {
  it('waits for both durable acknowledgement and defeat settling before ordered release events', async () => {
    const saving = deferred<void>();
    const immediateWrites: SaveV1[] = [];
    const saves = new RuntimeSaveCoordinator('slot-1', saveAtCantor(), {
      queueAutosave: vi.fn(),
      saveNow: async (_slotId: SaveSlotId, save: SaveV1) => {
        immediateWrites.push(save);
        await saving.promise;
      },
    });
    const emitted: Array<{ name: string; event: unknown }> = [];
    const confirmDefeatSaved = vi.fn(() => true);
    const coordinator = new BossEncounterCoordinator({
      saves,
      confirmDefeatSaved,
      updateSave: vi.fn(),
      publishProgressionEvents: vi.fn(),
      emit: (name, event) => emitted.push({ name, event }),
      reportSaveFailure: vi.fn(),
      isCurrentGeneration: () => true,
    });

    coordinator.observe(
      command(1, { kind: 'request-defeat-save', token: 7 }),
      { currentHealth: 23, currentMana: 11 },
      { snapshotAtEpochMs: 300, playTimeMs: 2_750 },
    );
    coordinator.observe(
      command(2, { kind: 'arena-lock', locked: false }),
      { currentHealth: 23, currentMana: 11 },
      { snapshotAtEpochMs: 300, playTimeMs: 2_750 },
    );
    expect(immediateWrites).toHaveLength(1);
    expect(emitted).toHaveLength(0);

    saving.resolve();
    await coordinator.whenIdle();
    expect(confirmDefeatSaved).toHaveBeenCalledWith(7, 300);
    expect(emitted.map(({ name }) => name)).toEqual(['boss-defeated', 'boss-health']);
    expect((emitted[0]!.event as BossDefeatedEvent).savedAtEpochMs).toBe(300);
  });

  it('holds a successful write until later settling and retries a failure without rebuilding', async () => {
    const writes: SaveV1[] = [];
    let fail = true;
    const saves = new RuntimeSaveCoordinator('slot-2', saveAtCantor(), {
      queueAutosave: vi.fn(),
      saveNow: async (_slotId, save) => {
        writes.push(save);
        if (fail) throw new Error('offline');
      },
    });
    const emitted: string[] = [];
    const reportSaveFailure = vi.fn();
    const coordinator = new BossEncounterCoordinator({
      saves,
      confirmDefeatSaved: vi.fn(() => true),
      updateSave: vi.fn(),
      publishProgressionEvents: vi.fn(),
      emit: (name) => emitted.push(name),
      reportSaveFailure,
      isCurrentGeneration: () => true,
    });

    coordinator.observe(
      command(1, { kind: 'request-defeat-save', token: 4 }),
      { currentHealth: 50, currentMana: 17 },
      { snapshotAtEpochMs: 310, playTimeMs: 2_800 },
    );
    await coordinator.whenIdle();
    expect(reportSaveFailure).toHaveBeenCalledTimes(1);
    expect(emitted).toEqual([]);

    fail = false;
    await coordinator.retry();
    expect(writes).toHaveLength(2);
    expect(writes[1]).toBe(writes[0]);
    expect(emitted).toEqual([]);

    coordinator.observe(
      command(2, { kind: 'arena-lock', locked: false }),
      { currentHealth: 50, currentMana: 17 },
      { snapshotAtEpochMs: 310, playTimeMs: 2_800 },
    );
    expect(emitted).toEqual(['boss-defeated', 'boss-health']);
  });

  it('allows the write to finish after shutdown without publishing stale scene events', async () => {
    const saving = deferred<void>();
    let current = true;
    const saves = new RuntimeSaveCoordinator('slot-3', saveAtCantor(), {
      queueAutosave: vi.fn(),
      saveNow: async () => saving.promise,
    });
    const emit = vi.fn();
    const confirmDefeatSaved = vi.fn();
    const coordinator = new BossEncounterCoordinator({
      saves,
      confirmDefeatSaved,
      updateSave: vi.fn(),
      publishProgressionEvents: vi.fn(),
      emit,
      reportSaveFailure: vi.fn(),
      isCurrentGeneration: () => current,
    });
    coordinator.observe(
      command(1, { kind: 'request-defeat-save', token: 9 }),
      { currentHealth: 40, currentMana: 10 },
      { snapshotAtEpochMs: 320, playTimeMs: 2_900 },
    );
    current = false;
    saving.resolve();
    await coordinator.whenIdle();
    expect(saves.snapshot.worldProgress.defeatedBosses).toContain('pallid-cantor');
    expect(confirmDefeatSaved).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });
});
