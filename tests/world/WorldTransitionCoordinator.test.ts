import { describe, expect, test } from 'vitest';

import { stableId } from '../../src/game/core/StableId';
import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { createNewSave } from '../../src/game/saves/SaveSchema';
import type { SaveV1 } from '../../src/game/saves/SaveSchema';
import { AreaLoader } from '../../src/game/world/AreaLoader';
import { WorldTransitionCoordinator } from '../../src/game/world/WorldTransitionCoordinator';

function save(): SaveV1 {
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
    player: { ...created.player, currentHealth: 37, currentMana: 11 },
  };
}

describe('WorldTransitionCoordinator', () => {
  test('labels available interact transitions without revealing locked travel', () => {
    const loader = new AreaLoader(CONTENT_REGISTRY);
    const area = loader.load(CONTENT_REGISTRY.areas.find(({ areaId }) => areaId === 'wren-rest')!);
    const coordinator = new WorldTransitionCoordinator(CONTENT_REGISTRY, loader, area);
    const current = save();
    const body = (x: number) => ({ x: x - 24, y: 512, width: 48, height: 96 });
    const roomId = stableId<'room'>('wren-rest-square');

    expect(coordinator.promptAt(roomId, body(2272), current)).toBeNull();
    expect(coordinator.promptAt(roomId, body(2080), current)).toBe('Enter passage');
    expect(
      coordinator.promptAt(roomId, body(2272), {
        ...current,
        worldProgress: {
          ...current.worldProgress,
          activatedShortcuts: [stableId<'shortcut'>('listening-arch-homeward-route')],
        },
      }),
    ).toBe('Travel to Listening Arch');
  });

  test('prepares a same-area rebind without changing checkpoint, location, or resources', () => {
    const loader = new AreaLoader(CONTENT_REGISTRY);
    const area = loader.load(CONTENT_REGISTRY.areas.find(({ areaId }) => areaId === 'wren-rest')!);
    const coordinator = new WorldTransitionCoordinator(CONTENT_REGISTRY, loader, area);
    const original = save();

    const result = coordinator.prepare(
      stableId<'transition'>('wren-square-to-herb-loft'),
      original,
      { currentHealth: 21, currentMana: 7 },
      { snapshotAtEpochMs: 120, playTimeMs: 20 },
    );

    expect(result).toMatchObject({
      kind: 'room',
      sourceRoomId: 'wren-rest-square',
      targetRoom: { roomId: 'wren-herb-loft' },
      binding: {
        roomId: 'wren-herb-loft',
        position: { x: 2624, y: 608 },
        facing: 'right',
      },
      save: {
        location: original.location,
        player: { currentHealth: 37, currentMana: 11 },
        worldProgress: { discoveredRooms: ['wren-herb-loft'] },
      },
    });
    expect(original.worldProgress.discoveredRooms).toEqual([]);
  });

  test('prepares a cross-area canonical candidate with live vitals and target discovery', () => {
    const loader = new AreaLoader(CONTENT_REGISTRY);
    const area = loader.load(CONTENT_REGISTRY.areas.find(({ areaId }) => areaId === 'wren-rest')!);
    const coordinator = new WorldTransitionCoordinator(CONTENT_REGISTRY, loader, area);

    const result = coordinator.prepare(
      stableId<'transition'>('wren-rest-to-brackenreach'),
      save(),
      { currentHealth: 21, currentMana: 7 },
      { snapshotAtEpochMs: 140, playTimeMs: 25 },
    );

    expect(result).toMatchObject({
      kind: 'area',
      sourceAreaId: 'wren-rest',
      targetArea: { definition: { areaId: 'brackenreach', regionId: 'brackenreach' } },
      targetCheckpoint: {
        checkpointId: 'brackenreach-trailhead',
        roomId: 'brackenreach-trail',
        canonicalPosition: { x: 256, y: 608 },
      },
      targetRoom: { roomId: 'brackenreach-trail' },
      save: {
        metadata: { snapshotAtEpochMs: 140, playTimeMs: 25 },
        location: {
          regionId: 'brackenreach',
          areaId: 'brackenreach',
          checkpointId: 'brackenreach-trailhead',
          safePosition: { x: 256, y: 608 },
        },
        player: { currentHealth: 21, currentMana: 7 },
        worldProgress: { discoveredRooms: ['brackenreach-trail'] },
      },
    });
  });

  test('fires enter transitions once per boundary entry and interact transitions once per buffer', () => {
    const loader = new AreaLoader(CONTENT_REGISTRY);
    const area = loader.load(CONTENT_REGISTRY.areas.find(({ areaId }) => areaId === 'wren-rest')!);
    const coordinator = new WorldTransitionCoordinator(CONTENT_REGISTRY, loader, area);
    const current = save();
    const body = (x: number) => ({ x: x - 24, y: 512, width: 48, height: 96 });

    expect(
      coordinator.select({
        roomId: stableId<'room'>('wren-rest-square'),
        playerBounds: body(2400),
        interactBufferId: null,
        save: current,
      }),
    ).toBeNull();
    expect(
      coordinator.select({
        roomId: stableId<'room'>('wren-rest-square'),
        playerBounds: body(2520),
        interactBufferId: null,
        save: current,
      })?.transitionId,
    ).toBe('wren-rest-to-brackenreach');
    expect(
      coordinator.select({
        roomId: stableId<'room'>('wren-rest-square'),
        playerBounds: body(2520),
        interactBufferId: null,
        save: current,
      }),
    ).toBeNull();
    coordinator.select({
      roomId: stableId<'room'>('wren-rest-square'),
      playerBounds: body(2400),
      interactBufferId: null,
      save: current,
    });
    expect(
      coordinator.select({
        roomId: stableId<'room'>('wren-rest-square'),
        playerBounds: body(2520),
        interactBufferId: null,
        save: current,
      })?.transitionId,
    ).toBe('wren-rest-to-brackenreach');

    const shortcutSave = {
      ...current,
      worldProgress: {
        ...current.worldProgress,
        activatedShortcuts: [stableId<'shortcut'>('listening-arch-homeward-route')],
      },
    };
    expect(
      coordinator.select({
        roomId: stableId<'room'>('wren-rest-square'),
        playerBounds: body(2260),
        interactBufferId: 4,
        save: shortcutSave,
      })?.transitionId,
    ).toBe('wren-homeward-to-listening-arch');
    expect(
      coordinator.select({
        roomId: stableId<'room'>('wren-rest-square'),
        playerBounds: body(2260),
        interactBufferId: 4,
        save: shortcutSave,
      }),
    ).toBeNull();
    expect(
      coordinator.select({
        roomId: stableId<'room'>('wren-rest-square'),
        playerBounds: body(2260),
        interactBufferId: 5,
        save: shortcutSave,
      })?.transitionId,
    ).toBe('wren-homeward-to-listening-arch');
  });

  test('accepts a deliberate interaction just beyond a narrow room doorway', () => {
    const loader = new AreaLoader(CONTENT_REGISTRY);
    const area = loader.load(CONTENT_REGISTRY.areas.find(({ areaId }) => areaId === 'wren-rest')!);
    const coordinator = new WorldTransitionCoordinator(CONTENT_REGISTRY, loader, area);
    const body = (x: number) => ({ x: x - 24, y: 512, width: 48, height: 96 });
    expect(
      coordinator.select({
        roomId: stableId<'room'>('wren-rest-square'),
        playerBounds: body(1590),
        interactBufferId: 1,
        save: save(),
      })?.transitionId,
    ).toBe('wren-square-to-forge-cellar');
    expect(
      coordinator.select({
        roomId: stableId<'room'>('wren-rest-square'),
        playerBounds: body(1650),
        interactBufferId: 2,
        save: save(),
      }),
    ).toBeNull();
  });

  test('arms an authored destination overlap until the player exits and re-enters', () => {
    const loader = new AreaLoader(CONTENT_REGISTRY);
    const area = loader.load(CONTENT_REGISTRY.areas.find(({ areaId }) => areaId === 'wren-rest')!);
    const coordinator = new WorldTransitionCoordinator(CONTENT_REGISTRY, loader, area);
    const body = (x: number) => ({ x: x - 24, y: 512, width: 48, height: 96 });
    coordinator.armEnterTransitionsAt(stableId<'room'>('wren-herb-loft'), body(2624));

    expect(
      coordinator.select({
        roomId: stableId<'room'>('wren-herb-loft'),
        playerBounds: body(2624),
        interactBufferId: null,
        save: save(),
      }),
    ).toBeNull();
    coordinator.select({
      roomId: stableId<'room'>('wren-herb-loft'),
      playerBounds: body(2700),
      interactBufferId: null,
      save: save(),
    });
    expect(
      coordinator.select({
        roomId: stableId<'room'>('wren-herb-loft'),
        playerBounds: body(2624),
        interactBufferId: null,
        save: save(),
      })?.transitionId,
    ).toBe('wren-herb-loft-to-square');
  });
});
