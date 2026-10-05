import { deepFreeze } from '../data/immutability';
import type {
  AreaTransitionDefinition,
  ContentRegistry,
  Rect,
  RoomTransitionDefinition,
  TransitionDefinition,
  TransitionId,
} from '../data/types';
import { resolvePlatformContacts } from '../physics/PlatformRules';
import { validateSaveV1 } from '../saves/SaveSchema';
import type { RoomId, SaveV1 } from '../saves/SaveSchema';
import type { PlayerRoomBinding } from '../entities/player/PlayerController';
import type { AreaLoader, LoadedArea } from './AreaLoader';
import type { RuntimeSaveStamp, RuntimeVitals } from './RuntimeSaveCoordinator';
import { applyProgressionTransaction } from './WorldProgression';
import { matchesWorldPredicate } from './WorldPredicates';

export type WorldTransitionSelectionInput = Readonly<{
  roomId: RoomId;
  playerBounds: Rect;
  interactBufferId: number | null;
  save: SaveV1;
}>;

export type PreparedRoomTransition = Readonly<{
  kind: 'room';
  transition: RoomTransitionDefinition;
  sourceRoomId: RoomId;
  targetRoom: NonNullable<ReturnType<LoadedArea['room']>>;
  binding: PlayerRoomBinding;
  save: SaveV1;
}>;

export type PreparedAreaTransition = Readonly<{
  kind: 'area';
  transition: AreaTransitionDefinition;
  sourceAreaId: LoadedArea['definition']['areaId'];
  targetArea: LoadedArea;
  targetCheckpoint: NonNullable<ReturnType<LoadedArea['checkpoint']>>;
  targetRoom: NonNullable<ReturnType<LoadedArea['room']>>;
  save: SaveV1;
}>;

export type PreparedWorldTransition =
  PreparedRoomTransition | PreparedAreaTransition | Readonly<{ kind: 'rejected'; reason: string }>;

export class WorldTransitionCoordinator {
  private readonly insideEnterTransitions = new Set<TransitionId>();
  private readonly usedInteractBufferIds = new Set<number>();

  public constructor(
    private readonly registry: ContentRegistry,
    private readonly loader: AreaLoader,
    private readonly area: LoadedArea,
  ) {}

  public armEnterTransitionsAt(roomId: RoomId, playerBounds: Rect): void {
    this.insideEnterTransitions.clear();
    for (const transition of this.area.transitionsFor(roomId)) {
      if (transition.activation === 'enter' && overlaps(transition.bounds, playerBounds)) {
        this.insideEnterTransitions.add(transition.transitionId);
      }
    }
  }

  public promptAt(roomId: RoomId, playerBounds: Rect, save: SaveV1): string | null {
    for (const transition of this.area.transitionsFor(roomId)) {
      if (transition.activation !== 'interact') continue;
      if (!overlaps(interactionBounds(transition), playerBounds)) continue;
      if (!matchesWorldPredicate(transition.predicate, save)) continue;
      if (transition.kind === 'room') return 'Enter passage';
      const targetArea = this.registry.areas.find(
        ({ areaId }) => areaId === transition.targetAreaId,
      );
      const checkpoint = targetArea?.checkpoints.find(
        ({ checkpointId }) => checkpointId === transition.targetCheckpointId,
      );
      const targetRoom = targetArea?.rooms.find(
        ({ roomId: targetRoomId }) => targetRoomId === checkpoint?.roomId,
      );
      return targetRoom === undefined ? 'Travel onward' : `Travel to ${targetRoom.displayName}`;
    }
    return null;
  }

  public select(input: WorldTransitionSelectionInput): TransitionDefinition | null {
    const authored = this.area.transitionsFor(input.roomId);
    const overlappingEnterIds = new Set(
      authored
        .filter(
          (transition) =>
            transition.activation === 'enter' && overlaps(transition.bounds, input.playerBounds),
        )
        .map(({ transitionId }) => transitionId),
    );
    const candidates = authored.filter((transition) => {
      const bounds =
        transition.activation === 'interact' ? interactionBounds(transition) : transition.bounds;
      if (!overlaps(bounds, input.playerBounds)) return false;
      if (!matchesWorldPredicate(transition.predicate, input.save)) return false;
      if (transition.activation === 'enter') {
        return !this.insideEnterTransitions.has(transition.transitionId);
      }
      return (
        input.interactBufferId !== null &&
        Number.isSafeInteger(input.interactBufferId) &&
        input.interactBufferId >= 0 &&
        !this.usedInteractBufferIds.has(input.interactBufferId)
      );
    });
    this.insideEnterTransitions.clear();
    for (const transitionId of overlappingEnterIds) {
      this.insideEnterTransitions.add(transitionId);
    }
    const selected = candidates[0] ?? null;
    if (selected?.activation === 'interact' && input.interactBufferId !== null) {
      this.usedInteractBufferIds.add(input.interactBufferId);
    }
    return selected;
  }

  public prepare(
    transitionId: TransitionId,
    save: SaveV1,
    liveVitals: RuntimeVitals,
    stamp: RuntimeSaveStamp,
  ): PreparedWorldTransition {
    const transition = this.area.definition.transitions.find(
      (candidate) => candidate.transitionId === transitionId,
    );
    if (transition === undefined) return rejected('unknown-transition');
    const validated = validateSaveV1(save);
    if (validated.kind === 'invalid') return rejected('invalid-save');
    if (!matchesWorldPredicate(transition.predicate, validated.value)) {
      return rejected('predicate-mismatch');
    }
    return transition.kind === 'room'
      ? this.prepareRoom(transition, validated.value)
      : this.prepareArea(transition, validated.value, liveVitals, stamp);
  }

  private prepareRoom(transition: RoomTransitionDefinition, save: SaveV1): PreparedWorldTransition {
    const targetRoom = this.area.room(transition.targetRoomId);
    if (targetRoom === null) return rejected('missing-target-room');
    const binding = this.bindingFor(
      this.area,
      targetRoom,
      transition.targetPosition,
      transition.targetFacing,
    );
    if (binding === null) return rejected('unsupported-target-position');
    const progression = applyProgressionTransaction(save, {
      commands: [{ kind: 'discover-room', roomId: targetRoom.roomId }],
    });
    if (progression.kind === 'rejected') return rejected(progression.reason);
    return Object.freeze({
      kind: 'room',
      transition,
      sourceRoomId: transition.roomId,
      targetRoom,
      binding,
      save: progression.save,
    });
  }

  private prepareArea(
    transition: AreaTransitionDefinition,
    save: SaveV1,
    liveVitals: RuntimeVitals,
    stamp: RuntimeSaveStamp,
  ): PreparedWorldTransition {
    if (!validStamp(stamp, save)) return rejected('invalid-stamp');
    const definition = this.registry.areas.find(({ areaId }) => areaId === transition.targetAreaId);
    if (definition === undefined) return rejected('missing-target-area');
    let targetArea: LoadedArea;
    try {
      targetArea = this.loader.load(definition);
    } catch {
      return rejected('invalid-target-area');
    }
    const targetCheckpoint = targetArea.checkpoint(transition.targetCheckpointId);
    if (targetCheckpoint === null) return rejected('missing-target-checkpoint');
    const targetRoom = targetArea.room(targetCheckpoint.roomId);
    if (targetRoom === null) return rejected('missing-target-room');
    if (
      this.bindingFor(
        targetArea,
        targetRoom,
        targetCheckpoint.canonicalPosition,
        targetCheckpoint.facing,
      ) === null
    ) {
      return rejected('unsupported-target-position');
    }
    const progression = applyProgressionTransaction(save, {
      commands: [{ kind: 'discover-room', roomId: targetRoom.roomId }],
    });
    if (progression.kind === 'rejected') return rejected(progression.reason);
    const candidate = {
      ...progression.save,
      metadata: {
        ...progression.save.metadata,
        snapshotAtEpochMs: Math.max(
          progression.save.metadata.snapshotAtEpochMs,
          stamp.snapshotAtEpochMs,
        ),
        playTimeMs: Math.max(progression.save.metadata.playTimeMs, stamp.playTimeMs),
      },
      location: {
        regionId: targetArea.definition.regionId,
        areaId: targetArea.definition.areaId,
        checkpointId: targetCheckpoint.checkpointId,
        safePosition: { ...targetCheckpoint.canonicalPosition },
      },
      player: {
        ...progression.save.player,
        currentHealth: liveVitals.currentHealth,
        currentMana: liveVitals.currentMana,
      },
    } satisfies SaveV1;
    const candidateValidation = validateSaveV1(candidate);
    if (candidateValidation.kind === 'invalid') return rejected('invalid-candidate');
    return Object.freeze({
      kind: 'area',
      transition,
      sourceAreaId: this.area.definition.areaId,
      targetArea,
      targetCheckpoint,
      targetRoom,
      save: candidateValidation.value,
    });
  }

  private bindingFor(
    area: LoadedArea,
    room: NonNullable<ReturnType<LoadedArea['room']>>,
    position: Readonly<{ x: number; y: number }>,
    facing: 'left' | 'right',
  ): PlayerRoomBinding | null {
    const surfaces = area.surfacesFor(room.roomId);
    const zones = area.zonesFor(room.roomId);
    const support = resolvePlatformContacts(position, position, surfaces, zones, {
      bodyHalfWidth: 24,
      bodyHeight: 96,
      ignoreOneWay: false,
    });
    if (
      support.groundY === null ||
      Math.abs(support.groundY - position.y) >= 0.001 ||
      position.x < room.bounds.x + 24 ||
      position.x > room.bounds.x + room.bounds.width - 24 ||
      position.y < room.bounds.y + 96 ||
      position.y > room.bounds.y + room.bounds.height
    ) {
      return null;
    }
    return deepFreeze({
      roomId: room.roomId,
      position: { ...position },
      facing,
      surfaces,
      zones,
      movementBounds: room.bounds,
    });
  }
}

function interactionBounds(transition: TransitionDefinition): Rect {
  return {
    ...transition.bounds,
    x: transition.bounds.x - 40,
    width: transition.bounds.width + 80,
  };
}

function overlaps(left: Rect, right: Rect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function validStamp(stamp: RuntimeSaveStamp, save: SaveV1): boolean {
  return (
    Number.isSafeInteger(stamp.snapshotAtEpochMs) &&
    stamp.snapshotAtEpochMs >= save.metadata.snapshotAtEpochMs &&
    Number.isSafeInteger(stamp.playTimeMs) &&
    stamp.playTimeMs >= save.metadata.playTimeMs
  );
}

function rejected(reason: string): Extract<PreparedWorldTransition, { kind: 'rejected' }> {
  return Object.freeze({ kind: 'rejected', reason });
}
