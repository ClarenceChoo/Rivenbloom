import { describe, expect, test } from 'vitest';

import { QuestStore } from '../../src/game/quests/QuestStore';
import type { QuestDefinition } from '../../src/game/quests/QuestStore';
import { CONTENT_REGISTRY, PUZZLES, WRENS_REST_AREA } from '../../src/game/data/areas';
import { sortContentIssues, validateContent } from '../../src/game/data/ContentValidation';
import type {
  ActorDefinition,
  AreaDefinition,
  AttackDefinition,
  ContentIssue,
  ContentRegistry,
  QuestContentDefinition,
} from '../../src/game/data/types';
import type { AreaId, CheckpointId, RoomId } from '../../src/game/saves/SaveSchema';
import type { StableId } from '../../src/game/core/StableId';
import type { AssetKey } from '../../src/game/data/types';
import { WORLD_ALWAYS } from '../../src/game/world/WorldPredicates';

function registryWith(patch: Partial<ContentRegistry>): ContentRegistry {
  return { ...CONTENT_REGISTRY, ...patch };
}

function areaWith(patch: Partial<AreaDefinition>): AreaDefinition {
  return { ...WRENS_REST_AREA, ...patch };
}

function attackWith(patch: Partial<AttackDefinition>): AttackDefinition {
  return {
    attackId: 'test-strike' as StableId<'attack'>,
    damage: {
      baseDamage: 1,
      damageType: 'physical' as StableId<'damage-type'>,
      poiseDamage: 0,
      critical: { kind: 'excluded' },
    },
    totalFrames: 12,
    hitboxes: [],
    movementImpulse: { x: 0, y: 0 },
    cancelWindows: [],
    animationSetId: null,
    audioSetId: null,
    cooldownMs: 0,
    delivery: 'melee',
    knockback: { x: 0, y: 0 },
    hitStopMs: 55,
    tags: ['blockable'],
    hitPolicy: { kind: 'once' },
    charge: null,
    ...patch,
  };
}

describe('content validation', () => {
  test("accepts the immutable Wren's Rest registry at final logical scale", () => {
    expect(validateContent(CONTENT_REGISTRY)).toEqual([]);
    expect(CONTENT_REGISTRY.areas).toHaveLength(5);
    expect(WRENS_REST_AREA).toMatchObject({
      areaId: 'wren-rest',
      regionId: 'brackenreach',
      bounds: { x: 0, y: 0, width: 4480, height: 720 },
      rooms: [
        {
          roomId: 'wren-rest-square',
          bounds: { x: 0, y: 0, width: 2560, height: 720 },
        },
        {
          roomId: 'wren-herb-loft',
          bounds: { x: 2560, y: 0, width: 960, height: 720 },
        },
        {
          roomId: 'wren-forge-cellar',
          bounds: { x: 3520, y: 0, width: 960, height: 720 },
        },
      ],
      surfaces: [
        {
          kind: 'solid',
          bounds: { x: 0, y: 608, width: 2560, height: 112 },
        },
        {
          kind: 'solid',
          bounds: { x: 2560, y: 608, width: 960, height: 112 },
        },
        {
          kind: 'solid',
          bounds: { x: 3520, y: 608, width: 960, height: 112 },
        },
        {
          kind: 'one-way',
          bounds: { x: 2816, y: 448, width: 320, height: 24 },
        },
      ],
      checkpoints: [
        {
          checkpointId: 'village-well',
          canonicalPosition: { x: 256, y: 608 },
        },
      ],
    });
    expect(Object.isFrozen(CONTENT_REGISTRY)).toBe(true);
    expect(Object.isFrozen(WRENS_REST_AREA.layers)).toBe(true);
    expect(Object.isFrozen(CONTENT_REGISTRY.actors[0])).toBe(true);
    expect(Object.isFrozen(CONTENT_REGISTRY.actors[0]!.stats)).toBe(true);
    expect(Reflect.set(CONTENT_REGISTRY.actors[0]!.stats, 'maxHealth', 1)).toBe(false);
    expect(CONTENT_REGISTRY.actors[0]!.stats.maxHealth).toBe(100);
  });

  test('reports invalid and duplicate stable IDs in their own namespaces', () => {
    const actor = CONTENT_REGISTRY.actors[0]!;
    const issues = validateContent(
      registryWith({
        areas: [areaWith({ regionId: 'Bracken Reach' as typeof WRENS_REST_AREA.regionId })],
        actors: [actor, { ...actor }],
      }),
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'invalid-id', path: '/areas/0/regionId' }),
        expect.objectContaining({ code: 'duplicate-id', path: '/actors/1/actorId' }),
      ]),
    );
  });

  test('reports non-finite values and room-relative geometry outside its authored bounds', () => {
    const room = WRENS_REST_AREA.rooms[0]!;
    const ground = WRENS_REST_AREA.surfaces[0]!;
    const issues = validateContent(
      registryWith({
        areas: [
          areaWith({
            layers: [
              { ...WRENS_REST_AREA.layers[0]!, depth: Number.NaN },
              ...WRENS_REST_AREA.layers.slice(1),
            ],
            rooms: [{ ...room, cameraBounds: { ...room.cameraBounds, width: 0 } }],
            surfaces: [{ ...ground, bounds: { ...ground.bounds, x: -16 } }],
          }),
        ],
      }),
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'invalid-value', path: '/areas/0/layers/0/depth' }),
        expect.objectContaining({
          code: 'invalid-geometry',
          path: '/areas/0/rooms/0/cameraBounds',
        }),
        expect.objectContaining({ code: 'invalid-geometry', path: '/areas/0/surfaces/0/bounds' }),
      ]),
    );
  });

  test('rejects rectangles whose finite components overflow to a non-finite edge', () => {
    const issues = validateContent(
      registryWith({
        areas: [
          areaWith({
            bounds: {
              x: Number.MAX_VALUE,
              y: 0,
              width: Number.MAX_VALUE,
              height: 720,
            },
          }),
        ],
      }),
    );

    expect(issues).toContainEqual(
      expect.objectContaining({ code: 'invalid-geometry', path: '/areas/0/bounds' }),
    );
  });

  test('reports checkpoint safe-zone and canonical-position errors at exclusive right edges', () => {
    const checkpoint = WRENS_REST_AREA.checkpoints[0]!;
    const issues = validateContent(
      registryWith({
        areas: [
          areaWith({
            checkpoints: [
              {
                ...checkpoint,
                safeZone: { x: 2480, y: 560, width: 96, height: 176 },
                canonicalPosition: { x: 2576, y: 608 },
              },
            ],
          }),
        ],
      }),
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-geometry',
          path: '/areas/0/checkpoints/0/safeZone',
        }),
        expect.objectContaining({
          code: 'inaccessible-checkpoint',
          path: '/areas/0/checkpoints/0/canonicalPosition',
        }),
      ]),
    );
  });

  test('reports every area-side cross-reference family without stopping at the first issue', () => {
    const checkpoint = WRENS_REST_AREA.checkpoints[0]!;
    const issues = validateContent(
      registryWith({
        areas: [
          areaWith({
            backgroundSetId: 'missing-background' as StableId<'background-set'>,
            ambienceProfileId: 'missing-ambience' as StableId<'ambience-profile'>,
            musicCueId: 'missing-music' as StableId<'music-cue'>,
            layers: [
              {
                ...WRENS_REST_AREA.layers[0]!,
                scope: { kind: 'room', roomId: 'missing-room' as typeof checkpoint.roomId },
                textureKey: 'missing-layer-asset' as StableId<'asset'>,
              },
            ],
            zones: [
              {
                zoneId: 'thorn-bed' as StableId<'zone'>,
                kind: 'hazard',
                roomId: checkpoint.roomId,
                bounds: { x: 512, y: 576, width: 64, height: 32 },
                attackId: 'missing-hazard-attack' as StableId<'attack'>,
              },
            ],
            actorSpawns: [
              {
                ...WRENS_REST_AREA.actorSpawns[0]!,
                actorId: 'missing-actor' as StableId<'actor'>,
              },
            ],
            triggers: [
              {
                triggerId: 'missing-dialogue-trigger' as StableId<'trigger'>,
                roomId: checkpoint.roomId,
                bounds: { x: 320, y: 544, width: 32, height: 64 },
                activation: 'interact',
                action: {
                  kind: 'start-dialogue',
                  dialogueId: 'missing-dialogue' as StableId<'dialogue'>,
                },
              },
            ],
            mechanisms: [
              {
                mechanismId: 'sealed-well' as StableId<'mechanism'>,
                kind: 'puzzle',
                roomId: checkpoint.roomId,
                bounds: { x: 352, y: 544, width: 32, height: 64 },
                puzzleId: 'sealed-well-puzzle' as StableId<'puzzle'>,
                requiredAbilityId: 'missing-ability' as StableId<'ability'>,
                requiredFactId: 'missing-fact' as StableId<'quest-flag'>,
              },
            ],
            props: [
              {
                propId: 'well-rope' as StableId<'prop'>,
                roomId: checkpoint.roomId,
                position: { x: 256, y: 608 },
                depth: 2,
                textureKey: 'missing-prop-asset' as StableId<'asset'>,
                surfaceId: 'missing-surface' as StableId<'surface'>,
              },
            ],
          }),
        ],
      }),
    );

    for (const path of [
      '/areas/0/backgroundSetId',
      '/areas/0/ambienceProfileId',
      '/areas/0/musicCueId',
      '/areas/0/layers/0/scope/roomId',
      '/areas/0/layers/0/textureKey',
      '/areas/0/zones/0/attackId',
      '/areas/0/actorSpawns/0/actorId',
      '/areas/0/triggers/0/action/dialogueId',
      '/areas/0/mechanisms/0/requiredAbilityId',
      '/areas/0/mechanisms/0/requiredFactId',
      '/areas/0/props/0/textureKey',
      '/areas/0/props/0/surfaceId',
    ]) {
      expect(issues).toContainEqual(expect.objectContaining({ code: 'missing-reference', path }));
    }
  });

  test('requires a transition checkpoint to belong to its target area', () => {
    const target = areaWith({
      areaId: 'bracken-gate' as AreaId,
      checkpoints: [
        {
          ...WRENS_REST_AREA.checkpoints[0]!,
          checkpointId: 'bracken-gate-post' as CheckpointId,
        },
      ],
    });
    const source = areaWith({
      transitions: [
        {
          kind: 'area',
          transitionId: 'to-bracken-gate' as StableId<'transition'>,
          roomId: WRENS_REST_AREA.rooms[0]!.roomId,
          bounds: { x: 2480, y: 480, width: 80, height: 128 },
          activation: 'enter',
          targetAreaId: target.areaId,
          targetCheckpointId: WRENS_REST_AREA.checkpoints[0]!.checkpointId,
          predicate: WORLD_ALWAYS,
        },
      ],
    });

    expect(validateContent(registryWith({ areas: [source, target] }))).toContainEqual(
      expect.objectContaining({
        code: 'invalid-reference',
        path: '/areas/0/transitions/0/targetCheckpointId',
      }),
    );
  });

  test('requires every room-owned definition to reference a room in its own area', () => {
    const sourceRoom = WRENS_REST_AREA.rooms[0]!;
    const foreignRoomId = 'bracken-gate-yard' as RoomId;
    const targetCheckpointId = 'bracken-gate-post' as CheckpointId;
    const foreignArea = areaWith({
      areaId: 'bracken-gate' as AreaId,
      displayName: 'Bracken Gate',
      layers: [],
      rooms: [{ ...sourceRoom, roomId: foreignRoomId, displayName: 'Gate Yard' }],
      surfaces: [],
      zones: [],
      actorSpawns: [],
      triggers: [],
      mechanisms: [],
      checkpoints: [
        {
          ...WRENS_REST_AREA.checkpoints[0]!,
          checkpointId: targetCheckpointId,
          roomId: foreignRoomId,
        },
      ],
      transitions: [],
      props: [],
    });
    const surfaceId = 'foreign-room-surface' as StableId<'surface'>;
    const mechanismId = 'foreign-room-mechanism' as StableId<'mechanism'>;
    const sourceArea = areaWith({
      surfaces: [
        {
          ...WRENS_REST_AREA.surfaces[0]!,
          surfaceId,
          roomId: foreignRoomId,
        },
      ],
      zones: [
        {
          zoneId: 'foreign-room-zone' as StableId<'zone'>,
          kind: 'water',
          roomId: foreignRoomId,
          bounds: { x: 0, y: 576, width: 32, height: 32 },
        },
      ],
      actorSpawns: [
        {
          ...WRENS_REST_AREA.actorSpawns[0]!,
          spawnId: 'foreign-room-spawn' as StableId<'actor-spawn'>,
          roomId: foreignRoomId,
        },
      ],
      triggers: [
        {
          triggerId: 'foreign-room-trigger' as StableId<'trigger'>,
          roomId: foreignRoomId,
          bounds: { x: 320, y: 544, width: 32, height: 64 },
          activation: 'interact',
          action: { kind: 'activate-mechanism', mechanismId },
        },
      ],
      mechanisms: [
        {
          mechanismId,
          kind: 'puzzle',
          roomId: foreignRoomId,
          bounds: { x: 352, y: 544, width: 32, height: 64 },
          puzzleId: 'foreign-room-puzzle' as StableId<'puzzle'>,
          requiredAbilityId: null,
          requiredFactId: null,
        },
      ],
      checkpoints: [
        {
          ...WRENS_REST_AREA.checkpoints[0]!,
          checkpointId: 'foreign-room-checkpoint' as CheckpointId,
          roomId: foreignRoomId,
        },
      ],
      transitions: [
        {
          kind: 'area',
          transitionId: 'foreign-room-transition' as StableId<'transition'>,
          roomId: foreignRoomId,
          bounds: { x: 2480, y: 480, width: 80, height: 128 },
          activation: 'enter',
          targetAreaId: foreignArea.areaId,
          targetCheckpointId,
          predicate: WORLD_ALWAYS,
        },
      ],
      props: [
        {
          propId: 'foreign-room-prop' as StableId<'prop'>,
          roomId: foreignRoomId,
          textureKey: null,
          position: { x: 256, y: 608 },
          depth: 1,
          surfaceId,
        },
      ],
    });
    const issues = validateContent(registryWith({ areas: [sourceArea, foreignArea] }));

    for (const path of [
      '/areas/0/surfaces/0/roomId',
      '/areas/0/zones/0/roomId',
      '/areas/0/actorSpawns/0/roomId',
      '/areas/0/triggers/0/roomId',
      '/areas/0/mechanisms/0/roomId',
      '/areas/0/checkpoints/0/roomId',
      '/areas/0/transitions/0/roomId',
      '/areas/0/props/0/roomId',
    ]) {
      expect(issues).toContainEqual(expect.objectContaining({ code: 'invalid-reference', path }));
    }
  });

  test('validates trigger fact and mechanism actions plus missing transition targets', () => {
    const roomId = WRENS_REST_AREA.rooms[0]!.roomId;
    const issues = validateContent(
      registryWith({
        areas: [
          areaWith({
            triggers: [
              {
                triggerId: 'set-missing-fact' as StableId<'trigger'>,
                roomId,
                bounds: { x: 320, y: 544, width: 32, height: 64 },
                activation: 'enter',
                action: {
                  kind: 'set-fact',
                  factId: 'missing-fact' as StableId<'quest-flag'>,
                },
              },
              {
                triggerId: 'start-missing-mechanism' as StableId<'trigger'>,
                roomId,
                bounds: { x: 352, y: 544, width: 32, height: 64 },
                activation: 'interact',
                action: {
                  kind: 'activate-mechanism',
                  mechanismId: 'missing-mechanism' as StableId<'mechanism'>,
                },
              },
            ],
            transitions: [
              {
                kind: 'area',
                transitionId: 'to-missing-area' as StableId<'transition'>,
                roomId,
                bounds: { x: 2480, y: 480, width: 80, height: 128 },
                activation: 'enter',
                targetAreaId: 'missing-area' as AreaId,
                targetCheckpointId: 'missing-checkpoint' as CheckpointId,
                predicate: WORLD_ALWAYS,
              },
            ],
          }),
        ],
      }),
    );

    for (const path of [
      '/areas/0/triggers/0/action/factId',
      '/areas/0/triggers/1/action/mechanismId',
      '/areas/0/transitions/0/targetAreaId',
      '/areas/0/transitions/0/targetCheckpointId',
    ]) {
      expect(issues).toContainEqual(expect.objectContaining({ code: 'missing-reference', path }));
    }
  });

  test('validates supporting texture and audio asset links', () => {
    const issues = validateContent(
      registryWith({
        backgroundSets: [
          {
            backgroundSetId: 'village-background' as StableId<'background-set'>,
            textureKeys: ['missing-background-texture' as AssetKey],
          },
        ],
        ambienceProfiles: [
          {
            ambienceProfileId: 'village-ambience' as StableId<'ambience-profile'>,
            audioSetId: 'missing-ambience-audio' as StableId<'audio-set'>,
          },
        ],
        musicCues: [
          {
            musicCueId: 'village-music' as StableId<'music-cue'>,
            assetKey: 'missing-music-asset' as AssetKey,
          },
        ],
        animationSets: [
          {
            animationSetId: 'mara-animations' as StableId<'animation-set'>,
            textureKeys: ['missing-animation-texture' as AssetKey],
          },
        ],
        audioSets: [
          {
            audioSetId: 'mara-audio' as StableId<'audio-set'>,
            assetKeys: ['missing-audio-asset' as AssetKey],
          },
        ],
      }),
    );

    for (const path of [
      '/backgroundSets/0/textureKeys/0',
      '/ambienceProfiles/0/audioSetId',
      '/musicCues/0/assetKey',
      '/animationSets/0/textureKeys/0',
      '/audioSets/0/assetKeys/0',
    ]) {
      expect(issues).toContainEqual(expect.objectContaining({ code: 'missing-reference', path }));
    }
  });

  test('validates attack cancel, animation, and audio references', () => {
    const issues = validateContent(
      registryWith({
        attacks: [
          attackWith({
            cancelWindows: [
              {
                fromFrame: 2,
                toFrame: 4,
                intoAttackIds: ['missing-follow-up' as StableId<'attack'>],
              },
            ],
            animationSetId: 'missing-animation-set' as StableId<'animation-set'>,
            audioSetId: 'missing-audio-set' as StableId<'audio-set'>,
          }),
        ],
      }),
    );

    for (const path of [
      '/attacks/0/cancelWindows/0/intoAttackIds/0',
      '/attacks/0/animationSetId',
      '/attacks/0/audioSetId',
    ]) {
      expect(issues).toContainEqual(expect.objectContaining({ code: 'missing-reference', path }));
    }
  });

  test('reports duplicate IDs in nested area, attack, dialogue node, and choice namespaces', () => {
    const layer = WRENS_REST_AREA.layers[0]!;
    const surface = WRENS_REST_AREA.surfaces[0]!;
    const checkpoint = WRENS_REST_AREA.checkpoints[0]!;
    const hitboxId = 'shared-hitbox' as StableId<'hitbox'>;
    const nodeId = 'shared-node' as StableId<'dialogue-node'>;
    const choiceId = 'shared-choice' as StableId<'dialogue-choice'>;
    const issues = validateContent(
      registryWith({
        areas: [
          areaWith({
            layers: [layer, { ...layer }],
            surfaces: [surface, { ...surface }],
            checkpoints: [checkpoint, { ...checkpoint }],
          }),
        ],
        attacks: [
          attackWith({
            hitboxes: [
              {
                hitboxId,
                fromFrame: 1,
                toFrame: 2,
                bounds: { x: 0, y: 0, width: 16, height: 16 },
              },
              {
                hitboxId,
                fromFrame: 3,
                toFrame: 4,
                bounds: { x: 0, y: 0, width: 16, height: 16 },
              },
            ],
          }),
        ],
        dialogue: [
          {
            dialogueId: 'nested-duplicates' as StableId<'dialogue'>,
            entryNodeId: nodeId,
            nodes: [
              {
                nodeId,
                speakerActorId: CONTENT_REGISTRY.actors[0]!.actorId,
                text: 'First node.',
                requiresAll: [],
                choices: [
                  { choiceId, text: 'First.', targetNodeId: null, effects: [] },
                  { choiceId, text: 'Second.', targetNodeId: null, effects: [] },
                ],
              },
              {
                nodeId,
                speakerActorId: CONTENT_REGISTRY.actors[0]!.actorId,
                text: 'Second node.',
                requiresAll: [],
                choices: [],
              },
            ],
          },
        ],
      }),
    );

    for (const path of [
      '/areas/0/layers/1/layerId',
      '/areas/0/surfaces/1/surfaceId',
      '/areas/0/checkpoints/1/checkpointId',
      '/attacks/0/hitboxes/1/hitboxId',
      '/dialogue/0/nodes/1/nodeId',
      '/dialogue/0/nodes/0/choices/1/choiceId',
    ]) {
      expect(issues).toContainEqual(expect.objectContaining({ code: 'duplicate-id', path }));
    }
  });

  test('reports actor, ability, drop, dialogue, fact, cue, and boss phase references', () => {
    const mara = CONTENT_REGISTRY.actors[0]!;
    const invalidBoss: ActorDefinition = {
      ...mara,
      kind: 'boss',
      actorId: 'ash-warden' as StableId<'actor'>,
      bossId: 'ash-warden' as StableId<'boss'>,
      attackIds: ['missing-attack' as StableId<'attack'>],
      animationSetId: 'missing-animations' as StableId<'animation-set'>,
      audioSetId: 'missing-audio' as StableId<'audio-set'>,
      aiProfileId: 'missing-ai' as StableId<'ai-profile'>,
      dropTableId: 'missing-drops' as StableId<'drop-table'>,
      phases: [
        {
          phaseId: 'first-verse' as StableId<'boss-phase'>,
          attackIds: ['missing-phase-attack' as StableId<'attack'>],
        },
      ],
    };
    const issues = validateContent(
      registryWith({
        actors: [mara, invalidBoss],
        aiProfiles: [],
        abilities: [
          {
            abilityId: 'bramble-bolt' as StableId<'ability'>,
            displayName: 'Bramble Bolt',
            manaCost: 4,
            cooldownMs: 250,
            unlockFactId: 'missing-fact' as StableId<'quest-flag'>,
            action: { kind: 'attack', attackId: 'missing-ability-attack' as StableId<'attack'> },
          },
        ],
        dropTables: [
          {
            dropTableId: 'ash-drops' as StableId<'drop-table'>,
            entries: [
              {
                itemId: 'missing-item' as StableId<'item'>,
                quantity: 1,
                weight: 1,
              },
            ],
          },
        ],
        dialogue: [
          {
            dialogueId: 'well-echo' as StableId<'dialogue'>,
            entryNodeId: 'greeting' as StableId<'dialogue-node'>,
            nodes: [
              {
                nodeId: 'greeting' as StableId<'dialogue-node'>,
                speakerActorId: 'missing-speaker' as StableId<'actor'>,
                text: 'The well remembers a quieter rain.',
                requiresAll: ['missing-condition' as StableId<'quest-flag'>],
                choices: [
                  {
                    choiceId: 'listen' as StableId<'dialogue-choice'>,
                    text: 'Listen.',
                    targetNodeId: 'missing-node' as StableId<'dialogue-node'>,
                    effects: [
                      {
                        kind: 'set-fact',
                        factId: 'missing-effect' as StableId<'quest-flag'>,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    );

    for (const path of [
      '/actors/1/attackIds/0',
      '/actors/1/animationSetId',
      '/actors/1/audioSetId',
      '/actors/1/aiProfileId',
      '/actors/1/dropTableId',
      '/actors/1/phases/0/attackIds/0',
      '/abilities/0/action/attackId',
      '/abilities/0/unlockFactId',
      '/dropTables/0/entries/0/itemId',
      '/dialogue/0/nodes/0/speakerActorId',
      '/dialogue/0/nodes/0/requiresAll/0',
      '/dialogue/0/nodes/0/choices/0/targetNodeId',
      '/dialogue/0/nodes/0/choices/0/effects/0/factId',
    ]) {
      expect(issues).toContainEqual(expect.objectContaining({ code: 'missing-reference', path }));
    }
  });

  test('enforces the same combat numeric domains as DamageResolver', () => {
    const attack: AttackDefinition = {
      attackId: 'unsafe-strike' as StableId<'attack'>,
      damage: {
        baseDamage: 1.5,
        damageType: 'physical' as StableId<'damage-type'>,
        poiseDamage: Number.MAX_SAFE_INTEGER + 1,
        critical: { kind: 'eligible', triggered: true, multiplier: 0 },
      },
      totalFrames: 12,
      hitboxes: [],
      movementImpulse: { x: 0, y: 0 },
      cancelWindows: [],
      animationSetId: null,
      audioSetId: null,
      cooldownMs: 0,
      delivery: 'melee',
      knockback: { x: 0, y: 0 },
      hitStopMs: 55,
      tags: ['blockable'],
      hitPolicy: { kind: 'once' },
      charge: null,
    };
    const actor = {
      ...CONTENT_REGISTRY.actors[0]!,
      resistances: [
        { damageTypeId: 'physical' as StableId<'damage-type'>, multiplier: 1.01 },
        { damageTypeId: 'frost' as StableId<'damage-type'>, multiplier: -1.01 },
      ],
    } satisfies ActorDefinition;
    const issues = validateContent(registryWith({ attacks: [attack], actors: [actor] }));

    for (const path of [
      '/attacks/0/damage/baseDamage',
      '/attacks/0/damage/poiseDamage',
      '/attacks/0/damage/critical/multiplier',
      '/actors/0/resistances/0/multiplier',
      '/actors/0/resistances/1/multiplier',
    ]) {
      expect(issues).toContainEqual(expect.objectContaining({ code: 'invalid-value', path }));
    }
  });

  test('requires actor armour and max poise to use the resolver safe-integer domain', () => {
    const actor = {
      ...CONTENT_REGISTRY.actors[0]!,
      stats: {
        ...CONTENT_REGISTRY.actors[0]!.stats,
        armour: 1.5,
        maxPoise: Number.MAX_SAFE_INTEGER + 1,
      },
    } satisfies ActorDefinition;
    const issues = validateContent(registryWith({ actors: [actor] }));

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-value',
          path: '/actors/0/stats/armour',
        }),
        expect.objectContaining({
          code: 'invalid-value',
          path: '/actors/0/stats/maxPoise',
        }),
      ]),
    );
  });

  test.each([
    ['triggered overflow', true, 2],
    ['latent overflow', false, 2],
    ['non-finite composition', false, Number.MAX_VALUE],
  ] as const)(
    'rejects an eligible critical %s before it can reach DamageResolver',
    (_label, triggered, multiplier) => {
      const attack = attackWith({
        damage: {
          baseDamage: Number.MAX_SAFE_INTEGER,
          damageType: 'physical' as StableId<'damage-type'>,
          poiseDamage: 0,
          critical: { kind: 'eligible', triggered, multiplier },
        },
      });

      expect(validateContent(registryWith({ attacks: [attack] }))).toContainEqual(
        expect.objectContaining({
          code: 'invalid-value',
          path: '/attacks/0/damage/critical/multiplier',
        }),
      );
    },
  );

  test('accepts resolver boundary values and supported fractional critical composition', () => {
    const actor = {
      ...CONTENT_REGISTRY.actors[0]!,
      stats: {
        ...CONTENT_REGISTRY.actors[0]!.stats,
        armour: Number.MAX_SAFE_INTEGER,
        maxPoise: Number.MAX_SAFE_INTEGER,
      },
    } satisfies ActorDefinition;
    const attacks = [
      attackWith({
        attackId: 'maximum-strike' as StableId<'attack'>,
        damage: {
          baseDamage: Number.MAX_SAFE_INTEGER,
          damageType: 'physical' as StableId<'damage-type'>,
          poiseDamage: Number.MAX_SAFE_INTEGER,
          critical: { kind: 'eligible', triggered: false, multiplier: 1 },
        },
      }),
      attackWith({
        attackId: 'fractional-critical' as StableId<'attack'>,
        damage: {
          baseDamage: 1,
          damageType: 'physical' as StableId<'damage-type'>,
          poiseDamage: 0,
          critical: { kind: 'eligible', triggered: true, multiplier: 1.5 },
        },
      }),
      attackWith({
        attackId: 'standard-critical' as StableId<'attack'>,
        damage: {
          baseDamage: 10,
          damageType: 'physical' as StableId<'damage-type'>,
          poiseDamage: 0,
          critical: { kind: 'eligible', triggered: true, multiplier: 1.5 },
        },
      }),
    ];

    expect(
      validateContent(
        registryWith({
          actors: [{ ...actor, attackIds: [] }],
          aiProfiles: [],
          attacks,
          abilities: [],
          bossEncounters: [],
          puzzles: [],
          dialogue: [],
          npcs: [],
          areas: [
            {
              ...WRENS_REST_AREA,
              actorSpawns: [WRENS_REST_AREA.actorSpawns[0]!],
              triggers: [WRENS_REST_AREA.triggers[0]!],
              transitions: WRENS_REST_AREA.transitions.filter(({ kind }) => kind === 'room'),
            },
          ],
          newGame: { ...CONTENT_REGISTRY.newGame, startingAbilities: [] },
        }),
      ),
    ).toEqual([]);
  });

  test('reports malformed bosses and quest graph failures through the existing quest rules', () => {
    const mara = CONTENT_REGISTRY.actors[0]!;
    const boss = {
      ...mara,
      kind: 'boss' as const,
      actorId: 'choir-warden' as StableId<'actor'>,
      bossId: 'choir-warden' as StableId<'boss'>,
      phases: [],
    } satisfies ActorDefinition;
    const cyclic: QuestDefinition = {
      questId: 'hollow-song' as StableId<'quest'>,
      initialStageId: 'listen' as StableId<'quest-stage'>,
      stages: [
        {
          stageId: 'listen' as StableId<'quest-stage'>,
          transitions: [
            {
              toStageId: 'answer' as StableId<'quest-stage'>,
              requiresAll: ['heard-song' as StableId<'quest-flag'>],
            },
          ],
        },
        {
          stageId: 'answer' as StableId<'quest-stage'>,
          transitions: [
            {
              toStageId: 'listen' as StableId<'quest-stage'>,
              requiresAll: ['answered-song' as StableId<'quest-flag'>],
            },
          ],
        },
      ],
    };
    expect(() => new QuestStore([cyclic])).toThrow(/cycle/);
    const quest: QuestContentDefinition = {
      definition: cyclic,
      declaredFacts: [
        'heard-song' as StableId<'quest-flag'>,
        'answered-song' as StableId<'quest-flag'>,
      ],
    };
    const issues = validateContent(
      registryWith({ actors: [mara, boss], aiProfiles: [], quests: [quest] }),
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'invalid-boss', path: '/actors/1/phases' }),
        expect.objectContaining({ code: 'invalid-reference', path: '/quests/0/definition' }),
      ]),
    );
  });

  test('reports duplicate boss and persistent world IDs in their own namespaces', () => {
    const mara = CONTENT_REGISTRY.actors[0]!;
    const bossId = 'shared-warden' as StableId<'boss'>;
    const firstBoss = {
      ...mara,
      kind: 'boss' as const,
      actorId: 'first-warden' as StableId<'actor'>,
      bossId,
      phases: [],
    } satisfies ActorDefinition;
    const secondBoss = {
      ...mara,
      kind: 'boss' as const,
      actorId: 'second-warden' as StableId<'actor'>,
      bossId,
      phases: [],
    } satisfies ActorDefinition;
    const discovery = WRENS_REST_AREA.discoveries[0]!;
    const puzzle = PUZZLES[0]!;
    const issues = validateContent(
      registryWith({
        actors: [mara, firstBoss, secondBoss],
        aiProfiles: [],
        puzzles: [puzzle, { ...puzzle }],
        areas: [
          areaWith({
            discoveries: [discovery, { ...discovery }],
          }),
        ],
      }),
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'duplicate-id', path: '/actors/2/bossId' }),
        expect.objectContaining({
          code: 'duplicate-id',
          path: '/areas/0/discoveries/1/discoveryId',
        }),
        expect.objectContaining({
          code: 'duplicate-id',
          path: '/puzzles/1/puzzleId',
        }),
      ]),
    );
  });

  test('validates every new-game critical reference', () => {
    const issues = validateContent(
      registryWith({
        newGame: {
          ...CONTENT_REGISTRY.newGame,
          initialAreaId: 'missing-area' as AreaId,
          initialCheckpointId: 'missing-checkpoint' as CheckpointId,
          startingAbilities: ['missing-ability' as StableId<'ability'>],
          initialQuests: {
            stages: [
              {
                questId: 'missing-quest' as StableId<'quest'>,
                stageId: 'missing-stage' as StableId<'quest-stage'>,
              },
            ],
            flags: ['missing-fact' as StableId<'quest-flag'>],
          },
        },
      }),
    );

    for (const path of [
      '/newGame/initialAreaId',
      '/newGame/initialCheckpointId',
      '/newGame/startingAbilities/0',
      '/newGame/initialQuests/stages/0/questId',
      '/newGame/initialQuests/flags/0',
    ]) {
      expect(issues).toContainEqual(expect.objectContaining({ code: 'missing-reference', path }));
    }
  });

  test('reports invalid new-game stage syntax independently of a missing quest', () => {
    const issues = validateContent(
      registryWith({
        newGame: {
          ...CONTENT_REGISTRY.newGame,
          initialQuests: {
            stages: [
              {
                questId: 'missing-quest' as StableId<'quest'>,
                stageId: 'Invalid Stage' as StableId<'quest-stage'>,
              },
            ],
            flags: [],
          },
        },
      }),
    );

    expect(issues).toEqual([
      {
        severity: 'error',
        code: 'missing-reference',
        path: '/newGame/initialQuests/stages/0/questId',
        message: 'Referenced quest does not exist.',
      },
      {
        severity: 'error',
        code: 'invalid-id',
        path: '/newGame/initialQuests/stages/0/stageId',
        message: 'Value must be a lowercase kebab-case stable ID.',
      },
    ]);
  });

  test('validates new-game region ownership, checkpoint ownership, and known quest stages', () => {
    const quest: QuestContentDefinition = {
      definition: {
        questId: 'homecoming' as StableId<'quest'>,
        initialStageId: 'wake' as StableId<'quest-stage'>,
        stages: [{ stageId: 'wake' as StableId<'quest-stage'>, transitions: [] }],
      },
      declaredFacts: [],
    };
    const otherArea = areaWith({
      areaId: 'bracken-gate' as AreaId,
      regionId: 'other-region' as typeof WRENS_REST_AREA.regionId,
      checkpoints: [
        {
          ...WRENS_REST_AREA.checkpoints[0]!,
          checkpointId: 'bracken-gate-post' as CheckpointId,
        },
      ],
    });
    const issues = validateContent(
      registryWith({
        areas: [WRENS_REST_AREA, otherArea],
        quests: [quest],
        newGame: {
          ...CONTENT_REGISTRY.newGame,
          initialRegionId: 'other-region' as typeof CONTENT_REGISTRY.newGame.initialRegionId,
          initialCheckpointId: 'bracken-gate-post' as CheckpointId,
          initialQuests: {
            stages: [
              {
                questId: quest.definition.questId,
                stageId: 'missing-stage' as StableId<'quest-stage'>,
              },
            ],
            flags: [],
          },
        },
      }),
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-reference',
          path: '/newGame/initialRegionId',
        }),
        expect.objectContaining({
          code: 'invalid-reference',
          path: '/newGame/initialCheckpointId',
        }),
        expect.objectContaining({
          code: 'missing-reference',
          path: '/newGame/initialQuests/stages/0/stageId',
        }),
      ]),
    );
  });

  test('aligns new-game stats and duplicate references with SaveSchema invariants', () => {
    const ability = {
      abilityId: 'moth-glimmer' as StableId<'ability'>,
      displayName: 'Moth Glimmer',
      manaCost: 1,
      cooldownMs: 1,
      unlockFactId: null,
      action: { kind: 'restore' as const, resource: 'mana' as const, amount: 1 },
    };
    const quest: QuestContentDefinition = {
      definition: {
        questId: 'homecoming' as StableId<'quest'>,
        initialStageId: 'wake' as StableId<'quest-stage'>,
        stages: [{ stageId: 'wake' as StableId<'quest-stage'>, transitions: [] }],
      },
      declaredFacts: ['heard-rain' as StableId<'quest-flag'>],
    };
    const issues = validateContent(
      registryWith({
        abilities: [ability],
        quests: [quest],
        newGame: {
          ...CONTENT_REGISTRY.newGame,
          baseStats: { maxHealth: 1.5, maxMana: 0, attackPower: 2.5, armour: 0.5 },
          startingAbilities: [ability.abilityId, ability.abilityId],
          initialQuests: {
            stages: [
              { questId: quest.definition.questId, stageId: quest.definition.initialStageId },
              { questId: quest.definition.questId, stageId: quest.definition.initialStageId },
            ],
            flags: [quest.declaredFacts[0]!, quest.declaredFacts[0]!],
          },
        },
      }),
    );

    for (const path of [
      '/newGame/baseStats/maxHealth',
      '/newGame/baseStats/maxMana',
      '/newGame/baseStats/attackPower',
      '/newGame/baseStats/armour',
    ]) {
      expect(issues).toContainEqual(expect.objectContaining({ code: 'invalid-value', path }));
    }
    for (const path of [
      '/newGame/startingAbilities/1',
      '/newGame/initialQuests/stages/1/questId',
      '/newGame/initialQuests/flags/1',
    ]) {
      expect(issues).toContainEqual(expect.objectContaining({ code: 'duplicate-id', path }));
    }
  });

  test('requires new-game quest stages and flags to use stable-ID order', () => {
    const alpha: QuestContentDefinition = {
      definition: {
        questId: 'alpha-quest' as StableId<'quest'>,
        initialStageId: 'alpha-stage' as StableId<'quest-stage'>,
        stages: [{ stageId: 'alpha-stage' as StableId<'quest-stage'>, transitions: [] }],
      },
      declaredFacts: ['alpha-fact' as StableId<'quest-flag'>],
    };
    const zeta: QuestContentDefinition = {
      definition: {
        questId: 'zeta-quest' as StableId<'quest'>,
        initialStageId: 'zeta-stage' as StableId<'quest-stage'>,
        stages: [{ stageId: 'zeta-stage' as StableId<'quest-stage'>, transitions: [] }],
      },
      declaredFacts: ['zeta-fact' as StableId<'quest-flag'>],
    };
    const issues = validateContent(
      registryWith({
        quests: [alpha, zeta],
        newGame: {
          ...CONTENT_REGISTRY.newGame,
          initialQuests: {
            stages: [
              { questId: zeta.definition.questId, stageId: zeta.definition.initialStageId },
              { questId: alpha.definition.questId, stageId: alpha.definition.initialStageId },
            ],
            flags: [zeta.declaredFacts[0]!, alpha.declaredFacts[0]!],
          },
        },
      }),
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-value',
          path: '/newGame/initialQuests/stages/1/questId',
        }),
        expect.objectContaining({
          code: 'invalid-value',
          path: '/newGame/initialQuests/flags/1',
        }),
      ]),
    );
  });

  test('returns a hand-derived deterministic issue sequence', () => {
    const invalid = registryWith({
      assetKeys: [
        'Invalid Asset' as AssetKey,
        'shared-asset' as AssetKey,
        'shared-asset' as AssetKey,
      ],
    });

    expect(validateContent(invalid)).toEqual([
      {
        severity: 'error',
        code: 'invalid-id',
        path: '/assetKeys/0',
        message: 'Value must be a lowercase kebab-case stable ID.',
      },
      {
        severity: 'error',
        code: 'duplicate-id',
        path: '/assetKeys/2',
        message: 'Stable ID is duplicated in its namespace.',
      },
    ]);
  });

  test('sorts by code units across path, code, and message tie-breaks', () => {
    const raw: readonly ContentIssue[] = [
      {
        severity: 'error',
        path: '/same',
        code: 'invalid-id',
        message: 'later-code',
      },
      {
        severity: 'error',
        path: '/same',
        code: 'duplicate-id',
        message: 'écho',
      },
      {
        severity: 'error',
        path: '/same',
        code: 'duplicate-id',
        message: 'zeta',
      },
      {
        severity: 'error',
        path: '/é',
        code: 'invalid-id',
        message: 'accent-path',
      },
      {
        severity: 'error',
        path: '/z',
        code: 'invalid-id',
        message: 'ascii-path',
      },
    ];

    expect(sortContentIssues(raw)).toEqual([raw[2], raw[1], raw[0], raw[4], raw[3]]);
  });

  test('repeats validation without mutating malformed authored input', () => {
    const invalid = registryWith({
      assetKeys: ['Invalid Asset' as AssetKey],
    });
    const before = structuredClone(invalid);
    const first = validateContent(invalid);

    expect(validateContent(invalid)).toEqual(first);
    expect(structuredClone(invalid)).toEqual(before);
  });
});
