import { describe, expect, it } from 'vitest';

import { CONTENT_REGISTRY, WRENS_REST_AREA } from '../../src/game/data/areas';
import { validateContent } from '../../src/game/data/ContentValidation';

describe("Wren's Rest interaction authoring", () => {
  it('places the seed-lantern and three NPC interactions at the exact stable positions', () => {
    expect(
      WRENS_REST_AREA.actorSpawns
        .filter(({ actorId }) => ['sela-quill', 'orin-fen', 'piri-moss'].includes(actorId))
        .map(({ spawnId, actorId, position, facing }) => ({ spawnId, actorId, position, facing })),
    ).toEqual([
      {
        spawnId: 'sela-at-chart-table',
        actorId: 'sela-quill',
        position: { x: 672, y: 608 },
        facing: 'left',
      },
      {
        spawnId: 'orin-at-forge',
        actorId: 'orin-fen',
        position: { x: 1216, y: 608 },
        facing: 'left',
      },
      {
        spawnId: 'piri-at-herb-stall',
        actorId: 'piri-moss',
        position: { x: 1760, y: 608 },
        facing: 'left',
      },
    ]);
    expect(WRENS_REST_AREA.triggers).toEqual([
      expect.objectContaining({
        triggerId: 'rest-at-village-well',
        bounds: { x: 176, y: 448, width: 160, height: 176 },
        activation: 'interact',
        action: {
          kind: 'activate-checkpoint',
          areaId: 'wren-rest',
          checkpointId: 'village-well',
        },
      }),
      expect.objectContaining({
        triggerId: 'speak-with-sela',
        bounds: { x: 592, y: 448, width: 160, height: 176 },
        action: { kind: 'interact-npc', spawnId: 'sela-at-chart-table' },
      }),
      expect.objectContaining({
        triggerId: 'speak-with-orin',
        bounds: { x: 1136, y: 448, width: 160, height: 176 },
        action: { kind: 'interact-npc', spawnId: 'orin-at-forge' },
      }),
      expect.objectContaining({
        triggerId: 'speak-with-piri',
        bounds: { x: 1680, y: 448, width: 160, height: 176 },
        action: { kind: 'interact-npc', spawnId: 'piri-at-herb-stall' },
      }),
    ]);
  });

  it('strictly validates NPC and checkpoint action references', () => {
    const missingNpcSpawn = {
      ...WRENS_REST_AREA,
      actorSpawns: WRENS_REST_AREA.actorSpawns.filter(
        ({ spawnId }) => spawnId !== 'sela-at-chart-table',
      ),
    };
    expect(validateContent({ ...CONTENT_REGISTRY, areas: [missingNpcSpawn] })).toContainEqual(
      expect.objectContaining({
        code: 'missing-reference',
        path: '/areas/0/triggers/1/action/spawnId',
      }),
    );
  });
});
