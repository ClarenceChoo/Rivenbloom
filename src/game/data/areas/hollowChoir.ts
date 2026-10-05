import { stableId } from '../../core/StableId';
import { deepFreeze } from '../immutability';
import type { AreaDefinition } from '../types';
import { WORLD_ALWAYS } from '../../world/WorldPredicates';

export const HOLLOW_CHOIR_AREA: AreaDefinition = deepFreeze({
  areaId: stableId<'area'>('hollow-choir'),
  regionId: stableId<'region'>('brackenreach'),
  displayName: 'Hollow Choir',
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  authoringGrid: 4,
  backgroundSetId: null,
  ambienceProfileId: null,
  musicCueId: null,
  layers: [],
  rooms: [room('hollow-choir-arena', 'Hollow Choir', 0, 0, 1920, 1080)],
  surfaces: [floor('hollow-choir-floor', 'hollow-choir-arena', 0, 900, 1920, 180)],
  zones: [],
  actorSpawns: [
    {
      spawnId: stableId<'actor-spawn'>('pallid-cantor-at-hollow-choir'),
      actorId: stableId<'actor'>('pallid-cantor'),
      roomId: stableId<'room'>('hollow-choir-arena'),
      position: { x: 960, y: 900 },
      facing: 'left',
      encounterId: stableId<'encounter'>('hollow-choir-cantor'),
    },
  ],
  triggers: [
    {
      triggerId: stableId<'trigger'>('hollow-choir-cantor-threshold'),
      roomId: stableId<'room'>('hollow-choir-arena'),
      bounds: { x: 192, y: 720, width: 160, height: 180 },
      activation: 'enter',
      action: { kind: 'start-boss', bossId: stableId<'boss'>('pallid-cantor') },
    },
    {
      triggerId: stableId<'trigger'>('rest-at-choir-threshold-lantern'),
      roomId: stableId<'room'>('hollow-choir-arena'),
      bounds: { x: 176, y: 720, width: 160, height: 180 },
      activation: 'interact',
      action: {
        kind: 'activate-checkpoint',
        areaId: stableId<'area'>('hollow-choir'),
        checkpointId: stableId<'checkpoint'>('choir-threshold-lantern'),
      },
    },
  ],
  mechanisms: [
    {
      mechanismId: stableId<'mechanism'>('hollow-choir-west-lens'),
      kind: 'boss-lens',
      roomId: stableId<'room'>('hollow-choir-arena'),
      bounds: { x: 280, y: 740, width: 160, height: 160 },
      bossId: stableId<'boss'>('pallid-cantor'),
      requiredAbilityId: stableId<'ability'>('resonant-pulse'),
      requiredFactId: null,
    },
    {
      mechanismId: stableId<'mechanism'>('hollow-choir-east-lens'),
      kind: 'boss-lens',
      roomId: stableId<'room'>('hollow-choir-arena'),
      bounds: { x: 1480, y: 740, width: 160, height: 160 },
      bossId: stableId<'boss'>('pallid-cantor'),
      requiredAbilityId: stableId<'ability'>('resonant-pulse'),
      requiredFactId: null,
    },
  ],
  checkpoints: [
    {
      checkpointId: stableId<'checkpoint'>('choir-threshold-lantern'),
      displayName: 'Choir Threshold Seed-Lantern',
      roomId: stableId<'room'>('hollow-choir-arena'),
      interactionPosition: { x: 256, y: 900 },
      safeZone: { x: 192, y: 772, width: 128, height: 160 },
      canonicalPosition: { x: 256, y: 900 },
      facing: 'right',
    },
  ],
  transitions: [
    {
      kind: 'area',
      transitionId: stableId<'transition'>('hollow-choir-to-resonance-gallery'),
      roomId: stableId<'room'>('hollow-choir-arena'),
      bounds: { x: 0, y: 720, width: 64, height: 180 },
      activation: 'enter',
      targetAreaId: stableId<'area'>('rootglass-reliquary'),
      targetCheckpointId: stableId<'checkpoint'>('resonance-gallery-lantern'),
      predicate: WORLD_ALWAYS,
    },
  ],
  encounters: [
    {
      encounterId: stableId<'encounter'>('hollow-choir-cantor'),
      roomId: stableId<'room'>('hollow-choir-arena'),
      activationBounds: { x: 192, y: 300, width: 1536, height: 600 },
      spawnIds: [stableId<'actor-spawn'>('pallid-cantor-at-hollow-choir')],
      predicate: WORLD_ALWAYS,
      completionCommands: [],
    },
  ],
  chests: [],
  discoveries: [],
  breakables: [],
  props: [],
  bossGates: [
    {
      gateId: stableId<'boss-gate'>('hollow-choir-entry-gate'),
      bossId: stableId<'boss'>('pallid-cantor'),
      roomId: stableId<'room'>('hollow-choir-arena'),
      bounds: { x: 160, y: 360, width: 32, height: 540 },
      side: 'entry',
    },
    {
      gateId: stableId<'boss-gate'>('hollow-choir-exit-gate'),
      bossId: stableId<'boss'>('pallid-cantor'),
      roomId: stableId<'room'>('hollow-choir-arena'),
      bounds: { x: 1728, y: 360, width: 32, height: 540 },
      side: 'exit',
    },
  ],
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
