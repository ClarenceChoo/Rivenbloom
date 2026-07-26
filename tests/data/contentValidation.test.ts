import { describe, expect, it } from 'vitest';
import { validateContent } from '../../src/game/data/contentValidation';
import { contentRegistry } from '../../src/game/data/contentRegistry';
import type {
  ActorDefinition,
  AreaDefinition,
  ContentIssue,
  ContentRegistry,
  TriggerDefinition
} from '../../src/game/data/types';

function emptyRegistry(): ContentRegistry {
  return {
    areas: [],
    actors: [],
    bossMechanisms: [],
    attacks: [],
    abilities: [],
    items: [],
    quests: [],
    dialogues: [],
    ambienceProfiles: []
  };
}

function actorDefinition(overrides: Partial<ActorDefinition> = {}): ActorDefinition {
  return {
    id: 'mara-vey',
    displayName: 'Mara Vey',
    kind: 'player',
    stats: {
      maxHealth: 100,
      maxMana: 60,
      power: 12,
      defence: 4,
      poise: 20
    },
    movement: {
      speed: 240,
      acceleration: 1600,
      jumpVelocity: 540
    },
    perception: {
      range: 0,
      hearingRange: 0
    },
    attackIds: [],
    abilityIds: [],
    resistances: {},
    drops: [],
    render: {
      assetKey: 'mara-sheet',
      source: { x: 28, y: 46, width: 244, height: 250 },
      size: { width: 122, height: 125 },
      origin: { x: 0.5, y: 1 },
      depth: 10
    },
    collisionBody: {
      offset: { x: -18, y: -82 },
      size: { width: 36, height: 82 }
    },
    hurtboxes: [
      {
        offset: { x: -20, y: -92 },
        size: { width: 40, height: 92 }
      }
    ],
    animationSetId: 'mara-animation-set',
    audioSetId: 'mara-audio-set',
    aiProfileId: 'player-controlled',
    ...overrides
  };
}

function areaDefinition(overrides: Partial<AreaDefinition> = {}): AreaDefinition {
  return {
    id: 'test-reach',
    displayName: 'Test Reach',
    regionId: 'test-region',
    bounds: { x: 0, y: 0, width: 1280, height: 720 },
    defaultSpawnId: 'test-spawn',
    ambienceProfileId: 'test-ambience',
    rooms: [
      {
        id: 'test-room',
        displayName: 'Test Room',
        bounds: { x: 0, y: 0, width: 1280, height: 720 },
        discoveryId: 'test-room-discovery'
      }
    ],
    layers: [
      {
        id: 'test-layer',
        roomId: 'test-room',
        kind: 'gameplay',
        assetKey: 'test-layer',
        position: { x: 0, y: 0 },
        size: { width: 1280, height: 720 },
        depth: 0,
        scrollFactor: 1
      }
    ],
    surfaces: [
      {
        id: 'test-surface',
        roomId: 'test-room',
        kind: 'solid',
        collision: { x: 0, y: 600, width: 1280, height: 120 },
        materialId: 'test-stone'
      }
    ],
    playerSpawns: [
      {
        id: 'test-spawn',
        roomId: 'test-room',
        position: { x: 120, y: 600 },
        facing: 'right'
      }
    ],
    actorSpawns: [],
    triggers: [],
    mechanisms: [],
    checkpoints: [],
    transitions: [],
    props: [],
    ...overrides
  };
}

describe('validateContent', () => {
  it('rejects stable IDs containing uppercase letters, spaces, or underscores', () => {
    const registry: ContentRegistry = {
      ...emptyRegistry(),
      items: [
        {
          id: 'Quiet Step',
          displayName: 'Quiet Step',
          kind: 'charm',
          description: 'Silences landing leaves.',
          maxStack: 1,
          value: 120,
          abilityIds: []
        }
      ]
    };

    expect(validateContent(registry)).toContainEqual({
      code: 'invalid-stable-id',
      path: 'items[0].id',
      id: 'Quiet Step',
      message: 'Stable IDs must use lowercase kebab-case.'
    });
  });

  it('rejects invalid stable IDs in nested persistent content', () => {
    const registry: ContentRegistry = {
      ...emptyRegistry(),
      quests: [
        {
          id: 'silent-bloom',
          displayName: 'The Silent Bloom',
          kind: 'main',
          initialStageId: 'listen_at_arch',
          prerequisiteQuestIds: [],
          stages: [
            {
              id: 'listen_at_arch',
              objective: 'Listen at the silent arch.',
              requiredItemIds: [],
              grantedItemIds: [],
              grantedAbilityIds: []
            }
          ]
        }
      ]
    };

    expect(validateContent(registry)).toContainEqual({
      code: 'invalid-stable-id',
      path: 'quests[0].stages[0].id',
      id: 'listen_at_arch',
      message: 'Stable IDs must use lowercase kebab-case.'
    });
  });

  it('reports duplicate IDs within a registry collection', () => {
    const quietStep = {
      id: 'quiet-step',
      displayName: 'Quiet Step',
      kind: 'charm' as const,
      description: 'Silences landing leaves.',
      maxStack: 1,
      value: 120,
      abilityIds: []
    };
    const registry: ContentRegistry = {
      ...emptyRegistry(),
      items: [
        quietStep,
        {
          ...quietStep,
          displayName: 'Second Quiet Step'
        }
      ]
    };

    expect(validateContent(registry)).toContainEqual({
      code: 'duplicate-id',
      path: 'items[1].id',
      id: 'quiet-step',
      message: 'Duplicate items ID "quiet-step".'
    });
  });

  it('reports duplicate IDs within nested content collections', () => {
    const stage = {
      id: 'listen-at-the-arch',
      objective: 'Listen at the silent arch.',
      requiredItemIds: [],
      grantedItemIds: [],
      grantedAbilityIds: []
    };
    const registry: ContentRegistry = {
      ...emptyRegistry(),
      quests: [
        {
          id: 'silent-bloom',
          displayName: 'The Silent Bloom',
          kind: 'main',
          initialStageId: 'listen-at-the-arch',
          prerequisiteQuestIds: [],
          stages: [stage, { ...stage, objective: 'Listen again.' }]
        }
      ]
    };

    expect(validateContent(registry)).toContainEqual({
      code: 'duplicate-id',
      path: 'quests[0].stages[1].id',
      id: 'listen-at-the-arch',
      message: 'Duplicate quest stages ID "listen-at-the-arch".'
    });
  });

  it('reports duplicate IDs in every area-local collection', () => {
    const duplicateTrigger = {
      id: 'duplicate-trigger',
      roomId: 'duplicate-room',
      kind: 'room-entry',
      bounds: { x: 80, y: 80, width: 120, height: 120 },
      targetId: 'first-discovery',
      once: false
    } as const satisfies TriggerDefinition;
    const duplicateMechanism = {
      id: 'duplicate-mechanism',
      roomId: 'duplicate-room',
      kind: 'lens',
      position: { x: 300, y: 600 },
      triggerId: 'duplicate-trigger',
      persistentFlagId: 'first-mechanism-flag'
    } as const;
    const duplicateCheckpoint = {
      id: 'duplicate-checkpoint',
      roomId: 'duplicate-room',
      triggerId: 'duplicate-trigger',
      spawnId: 'duplicate-player-spawn',
      position: { x: 120, y: 600 }
    } as const;
    const duplicateTransition = {
      id: 'duplicate-transition',
      roomId: 'duplicate-room',
      triggerId: 'duplicate-trigger',
      destinationAreaId: 'test-reach',
      destinationSpawnId: 'duplicate-player-spawn'
    } as const;
    const duplicateProp = {
      id: 'duplicate-prop',
      roomId: 'duplicate-room',
      position: { x: 420, y: 600 },
      render: {
        assetKey: 'test-prop',
        size: { width: 64, height: 64 },
        origin: { x: 0.5, y: 1 },
        depth: 2
      }
    } as const;
    const registry: ContentRegistry = {
      ...emptyRegistry(),
      areas: [
        areaDefinition({
          defaultSpawnId: 'duplicate-player-spawn',
          rooms: [
            {
              id: 'duplicate-room',
              displayName: 'First Room',
              bounds: { x: 0, y: 0, width: 640, height: 720 },
              discoveryId: 'first-discovery'
            },
            {
              id: 'duplicate-room',
              displayName: 'Second Room',
              bounds: { x: 640, y: 0, width: 640, height: 720 },
              discoveryId: 'second-discovery'
            }
          ],
          layers: [
            {
              id: 'duplicate-layer',
              roomId: 'duplicate-room',
              kind: 'gameplay',
              assetKey: 'first-layer',
              position: { x: 0, y: 0 },
              size: { width: 640, height: 720 },
              depth: 0,
              scrollFactor: 1
            },
            {
              id: 'duplicate-layer',
              roomId: 'duplicate-room',
              kind: 'foreground',
              assetKey: 'second-layer',
              position: { x: 640, y: 0 },
              size: { width: 640, height: 720 },
              depth: 10,
              scrollFactor: 1
            }
          ],
          surfaces: [
            {
              id: 'duplicate-surface',
              roomId: 'duplicate-room',
              kind: 'solid',
              collision: { x: 0, y: 600, width: 640, height: 120 },
              materialId: 'first-stone'
            },
            {
              id: 'duplicate-surface',
              roomId: 'duplicate-room',
              kind: 'one-way',
              collision: { x: 640, y: 600, width: 640, height: 120 },
              materialId: 'second-stone'
            }
          ],
          playerSpawns: [
            {
              id: 'duplicate-player-spawn',
              roomId: 'duplicate-room',
              position: { x: 120, y: 600 },
              facing: 'right'
            },
            {
              id: 'duplicate-player-spawn',
              roomId: 'duplicate-room',
              position: { x: 1120, y: 600 },
              facing: 'left'
            }
          ],
          actorSpawns: [
            {
              id: 'duplicate-actor-spawn',
              roomId: 'duplicate-room',
              actorId: 'first-actor',
              position: { x: 420, y: 600 },
              facing: 'right'
            },
            {
              id: 'duplicate-actor-spawn',
              roomId: 'duplicate-room',
              actorId: 'second-actor',
              position: { x: 860, y: 600 },
              facing: 'left'
            }
          ],
          triggers: [
            duplicateTrigger,
            {
              ...duplicateTrigger,
              targetId: 'second-discovery'
            }
          ],
          mechanisms: [
            duplicateMechanism,
            {
              ...duplicateMechanism,
              persistentFlagId: 'second-mechanism-flag'
            }
          ],
          checkpoints: [
            duplicateCheckpoint,
            {
              ...duplicateCheckpoint,
              position: { x: 1120, y: 600 }
            }
          ],
          transitions: [
            duplicateTransition,
            {
              ...duplicateTransition,
              destinationSpawnId: 'duplicate-player-spawn'
            }
          ],
          props: [
            duplicateProp,
            {
              ...duplicateProp,
              position: { x: 860, y: 600 }
            }
          ]
        })
      ]
    };

    expect(validateContent(registry)).toEqual(
      expect.arrayContaining([
        {
          code: 'duplicate-id',
          path: 'areas[0].rooms[1].id',
          id: 'duplicate-room',
          message: 'Duplicate area rooms ID "duplicate-room".'
        },
        {
          code: 'duplicate-id',
          path: 'areas[0].layers[1].id',
          id: 'duplicate-layer',
          message: 'Duplicate area layers ID "duplicate-layer".'
        },
        {
          code: 'duplicate-id',
          path: 'areas[0].surfaces[1].id',
          id: 'duplicate-surface',
          message: 'Duplicate area surfaces ID "duplicate-surface".'
        },
        {
          code: 'duplicate-id',
          path: 'areas[0].playerSpawns[1].id',
          id: 'duplicate-player-spawn',
          message: 'Duplicate area player spawns ID "duplicate-player-spawn".'
        },
        {
          code: 'duplicate-id',
          path: 'areas[0].actorSpawns[1].id',
          id: 'duplicate-actor-spawn',
          message: 'Duplicate area actor spawns ID "duplicate-actor-spawn".'
        },
        {
          code: 'duplicate-id',
          path: 'areas[0].triggers[1].id',
          id: 'duplicate-trigger',
          message: 'Duplicate area triggers ID "duplicate-trigger".'
        },
        {
          code: 'duplicate-id',
          path: 'areas[0].mechanisms[1].id',
          id: 'duplicate-mechanism',
          message: 'Duplicate area mechanisms ID "duplicate-mechanism".'
        },
        {
          code: 'duplicate-id',
          path: 'areas[0].checkpoints[1].id',
          id: 'duplicate-checkpoint',
          message: 'Duplicate area checkpoints ID "duplicate-checkpoint".'
        },
        {
          code: 'duplicate-id',
          path: 'areas[0].transitions[1].id',
          id: 'duplicate-transition',
          message: 'Duplicate area transitions ID "duplicate-transition".'
        },
        {
          code: 'duplicate-id',
          path: 'areas[0].props[1].id',
          id: 'duplicate-prop',
          message: 'Duplicate area props ID "duplicate-prop".'
        }
      ])
    );
  });

  it('reports duplicate dialogue nodes and node-local choices', () => {
    const registry: ContentRegistry = {
      ...emptyRegistry(),
      dialogues: [
        {
          id: 'duplicate-dialogue-content',
          entryNodeId: 'duplicate-node',
          nodes: [
            {
              id: 'duplicate-node',
              speakerActorId: 'first-speaker',
              text: 'Choose.',
              choices: [
                {
                  id: 'duplicate-choice',
                  text: 'First choice.'
                },
                {
                  id: 'duplicate-choice',
                  text: 'Second choice.'
                }
              ]
            },
            {
              id: 'duplicate-node',
              speakerActorId: 'second-speaker',
              text: 'Again.',
              choices: []
            }
          ]
        }
      ]
    };

    expect(validateContent(registry)).toEqual(
      expect.arrayContaining([
        {
          code: 'duplicate-id',
          path: 'dialogues[0].nodes[1].id',
          id: 'duplicate-node',
          message: 'Duplicate dialogue nodes ID "duplicate-node".'
        },
        {
          code: 'duplicate-id',
          path: 'dialogues[0].nodes[0].choices[1].id',
          id: 'duplicate-choice',
          message: 'Duplicate dialogue choices ID "duplicate-choice".'
        }
      ])
    );
  });

  it('reports globally reused room discovery and persistent flag IDs', () => {
    const sharedMechanismFlag = 'shared-mechanism-flag';
    const registry: ContentRegistry = {
      ...emptyRegistry(),
      areas: [
        areaDefinition({
          id: 'first-area',
          rooms: [
            {
              id: 'first-room',
              displayName: 'First Room',
              bounds: { x: 0, y: 0, width: 1280, height: 720 },
              discoveryId: 'shared-room-discovery'
            }
          ],
          mechanisms: [
            {
              id: 'first-mechanism',
              roomId: 'first-room',
              kind: 'lens',
              position: { x: 300, y: 600 },
              triggerId: 'first-trigger',
              persistentFlagId: sharedMechanismFlag
            }
          ]
        }),
        areaDefinition({
          id: 'second-area',
          rooms: [
            {
              id: 'second-room',
              displayName: 'Second Room',
              bounds: { x: 0, y: 0, width: 1280, height: 720 },
              discoveryId: 'shared-room-discovery'
            }
          ],
          mechanisms: [
            {
              id: 'second-mechanism',
              roomId: 'second-room',
              kind: 'lens',
              position: { x: 900, y: 600 },
              triggerId: 'second-trigger',
              persistentFlagId: 'second-mechanism-flag'
            }
          ]
        })
      ],
      bossMechanisms: [
        {
          id: 'planned-boss-lens',
          displayName: 'Planned Boss Lens',
          kind: 'lens',
          bossActorId: 'planned-boss',
          persistentFlagId: sharedMechanismFlag
        }
      ]
    };

    expect(validateContent(registry)).toEqual(
      expect.arrayContaining([
        {
          code: 'duplicate-id',
          path: 'areas[1].rooms[0].discoveryId',
          id: 'shared-room-discovery',
          message: 'Duplicate room discovery ID "shared-room-discovery".'
        },
        {
          code: 'duplicate-id',
          path: 'bossMechanisms[0].persistentFlagId',
          id: sharedMechanismFlag,
          message: `Duplicate persistent flag ID "${sharedMechanismFlag}".`
        }
      ])
    );
  });

  it('reports unresolved actor, ability, item, quest, and dialogue references', () => {
    const registry: ContentRegistry = {
      ...emptyRegistry(),
      actors: [
        actorDefinition({
          attackIds: ['missing-attack'],
          abilityIds: ['missing-ability'],
          drops: [{ itemId: 'missing-drop', chance: 1, quantity: 1 }]
        })
      ],
      abilities: [
        {
          id: 'lumen-bolt',
          displayName: 'Lumen Bolt',
          kind: 'spell',
          manaCost: 12,
          cooldownMs: 480,
          attackId: 'missing-spell-attack',
          requiredQuestId: 'missing-ability-quest'
        }
      ],
      items: [
        {
          id: 'quiet-step',
          displayName: 'Quiet Step',
          kind: 'charm',
          description: 'Silences landing leaves.',
          maxStack: 1,
          value: 120,
          abilityIds: ['missing-item-ability']
        }
      ],
      quests: [
        {
          id: 'silent-bloom',
          displayName: 'The Silent Bloom',
          kind: 'main',
          initialStageId: 'listen-at-the-arch',
          prerequisiteQuestIds: ['missing-prerequisite'],
          stages: [
            {
              id: 'listen-at-the-arch',
              objective: 'Listen at the silent arch.',
              dialogueId: 'missing-dialogue',
              requiredItemIds: ['missing-required-item'],
              grantedItemIds: ['missing-granted-item'],
              grantedAbilityIds: ['missing-granted-ability']
            }
          ]
        }
      ],
      dialogues: [
        {
          id: 'sela-introduction',
          entryNodeId: 'greeting',
          nodes: [
            {
              id: 'greeting',
              speakerActorId: 'missing-speaker',
              text: 'The route has fallen quiet.',
              nextNodeId: 'missing-node',
              choices: [
                {
                  id: 'accept',
                  text: 'I will listen.',
                  nextNodeId: 'missing-choice-node',
                  requiredQuestId: 'missing-choice-quest'
                }
              ],
              questId: 'missing-dialogue-quest',
              questStageId: 'missing-quest-stage'
            }
          ]
        }
      ]
    };

    const issues = validateContent(registry);
    const expected: readonly ContentIssue[] = [
      {
        code: 'unresolved-reference',
        path: 'actors[0].attackIds[0]',
        id: 'missing-attack',
        message: 'Unresolved attacks reference "missing-attack".'
      },
      {
        code: 'unresolved-reference',
        path: 'actors[0].abilityIds[0]',
        id: 'missing-ability',
        message: 'Unresolved abilities reference "missing-ability".'
      },
      {
        code: 'unresolved-reference',
        path: 'actors[0].drops[0].itemId',
        id: 'missing-drop',
        message: 'Unresolved items reference "missing-drop".'
      },
      {
        code: 'unresolved-reference',
        path: 'abilities[0].attackId',
        id: 'missing-spell-attack',
        message: 'Unresolved attacks reference "missing-spell-attack".'
      },
      {
        code: 'unresolved-reference',
        path: 'items[0].abilityIds[0]',
        id: 'missing-item-ability',
        message: 'Unresolved abilities reference "missing-item-ability".'
      },
      {
        code: 'unresolved-reference',
        path: 'quests[0].stages[0].dialogueId',
        id: 'missing-dialogue',
        message: 'Unresolved dialogues reference "missing-dialogue".'
      },
      {
        code: 'unresolved-reference',
        path: 'dialogues[0].nodes[0].speakerActorId',
        id: 'missing-speaker',
        message: 'Unresolved actors reference "missing-speaker".'
      },
      {
        code: 'unresolved-reference',
        path: 'dialogues[0].nodes[0].nextNodeId',
        id: 'missing-node',
        message: 'Unresolved dialogue nodes reference "missing-node".'
      }
    ];

    for (const expectedIssue of expected) {
      expect(issues).toContainEqual(expectedIssue);
    }
  });

  it('resolves dialogue quest stages within the referenced quest', () => {
    const registry: ContentRegistry = {
      ...emptyRegistry(),
      actors: [actorDefinition()],
      quests: [
        {
          id: 'quest-a',
          displayName: 'Quest A',
          kind: 'main',
          initialStageId: 'quest-a-stage',
          prerequisiteQuestIds: [],
          stages: [
            {
              id: 'quest-a-stage',
              objective: 'Complete quest A.',
              requiredItemIds: [],
              grantedItemIds: [],
              grantedAbilityIds: []
            }
          ]
        },
        {
          id: 'quest-b',
          displayName: 'Quest B',
          kind: 'discovery',
          initialStageId: 'quest-b-stage',
          prerequisiteQuestIds: [],
          stages: [
            {
              id: 'quest-b-stage',
              objective: 'Complete quest B.',
              requiredItemIds: [],
              grantedItemIds: [],
              grantedAbilityIds: []
            }
          ]
        }
      ],
      dialogues: [
        {
          id: 'crossed-quest-stage',
          entryNodeId: 'crossed-stage',
          nodes: [
            {
              id: 'crossed-stage',
              speakerActorId: 'mara-vey',
              text: 'This stage belongs to another quest.',
              choices: [],
              questId: 'quest-a',
              questStageId: 'quest-b-stage'
            }
          ]
        }
      ]
    };

    expect(validateContent(registry)).toContainEqual({
      code: 'unresolved-reference',
      path: 'dialogues[0].nodes[0].questStageId',
      id: 'quest-b-stage',
      message: 'Unresolved quest "quest-a" stages reference "quest-b-stage".'
    });
  });

  it('requires a quest for dialogue quest-stage mutations', () => {
    const registry: ContentRegistry = {
      ...emptyRegistry(),
      actors: [actorDefinition()],
      quests: [
        {
          id: 'quest-a',
          displayName: 'Quest A',
          kind: 'main',
          initialStageId: 'quest-a-stage',
          prerequisiteQuestIds: [],
          stages: [
            {
              id: 'quest-a-stage',
              objective: 'Complete quest A.',
              requiredItemIds: [],
              grantedItemIds: [],
              grantedAbilityIds: []
            }
          ]
        }
      ],
      dialogues: [
        {
          id: 'stage-without-quest',
          entryNodeId: 'missing-quest',
          nodes: [
            {
              id: 'missing-quest',
              speakerActorId: 'mara-vey',
              text: 'This mutation has no quest.',
              choices: [],
              questStageId: 'quest-a-stage'
            }
          ]
        }
      ]
    };

    expect(validateContent(registry)).toContainEqual({
      code: 'missing-required-field',
      path: 'dialogues[0].nodes[0].questId',
      id: 'missing-quest',
      message: 'Dialogue quest-stage mutations require a quest ID.'
    });
  });

  it('reports unresolved references inside an authored area graph', () => {
    const registry: ContentRegistry = {
      ...emptyRegistry(),
      areas: [
        {
          id: 'brackenreach-trail',
          displayName: 'Brackenreach Trail',
          regionId: 'brackenreach',
          bounds: { x: 0, y: 0, width: 2560, height: 720 },
          defaultSpawnId: 'missing-default-spawn',
          ambienceProfileId: 'missing-area-ambience',
          rooms: [
            {
              id: 'trailhead',
              displayName: 'Trailhead',
              bounds: { x: 0, y: 0, width: 1280, height: 720 },
              discoveryId: 'brackenreach-trailhead',
              ambienceProfileId: 'missing-room-ambience'
            }
          ],
          layers: [
            {
              id: 'far-forest',
              roomId: 'missing-layer-room',
              kind: 'far',
              assetKey: 'brackenreach-far',
              position: { x: 0, y: 0 },
              size: { width: 1280, height: 720 },
              depth: -30,
              scrollFactor: 0.05
            }
          ],
          surfaces: [
            {
              id: 'trail-floor',
              roomId: 'missing-surface-room',
              kind: 'solid',
              collision: { x: 0, y: 566, width: 1280, height: 154 },
              materialId: 'wet-slate'
            }
          ],
          playerSpawns: [
            {
              id: 'trail-west',
              roomId: 'missing-spawn-room',
              position: { x: 310, y: 566 },
              facing: 'right'
            }
          ],
          actorSpawns: [
            {
              id: 'missing-briar-spawn',
              roomId: 'missing-actor-room',
              actorId: 'missing-actor',
              position: { x: 850, y: 566 },
              facing: 'left'
            }
          ],
          triggers: [
            {
              id: 'arch-trigger',
              roomId: 'missing-trigger-room',
              kind: 'interaction',
              bounds: { x: 940, y: 420, width: 120, height: 146 },
              targetId: 'missing-target-mechanism',
              once: false
            }
          ],
          mechanisms: [
            {
              id: 'listening-arch',
              roomId: 'missing-mechanism-room',
              kind: 'listening-arch',
              position: { x: 1000, y: 566 },
              triggerId: 'missing-trigger',
              requiredAbilityId: 'missing-mechanism-ability',
              questId: 'missing-mechanism-quest',
              rewardItemId: 'missing-mechanism-item',
              persistentFlagId: 'listening-arch-awake'
            }
          ],
          checkpoints: [
            {
              id: 'trail-seed-lantern',
              roomId: 'missing-checkpoint-room',
              triggerId: 'missing-checkpoint-trigger',
              spawnId: 'missing-checkpoint-spawn',
              position: { x: 280, y: 566 }
            }
          ],
          transitions: [
            {
              id: 'trail-return',
              roomId: 'missing-transition-room',
              triggerId: 'missing-transition-trigger',
              destinationAreaId: 'missing-area',
              destinationSpawnId: 'missing-destination-spawn'
            }
          ],
          props: [
            {
              id: 'trail-shelf',
              roomId: 'missing-prop-room',
              position: { x: 0, y: 500 },
              render: {
                assetKey: 'brackenreach-terrain',
                size: { width: 420, height: 160 },
                origin: { x: 0, y: 0 },
                depth: 0
              },
              surfaceId: 'missing-prop-surface',
              mechanismId: 'missing-prop-mechanism'
            }
          ]
        }
      ]
    };

    const issues = validateContent(registry);
    const expected: readonly ContentIssue[] = [
      {
        code: 'unresolved-reference',
        path: 'areas[0].defaultSpawnId',
        id: 'missing-default-spawn',
        message: 'Unresolved player spawns reference "missing-default-spawn".'
      },
      {
        code: 'unresolved-reference',
        path: 'areas[0].actorSpawns[0].actorId',
        id: 'missing-actor',
        message: 'Unresolved actors reference "missing-actor".'
      },
      {
        code: 'unresolved-reference',
        path: 'areas[0].mechanisms[0].requiredAbilityId',
        id: 'missing-mechanism-ability',
        message: 'Unresolved abilities reference "missing-mechanism-ability".'
      },
      {
        code: 'unresolved-reference',
        path: 'areas[0].transitions[0].destinationAreaId',
        id: 'missing-area',
        message: 'Unresolved areas reference "missing-area".'
      },
      {
        code: 'unresolved-reference',
        path: 'areas[0].props[0].surfaceId',
        id: 'missing-prop-surface',
        message: 'Unresolved area surfaces reference "missing-prop-surface".'
      },
      {
        code: 'unresolved-reference',
        path: 'areas[0].triggers[0].targetId',
        id: 'missing-target-mechanism',
        message: 'Unresolved area mechanisms reference "missing-target-mechanism".'
      }
    ];

    for (const expectedIssue of expected) {
      expect(issues).toContainEqual(expectedIssue);
    }
  });

  const triggerTargetCases = [
    {
      kind: 'room-entry',
      targetId: 'absent-room-entry-discovery',
      registryName: 'area room discoveries'
    },
    {
      kind: 'interaction',
      targetId: 'absent-interaction-mechanism',
      registryName: 'area mechanisms'
    },
    {
      kind: 'discovery',
      targetId: 'absent-discovery',
      registryName: 'area room discoveries'
    },
    {
      kind: 'quest',
      targetId: 'absent-quest',
      registryName: 'quests'
    },
    {
      kind: 'transition',
      targetId: 'absent-transition',
      registryName: 'area transitions'
    },
    {
      kind: 'checkpoint',
      targetId: 'absent-checkpoint',
      registryName: 'area checkpoints'
    }
  ] as const;

  it.each(triggerTargetCases)('requires a target for $kind triggers', ({ kind }) => {
    const triggerId = `${kind}-trigger`;
    const malformedTrigger = {
      id: triggerId,
      roomId: 'test-room',
      kind,
      bounds: { x: 80, y: 80, width: 120, height: 120 },
      once: false
    } as TriggerDefinition;
    const registry: ContentRegistry = {
      ...emptyRegistry(),
      areas: [areaDefinition({ triggers: [malformedTrigger] })]
    };

    expect(validateContent(registry)).toContainEqual({
      code: 'missing-required-field',
      path: 'areas[0].triggers[0].targetId',
      id: triggerId,
      message: `Triggers of kind "${kind}" require a target ID.`
    });
  });

  it.each(triggerTargetCases)(
    'resolves a $kind trigger target against $registryName',
    ({ kind, targetId, registryName }) => {
      const trigger: TriggerDefinition = {
        id: `${kind}-trigger`,
        roomId: 'test-room',
        kind,
        bounds: { x: 80, y: 80, width: 120, height: 120 },
        targetId,
        once: false
      };
      const registry: ContentRegistry = {
        ...emptyRegistry(),
        areas: [areaDefinition({ triggers: [trigger] })]
      };

      expect(validateContent(registry)).toContainEqual({
        code: 'unresolved-reference',
        path: 'areas[0].triggers[0].targetId',
        id: targetId,
        message: `Unresolved ${registryName} reference "${targetId}".`
      });
    }
  );

  it('reports missing required area and boss content fields', () => {
    const registry: ContentRegistry = {
      ...emptyRegistry(),
      areas: [
        {
          id: 'empty-reach',
          displayName: '',
          regionId: 'brackenreach',
          bounds: { x: 0, y: 0, width: 1280, height: 720 },
          defaultSpawnId: '',
          ambienceProfileId: '',
          rooms: [],
          layers: [],
          surfaces: [],
          playerSpawns: [],
          actorSpawns: [],
          triggers: [],
          mechanisms: [],
          checkpoints: [],
          transitions: [],
          props: []
        }
      ],
      actors: [
        actorDefinition({
          id: 'boss-without-contract',
          displayName: 'Boss Without Contract',
          kind: 'boss'
        }),
        actorDefinition({
          id: 'boss-with-empty-contract',
          displayName: 'Boss With Empty Contract',
          kind: 'boss',
          boss: {
            phaseOneAttackIds: [],
            phaseTwoAttackIds: [],
            transitionAttackId: '',
            requiredMechanismIds: [],
            defeatItemId: '',
            defeatQuestId: ''
          }
        })
      ]
    };

    expect(validateContent(registry)).toEqual(
      expect.arrayContaining([
        {
          code: 'missing-required-field',
          path: 'areas[0].displayName',
          message: 'Areas require a display name.'
        },
        {
          code: 'missing-required-field',
          path: 'areas[0].rooms',
          message: 'Areas require at least one room.'
        },
        {
          code: 'missing-required-field',
          path: 'areas[0].layers',
          message: 'Areas require at least one visual layer.'
        },
        {
          code: 'missing-required-field',
          path: 'areas[0].surfaces',
          message: 'Areas require at least one collision surface.'
        },
        {
          code: 'missing-required-field',
          path: 'areas[0].playerSpawns',
          message: 'Areas require at least one player spawn.'
        },
        {
          code: 'missing-required-field',
          path: 'actors[0].boss',
          id: 'boss-without-contract',
          message: 'Boss actors require a boss content contract.'
        },
        {
          code: 'missing-required-field',
          path: 'actors[1].boss.phaseOneAttackIds',
          id: 'boss-with-empty-contract',
          message: 'Boss actors require at least one phase-one attack.'
        },
        {
          code: 'missing-required-field',
          path: 'actors[1].boss.requiredMechanismIds',
          id: 'boss-with-empty-contract',
          message: 'Boss actors require at least one phase-two mechanism.'
        }
      ])
    );
  });

  it('reports unresolved boss attack, reward, and quest references', () => {
    const registry: ContentRegistry = {
      ...emptyRegistry(),
      actors: [
        actorDefinition({
          id: 'pallid-cantor',
          displayName: 'The Pallid Cantor',
          kind: 'boss',
          boss: {
            phaseOneAttackIds: ['missing-phase-one'],
            phaseTwoAttackIds: ['missing-phase-two'],
            transitionAttackId: 'missing-transition-attack',
            requiredMechanismIds: ['Cantor_West_Lens', 'cantor-east-lens'],
            defeatItemId: 'missing-boss-item',
            defeatQuestId: 'missing-boss-quest'
          }
        })
      ]
    };

    expect(validateContent(registry)).toEqual(
      expect.arrayContaining([
        {
          code: 'unresolved-reference',
          path: 'actors[0].boss.phaseOneAttackIds[0]',
          id: 'missing-phase-one',
          message: 'Unresolved attacks reference "missing-phase-one".'
        },
        {
          code: 'unresolved-reference',
          path: 'actors[0].boss.transitionAttackId',
          id: 'missing-transition-attack',
          message: 'Unresolved attacks reference "missing-transition-attack".'
        },
        {
          code: 'unresolved-reference',
          path: 'actors[0].boss.defeatItemId',
          id: 'missing-boss-item',
          message: 'Unresolved items reference "missing-boss-item".'
        },
        {
          code: 'unresolved-reference',
          path: 'actors[0].boss.defeatQuestId',
          id: 'missing-boss-quest',
          message: 'Unresolved quests reference "missing-boss-quest".'
        },
        {
          code: 'invalid-stable-id',
          path: 'actors[0].boss.requiredMechanismIds[0]',
          id: 'Cantor_West_Lens',
          message: 'Stable IDs must use lowercase kebab-case.'
        }
      ])
    );
  });

  it('reports valid boss mechanism IDs absent from the registered boss mechanisms', () => {
    const registry: ContentRegistry = {
      ...emptyRegistry(),
      actors: [
        actorDefinition({
          id: 'pallid-cantor',
          displayName: 'The Pallid Cantor',
          kind: 'boss',
          boss: {
            phaseOneAttackIds: ['cantor-chime-slam'],
            phaseTwoAttackIds: ['cantor-resonant-dive'],
            transitionAttackId: 'cantor-porcelain-crack',
            requiredMechanismIds: ['absent-cantor-lens'],
            defeatItemId: 'cantor-sigil',
            defeatQuestId: 'silent-bloom'
          }
        })
      ]
    };

    expect(validateContent(registry)).toContainEqual({
      code: 'unresolved-reference',
      path: 'actors[0].boss.requiredMechanismIds[0]',
      id: 'absent-cantor-lens',
      message: 'Unresolved boss mechanisms reference "absent-cantor-lens".'
    });
  });

  it('validates the shipped Brackenreach content registry', () => {
    expect(contentRegistry.areas.map(({ id }) => id)).toContain('brackenreach-trail');
    expect(contentRegistry.actors.map(({ id }) => id)).toEqual(
      expect.arrayContaining(['mara-vey', 'pallid-cantor'])
    );
    expect(contentRegistry.quests.map(({ id }) => id)).toContain('silent-bloom');
    expect(validateContent(contentRegistry)).toEqual([]);
  });
});
