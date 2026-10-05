import { describe, expect, test } from 'vitest';

import { BRACKENREACH_AREA, CONTENT_REGISTRY, WRENS_REST_AREA } from '../../src/game/data/areas';
import type { AreaDefinition } from '../../src/game/data/types';
import { AreaLoader, ContentLoadError } from '../../src/game/world/AreaLoader';
import type { AreaId, CheckpointId, RoomId } from '../../src/game/saves/SaveSchema';
import type { StableId } from '../../src/game/core/StableId';
import type { ContentRegistry } from '../../src/game/data/types';
import { WORLD_ALWAYS } from '../../src/game/world/WorldPredicates';

describe('AreaLoader', () => {
  test('compiles deterministic room-relative lookups in authored order', () => {
    const loaded = new AreaLoader(CONTENT_REGISTRY).load(WRENS_REST_AREA);
    const roomId = 'wren-rest-square' as RoomId;

    expect(loaded.room(roomId)?.displayName).toBe("Wren's Rest Square");
    expect(loaded.checkpoint('village-well' as CheckpointId)?.canonicalPosition).toEqual({
      x: 256,
      y: 608,
    });
    expect(loaded.surfacesFor(roomId).map(({ surfaceId }) => surfaceId)).toEqual([
      'wren-rest-ground',
    ]);
    expect(loaded.zonesFor(roomId)).toEqual([]);
    expect(loaded.actorsFor(roomId).map(({ spawnId }) => spawnId)).toEqual([
      'mara-at-well',
      'sela-at-chart-table',
      'orin-at-forge',
      'piri-at-herb-stall',
    ]);
    expect(loaded.triggersFor(roomId).map(({ triggerId }) => triggerId)).toEqual([
      'rest-at-village-well',
      'speak-with-sela',
      'speak-with-orin',
      'speak-with-piri',
    ]);
    expect(loaded.checkpointsFor(roomId).map(({ checkpointId }) => checkpointId)).toEqual([
      'village-well',
    ]);
    expect(Object.isFrozen(loaded.surfacesFor(roomId))).toBe(true);
  });

  test('preserves non-lexical authored order across two rooms and repeated lookup families', () => {
    const westRoom = {
      roomId: 'wren-rest-west' as RoomId,
      displayName: 'West Square',
      bounds: { x: 0, y: 0, width: 1280, height: 720 },
      cameraBounds: { x: 0, y: 0, width: 1280, height: 720 },
      discoveryId: null,
    } as const;
    const eastRoom = {
      roomId: 'wren-rest-east' as RoomId,
      displayName: 'East Square',
      bounds: { x: 1280, y: 0, width: 1280, height: 720 },
      cameraBounds: { x: 1280, y: 0, width: 1280, height: 720 },
      discoveryId: null,
    } as const;
    const definition: AreaDefinition = {
      ...WRENS_REST_AREA,
      rooms: [westRoom, eastRoom],
      surfaces: [
        {
          surfaceId: 'zeta-ground' as StableId<'surface'>,
          kind: 'solid',
          roomId: westRoom.roomId,
          bounds: { x: 0, y: 608, width: 1280, height: 112 },
          materialId: 'loam-stone' as StableId<'material'>,
        },
        {
          surfaceId: 'alpha-ledge' as StableId<'surface'>,
          kind: 'one-way',
          roomId: westRoom.roomId,
          bounds: { x: 384, y: 480, width: 192, height: 16 },
          materialId: 'rootwood' as StableId<'material'>,
        },
        {
          surfaceId: 'east-ground' as StableId<'surface'>,
          kind: 'solid',
          roomId: eastRoom.roomId,
          bounds: { x: 1280, y: 608, width: 1280, height: 112 },
          materialId: 'loam-stone' as StableId<'material'>,
        },
      ],
      zones: [
        {
          zoneId: 'zeta-water' as StableId<'zone'>,
          kind: 'water',
          roomId: westRoom.roomId,
          bounds: { x: 640, y: 576, width: 64, height: 32 },
        },
        {
          zoneId: 'alpha-climb' as StableId<'zone'>,
          kind: 'climb',
          roomId: westRoom.roomId,
          bounds: { x: 768, y: 480, width: 32, height: 128 },
        },
      ],
      actorSpawns: [
        {
          ...WRENS_REST_AREA.actorSpawns[0]!,
          spawnId: 'zeta-spawn' as StableId<'actor-spawn'>,
          roomId: westRoom.roomId,
        },
        {
          ...WRENS_REST_AREA.actorSpawns[0]!,
          spawnId: 'alpha-spawn' as StableId<'actor-spawn'>,
          roomId: westRoom.roomId,
          position: { x: 320, y: 608 },
        },
      ],
      triggers: [],
      checkpoints: [{ ...WRENS_REST_AREA.checkpoints[0]!, roomId: westRoom.roomId }],
      transitions: [
        {
          kind: 'room',
          transitionId: 'west-to-east' as StableId<'transition'>,
          roomId: westRoom.roomId,
          bounds: { x: 1248, y: 480, width: 32, height: 128 },
          activation: 'enter',
          targetRoomId: eastRoom.roomId,
          targetPosition: { x: 1312, y: 608 },
          targetFacing: 'right',
          predicate: WORLD_ALWAYS,
        },
        {
          kind: 'room',
          transitionId: 'east-to-west' as StableId<'transition'>,
          roomId: eastRoom.roomId,
          bounds: { x: 1280, y: 480, width: 32, height: 128 },
          activation: 'enter',
          targetRoomId: westRoom.roomId,
          targetPosition: { x: 1216, y: 608 },
          targetFacing: 'left',
          predicate: WORLD_ALWAYS,
        },
      ],
      discoveries: [],
    };
    const registry: ContentRegistry = {
      ...CONTENT_REGISTRY,
      areas: [definition],
      puzzles: [],
      bossEncounters: [],
    };
    const before = structuredClone(definition);
    const loaded = new AreaLoader(registry).load(definition);

    expect(loaded.roomAt({ x: 1280, y: 608 })?.roomId).toBe('wren-rest-east');
    expect(loaded.surfacesFor(westRoom.roomId).map(({ surfaceId }) => surfaceId)).toEqual([
      'zeta-ground',
      'alpha-ledge',
    ]);
    expect(loaded.zonesFor(westRoom.roomId).map(({ zoneId }) => zoneId)).toEqual([
      'zeta-water',
      'alpha-climb',
    ]);
    expect(loaded.actorsFor(westRoom.roomId).map(({ spawnId }) => spawnId)).toEqual([
      'zeta-spawn',
      'alpha-spawn',
    ]);
    expect(structuredClone(definition)).toEqual(before);
  });

  test('uses left/top-inclusive and right/bottom-exclusive room containment', () => {
    const loaded = new AreaLoader(CONTENT_REGISTRY).load(WRENS_REST_AREA);

    expect(loaded.roomAt({ x: 0, y: 0 })?.roomId).toBe('wren-rest-square');
    expect(loaded.roomAt({ x: 2559.999, y: 719.999 })?.roomId).toBe('wren-rest-square');
    expect(loaded.roomAt({ x: 2560, y: 608 })?.roomId).toBe('wren-herb-loft');
    expect(loaded.roomAt({ x: 4480, y: 608 })).toBeNull();
    expect(loaded.roomAt({ x: 256, y: 720 })).toBeNull();
  });

  test('returns null or an empty frozen view for unknown lookups', () => {
    const loaded = new AreaLoader(CONTENT_REGISTRY).load(WRENS_REST_AREA);
    const missingRoom = 'missing-room' as RoomId;

    expect(loaded.room(missingRoom)).toBeNull();
    expect(loaded.checkpoint('missing-checkpoint' as CheckpointId)).toBeNull();
    expect(loaded.surfacesFor(missingRoom)).toEqual([]);
    expect(loaded.zonesFor(missingRoom)).toEqual([]);
    expect(loaded.actorsFor(missingRoom)).toEqual([]);
    expect(loaded.triggersFor(missingRoom)).toEqual([]);
    expect(loaded.checkpointsFor(missingRoom)).toEqual([]);
    expect(Object.isFrozen(loaded.actorsFor(missingRoom))).toBe(true);
  });

  test('returns authored-order Task 12 room content families as frozen views', () => {
    const loaded = new AreaLoader(CONTENT_REGISTRY).load(BRACKENREACH_AREA);
    const trail = 'brackenreach-trail' as RoomId;
    const arch = 'listening-arch' as RoomId;

    expect(loaded.transitionsFor(trail).map(({ transitionId }) => transitionId)).toEqual([
      'brackenreach-to-wren-rest',
      'trail-to-split-cedar-sanctum',
      'trail-to-listening-arch',
    ]);
    expect(loaded.mechanismsFor(arch).map(({ mechanismId }) => mechanismId)).toEqual([
      'listening-arch-homeward-latch',
    ]);
    expect(loaded.encountersFor(trail).map(({ encounterId }) => encounterId)).toEqual([
      'trail-briar-crossing',
    ]);
    expect(loaded.chestsFor(trail).map(({ chestId }) => chestId)).toEqual(['trail-wayfarer-cache']);
    expect(loaded.discoveriesFor(trail)).toEqual([]);
    expect(loaded.breakablesFor(trail).map(({ breakableId }) => breakableId)).toEqual([
      'split-cedar-root-knot',
    ]);
    expect(Object.isFrozen(loaded.transitionsFor(trail))).toBe(true);
    expect(Object.isFrozen(loaded.discoveriesFor(trail))).toBe(true);
  });

  test('throws deterministic ContentLoadError issues for an unregistered area', () => {
    const unregistered: AreaDefinition = {
      ...WRENS_REST_AREA,
      areaId: 'unregistered-area' as AreaId,
    };

    expect(() => new AreaLoader(CONTENT_REGISTRY).load(unregistered)).toThrowError(
      ContentLoadError,
    );
    try {
      new AreaLoader(CONTENT_REGISTRY).load(unregistered);
    } catch (error) {
      expect(error).toBeInstanceOf(ContentLoadError);
      expect((error as ContentLoadError).issues).toContainEqual(
        expect.objectContaining({ code: 'missing-reference', path: '/areaId' }),
      );
    }
  });

  test('rejects an invalid registered definition without mutating its source', () => {
    const invalid: AreaDefinition = {
      ...WRENS_REST_AREA,
      bounds: { ...WRENS_REST_AREA.bounds, width: 0 },
    };
    const before = structuredClone(invalid);

    try {
      new AreaLoader(CONTENT_REGISTRY).load(invalid);
      throw new Error('Expected invalid area to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ContentLoadError);
      expect((error as ContentLoadError).issues).toContainEqual(
        expect.objectContaining({ code: 'invalid-geometry', path: '/areas/0/bounds' }),
      );
    }
    expect(structuredClone(invalid)).toEqual(before);
  });

  test('loads an immutable snapshot that cannot change with its mutable source', () => {
    const mutable = structuredClone(WRENS_REST_AREA);
    const registry: ContentRegistry = {
      ...CONTENT_REGISTRY,
      areas: CONTENT_REGISTRY.areas.map((area) =>
        area.areaId === mutable.areaId ? mutable : area,
      ),
    };
    const loaded = new AreaLoader(registry).load(mutable);

    expect(Object.isFrozen(loaded.definition)).toBe(true);
    expect(Object.isFrozen(loaded.definition.surfaces)).toBe(true);
    expect(Object.isFrozen(loaded.definition.surfaces[0]!.bounds)).toBe(true);
    expect(Reflect.set(mutable.bounds, 'width', 64)).toBe(true);
    expect(Reflect.set(mutable.surfaces[0]!.bounds, 'x', 32)).toBe(true);
    expect(loaded.definition.bounds.width).toBe(4480);
    expect(loaded.surfacesFor('wren-rest-square' as RoomId)[0]!.bounds.x).toBe(0);
    expect(Reflect.set(loaded.definition.bounds, 'width', 64)).toBe(false);
  });
});
