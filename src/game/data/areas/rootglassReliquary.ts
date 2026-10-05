import { stableId } from '../../core/StableId';
import { deepFreeze } from '../immutability';
import type { AreaDefinition, WorldPredicate } from '../types';
import { WORLD_ALWAYS } from '../../world/WorldPredicates';

export const ROOTGLASS_RELIQUARY_AREA: AreaDefinition = deepFreeze({
  areaId: stableId<'area'>('rootglass-reliquary'),
  regionId: stableId<'region'>('brackenreach'),
  displayName: 'Rootglass Reliquary',
  bounds: { x: 0, y: 0, width: 8960, height: 1980 },
  authoringGrid: 4,
  backgroundSetId: null,
  ambienceProfileId: null,
  musicCueId: null,
  layers: [],
  rooms: [
    room('rootglass-vestibule', 'Rootglass Vestibule', 0, 0, 1920, 1080),
    room('west-archive', 'West Archive', 1920, 0, 1600, 1080),
    room('east-lens-vault', 'East Lens Vault', 3520, 0, 1600, 1080),
    room('flooded-stacks', 'Flooded Stacks', 5120, 0, 1920, 1080),
    room('folio-vault', 'Folio Vault', 5120, 1080, 1280, 900, 'folio-vault-discovery'),
    room('resonance-gallery', 'Resonance Gallery', 7040, 0, 1920, 1080),
  ],
  surfaces: [
    floor('rootglass-vestibule-floor', 'rootglass-vestibule', 0, 900, 1920, 180),
    floor('west-archive-floor', 'west-archive', 1920, 900, 1600, 180),
    floor('east-lens-vault-floor', 'east-lens-vault', 3520, 900, 1600, 180),
    floor('flooded-stacks-floor', 'flooded-stacks', 5120, 900, 1920, 180),
    floor('folio-vault-floor', 'folio-vault', 5120, 1868, 1280, 112),
    floor('resonance-gallery-floor', 'resonance-gallery', 7040, 900, 1920, 180),
    oneWay('west-archive-shelf', 'west-archive', 2432, 624, 384, 24),
    oneWay('flooded-stacks-shelf', 'flooded-stacks', 5760, 592, 512, 24),
    oneWay('resonance-gallery-ledge', 'resonance-gallery', 7744, 560, 512, 24),
  ],
  zones: [
    {
      zoneId: stableId<'zone'>('flooded-stacks-ladder'),
      kind: 'climb',
      roomId: stableId<'room'>('flooded-stacks'),
      bounds: { x: 5888, y: 540, width: 64, height: 360 },
    },
    {
      zoneId: stableId<'zone'>('flooded-stacks-water'),
      kind: 'water',
      roomId: stableId<'room'>('flooded-stacks'),
      bounds: { x: 5440, y: 820, width: 1152, height: 80 },
    },
    {
      zoneId: stableId<'zone'>('rootglass-silt-bed'),
      kind: 'hazard',
      roomId: stableId<'room'>('flooded-stacks'),
      bounds: { x: 6400, y: 820, width: 192, height: 80 },
      attackId: stableId<'attack'>('rootglass-silt-contact'),
    },
  ],
  actorSpawns: [
    spawn(
      'stacks-sunk-barkbound',
      'barkbound',
      'flooded-stacks',
      5888,
      900,
      'right',
      'stacks-sunk-index',
    ),
    spawn(
      'stacks-sunk-scribe',
      'spore-scribe',
      'flooded-stacks',
      6464,
      900,
      'left',
      'stacks-sunk-index',
    ),
    spawn(
      'gallery-guard-barkbound',
      'barkbound',
      'resonance-gallery',
      7808,
      900,
      'right',
      'gallery-resonance-guard',
    ),
    spawn(
      'gallery-guard-rootlurker',
      'rootlurker',
      'resonance-gallery',
      8384,
      900,
      'left',
      'gallery-resonance-guard',
    ),
  ],
  triggers: [
    restTrigger('rootglass-vestibule-lantern', 'rootglass-vestibule', 176, 720, 160, 180),
    restTrigger('flooded-stacks-lantern', 'flooded-stacks', 5296, 720, 160, 180),
    restTrigger('resonance-gallery-lantern', 'resonance-gallery', 7216, 720, 160, 180),
    factTrigger(
      'enter-rootglass-reliquary',
      'rootglass-vestibule',
      192,
      720,
      320,
      180,
      'enter',
      'rootglass-reliquary-entered',
    ),
    factTrigger(
      'light-absent-lantern-reliquary',
      'flooded-stacks',
      6672,
      720,
      160,
      180,
      'interact',
      'absent-lantern-reliquary-lit',
    ),
  ],
  mechanisms: [
    puzzleMechanism(
      'vestibule-index-lock',
      'rootglass-vestibule',
      1376,
      720,
      64,
      180,
      'vestibule-index-seal',
    ),
    puzzleMechanism(
      'reliquary-forge-anvil',
      'rootglass-vestibule',
      896,
      720,
      128,
      180,
      'reliquary-forge-awakening',
    ),
    puzzleMechanism(
      'east-lens-root-dial',
      'east-lens-vault',
      3840,
      720,
      96,
      180,
      'east-lens-alignment',
    ),
    puzzleMechanism(
      'east-lens-rain-dial',
      'east-lens-vault',
      4224,
      720,
      96,
      180,
      'east-lens-alignment',
    ),
    puzzleMechanism(
      'east-lens-bloom-dial',
      'east-lens-vault',
      4608,
      720,
      96,
      180,
      'east-lens-alignment',
    ),
    puzzleMechanism(
      'gallery-memory-lens',
      'resonance-gallery',
      7424,
      720,
      128,
      180,
      'gallery-choir-seal',
      'resonant-pulse',
      null,
    ),
    puzzleMechanism(
      'gallery-breath-lens',
      'resonance-gallery',
      7808,
      720,
      128,
      180,
      'gallery-choir-seal',
      'resonant-pulse',
      null,
    ),
    puzzleMechanism(
      'gallery-song-lens',
      'resonance-gallery',
      8192,
      720,
      128,
      180,
      'gallery-choir-seal',
    ),
  ],
  checkpoints: [
    checkpoint(
      'rootglass-vestibule-lantern',
      'Vestibule Seed-Lantern',
      'rootglass-vestibule',
      256,
      900,
    ),
    checkpoint(
      'flooded-stacks-lantern',
      'Flooded Stacks Seed-Lantern',
      'flooded-stacks',
      5376,
      900,
    ),
    checkpoint('resonance-gallery-lantern', 'Gallery Seed-Lantern', 'resonance-gallery', 7296, 900),
  ],
  transitions: [
    areaTransition(
      'rootglass-to-reliquary-verge',
      'rootglass-vestibule',
      0,
      720,
      64,
      180,
      'enter',
      'brackenreach',
      'reliquary-verge-lantern',
    ),
    areaTransition(
      'resonance-gallery-to-hollow-choir',
      'resonance-gallery',
      8896,
      720,
      64,
      180,
      'enter',
      'hollow-choir',
      'choir-threshold-lantern',
      requires({ requiresSolvedPuzzles: [stableId<'puzzle'>('gallery-choir-seal')] }),
    ),
    roomTransition(
      'vestibule-to-west-archive',
      'rootglass-vestibule',
      1856,
      720,
      64,
      180,
      'enter',
      'west-archive',
      1984,
      900,
      'right',
    ),
    roomTransition(
      'west-archive-to-vestibule',
      'west-archive',
      1920,
      720,
      64,
      180,
      'enter',
      'rootglass-vestibule',
      1792,
      900,
      'left',
    ),
    roomTransition(
      'vestibule-to-east-lens-vault',
      'rootglass-vestibule',
      1376,
      720,
      64,
      180,
      'interact',
      'east-lens-vault',
      3584,
      900,
      'right',
      requires({ requiresSolvedPuzzles: [stableId<'puzzle'>('vestibule-index-seal')] }),
    ),
    roomTransition(
      'east-lens-vault-to-vestibule',
      'east-lens-vault',
      3520,
      720,
      64,
      180,
      'enter',
      'rootglass-vestibule',
      1312,
      900,
      'left',
    ),
    roomTransition(
      'east-lens-vault-to-flooded-stacks',
      'east-lens-vault',
      5056,
      720,
      64,
      180,
      'enter',
      'flooded-stacks',
      5184,
      900,
      'right',
      requires({ requiresSolvedPuzzles: [stableId<'puzzle'>('east-lens-alignment')] }),
    ),
    roomTransition(
      'flooded-stacks-to-east-lens-vault',
      'flooded-stacks',
      5120,
      720,
      64,
      180,
      'enter',
      'east-lens-vault',
      4992,
      900,
      'left',
    ),
    roomTransition(
      'flooded-stacks-to-folio-vault',
      'flooded-stacks',
      6272,
      720,
      64,
      180,
      'interact',
      'folio-vault',
      5248,
      1868,
      'right',
      requires({
        requiresActivatedShortcuts: [stableId<'shortcut'>('flooded-stacks-silt-wall-open')],
      }),
    ),
    roomTransition(
      'folio-vault-to-flooded-stacks',
      'folio-vault',
      5120,
      1688,
      64,
      180,
      'enter',
      'flooded-stacks',
      6144,
      900,
      'left',
    ),
    roomTransition(
      'flooded-stacks-to-resonance-gallery',
      'flooded-stacks',
      6976,
      720,
      64,
      180,
      'enter',
      'resonance-gallery',
      7104,
      900,
      'right',
    ),
    roomTransition(
      'resonance-gallery-to-flooded-stacks',
      'resonance-gallery',
      7040,
      720,
      64,
      180,
      'enter',
      'flooded-stacks',
      6912,
      900,
      'left',
    ),
  ],
  encounters: [
    encounter('stacks-sunk-index', 'flooded-stacks', 5504, 480, 1280, 420, [
      'stacks-sunk-barkbound',
      'stacks-sunk-scribe',
    ]),
    encounter('gallery-resonance-guard', 'resonance-gallery', 7424, 480, 1280, 420, [
      'gallery-guard-barkbound',
      'gallery-guard-rootlurker',
    ]),
  ],
  chests: [
    chest('west-archive-index-chest', 'west-archive', 3104, 820, 'Open Index Chest', [
      { kind: 'grant-item', itemId: stableId<'item'>('rootglass-index-key'), quantity: 1 },
    ]),
    chest('folio-vault-cartographer-chest', 'folio-vault', 5792, 1788, "Recover Sela's Folio", [
      { kind: 'grant-item', itemId: stableId<'item'>('cartographers-folio'), quantity: 1 },
      { kind: 'set-fact', factId: stableId<'quest-flag'>('cartographers-folio-found') },
    ]),
  ],
  discoveries: [
    {
      discoveryId: stableId<'discovery'>('east-lens-wellspring-seed'),
      displayName: 'Wellspring Seed',
      description: 'A clear seed humming with rain caught beneath the Rootglass.',
      roomId: stableId<'room'>('east-lens-vault'),
      activation: 'interact',
      bounds: { x: 4832, y: 836, width: 64, height: 64 },
      predicate: requires({ excludesFacts: [stableId<'quest-flag'>('wellspring-seed-claimed')] }),
      rewardCommands: [
        { kind: 'increase-mana', amount: 8 },
        { kind: 'set-fact', factId: stableId<'quest-flag'>('wellspring-seed-claimed') },
      ],
    },
    {
      discoveryId: stableId<'discovery'>('folio-vault-discovery'),
      displayName: 'The Sealed Folio Vault',
      description: 'A dry archive chamber spared from the flooded stacks below.',
      roomId: stableId<'room'>('folio-vault'),
      activation: 'room-entry',
      bounds: null,
      predicate: WORLD_ALWAYS,
      rewardCommands: [],
    },
  ],
  breakables: [
    {
      breakableId: stableId<'breakable'>('flooded-stacks-silt-wall'),
      displayName: 'Silt Wall',
      roomId: stableId<'room'>('flooded-stacks'),
      bounds: { x: 6208, y: 720, width: 64, height: 180 },
      acceptedAttackIds: [
        stableId<'attack'>('mara-charged-heavy'),
        stableId<'attack'>('resonant-pulse-wave'),
      ],
      shortcutId: stableId<'shortcut'>('flooded-stacks-silt-wall-open'),
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
    materialId: stableId<'material'>('rootglass-stone'),
  } as const;
}

function oneWay(id: string, roomId: string, x: number, y: number, width: number, height: number) {
  return {
    ...floor(id, roomId, x, y, width, height),
    kind: 'one-way',
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
      areaId: stableId<'area'>('rootglass-reliquary'),
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
  requiredAbilityId: string | null = null,
  requiredFactId: string | null = null,
) {
  return {
    mechanismId: stableId<'mechanism'>(mechanismId),
    kind: 'puzzle',
    roomId: stableId<'room'>(roomId),
    bounds: { x, y, width, height },
    puzzleId: stableId<'puzzle'>(puzzleId),
    requiredAbilityId: requiredAbilityId === null ? null : stableId<'ability'>(requiredAbilityId),
    requiredFactId: requiredFactId === null ? null : stableId<'quest-flag'>(requiredFactId),
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
