import { describe, expect, test } from 'vitest';

import { CONTENT_REGISTRY, WRENS_REST_AREA } from '../../src/game/data/areas';
import { validateContent } from '../../src/game/data/ContentValidation';
import type { AreaDefinition, ContentRegistry } from '../../src/game/data/types';

function registryWithWren(area: AreaDefinition): ContentRegistry {
  return {
    ...CONTENT_REGISTRY,
    areas: CONTENT_REGISTRY.areas.map((candidate) =>
      candidate.areaId === area.areaId ? area : candidate,
    ),
  };
}

describe('Task 12 world graph validation', () => {
  test('rejects overlapping rooms', () => {
    const room = WRENS_REST_AREA.rooms[1]!;
    const malformed: AreaDefinition = {
      ...WRENS_REST_AREA,
      rooms: [
        WRENS_REST_AREA.rooms[0]!,
        { ...room, bounds: { ...room.bounds, x: 2400 }, cameraBounds: { ...room.bounds, x: 2400 } },
        WRENS_REST_AREA.rooms[2]!,
      ],
    };

    expect(validateContent(registryWithWren(malformed))).toContainEqual(
      expect.objectContaining({ code: 'invalid-geometry', path: '/areas/0/rooms/1/bounds' }),
    );
  });

  test('rejects unsupported same-room transition targets', () => {
    const transition = WRENS_REST_AREA.transitions.find(
      ({ transitionId }) => transitionId === 'wren-square-to-herb-loft',
    );
    if (transition?.kind !== 'room') throw new Error('Missing room transition fixture.');
    const malformed: AreaDefinition = {
      ...WRENS_REST_AREA,
      transitions: WRENS_REST_AREA.transitions.map((candidate) =>
        candidate === transition
          ? { ...transition, targetPosition: { x: 2624, y: 500 } }
          : candidate,
      ),
    };

    expect(validateContent(registryWithWren(malformed))).toContainEqual(
      expect.objectContaining({
        code: 'inaccessible-checkpoint',
        path: '/areas/0/transitions/2/targetPosition',
      }),
    );
  });

  test('rejects authored rooms disconnected from the full world graph', () => {
    const malformed: AreaDefinition = {
      ...WRENS_REST_AREA,
      transitions: WRENS_REST_AREA.transitions.filter(
        ({ transitionId }) =>
          transitionId !== 'wren-square-to-herb-loft' &&
          transitionId !== 'wren-herb-loft-to-square',
      ),
    };

    expect(validateContent(registryWithWren(malformed))).toContainEqual(
      expect.objectContaining({
        code: 'invalid-reference',
        path: '/areas/0/rooms/1/roomId',
        message: expect.stringContaining('unreachable'),
      }),
    );
  });
});
