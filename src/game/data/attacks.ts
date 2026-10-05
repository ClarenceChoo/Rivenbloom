import { damageTypeId, stableId } from '../core/StableId';
import { deepFreeze } from './immutability';
import type { AttackDefinition, AttackTag } from './types';

const blockable = Object.freeze(['blockable', 'parryable'] satisfies readonly AttackTag[]);

function attack(
  attackId: string,
  baseDamage: number,
  poiseDamage: number,
  patch: Partial<AttackDefinition>,
): AttackDefinition {
  return {
    attackId: stableId<'attack'>(attackId),
    damage: {
      baseDamage,
      damageType: damageTypeId('physical'),
      poiseDamage,
      critical: { kind: 'excluded' },
    },
    totalFrames: 18,
    hitboxes: [
      {
        hitboxId: stableId<'hitbox'>(`${attackId}-blade`),
        fromFrame: 5,
        toFrame: 8,
        bounds: { x: 22, y: -94, width: 76, height: 72 },
      },
    ],
    movementImpulse: { x: 80, y: 0 },
    cancelWindows: [],
    animationSetId: null,
    audioSetId: null,
    cooldownMs: 0,
    delivery: 'melee',
    knockback: { x: 180, y: -80 },
    hitStopMs: 55,
    tags: blockable,
    hitPolicy: { kind: 'once' },
    charge: null,
    ...patch,
  };
}

const authoredAttacks = [
  attack('mara-light-one', 12, 8, {
    cancelWindows: [
      {
        fromFrame: 7,
        toFrame: 10,
        intoAttackIds: [stableId<'attack'>('mara-light-two')],
      },
    ],
  }),
  attack('mara-light-two', 14, 10, {
    totalFrames: 19,
    cancelWindows: [
      {
        fromFrame: 8,
        toFrame: 11,
        intoAttackIds: [stableId<'attack'>('mara-light-three')],
      },
    ],
    knockback: { x: 200, y: -90 },
  }),
  attack('mara-light-three', 18, 16, {
    totalFrames: 23,
    hitboxes: [
      {
        hitboxId: stableId<'hitbox'>('mara-light-three-blade'),
        fromFrame: 7,
        toFrame: 11,
        bounds: { x: 18, y: -104, width: 94, height: 84 },
      },
    ],
    knockback: { x: 270, y: -130 },
  }),
  attack('mara-air-slash', 14, 10, {
    totalFrames: 20,
    movementImpulse: { x: 45, y: 25 },
    hitboxes: [
      {
        hitboxId: stableId<'hitbox'>('mara-air-slash-blade'),
        fromFrame: 5,
        toFrame: 9,
        bounds: { x: 10, y: -90, width: 90, height: 92 },
      },
    ],
  }),
  attack('mara-charged-heavy', 28, 30, {
    totalFrames: 30,
    movementImpulse: { x: 130, y: 0 },
    hitboxes: [
      {
        hitboxId: stableId<'hitbox'>('mara-charged-heavy-blade'),
        fromFrame: 10,
        toFrame: 15,
        bounds: { x: 12, y: -112, width: 116, height: 104 },
      },
    ],
    knockback: { x: 390, y: -170 },
    hitStopMs: 70,
    charge: { minimumMs: 350, maximumMs: 900 },
  }),
  attack('lumen-bolt-impact', 16, 8, {
    damage: {
      baseDamage: 16,
      damageType: damageTypeId('lumen'),
      poiseDamage: 8,
      critical: { kind: 'excluded' },
    },
    totalFrames: 1,
    hitboxes: [
      {
        hitboxId: stableId<'hitbox'>('lumen-bolt-impact-core'),
        fromFrame: 0,
        toFrame: 0,
        bounds: { x: -8, y: -8, width: 16, height: 16 },
      },
    ],
    movementImpulse: { x: 0, y: 0 },
    delivery: 'projectile',
    knockback: { x: 180, y: -40 },
    tags: ['blockable', 'parryable', 'projectile'],
  }),
  attack('resonant-pulse-wave', 4, 24, {
    damage: {
      baseDamage: 4,
      damageType: damageTypeId('resonance'),
      poiseDamage: 24,
      critical: { kind: 'excluded' },
    },
    totalFrames: 1,
    hitboxes: [],
    movementImpulse: { x: 0, y: 0 },
    delivery: 'radial',
    knockback: { x: 120, y: -20 },
    tags: ['blockable', 'rootglass-affecting'],
  }),
  attack('briar-scrapper-lunge', 10, 10, {
    totalFrames: 36,
    hitboxes: [
      {
        hitboxId: stableId<'hitbox'>('briar-scrapper-lunge-thorns'),
        fromFrame: 12,
        toFrame: 16,
        bounds: { x: 18, y: -80, width: 82, height: 64 },
      },
    ],
    movementImpulse: { x: 0, y: 0 },
    knockback: { x: 220, y: -70 },
  }),
  attack('duskwing-hook-dive', 9, 8, {
    totalFrames: 58,
    hitboxes: [
      {
        hitboxId: stableId<'hitbox'>('duskwing-hook-dive-talons'),
        fromFrame: 18,
        toFrame: 31,
        bounds: { x: 6, y: -42, width: 68, height: 58 },
      },
    ],
    movementImpulse: { x: 0, y: 0 },
    knockback: { x: 170, y: 80 },
  }),
  attack('spore-scribe-pollen-plant', 8, 6, {
    totalFrames: 54,
    hitboxes: [
      {
        hitboxId: stableId<'hitbox'>('spore-scribe-pollen-cloud'),
        fromFrame: 27,
        toFrame: 29,
        bounds: { x: -22, y: -44, width: 44, height: 44 },
      },
    ],
    movementImpulse: { x: 0, y: 0 },
    delivery: 'projectile',
    knockback: { x: 90, y: -20 },
    tags: ['blockable', 'parryable', 'projectile'],
  }),
  attack('barkbound-shield-bash', 13, 20, {
    totalFrames: 60,
    hitboxes: [
      {
        hitboxId: stableId<'hitbox'>('barkbound-shield-bash-face'),
        fromFrame: 23,
        toFrame: 28,
        bounds: { x: 24, y: -104, width: 90, height: 92 },
      },
    ],
    movementImpulse: { x: 0, y: 0 },
    knockback: { x: 300, y: -90 },
  }),
  attack('rootlurker-bell-eruption', 14, 16, {
    totalFrames: 83,
    hitboxes: [
      {
        hitboxId: stableId<'hitbox'>('rootlurker-bell-eruption-ring'),
        fromFrame: 33,
        toFrame: 39,
        bounds: { x: -150, y: -108, width: 300, height: 108 },
      },
    ],
    movementImpulse: { x: 0, y: 0 },
    delivery: 'radial',
    knockback: { x: 240, y: -100 },
    tags: ['unblockable'],
  }),
  attack('thorn-sentinel-press', 14, 14, {
    totalFrames: 50,
    hitboxes: [
      {
        hitboxId: stableId<'hitbox'>('thorn-sentinel-press-thorns'),
        fromFrame: 18,
        toFrame: 23,
        bounds: { x: 30, y: -126, width: 98, height: 112 },
      },
    ],
    movementImpulse: { x: 0, y: 0 },
    knockback: { x: 260, y: -80 },
  }),
  attack('thorn-sentinel-sweep-one', 12, 14, {
    totalFrames: 33,
    hitboxes: [
      {
        hitboxId: stableId<'hitbox'>('thorn-sentinel-sweep-one-branch'),
        fromFrame: 25,
        toFrame: 31,
        bounds: { x: 20, y: -132, width: 142, height: 118 },
      },
    ],
    movementImpulse: { x: 0, y: 0 },
    knockback: { x: 280, y: -90 },
  }),
  attack('thorn-sentinel-sweep-two', 18, 24, {
    totalFrames: 85,
    hitboxes: [
      {
        hitboxId: stableId<'hitbox'>('thorn-sentinel-sweep-two-branch'),
        fromFrame: 33,
        toFrame: 42,
        bounds: { x: 18, y: -138, width: 168, height: 124 },
      },
    ],
    movementImpulse: { x: 0, y: 0 },
    knockback: { x: 360, y: -130 },
    hitStopMs: 70,
  }),
  attack('bramble-thorn-contact', 12, 8, {
    totalFrames: 1,
    hitboxes: [],
    movementImpulse: { x: 0, y: 0 },
    delivery: 'hazard',
    knockback: { x: 180, y: -60 },
    hitStopMs: 45,
    tags: ['unblockable'],
    hitPolicy: { kind: 'interval', rehitIntervalMs: 650 },
  }),
  attack('rootglass-silt-contact', 10, 12, {
    damage: {
      baseDamage: 10,
      damageType: damageTypeId('resonance'),
      poiseDamage: 12,
      critical: { kind: 'excluded' },
    },
    totalFrames: 1,
    hitboxes: [],
    movementImpulse: { x: 0, y: 0 },
    delivery: 'hazard',
    knockback: { x: 140, y: -40 },
    hitStopMs: 45,
    tags: ['unblockable'],
    hitPolicy: { kind: 'interval', rehitIntervalMs: 650 },
  }),
  attack('pallid-cantor-note-volley', 12, 10, {
    damage: {
      baseDamage: 12,
      damageType: damageTypeId('resonance'),
      poiseDamage: 10,
      critical: { kind: 'excluded' },
    },
    totalFrames: 84,
    hitboxes: [],
    movementImpulse: { x: 0, y: 0 },
    cooldownMs: 2800,
    delivery: 'projectile',
    knockback: { x: 180, y: -50 },
    hitStopMs: 50,
    tags: ['blockable', 'parryable', 'projectile'],
  }),
  attack('pallid-cantor-fan-sweep', 17, 18, {
    totalFrames: 72,
    hitboxes: [
      {
        hitboxId: stableId<'hitbox'>('pallid-cantor-fan-sweep-root-fan'),
        fromFrame: 30,
        toFrame: 37,
        bounds: { x: 48, y: -246, width: 430, height: 208 },
      },
    ],
    movementImpulse: { x: 0, y: 0 },
    cooldownMs: 2200,
    knockback: { x: 300, y: -120 },
    hitStopMs: 60,
  }),
  attack('pallid-cantor-chime-slam', 20, 26, {
    damage: {
      baseDamage: 20,
      damageType: damageTypeId('resonance'),
      poiseDamage: 26,
      critical: { kind: 'excluded' },
    },
    totalFrames: 78,
    hitboxes: [
      {
        hitboxId: stableId<'hitbox'>('pallid-cantor-chime-slam-pulse'),
        fromFrame: 36,
        toFrame: 41,
        bounds: { x: -190, y: -96, width: 380, height: 96 },
      },
    ],
    movementImpulse: { x: 0, y: 0 },
    cooldownMs: 2600,
    delivery: 'radial',
    knockback: { x: 320, y: -160 },
    hitStopMs: 65,
    tags: ['blockable'],
  }),
  attack('pallid-cantor-spearfall', 19, 22, {
    totalFrames: 96,
    hitboxes: [],
    movementImpulse: { x: 0, y: 0 },
    cooldownMs: 3600,
    delivery: 'hazard',
    knockback: { x: 180, y: -180 },
    hitStopMs: 65,
    tags: ['unblockable'],
  }),
  attack('pallid-cantor-inversion-fan', 18, 20, {
    totalFrames: 108,
    hitboxes: [],
    movementImpulse: { x: 0, y: 0 },
    cooldownMs: 3200,
    delivery: 'hazard',
    knockback: { x: 260, y: -100 },
    hitStopMs: 60,
    tags: ['blockable'],
  }),
  attack('pallid-cantor-note-chain', 10, 8, {
    damage: {
      baseDamage: 10,
      damageType: damageTypeId('resonance'),
      poiseDamage: 8,
      critical: { kind: 'excluded' },
    },
    totalFrames: 96,
    hitboxes: [],
    movementImpulse: { x: 0, y: 0 },
    cooldownMs: 2600,
    delivery: 'projectile',
    knockback: { x: 160, y: -40 },
    hitStopMs: 50,
    tags: ['blockable', 'parryable', 'projectile'],
  }),
  attack('pallid-cantor-hover-chime', 22, 30, {
    damage: {
      baseDamage: 22,
      damageType: damageTypeId('resonance'),
      poiseDamage: 30,
      critical: { kind: 'excluded' },
    },
    totalFrames: 90,
    hitboxes: [
      {
        hitboxId: stableId<'hitbox'>('pallid-cantor-hover-chime-pulse'),
        fromFrame: 42,
        toFrame: 47,
        bounds: { x: -240, y: -120, width: 480, height: 120 },
      },
    ],
    movementImpulse: { x: 0, y: 0 },
    cooldownMs: 3000,
    delivery: 'radial',
    knockback: { x: 360, y: -180 },
    hitStopMs: 70,
    tags: ['unblockable'],
  }),
  attack('pallid-cantor-spear-cascade', 20, 24, {
    totalFrames: 120,
    hitboxes: [],
    movementImpulse: { x: 0, y: 0 },
    cooldownMs: 4200,
    delivery: 'hazard',
    knockback: { x: 200, y: -200 },
    hitStopMs: 65,
    tags: ['unblockable'],
  }),
] satisfies readonly AttackDefinition[];

export const ATTACKS: readonly AttackDefinition[] = deepFreeze(authoredAttacks);
