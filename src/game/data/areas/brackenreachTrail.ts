import type { AreaDefinition, PropDefinition } from '../types';
import { BrackenreachAssetKeys, SHELF_SOURCES, TERRAIN_ASSET_KEY, terrainProp } from './shared';

const brackenreachProps: readonly PropDefinition[] = [
  terrainProp(
    'trailhead-shelf-west',
    'trailhead',
    -20,
    500,
    SHELF_SOURCES.west,
    { width: 470, height: 212 },
    'trailhead-floor'
  ),
  terrainProp(
    'trailhead-shelf-centre',
    'trailhead',
    420,
    498,
    SHELF_SOURCES.centre,
    { width: 455, height: 228 },
    'trailhead-floor'
  ),
  terrainProp(
    'trailhead-shelf-east',
    'trailhead',
    840,
    500,
    SHELF_SOURCES.east,
    { width: 470, height: 217 },
    'trailhead-floor'
  ),
  terrainProp(
    'arch-shelf-west',
    'listening-arch',
    1250,
    500,
    SHELF_SOURCES.centre,
    { width: 455, height: 228 },
    'listening-arch-floor'
  ),
  terrainProp(
    'arch-shelf-centre',
    'listening-arch',
    1670,
    500,
    SHELF_SOURCES.west,
    { width: 470, height: 212 },
    'listening-arch-floor'
  ),
  terrainProp(
    'arch-shelf-east',
    'listening-arch',
    2110,
    500,
    SHELF_SOURCES.east,
    { width: 470, height: 217 },
    'listening-arch-floor'
  ),
  terrainProp(
    'arch-upper-shelf',
    'listening-arch',
    1510,
    354,
    SHELF_SOURCES.upper,
    { width: 310, height: 210 },
    'arch-upper-platform'
  ),
  {
    id: 'listening-arch-waystone',
    roomId: 'listening-arch',
    position: { x: 1952, y: 348 },
    render: {
      assetKey: TERRAIN_ASSET_KEY,
      source: SHELF_SOURCES.waystone,
      size: { width: 182, height: 142 },
      origin: { x: 0.5, y: 0 },
      depth: 2
    },
    mechanismId: 'brackenreach-listening-arch'
  }
];

/** Brackenreach Trail — the opening route: trailhead and the Listening Arch. */
export const brackenreachTrailArea: AreaDefinition = {
  id: 'brackenreach-trail',
  displayName: 'Brackenreach Trail',
  regionId: 'brackenreach',
  bounds: { x: 0, y: 0, width: 2560, height: 720 },
  defaultSpawnId: 'trail-west',
  ambienceProfileId: 'brackenreach-rain',
  rooms: [
    {
      id: 'trailhead',
      displayName: 'Trailhead',
      bounds: { x: 0, y: 0, width: 1280, height: 720 },
      discoveryId: 'brackenreach-trailhead'
    },
    {
      id: 'listening-arch',
      displayName: 'Listening Arch',
      bounds: { x: 1280, y: 0, width: 1280, height: 720 },
      discoveryId: 'brackenreach-listening-arch',
      ambienceProfileId: 'listening-arch-hush'
    }
  ],
  layers: [
    {
      id: 'far-forest',
      kind: 'far',
      assetKey: BrackenreachAssetKeys.far,
      position: { x: 0, y: 0 },
      size: { width: 1280, height: 720 },
      depth: -30,
      scrollFactor: 0.05
    },
    {
      id: 'mid-listening-trees',
      kind: 'mid',
      assetKey: BrackenreachAssetKeys.mid,
      position: { x: 0, y: 0 },
      size: { width: 1280, height: 720 },
      depth: -20,
      scrollFactor: 0.18
    },
    {
      id: 'foreground-foliage',
      kind: 'foreground',
      assetKey: BrackenreachAssetKeys.foreground,
      position: { x: 0, y: 0 },
      size: { width: 1280, height: 720 },
      depth: 8,
      scrollFactor: 1.08
    }
  ],
  surfaces: [
    {
      id: 'trailhead-floor',
      roomId: 'trailhead',
      kind: 'solid',
      collision: { x: 0, y: 566, width: 1280, height: 154 },
      materialId: 'wet-slate'
    },
    {
      id: 'listening-arch-floor',
      roomId: 'listening-arch',
      kind: 'solid',
      collision: { x: 1280, y: 566, width: 1280, height: 154 },
      materialId: 'wet-slate'
    },
    {
      id: 'arch-upper-platform',
      roomId: 'listening-arch',
      kind: 'one-way',
      collision: { x: 1510, y: 410, width: 310, height: 24 },
      materialId: 'moss-root'
    },
    {
      id: 'arch-root-climb',
      roomId: 'listening-arch',
      kind: 'climb',
      collision: { x: 1640, y: 410, width: 48, height: 156 },
      materialId: 'woven-root'
    }
  ],
  playerSpawns: [
    {
      id: 'trail-west',
      roomId: 'trailhead',
      position: { x: 590, y: 566 },
      facing: 'right'
    },
    {
      id: 'listening-arch-east',
      roomId: 'listening-arch',
      position: { x: 2200, y: 566 },
      facing: 'left'
    }
  ],
  actorSpawns: [
    {
      id: 'arch-briar-scrapper',
      roomId: 'listening-arch',
      actorId: 'briar-scrapper',
      position: { x: 1740, y: 566 },
      facing: 'left',
      encounterId: 'arch-approach-encounter'
    },
    {
      id: 'arch-duskwing',
      roomId: 'listening-arch',
      actorId: 'duskwing',
      position: { x: 1910, y: 328 },
      facing: 'left',
      encounterId: 'arch-approach-encounter'
    }
  ],
  triggers: [
    {
      id: 'trailhead-discovery',
      roomId: 'trailhead',
      kind: 'room-entry',
      bounds: { x: 120, y: 120, width: 1040, height: 446 },
      targetId: 'brackenreach-trailhead',
      once: true
    },
    {
      id: 'listening-arch-discovery',
      roomId: 'listening-arch',
      kind: 'room-entry',
      bounds: { x: 1320, y: 120, width: 1160, height: 446 },
      targetId: 'brackenreach-listening-arch',
      once: true
    },
    {
      id: 'trail-seed-lantern-trigger',
      roomId: 'trailhead',
      kind: 'checkpoint',
      bounds: { x: 232, y: 424, width: 92, height: 142 },
      targetId: 'trail-seed-lantern',
      once: false
    },
    {
      id: 'listening-arch-listen',
      roomId: 'listening-arch',
      kind: 'interaction',
      bounds: { x: 1890, y: 364, width: 164, height: 202 },
      targetId: 'brackenreach-listening-arch',
      once: false
    },
    {
      id: 'trail-west-boundary',
      roomId: 'trailhead',
      kind: 'transition',
      bounds: { x: 0, y: 0, width: 28, height: 720 },
      targetId: 'trail-to-village',
      once: false
    },
    {
      id: 'trail-east-boundary',
      roomId: 'listening-arch',
      kind: 'transition',
      bounds: { x: 2532, y: 0, width: 28, height: 720 },
      targetId: 'trail-to-hollows',
      once: false
    }
  ],
  mechanisms: [
    {
      id: 'brackenreach-listening-arch',
      roomId: 'listening-arch',
      kind: 'listening-arch',
      position: { x: 1972, y: 566 },
      triggerId: 'listening-arch-listen',
      questId: 'silent-bloom',
      persistentFlagId: 'listening-arch-awake'
    }
  ],
  checkpoints: [
    {
      id: 'trail-seed-lantern',
      roomId: 'trailhead',
      triggerId: 'trail-seed-lantern-trigger',
      spawnId: 'trail-west',
      position: { x: 278, y: 566 }
    }
  ],
  transitions: [
    {
      id: 'trail-to-village',
      roomId: 'trailhead',
      triggerId: 'trail-west-boundary',
      destinationAreaId: 'wrens-rest',
      destinationSpawnId: 'village-east'
    },
    {
      id: 'trail-to-hollows',
      roomId: 'listening-arch',
      triggerId: 'trail-east-boundary',
      destinationAreaId: 'singing-hollows',
      destinationSpawnId: 'hollow-mouth-west'
    }
  ],
  props: brackenreachProps
};
