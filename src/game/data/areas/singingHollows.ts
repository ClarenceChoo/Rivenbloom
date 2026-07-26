import type { AreaDefinition } from '../types';
import { SHELF_SOURCES, standardLayers, terrainProp } from './shared';

/** Singing Hollows — the cave route: bramble dash trial and the resonant basin. */
export const singingHollowsArea: AreaDefinition = {
  id: 'singing-hollows',
  displayName: 'Singing Hollows',
  regionId: 'brackenreach',
  bounds: { x: 0, y: 0, width: 2560, height: 720 },
  defaultSpawnId: 'hollow-mouth-west',
  ambienceProfileId: 'singing-hollows-echo',
  rooms: [
    {
      id: 'hollow-mouth',
      displayName: 'Hollow Mouth',
      bounds: { x: 0, y: 0, width: 880, height: 720 },
      discoveryId: 'singing-hollows-mouth'
    },
    {
      id: 'dash-trial',
      displayName: 'Bramble Run',
      bounds: { x: 880, y: 0, width: 920, height: 720 },
      discoveryId: 'singing-hollows-bramble-run'
    },
    {
      id: 'resonant-basin',
      displayName: 'Resonant Basin',
      bounds: { x: 1800, y: 0, width: 760, height: 720 },
      discoveryId: 'singing-hollows-resonant-basin'
    }
  ],
  layers: standardLayers('singing-hollows'),
  surfaces: [
    {
      id: 'mouth-floor',
      roomId: 'hollow-mouth',
      kind: 'solid',
      collision: { x: 0, y: 566, width: 880, height: 154 },
      materialId: 'cave-slate'
    },
    {
      id: 'trial-floor-west',
      roomId: 'dash-trial',
      kind: 'solid',
      collision: { x: 880, y: 566, width: 300, height: 154 },
      materialId: 'cave-slate'
    },
    {
      id: 'trial-bramble-west',
      roomId: 'dash-trial',
      kind: 'hazard',
      collision: { x: 1180, y: 540, width: 130, height: 180 },
      materialId: 'bramble-thicket',
      damage: 8
    },
    {
      id: 'trial-floor-centre',
      roomId: 'dash-trial',
      kind: 'solid',
      collision: { x: 1180, y: 566, width: 420, height: 154 },
      materialId: 'cave-slate'
    },
    {
      id: 'trial-bramble-east',
      roomId: 'dash-trial',
      kind: 'hazard',
      collision: { x: 1470, y: 540, width: 130, height: 180 },
      materialId: 'bramble-thicket',
      damage: 8
    },
    {
      id: 'trial-floor-east',
      roomId: 'dash-trial',
      kind: 'solid',
      collision: { x: 1600, y: 566, width: 200, height: 154 },
      materialId: 'cave-slate'
    },
    {
      id: 'trial-upper-ledge',
      roomId: 'dash-trial',
      kind: 'one-way',
      collision: { x: 1240, y: 396, width: 300, height: 22 },
      materialId: 'moss-root'
    },
    {
      id: 'basin-floor',
      roomId: 'resonant-basin',
      kind: 'solid',
      collision: { x: 1800, y: 566, width: 760, height: 154 },
      materialId: 'cave-slate'
    },
    {
      id: 'basin-root-climb',
      roomId: 'resonant-basin',
      kind: 'climb',
      collision: { x: 2380, y: 380, width: 48, height: 186 },
      materialId: 'woven-root'
    }
  ],
  playerSpawns: [
    {
      id: 'hollow-mouth-west',
      roomId: 'hollow-mouth',
      position: { x: 90, y: 566 },
      facing: 'right'
    },
    {
      id: 'basin-east',
      roomId: 'resonant-basin',
      position: { x: 2470, y: 566 },
      facing: 'left'
    }
  ],
  actorSpawns: [
    {
      id: 'mouth-duskwing',
      roomId: 'hollow-mouth',
      actorId: 'duskwing',
      position: { x: 560, y: 420 },
      facing: 'left',
      encounterId: 'hollow-mouth-encounter'
    },
    {
      id: 'trial-rootlurker',
      roomId: 'dash-trial',
      actorId: 'rootlurker',
      position: { x: 1390, y: 566 },
      facing: 'left',
      encounterId: 'bramble-run-encounter'
    },
    {
      id: 'basin-spore-scribe',
      roomId: 'resonant-basin',
      actorId: 'spore-scribe',
      position: { x: 2160, y: 566 },
      facing: 'left',
      encounterId: 'resonant-basin-encounter'
    }
  ],
  triggers: [
    {
      id: 'hollow-mouth-entry',
      roomId: 'hollow-mouth',
      kind: 'room-entry',
      bounds: { x: 40, y: 120, width: 800, height: 446 },
      targetId: 'singing-hollows-mouth',
      once: true
    },
    {
      id: 'bramble-run-entry',
      roomId: 'dash-trial',
      kind: 'room-entry',
      bounds: { x: 920, y: 120, width: 840, height: 446 },
      targetId: 'singing-hollows-bramble-run',
      once: true
    },
    {
      id: 'resonant-basin-entry',
      roomId: 'resonant-basin',
      kind: 'room-entry',
      bounds: { x: 1840, y: 120, width: 680, height: 446 },
      targetId: 'singing-hollows-resonant-basin',
      once: true
    },
    {
      id: 'hollows-lantern-rest',
      roomId: 'hollow-mouth',
      kind: 'checkpoint',
      bounds: { x: 700, y: 424, width: 92, height: 142 },
      targetId: 'hollows-seed-lantern',
      once: false
    },
    {
      id: 'memorial-hollows-interact',
      roomId: 'resonant-basin',
      kind: 'interaction',
      bounds: { x: 1880, y: 404, width: 110, height: 162 },
      targetId: 'memorial-lantern-hollows',
      once: false
    },
    {
      id: 'hollows-west-boundary',
      roomId: 'hollow-mouth',
      kind: 'transition',
      bounds: { x: 0, y: 0, width: 28, height: 720 },
      targetId: 'hollows-to-trail',
      once: false
    },
    {
      id: 'hollows-east-boundary',
      roomId: 'resonant-basin',
      kind: 'transition',
      bounds: { x: 2532, y: 0, width: 28, height: 720 },
      targetId: 'hollows-to-verge',
      once: false
    }
  ],
  mechanisms: [
    {
      id: 'memorial-lantern-hollows',
      roomId: 'resonant-basin',
      kind: 'seed-lantern',
      position: { x: 1935, y: 566 },
      triggerId: 'memorial-hollows-interact',
      questId: 'lanterns-for-the-absent',
      persistentFlagId: 'memorial-lantern-hollows-lit'
    }
  ],
  checkpoints: [
    {
      id: 'hollows-seed-lantern',
      roomId: 'hollow-mouth',
      triggerId: 'hollows-lantern-rest',
      spawnId: 'hollow-mouth-west',
      position: { x: 746, y: 566 }
    }
  ],
  transitions: [
    {
      id: 'hollows-to-trail',
      roomId: 'hollow-mouth',
      triggerId: 'hollows-west-boundary',
      destinationAreaId: 'brackenreach-trail',
      destinationSpawnId: 'listening-arch-east'
    },
    {
      id: 'hollows-to-verge',
      roomId: 'resonant-basin',
      triggerId: 'hollows-east-boundary',
      destinationAreaId: 'reliquary-verge',
      destinationSpawnId: 'verge-west'
    }
  ],
  props: [
    terrainProp(
      'mouth-shelf',
      'hollow-mouth',
      -20,
      500,
      SHELF_SOURCES.west,
      { width: 470, height: 212 },
      'mouth-floor'
    ),
    terrainProp(
      'trial-shelf-west',
      'dash-trial',
      880,
      500,
      SHELF_SOURCES.centre,
      { width: 455, height: 228 },
      'trial-floor-west'
    ),
    terrainProp(
      'trial-shelf-east',
      'dash-trial',
      1330,
      500,
      SHELF_SOURCES.east,
      { width: 470, height: 217 },
      'trial-floor-east'
    ),
    terrainProp('trial-ledge-shelf', 'dash-trial', 1235, 372, SHELF_SOURCES.upper, {
      width: 310,
      height: 210
    }),
    terrainProp(
      'basin-shelf',
      'resonant-basin',
      1800,
      500,
      SHELF_SOURCES.west,
      { width: 470, height: 212 },
      'basin-floor'
    )
  ]
};
