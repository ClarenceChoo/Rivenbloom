import type { AreaDefinition } from '../types';
import { SHELF_SOURCES, standardLayers, terrainProp } from './shared';

/** Hollow Choir — the Pallid Cantor's arena; its lenses live in bossMechanisms. */
export const hollowChoirArea: AreaDefinition = {
  id: 'hollow-choir',
  displayName: 'Hollow Choir',
  regionId: 'brackenreach',
  bounds: { x: 0, y: 0, width: 1920, height: 720 },
  defaultSpawnId: 'antechamber-west',
  ambienceProfileId: 'hollow-choir-still',
  rooms: [
    {
      id: 'choir-antechamber',
      displayName: 'Choir Antechamber',
      bounds: { x: 0, y: 0, width: 830, height: 720 },
      discoveryId: 'hollow-choir-antechamber'
    },
    {
      id: 'choir-arena',
      displayName: 'Choir Arena',
      bounds: { x: 830, y: 0, width: 1090, height: 720 },
      discoveryId: 'hollow-choir-arena'
    }
  ],
  layers: standardLayers('hollow-choir'),
  surfaces: [
    {
      id: 'antechamber-floor',
      roomId: 'choir-antechamber',
      kind: 'solid',
      collision: { x: 0, y: 566, width: 830, height: 154 },
      materialId: 'rootglass-pane'
    },
    {
      id: 'arena-floor',
      roomId: 'choir-arena',
      kind: 'solid',
      collision: { x: 830, y: 566, width: 1090, height: 154 },
      materialId: 'rootglass-pane'
    },
    {
      id: 'arena-ledge-west',
      roomId: 'choir-arena',
      kind: 'one-way',
      collision: { x: 950, y: 420, width: 220, height: 22 },
      materialId: 'moss-root'
    },
    {
      id: 'arena-ledge-east',
      roomId: 'choir-arena',
      kind: 'one-way',
      collision: { x: 1580, y: 420, width: 220, height: 22 },
      materialId: 'moss-root'
    }
  ],
  playerSpawns: [
    {
      id: 'antechamber-west',
      roomId: 'choir-antechamber',
      position: { x: 90, y: 566 },
      facing: 'right'
    },
    {
      id: 'arena-entry',
      roomId: 'choir-arena',
      position: { x: 900, y: 566 },
      facing: 'right'
    }
  ],
  actorSpawns: [
    {
      id: 'arena-pallid-cantor',
      roomId: 'choir-arena',
      actorId: 'pallid-cantor',
      position: { x: 1500, y: 566 },
      facing: 'left',
      encounterId: 'hollow-choir-boss'
    }
  ],
  triggers: [
    {
      id: 'antechamber-entry',
      roomId: 'choir-antechamber',
      kind: 'room-entry',
      bounds: { x: 40, y: 120, width: 750, height: 446 },
      targetId: 'hollow-choir-antechamber',
      once: true
    },
    {
      id: 'arena-entry-trigger',
      roomId: 'choir-arena',
      kind: 'room-entry',
      bounds: { x: 870, y: 120, width: 1010, height: 446 },
      targetId: 'hollow-choir-arena',
      once: true
    },
    {
      id: 'choir-lantern-rest',
      roomId: 'choir-antechamber',
      kind: 'checkpoint',
      bounds: { x: 620, y: 424, width: 92, height: 142 },
      targetId: 'choir-seed-lantern',
      once: false
    },
    {
      id: 'choir-west-boundary',
      roomId: 'choir-antechamber',
      kind: 'transition',
      bounds: { x: 0, y: 0, width: 28, height: 720 },
      targetId: 'choir-to-reliquary',
      once: false
    }
  ],
  mechanisms: [],
  checkpoints: [
    {
      id: 'choir-seed-lantern',
      roomId: 'choir-antechamber',
      triggerId: 'choir-lantern-rest',
      spawnId: 'antechamber-west',
      position: { x: 666, y: 566 }
    }
  ],
  transitions: [
    {
      id: 'choir-to-reliquary',
      roomId: 'choir-antechamber',
      triggerId: 'choir-west-boundary',
      destinationAreaId: 'rootglass-reliquary',
      destinationSpawnId: 'gallery-east'
    }
  ],
  props: [
    terrainProp(
      'antechamber-shelf',
      'choir-antechamber',
      -20,
      500,
      SHELF_SOURCES.west,
      { width: 470, height: 212 },
      'antechamber-floor'
    ),
    terrainProp(
      'arena-shelf',
      'choir-arena',
      830,
      500,
      SHELF_SOURCES.east,
      { width: 470, height: 217 },
      'arena-floor'
    ),
    terrainProp('arena-waystone', 'choir-arena', 1375, 348, SHELF_SOURCES.waystone, {
      width: 182,
      height: 142
    })
  ]
};
