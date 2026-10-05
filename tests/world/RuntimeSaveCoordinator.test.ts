import { describe, expect, it } from 'vitest';

import { questFlagId } from '../../src/game/core/StableId';
import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { createNewSave } from '../../src/game/saves/SaveSchema';
import type { SaveSlotId, SaveV1 } from '../../src/game/saves/SaveSchema';
import { RuntimeSaveCoordinator } from '../../src/game/world/RuntimeSaveCoordinator';
import { applyProgressionTransaction } from '../../src/game/world/WorldProgression';

function save(): SaveV1 {
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

class QueuePort {
  public readonly writes: Readonly<{ slotId: SaveSlotId; save: SaveV1 }>[] = [];

  public queueAutosave(slotId: SaveSlotId, candidate: SaveV1): void {
    this.writes.push({ slotId, save: candidate });
  }
}

class ImmediatePort extends QueuePort {
  public readonly immediateWrites: Readonly<{ slotId: SaveSlotId; save: SaveV1 }>[] = [];
  public fail = false;

  public async saveNow(slotId: SaveSlotId, candidate: SaveV1): Promise<void> {
    this.immediateWrites.push({ slotId, save: candidate });
    if (this.fail) throw new Error('storage refused');
  }
}

describe('RuntimeSaveCoordinator', () => {
  it('composes combat vitality and same-step progression against one latest candidate', () => {
    const port = new QueuePort();
    const coordinator = new RuntimeSaveCoordinator('slot-1', save(), port);

    const vitality = coordinator.patchVitals(
      { currentHealth: 73, currentMana: 19 },
      { snapshotAtEpochMs: 120, playTimeMs: 20 },
    );
    expect(vitality.kind).toBe('installed');

    const progression = coordinator.transact(
      (latest) =>
        applyProgressionTransaction(latest, {
          commands: [{ kind: 'set-fact', factId: questFlagId('silent-bloom-accepted') }],
        }),
      { snapshotAtEpochMs: 121, playTimeMs: 21 },
      { currentHealth: 73, currentMana: 19 },
    );

    expect(progression.kind).toBe('installed');
    expect(coordinator.snapshot.player).toMatchObject({ currentHealth: 73, currentMana: 19 });
    expect(coordinator.snapshot.quests.flags).toContain('silent-bloom-accepted');
    expect(coordinator.snapshot.metadata).toMatchObject({ snapshotAtEpochMs: 121, playTimeMs: 21 });
    expect(port.writes).toHaveLength(2);
    expect(port.writes[1]!.save).toBe(coordinator.snapshot);
  });

  it('preserves an intentional permanent-resource reward over pre-reward live vitals', () => {
    const coordinator = new RuntimeSaveCoordinator('slot-1', save(), new QueuePort());

    const progression = coordinator.transact(
      (latest) =>
        applyProgressionTransaction(latest, {
          commands: [{ kind: 'increase-health', amount: 20 }],
        }),
      { snapshotAtEpochMs: 121, playTimeMs: 21 },
      { currentHealth: 100, currentMana: 40 },
    );

    expect(progression.kind).toBe('installed');
    expect(coordinator.snapshot.player).toMatchObject({
      currentHealth: 120,
      baseStats: { maxHealth: 120 },
    });
  });

  it('does not write unchanged or rejected operations and deeply freezes installed saves', () => {
    const port = new QueuePort();
    const coordinator = new RuntimeSaveCoordinator('slot-2', save(), port);

    expect(
      coordinator.transact(
        (latest) => ({ kind: 'unchanged' as const, save: latest, events: Object.freeze([]) }),
        { snapshotAtEpochMs: 100, playTimeMs: 0 },
      ).kind,
    ).toBe('unchanged');
    expect(
      coordinator.transact(
        (latest) => ({
          kind: 'rejected' as const,
          reason: 'nope',
          save: latest,
          events: Object.freeze([]),
        }),
        { snapshotAtEpochMs: 100, playTimeMs: 0 },
      ).kind,
    ).toBe('rejected');
    expect(port.writes).toHaveLength(0);

    const candidate = {
      ...save(),
      player: { ...save().player, currency: 9 },
    };
    const result = coordinator.install(candidate, {
      snapshotAtEpochMs: 130,
      playTimeMs: 30,
    });
    expect(result.kind).toBe('installed');
    expect(Object.isFrozen(coordinator.snapshot)).toBe(true);
    expect(Object.isFrozen(coordinator.snapshot.player)).toBe(true);
    expect(Object.isFrozen(coordinator.snapshot.quests.stages)).toBe(true);
  });

  it('marks a synchronous queue failure without installing the candidate', () => {
    const before = save();
    const coordinator = new RuntimeSaveCoordinator('slot-3', before, {
      queueAutosave: () => {
        throw new Error('storage refused');
      },
    });
    const initialSnapshot = coordinator.snapshot;
    const result = coordinator.patchVitals(
      { currentHealth: 90, currentMana: 40 },
      { snapshotAtEpochMs: 110, playTimeMs: 10 },
    );

    expect(result.kind).toBe('failed');
    expect(coordinator.snapshot).toBe(initialSnapshot);
    expect(coordinator.autosaveState).toBe('failed');
  });

  it('writes an immediate candidate without queuing and blocks overtaking transactions', async () => {
    const port = new ImmediatePort();
    const coordinator = new RuntimeSaveCoordinator('slot-1', save(), port);
    const candidate = { ...save(), player: { ...save().player, currency: 9 } };

    const prepared = coordinator.prepareImmediate(candidate, {
      snapshotAtEpochMs: 120,
      playTimeMs: 20,
    });
    expect(prepared.kind).toBe('prepared');
    if (prepared.kind !== 'prepared') return;
    expect(port.writes).toHaveLength(0);
    expect(
      coordinator.patchVitals(
        { currentHealth: 80, currentMana: 30 },
        { snapshotAtEpochMs: 121, playTimeMs: 21 },
      ).kind,
    ).toBe('blocked');

    const committed = await coordinator.commitImmediate(prepared.token);
    expect(committed.kind).toBe('installed');
    expect(port.writes).toHaveLength(0);
    expect(port.immediateWrites).toEqual([{ slotId: 'slot-1', save: prepared.save }]);
    expect(coordinator.snapshot).toBe(prepared.save);
    expect(coordinator.revision).toBe(1);
  });

  it('retains one immutable immediate candidate and token for an exact retry', async () => {
    const port = new ImmediatePort();
    port.fail = true;
    const coordinator = new RuntimeSaveCoordinator('slot-2', save(), port);
    const prepared = coordinator.prepareImmediate(
      { ...save(), player: { ...save().player, currency: 14 } },
      { snapshotAtEpochMs: 130, playTimeMs: 30 },
    );
    expect(prepared.kind).toBe('prepared');
    if (prepared.kind !== 'prepared') return;

    const failed = await coordinator.commitImmediate(prepared.token);
    expect(failed.kind).toBe('failed');
    expect(coordinator.snapshot.player.currency).toBe(0);
    expect(coordinator.pendingImmediate).toEqual({ token: prepared.token, save: prepared.save });

    port.fail = false;
    const installed = await coordinator.commitImmediate(prepared.token);
    expect(installed.kind).toBe('installed');
    expect(port.immediateWrites).toHaveLength(2);
    expect(port.immediateWrites[0]!.save).toBe(prepared.save);
    expect(port.immediateWrites[1]!.save).toBe(prepared.save);
    expect(coordinator.pendingImmediate).toBeNull();
  });
});
