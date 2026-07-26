import type { AreaDefinition } from '../types';
import { SHELF_SOURCES, standardLayers, terrainProp } from './shared';

/** Wren's Rest — the settlement: Sela's map room, Piri's stall, Orin's forge. */
export const wrensRestArea: AreaDefinition = {
  id: 'wrens-rest',
  displayName: "Wren's Rest",
  regionId: 'brackenreach',
  bounds: { x: 0, y: 0, width: 1920, height: 720 },
  defaultSpawnId: 'village-green-spawn',
  ambienceProfileId: 'wrens-rest-evening',
  rooms: [
    {
      id: 'village-green',
      displayName: 'Village Green',
      bounds: { x: 0, y: 0, width: 1180, height: 720 },
      discoveryId: 'wrens-rest-village-green'
    },
    {
      id: 'forge-row',
      displayName: 'Forge Row',
      bounds: { x: 1180, y: 0, width: 740, height: 720 },
      discoveryId: 'wrens-rest-forge-row'
    }
  ],
  layers: standardLayers('wrens-rest'),
  surfaces: [
    {
      id: 'green-floor',
      roomId: 'village-green',
      kind: 'solid',
      collision: { x: 0, y: 566, width: 1180, height: 154 },
      materialId: 'settlement-brass'
    },
    {
      id: 'forge-floor',
      roomId: 'forge-row',
      kind: 'solid',
      collision: { x: 1180, y: 566, width: 740, height: 154 },
      materialId: 'settlement-brass'
    },
    {
      id: 'green-porch',
      roomId: 'village-green',
      kind: 'one-way',
      collision: { x: 640, y: 430, width: 250, height: 22 },
      materialId: 'moss-root'
    }
  ],
  playerSpawns: [
    {
      id: 'village-green-spawn',
      roomId: 'village-green',
      position: { x: 280, y: 566 },
      facing: 'right'
    },
    {
      id: 'village-east',
      roomId: 'forge-row',
      position: { x: 1830, y: 566 },
      facing: 'left'
    }
  ],
  actorSpawns: [
    {
      id: 'green-sela',
      roomId: 'village-green',
      actorId: 'sela-quill',
      position: { x: 520, y: 566 },
      facing: 'left'
    },
    {
      id: 'green-piri',
      roomId: 'village-green',
      actorId: 'piri-moss',
      position: { x: 880, y: 566 },
      facing: 'left'
    },
    {
      id: 'forge-orin',
      roomId: 'forge-row',
      actorId: 'orin-fen',
      position: { x: 1480, y: 566 },
      facing: 'left'
    }
  ],
  triggers: [
    {
      id: 'village-green-entry',
      roomId: 'village-green',
      kind: 'room-entry',
      bounds: { x: 60, y: 120, width: 1060, height: 446 },
      targetId: 'wrens-rest-village-green',
      once: true
    },
    {
      id: 'forge-row-entry',
      roomId: 'forge-row',
      kind: 'room-entry',
      bounds: { x: 1220, y: 120, width: 640, height: 446 },
      targetId: 'wrens-rest-forge-row',
      once: true
    },
    {
      id: 'village-lantern-rest',
      roomId: 'village-green',
      kind: 'checkpoint',
      bounds: { x: 180, y: 424, width: 92, height: 142 },
      targetId: 'village-seed-lantern',
      once: false
    },
    {
      id: 'forge-interact',
      roomId: 'forge-row',
      kind: 'interaction',
      bounds: { x: 1560, y: 404, width: 160, height: 162 },
      targetId: 'wrens-forge',
      once: false
    },
    {
      id: 'memorial-green-interact',
      roomId: 'village-green',
      kind: 'interaction',
      bounds: { x: 1020, y: 404, width: 110, height: 162 },
      targetId: 'memorial-lantern-green',
      once: false
    },
    {
      id: 'village-east-boundary',
      roomId: 'forge-row',
      kind: 'transition',
      bounds: { x: 1892, y: 0, width: 28, height: 720 },
      targetId: 'village-to-trail',
      once: false
    }
  ],
  mechanisms: [
    {
      id: 'wrens-forge',
      roomId: 'forge-row',
      kind: 'rootglass-forge',
      position: { x: 1640, y: 566 },
      triggerId: 'forge-interact',
      persistentFlagId: 'wrens-forge-lit'
    },
    {
      id: 'memorial-lantern-green',
      roomId: 'village-green',
      kind: 'seed-lantern',
      position: { x: 1075, y: 566 },
      triggerId: 'memorial-green-interact',
      questId: 'lanterns-for-the-absent',
      persistentFlagId: 'memorial-lantern-green-lit'
    }
  ],
  checkpoints: [
    {
      id: 'village-seed-lantern',
      roomId: 'village-green',
      triggerId: 'village-lantern-rest',
      spawnId: 'village-green-spawn',
      position: { x: 226, y: 566 }
    }
  ],
  transitions: [
    {
      id: 'village-to-trail',
      roomId: 'forge-row',
      triggerId: 'village-east-boundary',
      destinationAreaId: 'brackenreach-trail',
      destinationSpawnId: 'trail-west'
    }
  ],
  props: [
    terrainProp(
      'green-shelf-west',
      'village-green',
      -20,
      500,
      SHELF_SOURCES.west,
      { width: 470, height: 212 },
      'green-floor'
    ),
    terrainProp(
      'green-shelf-east',
      'village-green',
      620,
      498,
      SHELF_SOURCES.centre,
      { width: 455, height: 228 },
      'green-floor'
    ),
    terrainProp(
      'forge-shelf',
      'forge-row',
      1180,
      500,
      SHELF_SOURCES.east,
      { width: 470, height: 217 },
      'forge-floor'
    ),
    terrainProp('green-porch-shelf', 'village-green', 610, 386, SHELF_SOURCES.upper, {
      width: 310,
      height: 210
    })
  ]
};
