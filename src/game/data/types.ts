import type { DamagePacket } from '../combat/CombatTypes';
import type {
  AbilityId,
  DamageTypeId,
  EquipmentSlotId,
  ItemId,
  QuestFlagId,
  StableId,
  StatusEffectId,
  ProjectileId,
} from '../core/StableId';
import type { QuestDefinition, QuestSnapshot } from '../quests/QuestStore';
import type { ProgressionCommand, ProgressionRewardId } from '../world/WorldProgression';
import type {
  AreaId,
  BossId,
  CheckpointId,
  DiscoveryId,
  PlayerBaseStats,
  PuzzleId,
  RegionId,
  RoomId,
  ShortcutId,
} from '../saves/SaveSchema';

export type AssetKey = StableId<'asset'>;
export type BackgroundSetId = StableId<'background-set'>;
export type AmbienceProfileId = StableId<'ambience-profile'>;
export type MusicCueId = StableId<'music-cue'>;
export type AnimationSetId = StableId<'animation-set'>;
export type AudioSetId = StableId<'audio-set'>;
export type AiProfileId = StableId<'ai-profile'>;
export type DropTableId = StableId<'drop-table'>;
export type LayerId = StableId<'layer'>;
export type SurfaceId = StableId<'surface'>;
export type MaterialId = StableId<'material'>;
export type ZoneId = StableId<'zone'>;
export type ActorId = StableId<'actor'>;
export type ActorSpawnId = StableId<'actor-spawn'>;
export type EncounterId = StableId<'encounter'>;
export type AttackId = StableId<'attack'>;
export type HitboxId = StableId<'hitbox'>;
export type TriggerId = StableId<'trigger'>;
export type MechanismId = StableId<'mechanism'>;
export type TransitionId = StableId<'transition'>;
export type PropId = StableId<'prop'>;
export type BreakableId = StableId<'breakable'>;
export type BossPhaseId = StableId<'boss-phase'>;
export type DialogueId = StableId<'dialogue'>;
export type DialogueNodeId = StableId<'dialogue-node'>;
export type DialogueChoiceId = StableId<'dialogue-choice'>;
export type ShopId = StableId<'shop'>;
export type ShopOfferId = StableId<'shop-offer'>;

export type AttackTag =
  'blockable' | 'parryable' | 'projectile' | 'unblockable' | 'rootglass-affecting';

export type Vec2 = Readonly<{ x: number; y: number }>;
export type Rect = Readonly<{ x: number; y: number; width: number; height: number }>;

export type WorldPredicate = Readonly<{
  requiresFacts: readonly QuestFlagId[];
  excludesFacts: readonly QuestFlagId[];
  requiresAbilities: readonly AbilityId[];
  requiresItems: readonly Readonly<{ itemId: ItemId; quantity: number }>[];
  requiresSolvedPuzzles: readonly PuzzleId[];
  requiresActivatedShortcuts: readonly ShortcutId[];
  requiresDefeatedBosses: readonly BossId[];
  excludesDefeatedBosses: readonly BossId[];
}>;

export type ContentIssue = Readonly<{
  severity: 'error' | 'warning';
  code:
    | 'duplicate-id'
    | 'invalid-id'
    | 'invalid-value'
    | 'invalid-geometry'
    | 'missing-reference'
    | 'invalid-reference'
    | 'invalid-boss'
    | 'inaccessible-checkpoint';
  path: string;
  message: string;
}>;

export type BackgroundSetDefinition = Readonly<{
  backgroundSetId: BackgroundSetId;
  textureKeys: readonly AssetKey[];
}>;

export type AmbienceDefinition = Readonly<{
  ambienceProfileId: AmbienceProfileId;
  audioSetId: AudioSetId | null;
}>;

export type MusicCueDefinition = Readonly<{
  musicCueId: MusicCueId;
  assetKey: AssetKey | null;
}>;

export type AnimationSetDefinition = Readonly<{
  animationSetId: AnimationSetId;
  textureKeys: readonly AssetKey[];
}>;

export type AudioSetDefinition = Readonly<{
  audioSetId: AudioSetId;
  assetKeys: readonly AssetKey[];
}>;

export type AiAttackMotion =
  | Readonly<{ kind: 'melee' }>
  | Readonly<{ kind: 'lunge'; recoilSpeed: number }>
  | Readonly<{ kind: 'dive'; hoverMs: number; arcDepth: number }>
  | Readonly<{
      kind: 'plant';
      armsMs: number;
      lifetimeMs: number;
      roomCap: number;
      maxHits: number;
    }>
  | Readonly<{ kind: 'hide' }>;

export type AiAttackPatternDefinition = Readonly<{
  attackId: AttackId;
  telegraphMs: number;
  activeMs: number;
  recoveryMs: number;
  band: Readonly<{ minimumX: number; maximumX: number; vertical: number }>;
  slotClass: 'close' | 'ranged' | 'elite';
  pressureCost: 1 | 2;
  cameraInset: number;
  motion: AiAttackMotion;
}>;

export type AiProfileDefinition = Readonly<{
  aiProfileId: AiProfileId;
  actorId: ActorId;
  bodyBounds: Rect;
  hurtboxes: readonly Rect[];
  eyeOffset: Vec2;
  awareness: Readonly<{
    wakeRange: number;
    sightRange: number;
    verticalRange: number;
    suspectMs: number;
    lostSightMs: number;
    cameraSleepMargin: number;
  }>;
  territory: Readonly<{
    patrolRange: number;
    leashRange: number;
    ledgeProbe: Readonly<{ ahead: number; depth: number }> | null;
  }>;
  locomotion:
    | Readonly<{ kind: 'ground'; speed: number }>
    | Readonly<{ kind: 'aerial'; speed: number }>
    | Readonly<{ kind: 'stationary'; speed: 0 }>;
  frontalDefense: Readonly<{ multiplier: number; exposeCoreMs: number | null }> | null;
  attacks: readonly AiAttackPatternDefinition[];
}>;

export type DropTableEntry = Readonly<{
  itemId: ItemId;
  quantity: number;
  weight: number;
}>;

export type DropTableDefinition = Readonly<{
  dropTableId: DropTableId;
  entries: readonly DropTableEntry[];
}>;

export type LayerScope = Readonly<{ kind: 'area' }> | Readonly<{ kind: 'room'; roomId: RoomId }>;

export type LayerDefinition = Readonly<{
  layerId: LayerId;
  scope: LayerScope;
  depth: number;
  parallax: Vec2;
  offset: Vec2;
  textureKey: AssetKey | null;
}>;

export type RoomDefinition = Readonly<{
  roomId: RoomId;
  displayName: string;
  bounds: Rect;
  cameraBounds: Rect;
  discoveryId: DiscoveryId | null;
}>;

export type SurfaceDefinition = Readonly<{
  surfaceId: SurfaceId;
  kind: 'solid' | 'one-way';
  roomId: RoomId;
  bounds: Rect;
  materialId: MaterialId;
}>;

export type ZoneDefinition =
  | Readonly<{
      zoneId: ZoneId;
      kind: 'climb' | 'water';
      roomId: RoomId;
      bounds: Rect;
    }>
  | Readonly<{
      zoneId: ZoneId;
      kind: 'hazard';
      roomId: RoomId;
      bounds: Rect;
      attackId: AttackId;
    }>;

export type ActorSpawnDefinition = Readonly<{
  spawnId: ActorSpawnId;
  actorId: ActorId;
  roomId: RoomId;
  position: Vec2;
  facing: 'left' | 'right';
  encounterId: EncounterId | null;
}>;

export type TriggerAction =
  | Readonly<{ kind: 'set-fact'; factId: QuestFlagId }>
  | Readonly<{ kind: 'start-dialogue'; dialogueId: DialogueId }>
  | Readonly<{ kind: 'activate-mechanism'; mechanismId: MechanismId }>
  | Readonly<{ kind: 'interact-npc'; spawnId: ActorSpawnId }>
  | Readonly<{
      kind: 'activate-checkpoint';
      areaId: AreaId;
      checkpointId: CheckpointId;
    }>
  | Readonly<{ kind: 'start-boss'; bossId: BossId }>;

export type TriggerDefinition = Readonly<{
  triggerId: TriggerId;
  roomId: RoomId;
  bounds: Rect;
  activation: 'enter' | 'interact';
  action: TriggerAction;
}>;

export type MechanismDefinition =
  | Readonly<{
      mechanismId: MechanismId;
      kind: 'puzzle';
      roomId: RoomId;
      bounds: Rect;
      puzzleId: PuzzleId;
      requiredAbilityId: AbilityId | null;
      requiredFactId: QuestFlagId | null;
    }>
  | Readonly<{
      mechanismId: MechanismId;
      kind: 'shortcut';
      roomId: RoomId;
      bounds: Rect;
      shortcutId: ShortcutId;
      requiredAbilityId: AbilityId | null;
      requiredFactId: QuestFlagId | null;
    }>
  | Readonly<{
      mechanismId: MechanismId;
      kind: 'boss-lens';
      roomId: RoomId;
      bounds: Rect;
      bossId: BossId;
      requiredAbilityId: AbilityId;
      requiredFactId: null;
    }>;

export type CheckpointDefinition = Readonly<{
  checkpointId: CheckpointId;
  displayName: string;
  roomId: RoomId;
  interactionPosition: Vec2;
  safeZone: Rect;
  canonicalPosition: Vec2;
  facing: 'left' | 'right';
}>;

export type RoomTransitionDefinition = Readonly<{
  kind: 'room';
  transitionId: TransitionId;
  roomId: RoomId;
  bounds: Rect;
  activation: 'enter' | 'interact';
  targetRoomId: RoomId;
  targetPosition: Vec2;
  targetFacing: 'left' | 'right';
  predicate: WorldPredicate;
}>;

export type AreaTransitionDefinition = Readonly<{
  kind: 'area';
  transitionId: TransitionId;
  roomId: RoomId;
  bounds: Rect;
  activation: 'enter' | 'interact';
  targetAreaId: AreaId;
  targetCheckpointId: CheckpointId;
  predicate: WorldPredicate;
}>;

export type TransitionDefinition = RoomTransitionDefinition | AreaTransitionDefinition;

export type PropDefinition = Readonly<{
  propId: PropId;
  roomId: RoomId;
  textureKey: AssetKey | null;
  position: Vec2;
  depth: number;
  surfaceId: SurfaceId | null;
}>;

export type EncounterDefinition = Readonly<{
  encounterId: EncounterId;
  roomId: RoomId;
  activationBounds: Rect;
  spawnIds: readonly ActorSpawnId[];
  predicate: WorldPredicate;
  completionCommands: readonly ProgressionCommand[];
}>;

export type ChestDefinition = Readonly<{
  chestId: StableId<'chest'>;
  roomId: RoomId;
  bounds: Rect;
  prompt: string;
  predicate: WorldPredicate;
  rewardCommands: readonly ProgressionCommand[];
}>;

export type DiscoveryDefinition = Readonly<{
  discoveryId: DiscoveryId;
  displayName: string;
  description: string;
  roomId: RoomId;
  activation: 'room-entry' | 'interact';
  bounds: Rect | null;
  predicate: WorldPredicate;
  rewardCommands: readonly ProgressionCommand[];
}>;

export type BreakableDefinition = Readonly<{
  breakableId: BreakableId;
  displayName: string;
  roomId: RoomId;
  bounds: Rect;
  acceptedAttackIds: readonly AttackId[];
  shortcutId: ShortcutId;
}>;

export type PuzzleActivation = 'enter' | 'interact' | 'resonant-pulse';

export type PuzzleStepDefinition = Readonly<{
  mechanismId: MechanismId;
  activation: PuzzleActivation;
}>;

export type PuzzleProgramDefinition =
  | Readonly<{
      kind: 'timed-set';
      steps: readonly PuzzleStepDefinition[];
      windowMs: number;
    }>
  | Readonly<{
      kind: 'item-lock';
      step: PuzzleStepDefinition;
      itemId: ItemId;
      quantity: number;
    }>
  | Readonly<{
      kind: 'single';
      step: PuzzleStepDefinition;
      requiredWeaponLevel: number | null;
    }>
  | Readonly<{
      kind: 'ordered';
      steps: readonly PuzzleStepDefinition[];
    }>;

export type PuzzleDefinition = Readonly<{
  puzzleId: PuzzleId;
  displayName: string;
  description: string;
  roomId: RoomId;
  program: PuzzleProgramDefinition;
  predicate: WorldPredicate;
  rewardCommands: readonly ProgressionCommand[];
}>;

export type AreaDefinition = Readonly<{
  areaId: AreaId;
  regionId: RegionId;
  displayName: string;
  bounds: Rect;
  authoringGrid: number;
  backgroundSetId: BackgroundSetId | null;
  ambienceProfileId: AmbienceProfileId | null;
  musicCueId: MusicCueId | null;
  layers: readonly LayerDefinition[];
  rooms: readonly RoomDefinition[];
  surfaces: readonly SurfaceDefinition[];
  zones: readonly ZoneDefinition[];
  actorSpawns: readonly ActorSpawnDefinition[];
  triggers: readonly TriggerDefinition[];
  mechanisms: readonly MechanismDefinition[];
  checkpoints: readonly CheckpointDefinition[];
  transitions: readonly TransitionDefinition[];
  encounters: readonly EncounterDefinition[];
  chests: readonly ChestDefinition[];
  discoveries: readonly DiscoveryDefinition[];
  breakables: readonly BreakableDefinition[];
  props: readonly PropDefinition[];
  bossGates?: readonly Readonly<{
    gateId: StableId<'boss-gate'>;
    bossId: BossId;
    roomId: RoomId;
    bounds: Rect;
    side: 'entry' | 'exit';
  }>[];
}>;

export type ActorStats = Readonly<PlayerBaseStats & { maxPoise: number }>;

export type ActorCommonDefinition = Readonly<{
  actorId: ActorId;
  displayName: string;
  visualHeight: number;
  stats: ActorStats;
  movement: Readonly<{ maxSpeed: number; jumpSpeed: number }>;
  perception: Readonly<{ range: number }>;
  attackIds: readonly AttackId[];
  resistances: readonly Readonly<{ damageTypeId: DamageTypeId; multiplier: number }>[];
  dropTableId: DropTableId | null;
  animationSetId: AnimationSetId | null;
  audioSetId: AudioSetId | null;
  aiProfileId: AiProfileId | null;
}>;

export type EnemyActorDefinition = Readonly<
  Omit<ActorCommonDefinition, 'aiProfileId'> & {
    kind: 'enemy';
    aiProfileId: AiProfileId;
  }
>;

export type ActorDefinition =
  | Readonly<ActorCommonDefinition & { kind: 'player' | 'npc' }>
  | EnemyActorDefinition
  | Readonly<
      ActorCommonDefinition & {
        kind: 'boss';
        bossId: BossId;
        phases: readonly Readonly<{
          phaseId: BossPhaseId;
          attackIds: readonly AttackId[];
        }>[];
      }
    >;

export type BossLensDefinition = Readonly<{
  mechanismId: MechanismId;
  center: Vec2;
  activationRadius: number;
}>;

export type BossEncounterDefinition = Readonly<{
  encounterId: EncounterId;
  bossId: BossId;
  actorId: ActorId;
  spawnId: ActorSpawnId;
  areaId: AreaId;
  roomId: RoomId;
  entryCheckpointId: CheckpointId;
  spawnPosition: Vec2;
  spawnFacing: 'left' | 'right';
  roomBounds: Rect;
  combatBounds: Rect;
  floorY: number;
  body: Readonly<{ halfWidth: number; height: number }>;
  groundedHurtbox: Rect;
  throatHurtbox: Rect;
  sealedShellHurtbox: Rect;
  exposedHeartHurtbox: Rect;
  hoverAnchors: readonly Vec2[];
  phaseTwoBaseline: Vec2;
  lenses: readonly BossLensDefinition[];
  projectileCapacity: number;
  hazardCapacity: number;
}>;

export type AttackDefinition = Readonly<{
  attackId: AttackId;
  damage: DamagePacket;
  totalFrames: number;
  hitboxes: readonly Readonly<{
    hitboxId: HitboxId;
    fromFrame: number;
    toFrame: number;
    bounds: Rect;
  }>[];
  movementImpulse: Vec2;
  cancelWindows: readonly Readonly<{
    fromFrame: number;
    toFrame: number;
    intoAttackIds: readonly AttackId[];
  }>[];
  animationSetId: AnimationSetId | null;
  audioSetId: AudioSetId | null;
  cooldownMs: number;
  delivery: 'melee' | 'projectile' | 'radial' | 'hazard';
  knockback: Vec2;
  hitStopMs: number;
  tags: readonly AttackTag[];
  hitPolicy: Readonly<{ kind: 'once' }> | Readonly<{ kind: 'interval'; rehitIntervalMs: number }>;
  charge: Readonly<{ minimumMs: number; maximumMs: number }> | null;
}>;

export type AbilityDefinition = Readonly<{
  abilityId: AbilityId;
  displayName: string;
  manaCost: number;
  cooldownMs: number;
  unlockFactId: QuestFlagId | null;
  action:
    | Readonly<{ kind: 'attack'; attackId: AttackId }>
    | Readonly<{
        kind: 'projectile';
        projectileId: ProjectileId;
        attackId: AttackId;
        speed: number;
        lifetimeMs: number;
        bounds: Rect;
      }>
    | Readonly<{
        kind: 'dash';
        speed: number;
        durationMs: number;
        invulnerableMs: number;
        invulnerabilityStatusId: StatusEffectId;
      }>
    | Readonly<{
        kind: 'barrier';
        statusId: StableId<'status'>;
        durationMs: number;
        projectileAbsorptions: number;
      }>
    | Readonly<{
        kind: 'pulse';
        attackId: AttackId;
        radius: number;
        mechanismTag: 'rootglass-affecting';
      }>
    | Readonly<{ kind: 'restore'; resource: 'health' | 'mana'; amount: number }>;
}>;

export type ItemDefinition = Readonly<{
  charmEffect?: Readonly<{
    kind: 'briar-damage' | 'hit-protection' | 'parry-mana';
    amount: number;
  }>;
  recovery?: Readonly<{ resource: 'health' | 'mana'; amount: number }>;
  itemId: ItemId;
  displayName: string;
  category: 'material' | 'quest' | 'charm' | 'recovery';
  description: string;
  maxStack: number;
  equipment:
    | Readonly<{ slotId: EquipmentSlotId }>
    | Readonly<{ slotIds: readonly EquipmentSlotId[] }>
    | null;
}>;

export type QuestContentDefinition = Readonly<{
  definition: QuestDefinition;
  declaredFacts: readonly QuestFlagId[];
}>;

export type DialogueEffect = ProgressionCommand;

export type DialogueCondition = Readonly<{
  requiresFacts?: readonly QuestFlagId[];
  excludesFacts?: readonly QuestFlagId[];
  questStages?: readonly Readonly<{
    questId: StableId<'quest'>;
    stageIds: readonly StableId<'quest-stage'>[];
  }>[];
  excludesQuestStages?: readonly Readonly<{
    questId: StableId<'quest'>;
    stageIds: readonly StableId<'quest-stage'>[];
  }>[];
  requiresDefeatedBosses?: readonly BossId[];
  excludesDefeatedBosses?: readonly BossId[];
}>;

export type DialogueChoiceDefinition = Readonly<{
  choiceId: DialogueChoiceId;
  text: string;
  targetNodeId: DialogueNodeId | null;
  effects: readonly DialogueEffect[];
  rewardId?: ProgressionRewardId | null;
  condition?: DialogueCondition;
}>;

export type DialogueNodeDefinition = Readonly<{
  nodeId: DialogueNodeId;
  speakerActorId: ActorId;
  text: string;
  requiresAll: readonly QuestFlagId[];
  condition?: DialogueCondition;
  choices: readonly DialogueChoiceDefinition[];
}>;

export type DialogueDefinition = Readonly<{
  dialogueId: DialogueId;
  entryNodeId: DialogueNodeId;
  entryNodeIds?: readonly DialogueNodeId[];
  nodes: readonly DialogueNodeDefinition[];
}>;

export type NpcDefinition = Readonly<{
  actorId: ActorId;
  spawnId: ActorSpawnId;
  role: 'cartographer' | 'smith' | 'herbalist';
  prompt: string;
  dialogueId: DialogueId;
  defaultFacing: 'left' | 'right';
  shopId: ShopId | null;
}>;

export type ShopOfferDefinition = Readonly<{
  offerId: ShopOfferId;
  shopId: ShopId;
  soldOutFactId: QuestFlagId | null;
  displayName: string;
  description: string;
  price: number;
  itemId: ItemId | null;
  prerequisites: readonly QuestFlagId[];
  stockPolicy: 'repeatable' | 'one-time';
  commands: readonly ProgressionCommand[];
  rewardId: ProgressionRewardId | null;
}>;

export type NewGameDefinition = Readonly<{
  initialRegionId: RegionId;
  initialAreaId: AreaId;
  initialCheckpointId: CheckpointId;
  baseStats: PlayerBaseStats;
  initialQuests: QuestSnapshot;
  startingAbilities: readonly AbilityId[];
}>;

export type ContentRegistry = Readonly<{
  assetKeys: readonly AssetKey[];
  backgroundSets: readonly BackgroundSetDefinition[];
  ambienceProfiles: readonly AmbienceDefinition[];
  musicCues: readonly MusicCueDefinition[];
  animationSets: readonly AnimationSetDefinition[];
  audioSets: readonly AudioSetDefinition[];
  aiProfiles: readonly AiProfileDefinition[];
  dropTables: readonly DropTableDefinition[];
  bossEncounters: readonly BossEncounterDefinition[];
  areas: readonly AreaDefinition[];
  puzzles: readonly PuzzleDefinition[];
  actors: readonly ActorDefinition[];
  attacks: readonly AttackDefinition[];
  abilities: readonly AbilityDefinition[];
  items: readonly ItemDefinition[];
  quests: readonly QuestContentDefinition[];
  dialogue: readonly DialogueDefinition[];
  npcs: readonly NpcDefinition[];
  shopOffers: readonly ShopOfferDefinition[];
  newGame: NewGameDefinition;
}>;

export function rectContainsPoint(rect: Rect, point: Vec2): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x < rect.x + rect.width &&
    point.y < rect.y + rect.height
  );
}

export function rectContainsRect(container: Rect, child: Rect): boolean {
  return (
    child.x >= container.x &&
    child.y >= container.y &&
    child.x + child.width <= container.x + container.width &&
    child.y + child.height <= container.y + container.height
  );
}
