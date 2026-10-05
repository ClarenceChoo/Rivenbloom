import { describe, expect, it } from 'vitest';

import { CONTENT_REGISTRY, WRENS_REST_AREA } from '../../src/game/data/areas';
import { createNewSave } from '../../src/game/saves/SaveSchema';
import { CheckpointSystem } from '../../src/game/world/CheckpointSystem';
import { RuntimeSaveCoordinator } from '../../src/game/world/RuntimeSaveCoordinator';

function save() {
  const { newGame } = CONTENT_REGISTRY;
  const created = createNewSave({
    nowEpochMs: 5,
    location: {
      regionId: newGame.initialRegionId,
      areaId: newGame.initialAreaId,
      checkpointId: newGame.initialCheckpointId,
      safePosition: { x: 0, y: 0 },
    },
    baseStats: newGame.baseStats,
    initialQuests: newGame.initialQuests,
    startingAbilities: newGame.startingAbilities,
  });
  return { ...created, player: { ...created.player, currentHealth: 2, currentMana: 3 } };
}

describe('CheckpointSystem', () => {
  it('activates a canonical safe spawn, rests, and requests autosave once while held', () => {
    const system = new CheckpointSystem([WRENS_REST_AREA]);
    const first = system.activate(save(), { areaId: 'wren-rest', checkpointId: 'village-well' });
    expect(first).toMatchObject({
      kind: 'activated',
      position: { x: 256, y: 608 },
      facing: 'right',
      events: [{ kind: 'autosave-requested' }],
    });
    if (first.kind !== 'activated') return;
    expect(first.save.player.currentHealth).toBe(100);
    expect(first.save.player.currentMana).toBe(40);
    expect(first.save.location.safePosition).toEqual({ x: 256, y: 608 });
    expect(
      system.activate(first.save, { areaId: 'wren-rest', checkpointId: 'village-well' }).kind,
    ).toBe('unchanged');
  });

  it('restores death to canonical checkpoint and rejects invalid destinations without a patch', () => {
    const system = new CheckpointSystem([WRENS_REST_AREA]);
    const before = save();
    const restored = system.restore(before);
    expect(restored).toMatchObject({
      kind: 'restored',
      position: { x: 256, y: 608 },
      facing: 'right',
    });
    if (restored.kind !== 'restored') return;
    expect(restored.save.metadata).toEqual(before.metadata);

    const invalid = system.activate(before, { areaId: 'wren-rest', checkpointId: 'missing-well' });
    expect(invalid).toMatchObject({ kind: 'rejected', save: before });
  });

  it('validates the original save before held activation or canonical restoration can repair it', () => {
    const system = new CheckpointSystem([WRENS_REST_AREA]);
    const valid = save();
    expect(system.activate(valid, { areaId: 'wren-rest', checkpointId: 'village-well' }).kind).toBe(
      'activated',
    );
    const invalidVitals = {
      ...valid,
      player: { ...valid.player, currentHealth: valid.player.baseStats.maxHealth + 1 },
    };
    expect(
      system.activate(invalidVitals, {
        areaId: 'wren-rest',
        checkpointId: 'village-well',
      }),
    ).toMatchObject({ kind: 'rejected', reason: 'invalid-save' });
    expect(
      system.activate(valid, {
        areaId: 'missing-area',
        checkpointId: 'village-well',
      }),
    ).toMatchObject({ kind: 'rejected', reason: 'unknown-area' });
    const unknownSavedArea = {
      ...valid,
      location: { ...valid.location, areaId: 'missing-area' as typeof valid.location.areaId },
    };
    expect(
      system.activate(unknownSavedArea, {
        areaId: 'wren-rest',
        checkpointId: 'village-well',
      }),
    ).toMatchObject({ kind: 'rejected', reason: 'invalid-save' });

    system.releaseInteraction();
    expect(
      system.activate(invalidVitals, {
        areaId: 'wren-rest',
        checkpointId: 'village-well',
      }),
    ).toMatchObject({ kind: 'rejected', reason: 'invalid-save' });
    expect(
      system.activate(unknownSavedArea, {
        areaId: 'wren-rest',
        checkpointId: 'village-well',
      }),
    ).toMatchObject({ kind: 'rejected', reason: 'invalid-save' });
    expect(system.restore(invalidVitals)).toMatchObject({
      kind: 'rejected',
      reason: 'invalid-save',
    });
    expect(
      system.restore({
        ...valid,
        location: { ...valid.location, areaId: 'Bad Area' as typeof valid.location.areaId },
      }),
    ).toMatchObject({ kind: 'rejected', reason: 'invalid-save' });
    expect(system.restore(unknownSavedArea)).toMatchObject({
      kind: 'rejected',
      reason: 'invalid-save',
    });
  });

  it('releases a prepared activation after queue failure so a later press can retry', () => {
    const system = new CheckpointSystem([WRENS_REST_AREA]);
    const first = system.activate(save(), {
      areaId: 'wren-rest',
      checkpointId: 'village-well',
    });
    expect(first.kind).toBe('activated');
    if (first.kind !== 'activated') return;
    const runtime = new RuntimeSaveCoordinator('slot-1', save(), {
      queueAutosave: () => {
        throw new Error('storage unavailable');
      },
    });
    expect(runtime.install(first.save, { snapshotAtEpochMs: 6, playTimeMs: 1 }).kind).toBe(
      'failed',
    );

    expect(system.cancelActivation('village-well')).toBe(true);
    expect(
      system.activate(save(), { areaId: 'wren-rest', checkpointId: 'village-well' }).kind,
    ).toBe('activated');
  });
});
