import { validateContent } from '../data/ContentValidation';
import { immutableClone } from '../data/immutability';
import type {
  ActorSpawnDefinition,
  AreaDefinition,
  BreakableDefinition,
  CheckpointDefinition,
  ChestDefinition,
  ContentIssue,
  ContentRegistry,
  DiscoveryDefinition,
  EncounterDefinition,
  MechanismDefinition,
  RoomDefinition,
  SurfaceDefinition,
  TriggerDefinition,
  TransitionDefinition,
  Vec2,
  ZoneDefinition,
} from '../data/types';
import { rectContainsPoint } from '../data/types';
import type { AreaId, CheckpointId, RoomId } from '../saves/SaveSchema';

export type LoadedArea = Readonly<{
  definition: AreaDefinition;
  checkpoint(id: CheckpointId): CheckpointDefinition | null;
  room(id: RoomId): RoomDefinition | null;
  roomAt(point: Vec2): RoomDefinition | null;
  surfacesFor(roomId: RoomId): readonly SurfaceDefinition[];
  zonesFor(roomId: RoomId): readonly ZoneDefinition[];
  actorsFor(roomId: RoomId): readonly ActorSpawnDefinition[];
  triggersFor(roomId: RoomId): readonly TriggerDefinition[];
  checkpointsFor(roomId: RoomId): readonly CheckpointDefinition[];
  transitionsFor(roomId: RoomId): readonly TransitionDefinition[];
  mechanismsFor(roomId: RoomId): readonly MechanismDefinition[];
  encountersFor(roomId: RoomId): readonly EncounterDefinition[];
  chestsFor(roomId: RoomId): readonly ChestDefinition[];
  discoveriesFor(roomId: RoomId): readonly DiscoveryDefinition[];
  breakablesFor(roomId: RoomId): readonly BreakableDefinition[];
}>;

const EMPTY_SURFACES = Object.freeze([]) satisfies readonly SurfaceDefinition[];
const EMPTY_ZONES = Object.freeze([]) satisfies readonly ZoneDefinition[];
const EMPTY_ACTORS = Object.freeze([]) satisfies readonly ActorSpawnDefinition[];
const EMPTY_TRIGGERS = Object.freeze([]) satisfies readonly TriggerDefinition[];
const EMPTY_CHECKPOINTS = Object.freeze([]) satisfies readonly CheckpointDefinition[];
const EMPTY_TRANSITIONS = Object.freeze([]) satisfies readonly TransitionDefinition[];
const EMPTY_MECHANISMS = Object.freeze([]) satisfies readonly MechanismDefinition[];
const EMPTY_ENCOUNTERS = Object.freeze([]) satisfies readonly EncounterDefinition[];
const EMPTY_CHESTS = Object.freeze([]) satisfies readonly ChestDefinition[];
const EMPTY_DISCOVERIES = Object.freeze([]) satisfies readonly DiscoveryDefinition[];
const EMPTY_BREAKABLES = Object.freeze([]) satisfies readonly BreakableDefinition[];

export class ContentLoadError extends Error {
  public readonly name = 'ContentLoadError';

  public constructor(public readonly issues: readonly ContentIssue[]) {
    super('Area content could not be loaded.');
  }
}

export class AreaLoader {
  private readonly areasById: ReadonlyMap<AreaId, AreaDefinition>;

  public constructor(private readonly registry: ContentRegistry) {
    this.areasById = new Map(registry.areas.map((area) => [area.areaId, area]));
  }

  public load(definition: AreaDefinition): LoadedArea {
    const registered = this.areasById.get(definition.areaId);
    if (registered === undefined) {
      throw new ContentLoadError([
        Object.freeze({
          severity: 'error',
          code: 'missing-reference',
          path: '/areaId',
          message: 'Requested area is not registered.',
        }),
      ]);
    }

    const validationRegistry =
      registered === definition
        ? this.registry
        : {
            ...this.registry,
            areas: this.registry.areas.map((area) =>
              area.areaId === definition.areaId ? definition : area,
            ),
          };
    const issues = validateContent(validationRegistry);
    if (issues.some(({ severity }) => severity === 'error')) {
      throw new ContentLoadError(issues);
    }

    const snapshot = immutableClone(definition);
    const rooms = new Map(snapshot.rooms.map((room) => [room.roomId, room]));
    const checkpoints = new Map(
      snapshot.checkpoints.map((checkpoint) => [checkpoint.checkpointId, checkpoint]),
    );
    const surfaces = groupByRoom(snapshot.surfaces);
    const zones = groupByRoom(snapshot.zones);
    const actors = groupByRoom(snapshot.actorSpawns);
    const triggers = groupByRoom(snapshot.triggers);
    const checkpointsByRoom = groupByRoom(snapshot.checkpoints);
    const transitions = groupByRoom(snapshot.transitions);
    const mechanisms = groupByRoom(snapshot.mechanisms);
    const encounters = groupByRoom(snapshot.encounters);
    const chests = groupByRoom(snapshot.chests);
    const discoveries = groupByRoom(snapshot.discoveries);
    const breakables = groupByRoom(snapshot.breakables);

    return Object.freeze({
      definition: snapshot,
      checkpoint: (id: CheckpointId) => checkpoints.get(id) ?? null,
      room: (id: RoomId) => rooms.get(id) ?? null,
      roomAt: (point: Vec2) =>
        snapshot.rooms.find((room) => rectContainsPoint(room.bounds, point)) ?? null,
      surfacesFor: (roomId: RoomId) => surfaces.get(roomId) ?? EMPTY_SURFACES,
      zonesFor: (roomId: RoomId) => zones.get(roomId) ?? EMPTY_ZONES,
      actorsFor: (roomId: RoomId) => actors.get(roomId) ?? EMPTY_ACTORS,
      triggersFor: (roomId: RoomId) => triggers.get(roomId) ?? EMPTY_TRIGGERS,
      checkpointsFor: (roomId: RoomId) => checkpointsByRoom.get(roomId) ?? EMPTY_CHECKPOINTS,
      transitionsFor: (roomId: RoomId) => transitions.get(roomId) ?? EMPTY_TRANSITIONS,
      mechanismsFor: (roomId: RoomId) => mechanisms.get(roomId) ?? EMPTY_MECHANISMS,
      encountersFor: (roomId: RoomId) => encounters.get(roomId) ?? EMPTY_ENCOUNTERS,
      chestsFor: (roomId: RoomId) => chests.get(roomId) ?? EMPTY_CHESTS,
      discoveriesFor: (roomId: RoomId) => discoveries.get(roomId) ?? EMPTY_DISCOVERIES,
      breakablesFor: (roomId: RoomId) => breakables.get(roomId) ?? EMPTY_BREAKABLES,
    });
  }
}

function groupByRoom<Definition extends Readonly<{ roomId: RoomId }>>(
  definitions: readonly Definition[],
): ReadonlyMap<RoomId, readonly Definition[]> {
  const grouped = new Map<RoomId, Definition[]>();
  for (const definition of definitions) {
    const existing = grouped.get(definition.roomId);
    if (existing === undefined) grouped.set(definition.roomId, [definition]);
    else existing.push(definition);
  }
  return new Map(
    [...grouped].map(([roomId, entries]) => [roomId, Object.freeze([...entries])] as const),
  );
}
