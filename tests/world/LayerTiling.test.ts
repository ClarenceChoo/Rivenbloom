import { describe, expect, it } from 'vitest';
import type { LayerDefinition, RectDefinition } from '../../src/game/data/types';
import { horizontalLayerTiles } from '../../src/game/world/LayerTiling';

const areaBounds: RectDefinition = { x: 0, y: 0, width: 2560, height: 720 };
const layer: LayerDefinition = {
  id: 'test-far',
  kind: 'far',
  assetKey: 'test-far-asset',
  position: { x: 0, y: 0 },
  size: { width: 1280, height: 720 },
  depth: -30,
  scrollFactor: 0.05
};

describe('horizontalLayerTiles', () => {
  it('adds one edge-overdraw tile so parallax cannot expose the clear colour', () => {
    expect(horizontalLayerTiles(layer, areaBounds)).toEqual([0, 1280, 2560]);
  });
});
