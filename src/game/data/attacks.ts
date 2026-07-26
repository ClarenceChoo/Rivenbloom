import type { AttackDefinition, DamageType, PointDefinition } from './types';

type AttackInput = {
  readonly id: string;
  readonly displayName: string;
  readonly anticipationFrames: number;
  readonly activeFrames: number;
  readonly recoveryFrames: number;
  readonly damage: number;
  readonly poise: number;
  readonly type?: DamageType;
  readonly hitbox: {
    readonly offset: PointDefinition;
    readonly width: number;
    readonly height: number;
  };
  readonly cooldownMs?: number;
};

function attack(input: AttackInput): AttackDefinition {
  return {
    id: input.id,
    displayName: input.displayName,
    anticipationFrames: input.anticipationFrames,
    activeFrames: input.activeFrames,
    recoveryFrames: input.recoveryFrames,
    hitboxes: [
      {
        startFrame: input.anticipationFrames,
        endFrame: input.anticipationFrames + input.activeFrames - 1,
        bounds: {
          offset: input.hitbox.offset,
          size: {
            width: input.hitbox.width,
            height: input.hitbox.height
          }
        }
      }
    ],
    damage: {
      amount: input.damage,
      poise: input.poise,
      knockback: { x: 180, y: -70 },
      hitStopMs: 55,
      type: input.type ?? 'physical',
      tags: []
    },
    movementImpulse: { x: 0, y: 0 },
    cancelAfterFrame: input.anticipationFrames + input.activeFrames,
    cooldownMs: input.cooldownMs ?? 0,
    soundCueId: `${input.id}-sound`,
    effectCueId: `${input.id}-effect`
  };
}

export const attackDefinitions: readonly AttackDefinition[] = [
  attack({
    id: 'mara-light-slash',
    displayName: 'Leaf-Crescent Cut',
    anticipationFrames: 3,
    activeFrames: 4,
    recoveryFrames: 7,
    damage: 12,
    poise: 8,
    hitbox: { offset: { x: 22, y: -78 }, width: 76, height: 62 }
  }),
  attack({
    id: 'mara-heavy-slash',
    displayName: 'Wayfinder Hew',
    anticipationFrames: 9,
    activeFrames: 5,
    recoveryFrames: 13,
    damage: 28,
    poise: 26,
    hitbox: { offset: { x: 18, y: -88 }, width: 98, height: 78 }
  }),
  attack({
    id: 'lumen-bolt-burst',
    displayName: 'Lumen Bolt',
    anticipationFrames: 7,
    activeFrames: 1,
    recoveryFrames: 10,
    damage: 15,
    poise: 9,
    type: 'resonance',
    hitbox: { offset: { x: 30, y: -68 }, width: 34, height: 28 },
    cooldownMs: 480
  }),
  attack({
    id: 'briar-scrapper-lunge',
    displayName: 'Mask-First Lunge',
    anticipationFrames: 10,
    activeFrames: 5,
    recoveryFrames: 13,
    damage: 14,
    poise: 10,
    hitbox: { offset: { x: 18, y: -42 }, width: 70, height: 40 },
    cooldownMs: 950
  }),
  attack({
    id: 'duskwing-dive',
    displayName: 'Seed-Hook Dive',
    anticipationFrames: 12,
    activeFrames: 8,
    recoveryFrames: 14,
    damage: 13,
    poise: 7,
    hitbox: { offset: { x: -44, y: -34 }, width: 88, height: 58 },
    cooldownMs: 1100
  }),
  attack({
    id: 'spore-scribe-pollen',
    displayName: 'Delayed Pollen Script',
    anticipationFrames: 18,
    activeFrames: 2,
    recoveryFrames: 16,
    damage: 11,
    poise: 6,
    type: 'spore',
    hitbox: { offset: { x: 24, y: -62 }, width: 32, height: 32 },
    cooldownMs: 1400
  }),
  attack({
    id: 'barkbound-shield-slam',
    displayName: 'Bark-Door Slam',
    anticipationFrames: 14,
    activeFrames: 7,
    recoveryFrames: 18,
    damage: 22,
    poise: 30,
    hitbox: { offset: { x: 20, y: -96 }, width: 82, height: 96 },
    cooldownMs: 1500
  }),
  attack({
    id: 'rootlurker-bite',
    displayName: 'Bell-Jaw Ambush',
    anticipationFrames: 16,
    activeFrames: 6,
    recoveryFrames: 17,
    damage: 18,
    poise: 18,
    hitbox: { offset: { x: -48, y: -68 }, width: 96, height: 68 },
    cooldownMs: 1300
  }),
  attack({
    id: 'thorn-sentinel-thrust',
    displayName: 'Surveyor Thrust',
    anticipationFrames: 13,
    activeFrames: 5,
    recoveryFrames: 16,
    damage: 24,
    poise: 24,
    type: 'rootglass',
    hitbox: { offset: { x: 28, y: -82 }, width: 132, height: 42 },
    cooldownMs: 1150
  }),
  attack({
    id: 'thorn-sentinel-sweep',
    displayName: 'Halo Sweep',
    anticipationFrames: 20,
    activeFrames: 8,
    recoveryFrames: 20,
    damage: 29,
    poise: 32,
    type: 'rootglass',
    hitbox: { offset: { x: -96, y: -104 }, width: 192, height: 92 },
    cooldownMs: 1800
  }),
  attack({
    id: 'cantor-chime-slam',
    displayName: 'Chime Slam',
    anticipationFrames: 22,
    activeFrames: 7,
    recoveryFrames: 18,
    damage: 30,
    poise: 34,
    type: 'rootglass',
    hitbox: { offset: { x: -92, y: -168 }, width: 184, height: 168 },
    cooldownMs: 1600
  }),
  attack({
    id: 'cantor-fan-sweep',
    displayName: 'Root-Fan Sweep',
    anticipationFrames: 18,
    activeFrames: 10,
    recoveryFrames: 20,
    damage: 26,
    poise: 22,
    type: 'rootglass',
    hitbox: { offset: { x: -180, y: -146 }, width: 360, height: 130 },
    cooldownMs: 1450
  }),
  attack({
    id: 'cantor-note-volley',
    displayName: 'Cantor Note Volley',
    anticipationFrames: 16,
    activeFrames: 3,
    recoveryFrames: 20,
    damage: 17,
    poise: 10,
    type: 'resonance',
    hitbox: { offset: { x: -26, y: -136 }, width: 52, height: 52 },
    cooldownMs: 1350
  }),
  attack({
    id: 'cantor-glass-spears',
    displayName: 'Falling Glass-Root Spears',
    anticipationFrames: 24,
    activeFrames: 12,
    recoveryFrames: 20,
    damage: 23,
    poise: 20,
    type: 'rootglass',
    hitbox: { offset: { x: -34, y: -180 }, width: 68, height: 180 },
    cooldownMs: 1900
  }),
  attack({
    id: 'cantor-resonant-dive',
    displayName: 'Resonant Dive',
    anticipationFrames: 14,
    activeFrames: 10,
    recoveryFrames: 16,
    damage: 28,
    poise: 26,
    type: 'resonance',
    hitbox: { offset: { x: -82, y: -142 }, width: 164, height: 142 },
    cooldownMs: 1250
  }),
  attack({
    id: 'cantor-reverse-choir',
    displayName: 'Reverse Choir',
    anticipationFrames: 22,
    activeFrames: 14,
    recoveryFrames: 18,
    damage: 22,
    poise: 18,
    type: 'resonance',
    hitbox: { offset: { x: -210, y: -128 }, width: 420, height: 112 },
    cooldownMs: 1800
  }),
  attack({
    id: 'cantor-chained-notes',
    displayName: 'Chained Notes',
    anticipationFrames: 12,
    activeFrames: 5,
    recoveryFrames: 14,
    damage: 18,
    poise: 12,
    type: 'resonance',
    hitbox: { offset: { x: -30, y: -126 }, width: 60, height: 60 },
    cooldownMs: 1050
  }),
  attack({
    id: 'cantor-heart-pulse',
    displayName: 'Exposed Heart Pulse',
    anticipationFrames: 20,
    activeFrames: 9,
    recoveryFrames: 22,
    damage: 32,
    poise: 28,
    type: 'resonance',
    hitbox: { offset: { x: -150, y: -160 }, width: 300, height: 144 },
    cooldownMs: 2100
  }),
  attack({
    id: 'cantor-porcelain-crack',
    displayName: 'Porcelain Crack',
    anticipationFrames: 30,
    activeFrames: 1,
    recoveryFrames: 24,
    damage: 0,
    poise: 0,
    type: 'rootglass',
    hitbox: { offset: { x: 0, y: 0 }, width: 1, height: 1 }
  })
];
