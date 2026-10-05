import { questFlagId, questStageId, stableId } from '../../src/game/core/StableId';
import { expect, it } from 'vitest';
import { projectRoomMap } from '../../src/game/ui/RoomMapProjection';
import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { createNewSave } from '../../src/game/saves/SaveSchema';
it('connects discovered rooms and conceals undiscovered destination labels', () => {
  const c = CONTENT_REGISTRY.newGame;
  const save = createNewSave({
    nowEpochMs: 100,
    location: {
      regionId: c.initialRegionId,
      areaId: c.initialAreaId,
      checkpointId: c.initialCheckpointId,
      safePosition: { x: 256, y: 608 },
    },
    baseStats: c.baseStats,
    initialQuests: c.initialQuests,
    startingAbilities: c.startingAbilities,
  });
  const map = projectRoomMap(save, 'wren-rest-square');
  expect(map.nodes).toHaveLength(1);
  expect(map.nodes[0]).toMatchObject({ id: 'wren-rest-square', current: true, checkpoint: true });
  expect(map.edges).toHaveLength(0);
  expect(map.nodes[0]?.objective).toBe(true);
  expect(map.unexploredExits.map((exit) => exit.position)).toContain('east edge');
  expect(map.unexploredExits.map((exit) => exit.position)).toContain('centre');
  const known = projectRoomMap(
    {
      ...save,
      worldProgress: {
        ...save.worldProgress,
        discoveredRooms: [
          stableId<'room'>('brackenreach-trail'),
          stableId<'room'>('wren-rest-square'),
        ],
      },
    },
    'wren-rest-square',
  );
  expect(
    known.edges.some(
      (edge) => edge.from === 'wren-rest-square' && edge.to === 'brackenreach-trail',
    ),
  ).toBe(true);
  expect(JSON.stringify(map)).not.toContain('Split Cedar');
});

it('points to the root-memory until it is recovered, then to Piri', () => {
  const c = CONTENT_REGISTRY.newGame;
  const save = createNewSave({
    nowEpochMs: 100,
    location: {
      regionId: c.initialRegionId,
      areaId: c.initialAreaId,
      checkpointId: c.initialCheckpointId,
      safePosition: { x: 256, y: 608 },
    },
    baseStats: c.baseStats,
    initialQuests: c.initialQuests,
    startingAbilities: c.startingAbilities,
  });
  const seeking = {
    ...save,
    quests: {
      stages: save.quests.stages.map((quest) =>
        quest.questId === 'the-silent-bloom'
          ? { ...quest, stageId: questStageId('bring-root-memory-to-piri') }
          : quest,
      ),
      flags: [...save.quests.flags, questFlagId('listening-arch-traced')],
    },
    worldProgress: {
      ...save.worldProgress,
      discoveredRooms: [
        stableId<'room'>('wren-rest-square'),
        stableId<'room'>('root-memory-chamber'),
      ],
    },
  };
  const before = projectRoomMap(seeking, 'wren-rest-square');
  expect(before.nodes.find((node) => node.id === 'root-memory-chamber')?.objective).toBe(true);
  expect(before.nodes.find((node) => node.id === 'wren-rest-square')?.objective).toBe(false);

  const recovered = {
    ...seeking,
    quests: {
      ...seeking.quests,
      flags: [...seeking.quests.flags, questFlagId('root-memory-recovered')],
    },
  };
  const after = projectRoomMap(recovered, 'wren-rest-square');
  expect(after.nodes.find((node) => node.id === 'wren-rest-square')?.objective).toBe(true);
  expect(after.nodes.find((node) => node.id === 'root-memory-chamber')?.objective).toBe(false);
});

it('marks the Dash Trial before the discovered Reliquary Verge while seeking the briar core', () => {
  const c = CONTENT_REGISTRY.newGame;
  const save = createNewSave({
    nowEpochMs: 100,
    location: {
      regionId: c.initialRegionId,
      areaId: c.initialAreaId,
      checkpointId: c.initialCheckpointId,
      safePosition: { x: 256, y: 608 },
    },
    baseStats: c.baseStats,
    initialQuests: c.initialQuests,
    startingAbilities: c.startingAbilities,
  });
  const seeking = {
    ...save,
    quests: {
      ...save.quests,
      stages: save.quests.stages.map((quest) =>
        quest.questId === 'the-silent-bloom'
          ? { ...quest, stageId: questStageId('seek-briar-core') }
          : quest,
      ),
    },
    worldProgress: {
      ...save.worldProgress,
      discoveredRooms: [
        stableId<'room'>('wren-rest-square'),
        stableId<'room'>('dash-trial'),
        stableId<'room'>('reliquary-verge'),
      ],
    },
  };
  const before = projectRoomMap(seeking, 'wren-rest-square');
  expect(before.nodes.find((node) => node.id === 'dash-trial')?.objective).toBe(true);
  expect(before.nodes.find((node) => node.id === 'reliquary-verge')?.objective).toBe(false);
  const after = projectRoomMap(
    {
      ...seeking,
      quests: {
        ...seeking.quests,
        flags: [...seeking.quests.flags, questFlagId('wayfinder-dash-awakened')],
      },
    },
    'wren-rest-square',
  );
  expect(after.nodes.find((node) => node.id === 'dash-trial')?.objective).toBe(false);
  expect(after.nodes.find((node) => node.id === 'reliquary-verge')?.objective).toBe(true);
});
