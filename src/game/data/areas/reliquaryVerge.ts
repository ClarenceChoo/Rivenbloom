import type { AreaDefinition } from '../types';
import { SHELF_SOURCES, standardLayers, terrainProp } from './shared';

/** Reliquary Verge — the elite gate before the dungeon, with a shortcut home. */
export const reliquaryVergeArea: AreaDefinition = {
  id: 'reliquary-verge',
  displayName: 'Reliquary Verge',
  regionId: 'brackenreach',
  bounds: { x: 0, y: 0, width: 1920, height: 720 },
  defaultSpawnId: 'verge-west',
  ambienceProfileId: 'reliquary-verge-glass',
  rooms: [
    {
      id: 'verge-approach',
      displayName: 'Verge Approach',
      bounds: { x: 0, y: 0, width: 1000, height: 720 },
      discoveryId: 'reliquary-verge-approach'
    },
    {
      id: 'sentinel-gate',
      displayName: 'Sentinel Gate',
      bounds: { x: 1000, y: 0, width: 920, height: 720 },
      discoveryId: 'reliquary-verge-sentinel-gate'
    }
  ],
  layers: standardLayers('reliquary-verge'),
  surfaces: [
    {
      id: 'approach-floor',
      roomId: 'verge-approach',
      kind: 'solid',
      collision: { x: 0, y: 566, width: 1000, height: 154 },
      materialId: 'rootglass-pane'
    },
    {
      id: 'gate-floor',
      roomId: 'sentinel-gate',
      kind: 'solid',
      collision: { x: 1000, y: 566, width: 920, height: 154 },
      materialId: 'rootglass-pane'
    },
    {
      id: 'approach-ledge',
      roomId: 'verge-approach',
      kind: 'one-way',
      collision: { x: 420, y: 410, width: 280, height: 22 },
      materialId: 'moss-root'
    }
  ],
  playerSpawns: [
    {
      id: 'verge-west',
      roomId: 'verge-approach',
      position: { x: 90, y: 566 },
      facing: 'right'
    },
    {
      id: 'verge-east',
      roomId: 'sentinel-gate',
      position: { x: 1830, y: 566 },
      facing: 'left'
    }
  ],
  actorSpawns: [
    {
      id: 'approach-barkbound',
      roomId: 'verge-approach',
      actorId: 'barkbound',
      position: { x: 620, y: 566 },
      facing: 'left',
      encounterId: 'verge-approach-encounter'
    },
    {
      id: 'approach-scrapper',
      roomId: 'verge-approach',
      actorId: 'briar-scrapper',
      position: { x: 800, y: 566 },
      facing: 'left',
      encounterId: 'verge-approach-encounter'
    },
    {
      id: 'gate-thorn-sentinel',
      roomId: 'sentinel-gate',
      actorId: 'thorn-sentinel',
      position: { x: 1450, y: 566 },
      facing: 'left',
      encounterId: 'sentinel-gate-encounter'
    }
  ],
  triggers: [
    {
      id: 'verge-approach-entry',
      roomId: 'verge-approach',
      kind: 'room-entry',
      bounds: { x: 40, y: 120, width: 920, height: 446 },
      targetId: 'reliquary-verge-approach',
      once: true
    },
    {
      id: 'sentinel-gate-entry',
      roomId: 'sentinel-gate',
      kind: 'room-entry',
      bounds: { x: 1040, y: 120, width: 840, height: 446 },
      targetId: 'reliquary-verge-sentinel-gate',
      once: true
    },
    {
      id: 'verge-lantern-rest',
      roomId: 'verge-approach',
      kind: 'checkpoint',
      bounds: { x: 150, y: 424, width: 92, height: 142 },
      targetId: 'verge-seed-lantern',
      once: false
    },
    {
      id: 'verge-shortcut-interact',
      roomId: 'verge-approach',
      kind: 'interaction',
      bounds: { x: 320, y: 240, width: 140, height: 180 },
      targetId: 'verge-shortcut',
      once: false
    },
    {
      id: 'memorial-verge-interact',
      roomId: 'sentinel-gate',
      kind: 'interaction',
      bounds: { x: 1730, y: 404, width: 110, height: 162 },
      targetId: 'memorial-lantern-verge',
      once: false
    },
    {
      id: 'verge-west-boundary',
      roomId: 'verge-approach',
      kind: 'transition',
      bounds: { x: 0, y: 0, width: 28, height: 720 },
      targetId: 'verge-to-hollows',
      once: false
    },
    {
      id: 'verge-east-boundary',
      roomId: 'sentinel-gate',
      kind: 'transition',
      bounds: { x: 1892, y: 0, width: 28, height: 720 },
      targetId: 'verge-to-reliquary',
      once: false
    }
  ],
  mechanisms: [
    {
      id: 'verge-shortcut',
      roomId: 'verge-approach',
      kind: 'shortcut',
      position: { x: 390, y: 410 },
      triggerId: 'verge-shortcut-interact',
      persistentFlagId: 'verge-shortcut-open'
    },
    {
      id: 'memorial-lantern-verge',
      roomId: 'sentinel-gate',
      kind: 'seed-lantern',
      position: { x: 1785, y: 566 },
      triggerId: 'memorial-verge-interact',
      questId: 'lanterns-for-the-absent',
      persistentFlagId: 'memorial-lantern-verge-lit'
    }
  ],
  checkpoints: [
    {
      id: 'verge-seed-lantern',
      roomId: 'verge-approach',
      triggerId: 'verge-lantern-rest',
      spawnId: 'verge-west',
      position: { x: 196, y: 566 }
    }
  ],
  transitions: [
    {
      id: 'verge-to-hollows',
      roomId: 'verge-approach',
      triggerId: 'verge-west-boundary',
      destinationAreaId: 'singing-hollows',
      destinationSpawnId: 'basin-east'
    },
    {
      id: 'verge-to-reliquary',
      roomId: 'sentinel-gate',
      triggerId: 'verge-east-boundary',
      destinationAreaId: 'rootglass-reliquary',
      destinationSpawnId: 'vestibule-west'
    }
  ],
  props: [
    terrainProp(
      'approach-shelf',
      'verge-approach',
      -20,
      500,
      SHELF_SOURCES.west,
      { width: 470, height: 212 },
      'approach-floor'
    ),
    terrainProp(
      'gate-shelf',
      'sentinel-gate',
      1000,
      500,
      SHELF_SOURCES.east,
      { width: 470, height: 217 },
      'gate-floor'
    ),
    terrainProp('approach-ledge-shelf', 'verge-approach', 405, 386, SHELF_SOURCES.upper, {
      width: 310,
      height: 210
    })
  ]
};
