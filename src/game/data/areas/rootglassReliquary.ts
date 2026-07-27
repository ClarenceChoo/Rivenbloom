import type { AreaDefinition } from '../types';
import { SHELF_SOURCES, standardLayers, terrainProp } from './shared';

/** Rootglass Reliquary — the dungeon: vestibule, flooded stacks, resonance gallery. */
export const rootglassReliquaryArea: AreaDefinition = {
  id: 'rootglass-reliquary',
  displayName: 'Rootglass Reliquary',
  regionId: 'brackenreach',
  bounds: { x: 0, y: 0, width: 3840, height: 720 },
  defaultSpawnId: 'vestibule-west',
  ambienceProfileId: 'reliquary-depths',
  rooms: [
    {
      id: 'vestibule',
      displayName: 'Vestibule',
      bounds: { x: 0, y: 0, width: 1280, height: 720 },
      discoveryId: 'reliquary-vestibule'
    },
    {
      id: 'flooded-stacks',
      displayName: 'Flooded Stacks',
      bounds: { x: 1280, y: 0, width: 1280, height: 720 },
      discoveryId: 'reliquary-flooded-stacks'
    },
    {
      id: 'folio-vault',
      displayName: 'Folio Vault',
      bounds: { x: 1580, y: 0, width: 360, height: 300 },
      discoveryId: 'reliquary-folio-vault'
    },
    {
      id: 'resonance-gallery',
      displayName: 'Resonance Gallery',
      bounds: { x: 2560, y: 0, width: 1280, height: 720 },
      discoveryId: 'reliquary-resonance-gallery'
    }
  ],
  layers: standardLayers('rootglass-reliquary'),
  surfaces: [
    {
      id: 'vestibule-floor',
      roomId: 'vestibule',
      kind: 'solid',
      collision: { x: 0, y: 566, width: 1280, height: 154 },
      materialId: 'rootglass-pane'
    },
    {
      id: 'stacks-floor-west',
      roomId: 'flooded-stacks',
      kind: 'solid',
      collision: { x: 1280, y: 566, width: 360, height: 154 },
      materialId: 'rootglass-pane'
    },
    {
      id: 'stacks-water',
      roomId: 'flooded-stacks',
      kind: 'water',
      collision: { x: 1640, y: 566, width: 560, height: 154 },
      materialId: 'still-water'
    },
    {
      id: 'stacks-floor-east',
      roomId: 'flooded-stacks',
      kind: 'solid',
      collision: { x: 2200, y: 566, width: 360, height: 154 },
      materialId: 'rootglass-pane'
    },
    {
      id: 'stacks-shelf-ledge',
      roomId: 'flooded-stacks',
      kind: 'one-way',
      collision: { x: 1700, y: 420, width: 260, height: 22 },
      materialId: 'moss-root'
    },
    {
      id: 'vault-ledge',
      roomId: 'folio-vault',
      kind: 'one-way',
      collision: { x: 1620, y: 260, width: 280, height: 22 },
      materialId: 'moss-root'
    },
    {
      id: 'stacks-root-climb',
      roomId: 'flooded-stacks',
      kind: 'climb',
      collision: { x: 1860, y: 260, width: 48, height: 306 },
      materialId: 'woven-root'
    },
    {
      id: 'vault-seal-surface',
      roomId: 'folio-vault',
      kind: 'solid',
      collision: { x: 1820, y: 114, width: 24, height: 146 },
      materialId: 'cracked-rootglass'
    },
    {
      id: 'gallery-floor',
      roomId: 'resonance-gallery',
      kind: 'solid',
      collision: { x: 2560, y: 566, width: 1280, height: 154 },
      materialId: 'rootglass-pane'
    },
    {
      id: 'gallery-shard-bed',
      roomId: 'resonance-gallery',
      kind: 'hazard',
      collision: { x: 3020, y: 540, width: 170, height: 180 },
      materialId: 'glass-shards',
      damage: 10
    },
    {
      id: 'gallery-ledge',
      roomId: 'resonance-gallery',
      kind: 'one-way',
      collision: { x: 2980, y: 400, width: 260, height: 22 },
      materialId: 'moss-root'
    }
  ],
  playerSpawns: [
    {
      id: 'vestibule-west',
      roomId: 'vestibule',
      position: { x: 90, y: 566 },
      facing: 'right'
    },
    {
      id: 'gallery-east',
      roomId: 'resonance-gallery',
      position: { x: 3750, y: 566 },
      facing: 'left'
    }
  ],
  actorSpawns: [
    {
      id: 'vestibule-barkbound',
      roomId: 'vestibule',
      actorId: 'barkbound',
      position: { x: 760, y: 566 },
      facing: 'left',
      encounterId: 'vestibule-encounter'
    },
    {
      id: 'stacks-rootlurker',
      roomId: 'flooded-stacks',
      actorId: 'rootlurker',
      position: { x: 2280, y: 566 },
      facing: 'left',
      encounterId: 'flooded-stacks-encounter'
    },
    {
      id: 'stacks-spore-scribe',
      roomId: 'flooded-stacks',
      actorId: 'spore-scribe',
      position: { x: 1420, y: 566 },
      facing: 'right',
      encounterId: 'flooded-stacks-encounter'
    },
    {
      id: 'gallery-scrapper',
      roomId: 'resonance-gallery',
      actorId: 'briar-scrapper',
      position: { x: 2900, y: 566 },
      facing: 'left',
      encounterId: 'resonance-gallery-encounter'
    },
    {
      id: 'gallery-duskwing',
      roomId: 'resonance-gallery',
      actorId: 'duskwing',
      position: { x: 3300, y: 400 },
      facing: 'left',
      encounterId: 'resonance-gallery-encounter'
    }
  ],
  triggers: [
    {
      id: 'vestibule-entry',
      roomId: 'vestibule',
      kind: 'room-entry',
      bounds: { x: 40, y: 120, width: 1200, height: 446 },
      targetId: 'reliquary-vestibule',
      once: true
    },
    {
      id: 'flooded-stacks-entry',
      roomId: 'flooded-stacks',
      kind: 'room-entry',
      bounds: { x: 1320, y: 300, width: 1200, height: 266 },
      targetId: 'reliquary-flooded-stacks',
      once: true
    },
    {
      id: 'folio-vault-entry',
      roomId: 'folio-vault',
      kind: 'discovery',
      bounds: { x: 1600, y: 140, width: 200, height: 120 },
      targetId: 'reliquary-folio-vault',
      once: true
    },
    {
      id: 'lost-folio-recovery',
      roomId: 'folio-vault',
      kind: 'quest',
      bounds: { x: 1620, y: 150, width: 150, height: 110 },
      targetId: 'lost-folio-quest',
      once: true
    },
    {
      id: 'resonance-gallery-entry',
      roomId: 'resonance-gallery',
      kind: 'room-entry',
      bounds: { x: 2600, y: 120, width: 1200, height: 446 },
      targetId: 'reliquary-resonance-gallery',
      once: true
    },
    {
      id: 'vestibule-lantern-rest',
      roomId: 'vestibule',
      kind: 'checkpoint',
      bounds: { x: 150, y: 424, width: 92, height: 142 },
      targetId: 'vestibule-seed-lantern',
      once: false
    },
    {
      id: 'gallery-lantern-rest',
      roomId: 'resonance-gallery',
      kind: 'checkpoint',
      bounds: { x: 2620, y: 424, width: 92, height: 142 },
      targetId: 'gallery-seed-lantern',
      once: false
    },
    {
      id: 'gallery-lens-west-zone',
      roomId: 'resonance-gallery',
      kind: 'interaction',
      bounds: { x: 2760, y: 360, width: 150, height: 206 },
      targetId: 'gallery-lens-west',
      once: false
    },
    {
      id: 'gallery-lens-east-zone',
      roomId: 'resonance-gallery',
      kind: 'interaction',
      bounds: { x: 3420, y: 360, width: 150, height: 206 },
      targetId: 'gallery-lens-east',
      once: false
    },
    {
      id: 'reliquary-west-boundary',
      roomId: 'vestibule',
      kind: 'transition',
      bounds: { x: 0, y: 0, width: 28, height: 720 },
      targetId: 'reliquary-to-verge',
      once: false
    },
    {
      id: 'reliquary-east-boundary',
      roomId: 'resonance-gallery',
      kind: 'transition',
      bounds: { x: 3812, y: 0, width: 28, height: 720 },
      targetId: 'reliquary-to-choir',
      once: false
    }
  ],
  mechanisms: [
    {
      id: 'gallery-lens-west',
      roomId: 'resonance-gallery',
      kind: 'lens',
      position: { x: 2835, y: 566 },
      triggerId: 'gallery-lens-west-zone',
      requiredAbilityId: 'resonant-pulse',
      questId: 'silent-bloom',
      persistentFlagId: 'gallery-lens-west-awake'
    },
    {
      id: 'gallery-lens-east',
      roomId: 'resonance-gallery',
      kind: 'lens',
      position: { x: 3495, y: 566 },
      triggerId: 'gallery-lens-east-zone',
      requiredAbilityId: 'resonant-pulse',
      questId: 'silent-bloom',
      persistentFlagId: 'gallery-lens-east-awake'
    }
  ],
  checkpoints: [
    {
      id: 'vestibule-seed-lantern',
      roomId: 'vestibule',
      triggerId: 'vestibule-lantern-rest',
      spawnId: 'vestibule-west',
      position: { x: 196, y: 566 }
    },
    {
      id: 'gallery-seed-lantern',
      roomId: 'resonance-gallery',
      triggerId: 'gallery-lantern-rest',
      spawnId: 'gallery-east',
      position: { x: 2666, y: 566 }
    }
  ],
  transitions: [
    {
      id: 'reliquary-to-verge',
      roomId: 'vestibule',
      triggerId: 'reliquary-west-boundary',
      destinationAreaId: 'reliquary-verge',
      destinationSpawnId: 'verge-east'
    },
    {
      id: 'reliquary-to-choir',
      roomId: 'resonance-gallery',
      triggerId: 'reliquary-east-boundary',
      destinationAreaId: 'hollow-choir',
      destinationSpawnId: 'antechamber-west'
    }
  ],
  props: [
    terrainProp(
      'vestibule-shelf',
      'vestibule',
      -20,
      500,
      SHELF_SOURCES.west,
      { width: 470, height: 212 },
      'vestibule-floor'
    ),
    terrainProp(
      'stacks-shelf-west',
      'flooded-stacks',
      1280,
      500,
      SHELF_SOURCES.centre,
      { width: 455, height: 228 },
      'stacks-floor-west'
    ),
    terrainProp(
      'stacks-shelf-east',
      'flooded-stacks',
      2130,
      500,
      SHELF_SOURCES.east,
      { width: 470, height: 217 },
      'stacks-floor-east'
    ),
    terrainProp('vault-shelf', 'folio-vault', 1610, 236, SHELF_SOURCES.upper, {
      width: 310,
      height: 210
    }),
    terrainProp(
      'gallery-shelf',
      'resonance-gallery',
      2560,
      500,
      SHELF_SOURCES.west,
      { width: 470, height: 212 },
      'gallery-floor'
    ),
    terrainProp('gallery-ledge-shelf', 'resonance-gallery', 2975, 376, SHELF_SOURCES.upper, {
      width: 310,
      height: 210
    }),
    terrainProp('vault-seal-prop', 'folio-vault', 1816, 110, SHELF_SOURCES.upper, {
      width: 32,
      height: 152
    })
  ],
  breakables: [
    {
      id: 'stacks-vault-seal',
      roomId: 'folio-vault',
      bounds: { x: 1820, y: 114, width: 24, height: 146 },
      health: 30,
      persistentFlagId: 'stacks-vault-seal-broken',
      surfaceId: 'vault-seal-surface',
      propId: 'vault-seal-prop'
    }
  ]
};
