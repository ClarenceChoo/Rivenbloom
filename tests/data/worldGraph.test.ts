import { describe, expect, test } from 'vitest';

import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { buildWorldGraph, reachableWorldNodes } from '../../src/game/world/WorldGraph';

describe('WorldGraph', () => {
  test('builds frozen stable-sorted nodes and authored-order edges', () => {
    const graph = buildWorldGraph(CONTENT_REGISTRY);

    expect(graph.nodes).toHaveLength(18);
    expect(graph.nodes.map(({ key }) => key)).toEqual(
      [...graph.nodes.map(({ key }) => key)].sort((left, right) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
    );
    expect(graph.edges).toHaveLength(36);
    expect(graph.edges[0]).toMatchObject({
      transitionId: 'wren-rest-to-brackenreach',
      from: { areaId: 'wren-rest', roomId: 'wren-rest-square' },
      to: { areaId: 'brackenreach', roomId: 'brackenreach-trail' },
    });
    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.isFrozen(graph.nodes)).toBe(true);
    expect(Object.isFrozen(graph.edges[0]?.to)).toBe(true);
  });

  test('reaches the critical and optional world when every authored edge is available', () => {
    const graph = buildWorldGraph(CONTENT_REGISTRY);
    const reachable = reachableWorldNodes(graph, {
      areaId: 'wren-rest',
      roomId: 'wren-rest-square',
    });

    expect(reachable).toHaveLength(18);
    expect(reachable.map(({ roomId }) => roomId)).toEqual(
      expect.arrayContaining([
        'wren-herb-loft',
        'wren-forge-cellar',
        'split-cedar-sanctum',
        'dash-trial',
        'east-lens-vault',
        'folio-vault',
        'hollow-choir-arena',
      ]),
    );
    expect(Object.isFrozen(reachable)).toBe(true);
  });

  test('returns an empty frozen result for an unknown start node', () => {
    const graph = buildWorldGraph(CONTENT_REGISTRY);
    const reachable = reachableWorldNodes(graph, {
      areaId: 'missing-area',
      roomId: 'missing-room',
    });
    expect(reachable).toEqual([]);
    expect(Object.isFrozen(reachable)).toBe(true);
  });
});
