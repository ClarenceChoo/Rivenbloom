export type StableId = string;

export type PointDefinition = {
  readonly x: number;
  readonly y: number;
};

export type SizeDefinition = {
  readonly width: number;
  readonly height: number;
};

export type RectDefinition = PointDefinition & SizeDefinition;

export type SourceRectDefinition = RectDefinition;

export type RenderDefinition = {
  readonly assetKey: StableId;
  readonly source?: SourceRectDefinition;
  readonly size: SizeDefinition;
  readonly origin: PointDefinition;
  readonly depth: number;
};

export type CollisionBodyDefinition = {
  readonly offset: PointDefinition;
  readonly size: SizeDefinition;
};

export type SurfaceDefinition = {
  readonly id: StableId;
  readonly roomId: StableId;
  readonly kind: 'solid' | 'one-way' | 'climb' | 'water' | 'hazard';
  readonly collision: RectDefinition;
  readonly materialId: StableId;
  readonly damage?: number;
};

export type LayerDefinition = {
  readonly id: StableId;
  readonly roomId?: StableId;
  readonly kind: 'far' | 'mid' | 'gameplay' | 'foreground';
  readonly assetKey: StableId;
  readonly position: PointDefinition;
  readonly size: SizeDefinition;
  readonly depth: number;
  readonly scrollFactor: number;
  readonly source?: SourceRectDefinition;
};

export type PlayerSpawnDefinition = {
  readonly id: StableId;
  readonly roomId: StableId;
  readonly position: PointDefinition;
  readonly facing: 'left' | 'right';
};

export type ActorSpawnDefinition = {
  readonly id: StableId;
  readonly roomId: StableId;
  readonly actorId: StableId;
  readonly position: PointDefinition;
  readonly facing: 'left' | 'right';
  readonly encounterId?: StableId;
};

export type TriggerDefinition = {
  readonly id: StableId;
  readonly roomId: StableId;
  readonly kind: 'room-entry' | 'interaction' | 'discovery' | 'quest' | 'transition' | 'checkpoint';
  readonly bounds: RectDefinition;
  readonly targetId?: StableId;
  readonly once: boolean;
};

export type MechanismDefinition = {
  readonly id: StableId;
  readonly roomId: StableId;
  readonly kind: 'listening-arch' | 'lens' | 'shortcut' | 'seed-lantern' | 'rootglass-forge';
  readonly position: PointDefinition;
  readonly triggerId: StableId;
  readonly requiredAbilityId?: StableId;
  readonly questId?: StableId;
  readonly rewardItemId?: StableId;
  readonly persistentFlagId: StableId;
};

export type CheckpointDefinition = {
  readonly id: StableId;
  readonly roomId: StableId;
  readonly triggerId: StableId;
  readonly spawnId: StableId;
  readonly position: PointDefinition;
};

export type TransitionDefinition = {
  readonly id: StableId;
  readonly roomId: StableId;
  readonly triggerId: StableId;
  readonly destinationAreaId: StableId;
  readonly destinationSpawnId: StableId;
};

export type PropDefinition = {
  readonly id: StableId;
  readonly roomId: StableId;
  readonly position: PointDefinition;
  readonly render: RenderDefinition;
  readonly surfaceId?: StableId;
  readonly mechanismId?: StableId;
};

export type RoomDefinition = {
  readonly id: StableId;
  readonly displayName: string;
  readonly bounds: RectDefinition;
  readonly discoveryId: StableId;
  readonly ambienceProfileId?: StableId;
};

export type AreaDefinition = {
  readonly id: StableId;
  readonly displayName: string;
  readonly regionId: StableId;
  readonly bounds: RectDefinition;
  readonly defaultSpawnId: StableId;
  readonly ambienceProfileId: StableId;
  readonly rooms: readonly RoomDefinition[];
  readonly layers: readonly LayerDefinition[];
  readonly surfaces: readonly SurfaceDefinition[];
  readonly playerSpawns: readonly PlayerSpawnDefinition[];
  readonly actorSpawns: readonly ActorSpawnDefinition[];
  readonly triggers: readonly TriggerDefinition[];
  readonly mechanisms: readonly MechanismDefinition[];
  readonly checkpoints: readonly CheckpointDefinition[];
  readonly transitions: readonly TransitionDefinition[];
  readonly props: readonly PropDefinition[];
};

export type DamageType = 'physical' | 'resonance' | 'spore' | 'rootglass';

export type DamagePacketDefinition = {
  readonly amount: number;
  readonly poise: number;
  readonly knockback: PointDefinition;
  readonly hitStopMs: number;
  readonly type: DamageType;
  readonly tags: readonly StableId[];
};

export type HitboxKeyframeDefinition = {
  readonly startFrame: number;
  readonly endFrame: number;
  readonly bounds: CollisionBodyDefinition;
};

export type AttackDefinition = {
  readonly id: StableId;
  readonly displayName: string;
  readonly anticipationFrames: number;
  readonly activeFrames: number;
  readonly recoveryFrames: number;
  readonly hitboxes: readonly HitboxKeyframeDefinition[];
  readonly damage: DamagePacketDefinition;
  readonly movementImpulse: PointDefinition;
  readonly cancelAfterFrame: number;
  readonly cooldownMs: number;
  readonly soundCueId: StableId;
  readonly effectCueId: StableId;
};

export type BossDefinition = {
  readonly phaseOneAttackIds: readonly StableId[];
  readonly phaseTwoAttackIds: readonly StableId[];
  readonly transitionAttackId: StableId;
  readonly requiredMechanismIds: readonly StableId[];
  readonly defeatItemId: StableId;
  readonly defeatQuestId: StableId;
};

export type ActorDefinition = {
  readonly id: StableId;
  readonly displayName: string;
  readonly kind: 'player' | 'npc' | 'enemy' | 'elite' | 'boss';
  readonly stats: {
    readonly maxHealth: number;
    readonly maxMana: number;
    readonly power: number;
    readonly defence: number;
    readonly poise: number;
  };
  readonly movement: {
    readonly speed: number;
    readonly acceleration: number;
    readonly jumpVelocity: number;
  };
  readonly perception: {
    readonly range: number;
    readonly hearingRange: number;
  };
  readonly attackIds: readonly StableId[];
  readonly abilityIds: readonly StableId[];
  readonly resistances: Readonly<Partial<Record<DamageType, number>>>;
  readonly drops: readonly {
    readonly itemId: StableId;
    readonly chance: number;
    readonly quantity: number;
  }[];
  readonly render: RenderDefinition;
  readonly collisionBody: CollisionBodyDefinition;
  readonly hurtboxes: readonly CollisionBodyDefinition[];
  readonly animationSetId: StableId;
  readonly audioSetId: StableId;
  readonly aiProfileId: StableId;
  readonly boss?: BossDefinition;
};

export type AbilityDefinition = {
  readonly id: StableId;
  readonly displayName: string;
  readonly kind: 'spell' | 'movement' | 'guard' | 'mechanism';
  readonly manaCost: number;
  readonly cooldownMs: number;
  readonly attackId?: StableId;
  readonly requiredQuestId?: StableId;
};

export type ItemDefinition = {
  readonly id: StableId;
  readonly displayName: string;
  readonly kind: 'weapon' | 'charm' | 'quest' | 'upgrade' | 'currency';
  readonly description: string;
  readonly maxStack: number;
  readonly value: number;
  readonly abilityIds: readonly StableId[];
};

export type QuestStageDefinition = {
  readonly id: StableId;
  readonly objective: string;
  readonly dialogueId?: StableId;
  readonly requiredItemIds: readonly StableId[];
  readonly grantedItemIds: readonly StableId[];
  readonly grantedAbilityIds: readonly StableId[];
};

export type QuestDefinition = {
  readonly id: StableId;
  readonly displayName: string;
  readonly kind: 'main' | 'discovery';
  readonly initialStageId: StableId;
  readonly stages: readonly QuestStageDefinition[];
  readonly prerequisiteQuestIds: readonly StableId[];
};

export type DialogueChoiceDefinition = {
  readonly id: StableId;
  readonly text: string;
  readonly nextNodeId?: StableId;
  readonly requiredQuestId?: StableId;
};

export type DialogueNodeDefinition = {
  readonly id: StableId;
  readonly speakerActorId: StableId;
  readonly text: string;
  readonly nextNodeId?: StableId;
  readonly choices: readonly DialogueChoiceDefinition[];
  readonly questId?: StableId;
  readonly questStageId?: StableId;
};

export type DialogueDefinition = {
  readonly id: StableId;
  readonly entryNodeId: StableId;
  readonly nodes: readonly DialogueNodeDefinition[];
};

export type AmbienceProfileDefinition = {
  readonly id: StableId;
  readonly musicCueId: StableId;
  readonly ambientCueIds: readonly StableId[];
  readonly rain: {
    readonly enabled: boolean;
    readonly density: number;
    readonly drift: number;
  };
  readonly colour: {
    readonly shadow: string;
    readonly light: string;
  };
};

export type ContentRegistry = {
  readonly areas: readonly AreaDefinition[];
  readonly actors: readonly ActorDefinition[];
  readonly attacks: readonly AttackDefinition[];
  readonly abilities: readonly AbilityDefinition[];
  readonly items: readonly ItemDefinition[];
  readonly quests: readonly QuestDefinition[];
  readonly dialogues: readonly DialogueDefinition[];
  readonly ambienceProfiles: readonly AmbienceProfileDefinition[];
};

export type ContentIssue = {
  readonly code:
    | 'invalid-stable-id'
    | 'duplicate-id'
    | 'unresolved-reference'
    | 'missing-required-field';
  readonly path: string;
  readonly id?: StableId;
  readonly message: string;
};

export type LoadedRoom = {
  readonly id: StableId;
  readonly displayName: string;
  readonly bounds: RectDefinition;
  readonly discoveryId: StableId;
  readonly ambienceProfileId: StableId;
  readonly layerIds: readonly StableId[];
  readonly surfaceIds: readonly StableId[];
  readonly playerSpawnIds: readonly StableId[];
  readonly actorSpawnIds: readonly StableId[];
  readonly triggerIds: readonly StableId[];
  readonly mechanismIds: readonly StableId[];
  readonly checkpointIds: readonly StableId[];
  readonly transitionIds: readonly StableId[];
  readonly propIds: readonly StableId[];
};

export type LoadedArea = {
  readonly areaId: StableId;
  readonly displayName: string;
  readonly regionId: StableId;
  readonly bounds: RectDefinition;
  readonly ambienceProfileId: StableId;
  readonly initialSpawn: PlayerSpawnDefinition;
  readonly layers: readonly LayerDefinition[];
  readonly rooms: readonly LoadedRoom[];
};
