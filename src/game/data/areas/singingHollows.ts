import { stableId } from '../../core/StableId';
import { deepFreeze } from '../immutability';
import type { AreaDefinition, WorldPredicate } from '../types';
import { WORLD_ALWAYS } from '../../world/WorldPredicates';

export const SINGING_HOLLOWS_AREA: AreaDefinition = deepFreeze({
  areaId: stableId<'area'>('singing-hollows'),
  regionId: stableId<'region'>('brackenreach'),
  displayName: 'Singing Hollows',
  bounds: { x: 0, y: 0, width: 5440, height: 1800 },
  authoringGrid: 4,
  backgroundSetId: null,
  ambienceProfileId: null,
  musicCueId: null,
  layers: [],
  rooms: [
    room('hollows-mouth', 'Hollows Mouth', 0, 0, 1920, 900),
    room('echo-pool', 'Echo Pool', 1920, 0, 1600, 900),
    room('root-memory-chamber', 'Root-Memory Chamber', 3520, 0, 1920, 900),
    room('dash-trial', 'Wayfinder Dash Trial', 3520, 900, 1920, 900),
  ],
  surfaces: [
    floor('hollows-mouth-floor', 'hollows-mouth', 0, 788, 1920, 112),
    floor('echo-pool-floor', 'echo-pool', 1920, 788, 1600, 112),
    floor('root-memory-floor', 'root-memory-chamber', 3520, 788, 1920, 112),
    floor('dash-trial-floor', 'dash-trial', 3520, 1688, 1920, 112),
    oneWay('hollows-rib-ledge', 'hollows-mouth', 704, 560, 384, 24),
    oneWay('echo-pool-ledge', 'echo-pool', 2784, 512, 384, 24),
    oneWay('dash-trial-rib', 'dash-trial', 4320, 1440, 512, 24),
  ],
  zones: [
    {
      zoneId: stableId<'zone'>('echo-pool-water'),
      kind: 'water',
      roomId: stableId<'room'>('echo-pool'),
      bounds: { x: 2464, y: 736, width: 640, height: 52 },
    },
    {
      zoneId: stableId<'zone'>('dash-trial-rib-climb'),
      kind: 'climb',
      roomId: stableId<'room'>('dash-trial'),
      bounds: { x: 4544, y: 1440, width: 64, height: 248 },
    },
    {
      zoneId: stableId<'zone'>('hollows-bramble-gate'),
      kind: 'hazard',
      roomId: stableId<'room'>('root-memory-chamber'),
      bounds: { x: 5120, y: 628, width: 192, height: 160 },
      attackId: stableId<'attack'>('bramble-thorn-contact'),
    },
  ],
  actorSpawns: [
    spawn(
      'hollows-rib-duskwing',
      'duskwing',
      'hollows-mouth',
      896,
      520,
      'right',
      'hollows-rib-crossing',
    ),
    spawn(
      'hollows-rib-briar',
      'briar-scrapper',
      'hollows-mouth',
      1376,
      788,
      'left',
      'hollows-rib-crossing',
    ),
    spawn(
      'echo-pool-rootlurker',
      'rootlurker',
      'echo-pool',
      2512,
      788,
      'right',
      'echo-pool-ambush',
    ),
    spawn('echo-pool-duskwing', 'duskwing', 'echo-pool', 3104, 520, 'left', 'echo-pool-ambush'),
  ],
  triggers: [
    restTrigger('hollows-mouth-lantern', 'hollows-mouth', 176, 628, 160, 176),
    restTrigger('root-memory-lantern', 'root-memory-chamber', 3696, 628, 160, 176),
    factTrigger(
      'light-absent-lantern-hollows',
      'echo-pool',
      2064,
      628,
      160,
      176,
      'interact',
      'absent-lantern-hollows-lit',
    ),
    factTrigger(
      'recover-root-memory',
      'root-memory-chamber',
      4096,
      628,
      160,
      176,
      'interact',
      'root-memory-recovered',
    ),
  ],
  mechanisms: [
    puzzleMechanism(
      'dash-circuit-dew-plate',
      'dash-trial',
      3840,
      1624,
      128,
      64,
      'hollows-dash-circuit',
    ),
    puzzleMechanism(
      'dash-circuit-rib-plate',
      'dash-trial',
      4384,
      1376,
      128,
      64,
      'hollows-dash-circuit',
    ),
    puzzleMechanism(
      'dash-circuit-song-plate',
      'dash-trial',
      4928,
      1624,
      128,
      64,
      'hollows-dash-circuit',
    ),
  ],
  checkpoints: [
    checkpoint('hollows-mouth-lantern', 'Hollows Mouth Seed-Lantern', 'hollows-mouth', 256, 788),
    checkpoint('root-memory-lantern', 'Root-Memory Seed-Lantern', 'root-memory-chamber', 3776, 788),
  ],
  transitions: [
    areaTransition(
      'hollows-mouth-to-listening-arch',
      'hollows-mouth',
      0,
      628,
      64,
      160,
      'enter',
      'brackenreach',
      'listening-arch-lantern',
    ),
    areaTransition(
      'root-memory-to-reliquary-verge',
      'root-memory-chamber',
      5376,
      628,
      64,
      160,
      'enter',
      'brackenreach',
      'reliquary-verge-lantern',
      requires({
        requiresAbilities: [stableId<'ability'>('wayfinder-dash')],
        requiresFacts: [stableId<'quest-flag'>('wayfinder-dash-awakened')],
      }),
    ),
    roomTransition(
      'hollows-mouth-to-echo-pool',
      'hollows-mouth',
      1856,
      628,
      64,
      160,
      'enter',
      'echo-pool',
      1984,
      788,
      'right',
    ),
    roomTransition(
      'echo-pool-to-hollows-mouth',
      'echo-pool',
      1920,
      628,
      64,
      160,
      'enter',
      'hollows-mouth',
      1792,
      788,
      'left',
    ),
    roomTransition(
      'echo-pool-to-root-memory',
      'echo-pool',
      3456,
      628,
      64,
      160,
      'enter',
      'root-memory-chamber',
      3584,
      788,
      'right',
    ),
    roomTransition(
      'root-memory-to-echo-pool',
      'root-memory-chamber',
      3520,
      628,
      64,
      160,
      'enter',
      'echo-pool',
      3392,
      788,
      'left',
    ),
    roomTransition(
      'root-memory-to-dash-trial',
      'root-memory-chamber',
      4400,
      724,
      160,
      64,
      'interact',
      'dash-trial',
      4480,
      1688,
      'right',
      requires({ requiresFacts: [stableId<'quest-flag'>('root-memory-recovered')] }),
    ),
    roomTransition(
      'dash-trial-to-root-memory',
      'dash-trial',
      4400,
      1528,
      160,
      160,
      'interact',
      'root-memory-chamber',
      4480,
      788,
      'left',
    ),
  ],
  encounters: [
    encounter('hollows-rib-crossing', 'hollows-mouth', 512, 400, 1152, 388, [
      'hollows-rib-duskwing',
      'hollows-rib-briar',
    ]),
    encounter('echo-pool-ambush', 'echo-pool', 2240, 400, 1120, 388, [
      'echo-pool-rootlurker',
      'echo-pool-duskwing',
    ]),
  ],
  chests: [],
  discoveries: [
    {
      discoveryId: stableId<'discovery'>('echo-pool-heart-petal'),
      displayName: 'Heart Petal',
      description: 'A living petal grown where the Hollows gather their oldest rain.',
      roomId: stableId<'room'>('echo-pool'),
      activation: 'interact',
      bounds: { x: 3264, y: 724, width: 64, height: 64 },
      predicate: requires({ excludesFacts: [stableId<'quest-flag'>('heart-petal-claimed')] }),
      rewardCommands: [
        { kind: 'increase-health', amount: 20 },
        { kind: 'set-fact', factId: stableId<'quest-flag'>('heart-petal-claimed') },
      ],
    },
  ],
  breakables: [],
  props: [],
} satisfies AreaDefinition);

function room(
  id: string,
  displayName: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  return {
    roomId: stableId<'room'>(id),
    displayName,
    bounds: { x, y, width, height },
    cameraBounds: { x, y, width, height },
    discoveryId: null,
  } as const;
}

function floor(id: string, roomId: string, x: number, y: number, width: number, height: number) {
  return {
    surfaceId: stableId<'surface'>(id),
    kind: 'solid',
    roomId: stableId<'room'>(roomId),
    bounds: { x, y, width, height },
    materialId: stableId<'material'>('rootglass-stone'),
  } as const;
}

function oneWay(id: string, roomId: string, x: number, y: number, width: number, height: number) {
  return {
    ...floor(id, roomId, x, y, width, height),
    kind: 'one-way',
    materialId: stableId<'material'>('rootwood'),
  } as const;
}

function checkpoint(id: string, displayName: string, roomId: string, x: number, y: number) {
  return {
    checkpointId: stableId<'checkpoint'>(id),
    displayName,
    roomId: stableId<'room'>(roomId),
    interactionPosition: { x, y },
    safeZone: { x: x - 64, y: y - 128, width: 128, height: 160 },
    canonicalPosition: { x, y },
    facing: 'right',
  } as const;
}

function restTrigger(
  checkpointId: string,
  roomId: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  return {
    triggerId: stableId<'trigger'>(`rest-at-${checkpointId}`),
    roomId: stableId<'room'>(roomId),
    bounds: { x, y, width, height },
    activation: 'interact',
    action: {
      kind: 'activate-checkpoint',
      areaId: stableId<'area'>('singing-hollows'),
      checkpointId: stableId<'checkpoint'>(checkpointId),
    },
  } as const;
}

function factTrigger(
  id: string,
  roomId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  activation: 'enter' | 'interact',
  factId: string,
) {
  return {
    triggerId: stableId<'trigger'>(id),
    roomId: stableId<'room'>(roomId),
    bounds: { x, y, width, height },
    activation,
    action: { kind: 'set-fact', factId: stableId<'quest-flag'>(factId) },
  } as const;
}

function puzzleMechanism(
  mechanismId: string,
  roomId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  puzzleId: string,
) {
  return {
    mechanismId: stableId<'mechanism'>(mechanismId),
    kind: 'puzzle',
    roomId: stableId<'room'>(roomId),
    bounds: { x, y, width, height },
    puzzleId: stableId<'puzzle'>(puzzleId),
    requiredAbilityId: null,
    requiredFactId: null,
  } as const;
}

function spawn(
  spawnId: string,
  actorId: string,
  roomId: string,
  x: number,
  y: number,
  facing: 'left' | 'right',
  encounterId: string,
) {
  return {
    spawnId: stableId<'actor-spawn'>(spawnId),
    actorId: stableId<'actor'>(actorId),
    roomId: stableId<'room'>(roomId),
    position: { x, y },
    facing,
    encounterId: stableId<'encounter'>(encounterId),
  } as const;
}

function encounter(
  encounterId: string,
  roomId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  spawnIds: readonly string[],
) {
  return {
    encounterId: stableId<'encounter'>(encounterId),
    roomId: stableId<'room'>(roomId),
    activationBounds: { x, y, width, height },
    spawnIds: spawnIds.map((id) => stableId<'actor-spawn'>(id)),
    predicate: WORLD_ALWAYS,
    completionCommands: [],
  } as const;
}

function requires(patch: Partial<WorldPredicate>): WorldPredicate {
  return { ...WORLD_ALWAYS, ...patch };
}

function areaTransition(
  id: string,
  roomId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  activation: 'enter' | 'interact',
  targetAreaId: string,
  targetCheckpointId: string,
  predicate: WorldPredicate = WORLD_ALWAYS,
) {
  return {
    kind: 'area',
    transitionId: stableId<'transition'>(id),
    roomId: stableId<'room'>(roomId),
    bounds: { x, y, width, height },
    activation,
    targetAreaId: stableId<'area'>(targetAreaId),
    targetCheckpointId: stableId<'checkpoint'>(targetCheckpointId),
    predicate,
  } as const;
}

function roomTransition(
  id: string,
  roomId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  activation: 'enter' | 'interact',
  targetRoomId: string,
  targetX: number,
  targetY: number,
  targetFacing: 'left' | 'right',
  predicate: WorldPredicate = WORLD_ALWAYS,
) {
  return {
    kind: 'room',
    transitionId: stableId<'transition'>(id),
    roomId: stableId<'room'>(roomId),
    bounds: { x, y, width, height },
    activation,
    targetRoomId: stableId<'room'>(targetRoomId),
    targetPosition: { x: targetX, y: targetY },
    targetFacing,
    predicate,
  } as const;
}
