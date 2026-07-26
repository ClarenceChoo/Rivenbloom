import { describe, expect, it } from 'vitest';
import { areaDefinitions } from '../../src/game/data/areas';
import type { AreaDefinition } from '../../src/game/data/types';
import { AreaLoader } from '../../src/game/world/AreaLoader';

describe('AreaLoader', () => {
  it('selects the default spawn, orders layers, and groups authored room content', () => {
    const definition = areaDefinitions[0];
    if (definition === undefined) throw new Error('Expected shipped Brackenreach area.');
    const sourceLayerIds = definition.layers.map(({ id }) => id);

    const loaded = new AreaLoader().load(definition);

    expect(loaded.areaId).toBe('brackenreach-trail');
    expect(loaded.initialSpawn).toEqual({
      id: 'trail-west',
      roomId: 'trailhead',
      position: { x: 590, y: 566 },
      facing: 'right'
    });
    expect(loaded.layers.map(({ id }) => id)).toEqual([
      'far-forest',
      'mid-listening-trees',
      'foreground-foliage'
    ]);
    expect(definition.layers.map(({ id }) => id)).toEqual(sourceLayerIds);
    expect(loaded.rooms[0]).toMatchObject({
      id: 'trailhead',
      surfaceIds: ['trailhead-floor'],
      playerSpawnIds: ['trail-west'],
      actorSpawnIds: [],
      checkpointIds: ['trail-seed-lantern']
    });
    expect(loaded.rooms[1]).toMatchObject({
      id: 'listening-arch',
      surfaceIds: ['listening-arch-floor', 'arch-upper-platform', 'arch-root-climb'],
      playerSpawnIds: ['listening-arch-east'],
      actorSpawnIds: ['arch-briar-scrapper', 'arch-duskwing'],
      mechanismIds: ['brackenreach-listening-arch']
    });
  });

  it('rejects an area whose default player spawn does not exist', () => {
    const definition = areaDefinitions[0];
    if (definition === undefined) throw new Error('Expected shipped Brackenreach area.');
    const invalid: AreaDefinition = {
      ...definition,
      defaultSpawnId: 'missing-spawn'
    };

    expect(() => new AreaLoader().load(invalid)).toThrowError(
      'Area "brackenreach-trail" default spawn "missing-spawn" does not exist.'
    );
  });
});
