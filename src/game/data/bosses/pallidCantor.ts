import { stableId } from '../../core/StableId';
import { deepFreeze } from '../immutability';
import type { BossEncounterDefinition } from '../types';

export const PALLID_CANTOR_ENCOUNTER: BossEncounterDefinition = deepFreeze({
  encounterId: stableId<'encounter'>('hollow-choir-cantor'),
  bossId: stableId<'boss'>('pallid-cantor'),
  actorId: stableId<'actor'>('pallid-cantor'),
  spawnId: stableId<'actor-spawn'>('pallid-cantor-at-hollow-choir'),
  areaId: stableId<'area'>('hollow-choir'),
  roomId: stableId<'room'>('hollow-choir-arena'),
  entryCheckpointId: stableId<'checkpoint'>('choir-threshold-lantern'),
  spawnPosition: { x: 960, y: 900 },
  spawnFacing: 'left',
  roomBounds: { x: 0, y: 0, width: 1920, height: 1080 },
  combatBounds: { x: 192, y: 300, width: 1536, height: 600 },
  floorY: 900,
  body: { halfWidth: 72, height: 252 },
  groundedHurtbox: { x: -78, y: -260, width: 156, height: 260 },
  throatHurtbox: { x: -42, y: -310, width: 84, height: 110 },
  sealedShellHurtbox: { x: -88, y: -270, width: 176, height: 270 },
  exposedHeartHurtbox: { x: -62, y: -150, width: 124, height: 120 },
  hoverAnchors: [
    { x: 480, y: 640 },
    { x: 960, y: 600 },
    { x: 1440, y: 640 },
  ],
  phaseTwoBaseline: { x: 960, y: 860 },
  lenses: [
    {
      mechanismId: stableId<'mechanism'>('hollow-choir-west-lens'),
      center: { x: 360, y: 820 },
      activationRadius: 80,
    },
    {
      mechanismId: stableId<'mechanism'>('hollow-choir-east-lens'),
      center: { x: 1560, y: 820 },
      activationRadius: 80,
    },
  ],
  projectileCapacity: 16,
  hazardCapacity: 15,
});

export const PALLID_CANTOR_LANE_CENTERS = Object.freeze([360, 660, 960, 1260, 1560]);
