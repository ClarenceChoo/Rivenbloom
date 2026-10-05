import { describe, expect, it } from 'vitest';

import { equipmentSlotId, itemId, questFlagId, questStageId } from '../../src/game/core/StableId';
import { CONTENT_REGISTRY, WRENS_REST_AREA } from '../../src/game/data/areas';
import { createNewSave } from '../../src/game/saves/SaveSchema';
import type { SaveV1 } from '../../src/game/saves/SaveSchema';
import { projectWorldUi } from '../../src/game/world/WorldUiProjection';

function save(): SaveV1 {
  const { newGame } = CONTENT_REGISTRY;
  const created = createNewSave({
    nowEpochMs: 100,
    location: {
      regionId: newGame.initialRegionId,
      areaId: newGame.initialAreaId,
      checkpointId: newGame.initialCheckpointId,
      safePosition: { x: 256, y: 608 },
    },
    baseStats: newGame.baseStats,
    initialQuests: newGame.initialQuests,
    startingAbilities: newGame.startingAbilities,
  });
  return {
    ...created,
    player: { ...created.player, currency: 17, experience: 42, weaponLevel: 1 },
    inventory: [{ itemId: itemId('quiet-step'), quantity: 1 }],
    equipment: [{ slot: equipmentSlotId('charm-one'), itemId: itemId('quiet-step') }],
  };
}

describe('WorldUiProjection', () => {
  it('asks the player to recover the root-memory before directing them back to Piri', () => {
    const created = save();
    const seeking: SaveV1 = {
      ...created,
      quests: {
        stages: created.quests.stages.map((quest) =>
          quest.questId === 'the-silent-bloom'
            ? { ...quest, stageId: questStageId('bring-root-memory-to-piri') }
            : quest,
        ),
        flags: [...created.quests.flags, questFlagId('listening-arch-traced')],
      },
    };
    const objective = (state: SaveV1) =>
      projectWorldUi({
        revision: 1,
        save: state,
        area: WRENS_REST_AREA,
        room: WRENS_REST_AREA.rooms[0]!,
        checkpoint: WRENS_REST_AREA.checkpoints[0]!,
        prompt: null,
        liveVitals: { currentHealth: 100, currentMana: 40 },
        autosave: 'queued',
        objects: {
          roomId: WRENS_REST_AREA.rooms[0]!.roomId,
          puzzles: [],
          chests: [],
          discoveries: [],
          shortcuts: [],
          breakables: [],
        },
      }).quests.find((quest) => quest.questId === 'the-silent-bloom')?.objective;

    expect(objective(seeking)).toBe('Recover the root-memory in the Singing Hollows.');
    expect(
      objective({
        ...seeking,
        quests: {
          ...seeking.quests,
          flags: [...seeking.quests.flags, questFlagId('root-memory-recovered')],
        },
      }),
    ).toBe('Bring the recovered root-memory to Piri.');
    expect(
      objective({
        ...seeking,
        quests: {
          ...seeking.quests,
          stages: seeking.quests.stages.map((quest) =>
            quest.questId === 'the-silent-bloom'
              ? { ...quest, stageId: questStageId('seek-briar-core') }
              : quest,
          ),
        },
      }),
    ).toBe('Learn Wayfinder Dash in the trial beneath the Root-Memory Chamber.');
    expect(
      objective({
        ...seeking,
        quests: {
          ...seeking.quests,
          stages: seeking.quests.stages.map((quest) =>
            quest.questId === 'the-silent-bloom'
              ? { ...quest, stageId: questStageId('seek-briar-core') }
              : quest,
          ),
          flags: [...seeking.quests.flags, questFlagId('wayfinder-dash-awakened')],
        },
      }),
    ).toBe('Claim a briar core from the Thorn Sentinel east of the Root-Memory Chamber.');
  });

  it('publishes authored display copy and equipment data in a deeply frozen whole snapshot', () => {
    const projection = projectWorldUi({
      revision: 4,
      save: save(),
      area: WRENS_REST_AREA,
      room: WRENS_REST_AREA.rooms[0]!,
      checkpoint: WRENS_REST_AREA.checkpoints[0]!,
      prompt: 'Speak with Sela',
      liveVitals: { currentHealth: 73, currentMana: 19 },
      autosave: 'queued',
      objects: {
        roomId: WRENS_REST_AREA.rooms[0]!.roomId,
        puzzles: [{ puzzleId: 'test-puzzle', state: 'advanced' }],
        chests: [{ chestId: 'test-chest', state: 'closed' }],
        discoveries: [{ discoveryId: 'test-discovery', state: 'available' }],
        shortcuts: [{ shortcutId: 'test-shortcut', state: 'opened' }],
        breakables: [{ breakableId: 'test-breakable', state: 'closed' }],
      },
    });

    expect(projection).toMatchObject({
      revision: 4,
      area: { areaId: 'wren-rest', label: "Wren's Rest" },
      room: { roomId: 'wren-rest-square', label: "Wren's Rest Square" },
      prompt: 'Speak with Sela',
      player: {
        currentHealth: 73,
        maxHealth: 100,
        currentMana: 19,
        maxMana: 40,
        experience: 42,
        currency: 17,
        weaponLevel: 1,
      },
      checkpoint: { checkpointId: 'village-well', label: 'Village Seed-Lantern' },
      world: {
        discoveredRoomIds: [],
        objects: {
          roomId: 'wren-rest-square',
          puzzles: [{ puzzleId: 'test-puzzle', state: 'advanced' }],
          chests: [{ chestId: 'test-chest', state: 'closed' }],
          discoveries: [{ discoveryId: 'test-discovery', state: 'available' }],
          shortcuts: [{ shortcutId: 'test-shortcut', state: 'opened' }],
          breakables: [{ breakableId: 'test-breakable', state: 'closed' }],
        },
      },
      autosave: 'queued',
    });
    expect(projection.quests).toContainEqual(
      expect.objectContaining({
        questId: 'the-silent-bloom',
        displayName: 'The Silent Bloom',
        stageId: 'unheard',
        title: 'A Quiet Map',
        objective: 'Speak with Sela at her chart table.',
        status: 'active',
      }),
    );
    expect(projection.inventory).toContainEqual({
      itemId: 'quiet-step',
      displayName: 'Quiet Step',
      description: 'Reduces damage from briar hazards by 20% while equipped.',
      category: 'charm',
      quantity: 1,
      equippedSlots: ['charm-one'],
    });
    expect(Object.isFrozen(projection)).toBe(true);
    expect(Object.isFrozen(projection.quests)).toBe(true);
    expect(Object.isFrozen(projection.inventory[0]!.equippedSlots)).toBe(true);
    expect(Object.isFrozen(projection.world.objects.chests)).toBe(true);
  });
});
