import type { LayerDefinition, RectDefinition } from '../data/types';

export const horizontalLayerTiles = (
  layer: LayerDefinition,
  bounds: RectDefinition
): readonly number[] => {
  if (layer.size.width <= 0) return [layer.position.x];
  const tiles: number[] = [];
  const rightEdge = bounds.x + bounds.width;
  for (let x = layer.position.x; x <= rightEdge; x += layer.size.width) {
    tiles.push(x);
  }
  return tiles;
};
