import {
  isRecoveringRootMemory,
  isSeekingWayfinderDash,
  MAIN_QUEST_DESTINATIONS,
} from '../data/quests';
import { CONTENT_REGISTRY } from '../data/areas';
import type { SaveV1 } from '../saves/SaveSchema';
import { buildWorldGraph } from '../world/WorldGraph';
import { matchesWorldPredicate } from '../world/WorldPredicates';

const graph = buildWorldGraph(CONTENT_REGISTRY);
export type RoomMap = ReturnType<typeof computeRoomMap>;
const cache = new WeakMap<SaveV1, Map<string, RoomMap>>();

export function projectRoomMap(save: SaveV1, currentRoomId: string): RoomMap {
  let rooms = cache.get(save);
  if (!rooms) {
    rooms = new Map();
    cache.set(save, rooms);
  }
  let result = rooms.get(currentRoomId);
  if (!result) {
    result = computeRoomMap(save, currentRoomId);
    rooms.set(currentRoomId, result);
  }
  return result;
}
function computeRoomMap(save: SaveV1, currentRoomId: string) {
  const stage = save.quests.stages.find((quest) => quest.questId === 'the-silent-bloom')?.stageId;
  const destination = isRecoveringRootMemory(stage, save.quests.flags)
    ? 'root-memory-chamber'
    : isSeekingWayfinderDash(stage, save.quests.flags)
      ? 'dash-trial'
      : stage === undefined
        ? undefined
        : MAIN_QUEST_DESTINATIONS[stage];
  const discovered = new Set<string>([...save.worldProgress.discoveredRooms, currentRoomId]);
  const nodes = CONTENT_REGISTRY.areas.flatMap((area, column) =>
    area.rooms.flatMap((room, row) =>
      discovered.has(room.roomId)
        ? [
            {
              id: room.roomId,
              label: room.displayName,
              current: room.roomId === currentRoomId,
              objective: room.roomId === destination,
              checkpoint: area.checkpoints.some((checkpoint) => checkpoint.roomId === room.roomId),
              x: column * 240 + 110,
              y: row * 90 + 45,
            },
          ]
        : [],
    ),
  );
  const edges = graph.edges
    .filter((edge) => discovered.has(edge.from.roomId) && discovered.has(edge.to.roomId))
    .map((edge) => ({
      id: edge.transitionId,
      from: edge.from.roomId,
      to: edge.to.roomId,
      locked: !matchesWorldPredicate(edge.predicate, save),
    }));
  const unexploredExits = graph.edges
    .filter(
      (edge) =>
        discovered.has(edge.from.roomId) &&
        !discovered.has(edge.to.roomId) &&
        matchesWorldPredicate(edge.predicate, save) &&
        CONTENT_REGISTRY.areas
          .find((area) => area.areaId === edge.to.areaId)
          ?.rooms.find((room) => room.roomId === edge.to.roomId)?.discoveryId === null,
    )
    .map((edge) => {
      const room = CONTENT_REGISTRY.areas
        .find((area) => area.areaId === edge.from.areaId)
        ?.rooms.find((candidate) => candidate.roomId === edge.from.roomId);
      const fraction =
        room === undefined
          ? 0.5
          : (edge.definition.bounds.x + edge.definition.bounds.width / 2 - room.bounds.x) /
            room.bounds.width;
      const position =
        fraction < 0.2
          ? 'west edge'
          : fraction < 0.4
            ? 'west side'
            : fraction < 0.6
              ? 'centre'
              : fraction < 0.8
                ? 'east side'
                : 'east edge';
      return { from: edge.from.roomId, id: edge.transitionId, position };
    });
  return { nodes, edges, unexploredExits };
}
