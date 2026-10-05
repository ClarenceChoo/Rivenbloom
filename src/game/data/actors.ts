import { damageTypeId, stableId } from '../core/StableId';
import { ENEMY_PROFILES } from '../entities/enemies/profiles';
import { deepFreeze } from './immutability';
import type {
  ActorDefinition,
  AiProfileDefinition,
  AnimationSetDefinition,
  AudioSetDefinition,
  DropTableDefinition,
  EnemyActorDefinition,
} from './types';

const authoredMara = {
  actorId: stableId<'actor'>('mara'),
  kind: 'player',
  displayName: 'Mara',
  visualHeight: 128,
  stats: {
    maxHealth: 100,
    maxMana: 40,
    attackPower: 12,
    armour: 3,
    maxPoise: 40,
  },
  movement: { maxSpeed: 280, jumpSpeed: 680 },
  perception: { range: 0 },
  attackIds: [
    stableId<'attack'>('mara-light-one'),
    stableId<'attack'>('mara-light-two'),
    stableId<'attack'>('mara-light-three'),
    stableId<'attack'>('mara-air-slash'),
    stableId<'attack'>('mara-charged-heavy'),
  ],
  resistances: [],
  dropTableId: null,
  animationSetId: null,
  audioSetId: null,
  aiProfileId: null,
} satisfies ActorDefinition;

export const MARA_ACTOR: ActorDefinition = deepFreeze(authoredMara);

function enemy(
  actorId: string,
  displayName: string,
  visualHeight: number,
  maxHealth: number,
  armour: number,
  maxPoise: number,
  maxSpeed: number,
  sightRange: number,
  attackIds: readonly string[],
  resistances: EnemyActorDefinition['resistances'],
  dropTableId: string | null = null,
): EnemyActorDefinition {
  return {
    actorId: stableId<'actor'>(actorId),
    kind: 'enemy',
    displayName,
    visualHeight,
    stats: { maxHealth, maxMana: 0, attackPower: 0, armour, maxPoise },
    movement: { maxSpeed, jumpSpeed: 0 },
    perception: { range: sightRange },
    attackIds: attackIds.map((id) => stableId<'attack'>(id)),
    resistances,
    dropTableId: dropTableId === null ? null : stableId<'drop-table'>(dropTableId),
    animationSetId: null,
    audioSetId: null,
    aiProfileId: stableId<'ai-profile'>(`${actorId}-ai`),
  };
}

const authoredEnemies = [
  enemy('briar-scrapper', 'Briar Scrapper', 88, 42, 1, 20, 145, 420, ['briar-scrapper-lunge'], []),
  enemy(
    'duskwing',
    'Duskwing',
    72,
    30,
    0,
    14,
    230,
    520,
    ['duskwing-hook-dive'],
    [{ damageTypeId: damageTypeId('lumen'), multiplier: -0.15 }],
  ),
  enemy(
    'spore-scribe',
    'Spore Scribe',
    96,
    38,
    1,
    18,
    90,
    600,
    ['spore-scribe-pollen-plant'],
    [{ damageTypeId: damageTypeId('lumen'), multiplier: 0.2 }],
  ),
  enemy(
    'barkbound',
    'Barkbound',
    116,
    72,
    5,
    38,
    75,
    380,
    ['barkbound-shield-bash'],
    [
      { damageTypeId: damageTypeId('physical'), multiplier: 0.25 },
      { damageTypeId: damageTypeId('resonance'), multiplier: -0.25 },
    ],
  ),
  enemy(
    'rootlurker',
    'Rootlurker',
    100,
    50,
    2,
    26,
    0,
    150,
    ['rootlurker-bell-eruption'],
    [{ damageTypeId: damageTypeId('resonance'), multiplier: -0.2 }],
  ),
  enemy(
    'thorn-sentinel',
    'Thorn Sentinel',
    136,
    180,
    6,
    70,
    100,
    520,
    ['thorn-sentinel-press', 'thorn-sentinel-sweep-one', 'thorn-sentinel-sweep-two'],
    [
      { damageTypeId: damageTypeId('physical'), multiplier: 0.25 },
      { damageTypeId: damageTypeId('resonance'), multiplier: -0.25 },
    ],
    'thorn-sentinel-briar-core',
  ),
] satisfies readonly EnemyActorDefinition[];

function npc(actor: string, displayName: string): ActorDefinition {
  return {
    actorId: stableId<'actor'>(actor),
    kind: 'npc',
    displayName,
    visualHeight: 112,
    stats: { maxHealth: 1, maxMana: 1, attackPower: 1, armour: 0, maxPoise: 1 },
    movement: { maxSpeed: 0, jumpSpeed: 0 },
    perception: { range: 160 },
    attackIds: [],
    resistances: [],
    dropTableId: null,
    animationSetId: null,
    audioSetId: null,
    aiProfileId: null,
  };
}

export const NPC_ACTORS: readonly ActorDefinition[] = deepFreeze([
  npc('sela-quill', 'Sela Quill'),
  npc('orin-fen', 'Orin Fen'),
  npc('piri-moss', 'Piri Moss'),
]);

export const ENEMY_ACTORS: readonly EnemyActorDefinition[] = deepFreeze(authoredEnemies);
export const PALLID_CANTOR_ACTOR: ActorDefinition = deepFreeze({
  actorId: stableId<'actor'>('pallid-cantor'),
  kind: 'boss',
  bossId: stableId<'boss'>('pallid-cantor'),
  displayName: 'The Pallid Cantor',
  visualHeight: 320,
  stats: { maxHealth: 420, maxMana: 0, attackPower: 22, armour: 4, maxPoise: 84 },
  movement: { maxSpeed: 96, jumpSpeed: 0 },
  perception: { range: 960 },
  attackIds: [
    'pallid-cantor-note-volley',
    'pallid-cantor-fan-sweep',
    'pallid-cantor-chime-slam',
    'pallid-cantor-spearfall',
    'pallid-cantor-inversion-fan',
    'pallid-cantor-note-chain',
    'pallid-cantor-hover-chime',
    'pallid-cantor-spear-cascade',
  ].map((id) => stableId<'attack'>(id)),
  phases: [
    {
      phaseId: stableId<'boss-phase'>('pallid-cantor-first-verse'),
      attackIds: [
        'pallid-cantor-note-volley',
        'pallid-cantor-fan-sweep',
        'pallid-cantor-chime-slam',
        'pallid-cantor-spearfall',
      ].map((id) => stableId<'attack'>(id)),
    },
    {
      phaseId: stableId<'boss-phase'>('pallid-cantor-broken-refrain'),
      attackIds: [
        'pallid-cantor-inversion-fan',
        'pallid-cantor-note-chain',
        'pallid-cantor-hover-chime',
        'pallid-cantor-spear-cascade',
      ].map((id) => stableId<'attack'>(id)),
    },
  ],
  resistances: [
    { damageTypeId: damageTypeId('physical'), multiplier: 0.15 },
    { damageTypeId: damageTypeId('lumen'), multiplier: 0.1 },
    { damageTypeId: damageTypeId('resonance'), multiplier: -0.25 },
  ],
  dropTableId: null,
  animationSetId: null,
  audioSetId: null,
  aiProfileId: null,
});
export const ACTORS: readonly ActorDefinition[] = deepFreeze([
  MARA_ACTOR,
  ...ENEMY_ACTORS,
  ...NPC_ACTORS,
  PALLID_CANTOR_ACTOR,
]);
export const ANIMATION_SETS = Object.freeze([]) satisfies readonly AnimationSetDefinition[];
export const AUDIO_SETS = Object.freeze([]) satisfies readonly AudioSetDefinition[];
export const AI_PROFILES: readonly AiProfileDefinition[] = ENEMY_PROFILES;
export const DROP_TABLES: readonly DropTableDefinition[] = deepFreeze([
  {
    dropTableId: stableId<'drop-table'>('thorn-sentinel-briar-core'),
    entries: [{ itemId: stableId<'item'>('briar-core'), quantity: 1, weight: 1 }],
  },
]);
