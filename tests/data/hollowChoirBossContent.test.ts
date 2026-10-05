import { describe, expect, it } from 'vitest';

import { stableId } from '../../src/game/core/StableId';
import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { PALLID_CANTOR_ENCOUNTER } from '../../src/game/data/bosses/pallidCantor';
import { createNewSave } from '../../src/game/saves/SaveSchema';
import { AreaLoader } from '../../src/game/world/AreaLoader';
import { WorldRoomRuntime } from '../../src/game/world/WorldRoomRuntime';

describe('Hollow Choir boss authoring', () => {
  it('pins the canonical arena, spawn, threshold, lenses, and gates', () => {
    const area = CONTENT_REGISTRY.areas.find(({ areaId }) => areaId === 'hollow-choir')!;
    expect(area.rooms).toEqual([
      expect.objectContaining({
        roomId: 'hollow-choir-arena',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      }),
    ]);
    expect(area.surfaces).toContainEqual(
      expect.objectContaining({ bounds: { x: 0, y: 900, width: 1920, height: 180 } }),
    );
    expect(area.actorSpawns).toContainEqual({
      spawnId: 'pallid-cantor-at-hollow-choir',
      actorId: 'pallid-cantor',
      roomId: 'hollow-choir-arena',
      position: { x: 960, y: 900 },
      facing: 'left',
      encounterId: 'hollow-choir-cantor',
    });
    expect(area.triggers).toContainEqual(
      expect.objectContaining({
        triggerId: 'hollow-choir-cantor-threshold',
        bounds: { x: 192, y: 720, width: 160, height: 180 },
        activation: 'enter',
        action: { kind: 'start-boss', bossId: 'pallid-cantor' },
      }),
    );
    expect(area.mechanisms.filter(({ kind }) => kind === 'boss-lens')).toEqual([
      expect.objectContaining({
        mechanismId: 'hollow-choir-west-lens',
        bounds: { x: 280, y: 740, width: 160, height: 160 },
      }),
      expect.objectContaining({
        mechanismId: 'hollow-choir-east-lens',
        bounds: { x: 1480, y: 740, width: 160, height: 160 },
      }),
    ]);
    expect(area.bossGates).toEqual([
      expect.objectContaining({
        gateId: 'hollow-choir-entry-gate',
        bounds: { x: 160, y: 360, width: 32, height: 540 },
        side: 'entry',
      }),
      expect.objectContaining({
        gateId: 'hollow-choir-exit-gate',
        bounds: { x: 1728, y: 360, width: 32, height: 540 },
        side: 'exit',
      }),
    ]);
    expect(PALLID_CANTOR_ENCOUNTER.combatBounds).toEqual({
      x: 192,
      y: 300,
      width: 1536,
      height: 600,
    });
  });

  it('does not construct the boss from a defeated save', () => {
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
    const save = {
      ...created,
      worldProgress: {
        ...created.worldProgress,
        defeatedBosses: [stableId<'boss'>('pallid-cantor')],
      },
    };
    const loader = new AreaLoader(CONTENT_REGISTRY);
    const definition = CONTENT_REGISTRY.areas.find(({ areaId }) => areaId === 'hollow-choir')!;
    const loaded = loader.load(definition);
    const runtime = new WorldRoomRuntime({
      registry: CONTENT_REGISTRY,
      loader,
      area: loaded,
      roomId: stableId<'room'>('hollow-choir-arena'),
      save,
      baseline: { lastStepIndex: 0, simulationTimeMs: 0 },
      readCameraBounds: () => ({ x: 0, y: 0, width: 1280, height: 720 }),
    });
    expect(runtime.snapshot().combat.boss).toBeNull();
    runtime.dispose();
  });
});
