import type { ActorDefinition, BossDefinition, StableId } from './types';
import { PLAYER_MOVEMENT_TUNING } from '../config/traversal';

type ActorInput = {
  readonly id: StableId;
  readonly displayName: string;
  readonly kind: ActorDefinition['kind'];
  readonly assetKey: StableId;
  readonly attackIds?: readonly StableId[];
  readonly abilityIds?: readonly StableId[];
  readonly drops?: ActorDefinition['drops'];
  readonly boss?: BossDefinition;
  readonly maxHealth?: number;
  readonly maxMana?: number;
  readonly renderWidth?: number;
  readonly renderHeight?: number;
};

function actor(input: ActorInput): ActorDefinition {
  const isBoss = input.kind === 'boss';
  const isNpc = input.kind === 'npc';
  const renderWidth = input.renderWidth ?? (isBoss ? 240 : 126);
  const renderHeight = input.renderHeight ?? (isBoss ? 260 : 126);
  return {
    id: input.id,
    displayName: input.displayName,
    kind: input.kind,
    stats: {
      maxHealth: input.maxHealth ?? (isBoss ? 900 : isNpc ? 1 : 100),
      maxMana: input.maxMana ?? (input.kind === 'player' ? 60 : 0),
      power: isBoss ? 28 : isNpc ? 0 : input.kind === 'elite' ? 20 : 12,
      defence: isBoss ? 14 : isNpc ? 0 : 5,
      poise: isBoss ? 140 : isNpc ? 0 : input.kind === 'elite' ? 70 : 24
    },
    movement: {
      speed:
        input.kind === 'player'
          ? PLAYER_MOVEMENT_TUNING.maxRunSpeed
          : isNpc
            ? 0
            : isBoss
              ? 110
              : 180,
      acceleration:
        input.kind === 'player' ? PLAYER_MOVEMENT_TUNING.groundAcceleration : isNpc ? 0 : 1000,
      jumpVelocity: input.kind === 'player' ? PLAYER_MOVEMENT_TUNING.jumpSpeed : 0
    },
    perception: {
      range: isNpc || input.kind === 'player' ? 0 : isBoss ? 760 : 520,
      hearingRange: isNpc || input.kind === 'player' ? 0 : 360
    },
    attackIds: input.attackIds ?? [],
    abilityIds: input.abilityIds ?? [],
    resistances: isBoss ? { rootglass: 0.35, resonance: -0.15 } : {},
    drops: input.drops ?? [],
    render:
      input.id === 'mara-vey'
        ? {
            assetKey: input.assetKey,
            source: { x: 28, y: 46, width: 244, height: 250 },
            size: { width: 122, height: 125 },
            origin: { x: 0.5, y: 1 },
            depth: 10
          }
        : {
            assetKey: input.assetKey,
            source: { x: 0, y: 0, width: 384, height: 342 },
            size: { width: renderWidth, height: renderHeight },
            origin: { x: 0.5, y: 1 },
            depth: 10
          },
    collisionBody: {
      offset: { x: isBoss ? -64 : -18, y: isBoss ? -190 : -82 },
      size: { width: isBoss ? 128 : 36, height: isBoss ? 190 : 82 }
    },
    hurtboxes: [
      {
        offset: { x: isBoss ? -78 : -20, y: isBoss ? -218 : -92 },
        size: { width: isBoss ? 156 : 40, height: isBoss ? 218 : 92 }
      }
    ],
    animationSetId: `${input.id}-animation-set`,
    audioSetId: `${input.id}-audio-set`,
    aiProfileId: input.kind === 'player' ? 'player-controlled' : `${input.id}-ai`,
    ...(input.boss === undefined ? {} : { boss: input.boss })
  };
}

const enemyDrops: Readonly<Record<string, ActorDefinition['drops']>> = {
  'briar-scrapper': [{ itemId: 'briar-core', chance: 0.2, quantity: 1 }],
  'thorn-sentinel': [{ itemId: 'briar-core', chance: 1, quantity: 1 }]
};

export const actorDefinitions: readonly ActorDefinition[] = [
  actor({
    id: 'mara-vey',
    displayName: 'Mara Vey',
    kind: 'player',
    assetKey: 'mara-sheet',
    attackIds: [
      'mara-light-combo-1',
      'mara-light-combo-2',
      'mara-light-combo-3',
      'mara-air-slash',
      'mara-heavy-slash',
      'mara-charged-strike'
    ],
    abilityIds: ['lumen-bolt', 'wayfinder-dash', 'aegis-veil', 'resonant-pulse'],
    maxHealth: 100,
    maxMana: 60
  }),
  actor({
    id: 'sela-quill',
    displayName: 'Sela Quill',
    kind: 'npc',
    assetKey: 'dialogue-portraits'
  }),
  actor({
    id: 'orin-fen',
    displayName: 'Orin Fen',
    kind: 'npc',
    assetKey: 'dialogue-portraits'
  }),
  actor({
    id: 'piri-moss',
    displayName: 'Piri Moss',
    kind: 'npc',
    assetKey: 'dialogue-portraits'
  }),
  actor({
    id: 'briar-scrapper',
    displayName: 'Briar Scrapper',
    kind: 'enemy',
    assetKey: 'briar-scrapper-sheet',
    attackIds: ['briar-scrapper-lunge'],
    drops: enemyDrops['briar-scrapper']
  }),
  actor({
    id: 'duskwing',
    displayName: 'Duskwing',
    kind: 'enemy',
    assetKey: 'duskwing-sheet',
    attackIds: ['duskwing-dive']
  }),
  actor({
    id: 'spore-scribe',
    displayName: 'Spore Scribe',
    kind: 'enemy',
    assetKey: 'spore-scribe-sheet',
    attackIds: ['spore-scribe-pollen']
  }),
  actor({
    id: 'barkbound',
    displayName: 'Barkbound',
    kind: 'enemy',
    assetKey: 'barkbound-sheet',
    attackIds: ['barkbound-shield-slam']
  }),
  actor({
    id: 'rootlurker',
    displayName: 'Rootlurker',
    kind: 'enemy',
    assetKey: 'rootlurker-sheet',
    attackIds: ['rootlurker-bite']
  }),
  actor({
    id: 'thorn-sentinel',
    displayName: 'Thorn Sentinel',
    kind: 'elite',
    assetKey: 'thorn-sentinel-sheet',
    attackIds: ['thorn-sentinel-thrust', 'thorn-sentinel-sweep'],
    drops: enemyDrops['thorn-sentinel'],
    maxHealth: 280,
    renderWidth: 162,
    renderHeight: 168
  }),
  actor({
    id: 'pallid-cantor',
    displayName: 'The Pallid Cantor',
    kind: 'boss',
    assetKey: 'pallid-cantor-sheet',
    attackIds: [
      'cantor-chime-slam',
      'cantor-fan-sweep',
      'cantor-note-volley',
      'cantor-glass-spears',
      'cantor-resonant-dive',
      'cantor-reverse-choir',
      'cantor-chained-notes',
      'cantor-heart-pulse',
      'cantor-porcelain-crack'
    ],
    drops: [{ itemId: 'cantor-sigil', chance: 1, quantity: 1 }],
    boss: {
      phaseOneAttackIds: [
        'cantor-chime-slam',
        'cantor-fan-sweep',
        'cantor-note-volley',
        'cantor-glass-spears'
      ],
      phaseTwoAttackIds: [
        'cantor-resonant-dive',
        'cantor-reverse-choir',
        'cantor-chained-notes',
        'cantor-heart-pulse'
      ],
      transitionAttackId: 'cantor-porcelain-crack',
      requiredMechanismIds: ['cantor-west-lens', 'cantor-east-lens'],
      defeatItemId: 'cantor-sigil',
      defeatQuestId: 'silent-bloom'
    },
    maxHealth: 900
  })
];
