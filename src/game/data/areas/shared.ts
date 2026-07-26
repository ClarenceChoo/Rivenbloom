import type { LayerDefinition, PropDefinition, StableId } from '../types';

export const BrackenreachAssetKeys = {
  far: 'brackenreach-far',
  mid: 'brackenreach-mid',
  foreground: 'brackenreach-foreground',
  terrain: 'brackenreach-terrain',
  mara: 'mara-sheet'
} as const;

export const TERRAIN_ASSET_KEY = BrackenreachAssetKeys.terrain;

export function terrainProp(
  id: StableId,
  roomId: StableId,
  x: number,
  y: number,
  source: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
  size: { readonly width: number; readonly height: number },
  surfaceId?: StableId
): PropDefinition {
  return {
    id,
    roomId,
    position: { x, y },
    render: {
      assetKey: TERRAIN_ASSET_KEY,
      source,
      size,
      origin: { x: 0, y: 0 },
      depth: 0
    },
    ...(surfaceId === undefined ? {} : { surfaceId })
  };
}

/** Shelf source rectangles shared by the Brackenreach terrain kit. */
export const SHELF_SOURCES = {
  west: { x: 18, y: 100, width: 376, height: 170 },
  centre: { x: 408, y: 98, width: 354, height: 178 },
  east: { x: 1154, y: 102, width: 360, height: 166 },
  upper: { x: 700, y: 366, width: 310, height: 210 },
  waystone: { x: 1152, y: 630, width: 364, height: 284 }
} as const;

/** Standard three-plane parallax stack reused until per-area art lands. */
export const standardLayers = (prefix: string): readonly LayerDefinition[] => [
  {
    id: `${prefix}-far`,
    kind: 'far',
    assetKey: BrackenreachAssetKeys.far,
    position: { x: 0, y: 0 },
    size: { width: 1280, height: 720 },
    depth: -30,
    scrollFactor: 0.05
  },
  {
    id: `${prefix}-mid`,
    kind: 'mid',
    assetKey: BrackenreachAssetKeys.mid,
    position: { x: 0, y: 0 },
    size: { width: 1280, height: 720 },
    depth: -20,
    scrollFactor: 0.18
  },
  {
    id: `${prefix}-foreground`,
    kind: 'foreground',
    assetKey: BrackenreachAssetKeys.foreground,
    position: { x: 0, y: 0 },
    size: { width: 1280, height: 720 },
    depth: 8,
    scrollFactor: 1.08
  }
];
