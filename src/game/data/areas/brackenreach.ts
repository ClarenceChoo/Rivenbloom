import { stableId } from '../../core/StableId';
import { deepFreeze } from '../immutability';
import type { AreaDefinition, WorldPredicate } from '../types';
import { WORLD_ALWAYS } from '../../world/WorldPredicates';

export const BRACKENREACH_AREA: AreaDefinition = deepFreeze({
  areaId: stableId<'area'>('brackenreach'),
  regionId: stableId<'region'>('brackenreach'),
  displayName: 'Brackenreach',
  bounds: { x: 0, y: 0, width: 8960, height: 1440 },
  authoringGrid: 16,
  backgroundSetId: null,
  ambienceProfileId: null,
  musicCueId: null,
  layers: [],
  rooms: [
    room('brackenreach-trail', 'Brackenreach Trail', 0, 0, 2560, 720),
    room(
      'split-cedar-sanctum',
      'Split Cedar Sanctuary',
      2560,
      720,
      1280,
      720,
      'split-cedar-sanctum-discovery',
    ),
    room('listening-arch', 'Listening Arch', 3840, 0, 2560, 720),
    room('reliquary-verge', 'Reliquary Verge', 6400, 0, 2560, 720),
  ],
  surfaces: [
    floor('brackenreach-trail-floor', 'brackenreach-trail', 0, 608, 2560, 112),
    floor('split-cedar-sanctum-floor', 'split-cedar-sanctum', 2560, 1328, 1280, 112),
    floor('listening-arch-floor', 'listening-arch', 3840, 608, 2560, 112),
    floor('reliquary-verge-floor', 'reliquary-verge', 6400, 608, 2560, 112),
    oneWay('trail-rain-shelf', 'brackenreach-trail', 1216, 432, 384, 24),
    oneWay('arch-upper-step', 'listening-arch', 4672, 384, 416, 24),
  ],
  zones: [climb('split-cedar-root-climb', 'split-cedar-sanctum', 2784, 960, 64, 368)],
  actorSpawns: [
    spawn(
      'trail-briar-west',
      'briar-scrapper',
      'brackenreach-trail',
      1184,
      608,
      'right',
      'trail-briar-crossing',
    ),
    spawn(
      'trail-briar-east',
      'briar-scrapper',
      'brackenreach-trail',
      1600,
      608,
      'left',
      'trail-briar-crossing',
    ),
    spawn(
      'arch-rain-briar',
      'briar-scrapper',
      'listening-arch',
      4928,
      608,
      'right',
      'arch-rain-steps',
    ),
    spawn(
      'arch-rain-scribe',
      'spore-scribe',
      'listening-arch',
      5504,
      608,
      'left',
      'arch-rain-steps',
    ),
    spawn(
      'verge-thorn-sentinel',
      'thorn-sentinel',
      'reliquary-verge',
      7680,
      608,
      'left',
      'verge-sentinel-gate',
    ),
  ],
  triggers: [
    restTrigger('brackenreach-trailhead', 'brackenreach-trail', 176, 448, 160, 176),
    restTrigger('listening-arch-lantern', 'listening-arch', 4016, 448, 160, 176),
    restTrigger('reliquary-verge-lantern', 'reliquary-verge', 6576, 448, 160, 176),
    factTrigger(
      'light-absent-lantern-trail',
      'brackenreach-trail',
      2160,
      448,
      160,
      176,
      'interact',
      'absent-lantern-trail-lit',
    ),
    factTrigger(
      'trace-listening-arch',
      'listening-arch',
      4096,
      352,
      320,
      256,
      'enter',
      'listening-arch-traced',
    ),
  ],
  mechanisms: [
    {
      mechanismId: stableId<'mechanism'>('listening-arch-homeward-latch'),
      kind: 'shortcut',
      roomId: stableId<'room'>('listening-arch'),
      bounds: { x: 4384, y: 448, width: 128, height: 160 },
      shortcutId: stableId<'shortcut'>('listening-arch-homeward-route'),
      requiredAbilityId: null,
      requiredFactId: stableId<'quest-flag'>('listening-arch-traced'),
    },
  ],
  checkpoints: [
    checkpoint('brackenreach-trailhead', 'Trailhead Seed-Lantern', 'brackenreach-trail', 256, 608),
    checkpoint(
      'listening-arch-lantern',
      'Listening Arch Seed-Lantern',
      'listening-arch',
      4096,
      608,
    ),
    checkpoint(
      'reliquary-verge-lantern',
      'Reliquary Verge Seed-Lantern',
      'reliquary-verge',
      6656,
      608,
    ),
  ],
  transitions: [
    areaTransition(
      'brackenreach-to-wren-rest',
      'brackenreach-trail',
      0,
      448,
      64,
      160,
      'enter',
      'wren-rest',
      'village-well',
    ),
    areaTransition(
      'listening-arch-homeward-to-wren',
      'listening-arch',
      4512,
      448,
      64,
      160,
      'interact',
      'wren-rest',
      'village-well',
      requires({
        requiresActivatedShortcuts: [stableId<'shortcut'>('listening-arch-homeward-route')],
      }),
    ),
    areaTransition(
      'listening-arch-to-hollows',
      'listening-arch',
      6336,
      448,
      64,
      160,
      'enter',
      'singing-hollows',
      'hollows-mouth-lantern',
      requires({ requiresFacts: [stableId<'quest-flag'>('listening-arch-traced')] }),
    ),
    areaTransition(
      'reliquary-verge-to-root-memory',
      'reliquary-verge',
      6400,
      448,
      64,
      160,
      'enter',
      'singing-hollows',
      'root-memory-lantern',
    ),
    areaTransition(
      'reliquary-verge-to-rootglass',
      'reliquary-verge',
      8896,
      448,
      64,
      160,
      'enter',
      'rootglass-reliquary',
      'rootglass-vestibule-lantern',
      requires({ requiresFacts: [stableId<'quest-flag'>('surveyor-edge-reforged')] }),
    ),
    roomTransition(
      'trail-to-split-cedar-sanctum',
      'brackenreach-trail',
      2048,
      448,
      64,
      160,
      'interact',
      'split-cedar-sanctum',
      2688,
      1328,
      'right',
      requires({
        requiresActivatedShortcuts: [stableId<'shortcut'>('split-cedar-root-knot-open')],
      }),
    ),
    roomTransition(
      'split-cedar-sanctum-to-trail',
      'split-cedar-sanctum',
      2560,
      1168,
      64,
      160,
      'enter',
      'brackenreach-trail',
      1920,
      608,
      'left',
    ),
    roomTransition(
      'trail-to-listening-arch',
      'brackenreach-trail',
      2496,
      448,
      64,
      160,
      'enter',
      'listening-arch',
      3904,
      608,
      'right',
    ),
    roomTransition(
      'listening-arch-to-trail',
      'listening-arch',
      3840,
      448,
      64,
      160,
      'enter',
      'brackenreach-trail',
      2432,
      608,
      'left',
    ),
  ],
  encounters: [
    encounter('trail-briar-crossing', 'brackenreach-trail', 768, 320, 1280, 288, [
      'trail-briar-west',
      'trail-briar-east',
    ]),
    encounter('arch-rain-steps', 'listening-arch', 4480, 288, 1280, 320, [
      'arch-rain-briar',
      'arch-rain-scribe',
    ]),
    encounter(
      'verge-sentinel-gate',
      'reliquary-verge',
      7168,
      288,
      1280,
      320,
      ['verge-thorn-sentinel'],
      requires({ excludesFacts: [stableId<'quest-flag'>('briar-core-claimed')] }),
      [{ kind: 'set-fact', factId: stableId<'quest-flag'>('briar-core-claimed') }],
    ),
  ],
  chests: [
    chest('trail-wayfarer-cache', 'brackenreach-trail', 848, 528, 'Open Wayfarer Cache', [
      { kind: 'grant-currency', amount: 20 },
    ]),
    chest('listening-arch-survey-cache', 'listening-arch', 5824, 528, 'Open Survey Cache', [
      { kind: 'grant-currency', amount: 30 },
    ]),
    chest('split-cedar-resin-cache', 'split-cedar-sanctum', 3008, 1248, 'Open Resin Cache', [
      { kind: 'grant-currency', amount: 25 },
    ]),
  ],
  discoveries: [
    {
      discoveryId: stableId<'discovery'>('split-cedar-sanctum-discovery'),
      displayName: "The Split Cedar's Heart",
      description: 'A rain-silver sanctuary nested inside a cedar divided by living roots.',
      roomId: stableId<'room'>('split-cedar-sanctum'),
      activation: 'room-entry',
      bounds: null,
      predicate: WORLD_ALWAYS,
      rewardCommands: [{ kind: 'grant-xp', amount: 20 }],
    },
  ],
  breakables: [
    {
      breakableId: stableId<'breakable'>('split-cedar-root-knot'),
      displayName: 'Root Knot',
      roomId: stableId<'room'>('brackenreach-trail'),
      bounds: { x: 1984, y: 448, width: 64, height: 160 },
      acceptedAttackIds: [
        stableId<'attack'>('mara-charged-heavy'),
        stableId<'attack'>('resonant-pulse-wave'),
      ],
      shortcutId: stableId<'shortcut'>('split-cedar-root-knot-open'),
    },
  ],
  props: [],
} satisfies AreaDefinition);

function room(
  id: string,
  displayName: string,
  x: number,
  y: number,
  width: number,
  height: number,
  discoveryId: string | null = null,
) {
  return {
    roomId: stableId<'room'>(id),
    displayName,
    bounds: { x, y, width, height },
    cameraBounds: { x, y, width, height },
    discoveryId: discoveryId === null ? null : stableId<'discovery'>(discoveryId),
  } as const;
}

function floor(id: string, roomId: string, x: number, y: number, width: number, height: number) {
  return {
    surfaceId: stableId<'surface'>(id),
    kind: 'solid',
    roomId: stableId<'room'>(roomId),
    bounds: { x, y, width, height },
    materialId: stableId<'material'>('loam-stone'),
  } as const;
}

function oneWay(id: string, roomId: string, x: number, y: number, width: number, height: number) {
  return {
    ...floor(id, roomId, x, y, width, height),
    kind: 'one-way',
    materialId: stableId<'material'>('rootwood'),
  } as const;
}

function climb(id: string, roomId: string, x: number, y: number, width: number, height: number) {
  return {
    zoneId: stableId<'zone'>(id),
    kind: 'climb',
    roomId: stableId<'room'>(roomId),
    bounds: { x, y, width, height },
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
      areaId: stableId<'area'>('brackenreach'),
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
  predicate: WorldPredicate = WORLD_ALWAYS,
  completionCommands: readonly import('../../world/WorldProgression').ProgressionCommand[] = [],
) {
  return {
    encounterId: stableId<'encounter'>(encounterId),
    roomId: stableId<'room'>(roomId),
    activationBounds: { x, y, width, height },
    spawnIds: spawnIds.map((id) => stableId<'actor-spawn'>(id)),
    predicate,
    completionCommands,
  } as const;
}

function chest(
  chestId: string,
  roomId: string,
  x: number,
  y: number,
  prompt: string,
  rewardCommands: readonly import('../../world/WorldProgression').ProgressionCommand[],
) {
  return {
    chestId: stableId<'chest'>(chestId),
    roomId: stableId<'room'>(roomId),
    bounds: { x, y, width: 96, height: 80 },
    prompt,
    predicate: WORLD_ALWAYS,
    rewardCommands,
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
