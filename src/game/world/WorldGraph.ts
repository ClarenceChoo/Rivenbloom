import { deepFreeze } from '../data/immutability';
import type { ContentRegistry, TransitionDefinition, WorldPredicate } from '../data/types';
import type { TransitionId } from '../data/types';
import type { AreaId, RoomId } from '../saves/SaveSchema';

export type WorldNodeRef = Readonly<{ areaId: string; roomId: string }>;

export type WorldGraphNode = Readonly<{
  key: string;
  areaId: AreaId;
  roomId: RoomId;
}>;

export type WorldGraphEdge = Readonly<{
  transitionId: TransitionId;
  from: WorldGraphNode;
  to: WorldGraphNode;
  predicate: WorldPredicate;
  definition: TransitionDefinition;
}>;

export type WorldGraph = Readonly<{
  nodes: readonly WorldGraphNode[];
  edges: readonly WorldGraphEdge[];
}>;

const EMPTY_NODES = Object.freeze([]) satisfies readonly WorldGraphNode[];

export function buildWorldGraph(registry: ContentRegistry): WorldGraph {
  const nodes = registry.areas
    .flatMap((area) =>
      area.rooms.map((room) => ({
        key: nodeKey(area.areaId, room.roomId),
        areaId: area.areaId,
        roomId: room.roomId,
      })),
    )
    .sort((left, right) => compare(left.key, right.key));
  const nodesByKey = new Map(nodes.map((node) => [node.key, node]));
  const checkpointTargets = new Map(
    registry.areas.flatMap((area) =>
      area.checkpoints.map(
        (checkpoint) => [checkpoint.checkpointId, nodeKey(area.areaId, checkpoint.roomId)] as const,
      ),
    ),
  );
  const edges: WorldGraphEdge[] = [];

  for (const area of registry.areas) {
    for (const definition of area.transitions) {
      const from = nodesByKey.get(nodeKey(area.areaId, definition.roomId));
      const targetKey =
        definition.kind === 'room'
          ? nodeKey(area.areaId, definition.targetRoomId)
          : checkpointTargets.get(definition.targetCheckpointId);
      const to = targetKey === undefined ? undefined : nodesByKey.get(targetKey);
      if (from === undefined || to === undefined) continue;
      edges.push({
        transitionId: definition.transitionId,
        from,
        to,
        predicate: definition.predicate,
        definition,
      });
    }
  }

  return deepFreeze({ nodes, edges });
}

export function reachableWorldNodes(
  graph: WorldGraph,
  start: WorldNodeRef,
  allowEdge: (edge: WorldGraphEdge) => boolean = () => true,
): readonly WorldGraphNode[] {
  const startKey = nodeKey(start.areaId, start.roomId);
  if (!graph.nodes.some(({ key }) => key === startKey)) return EMPTY_NODES;

  const visited = new Set([startKey]);
  const queue = [startKey];
  while (queue.length > 0) {
    const key = queue.shift();
    if (key === undefined) break;
    for (const edge of graph.edges) {
      if (edge.from.key !== key || !allowEdge(edge) || visited.has(edge.to.key)) continue;
      visited.add(edge.to.key);
      queue.push(edge.to.key);
    }
  }

  return deepFreeze(graph.nodes.filter(({ key }) => visited.has(key)));
}

function nodeKey(areaId: string, roomId: string): string {
  return `${areaId}/${roomId}`;
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
