import { isStableId } from '../core/StableId';
import { deepFreeze, immutableClone } from '../data/immutability';
import { rectContainsPoint } from '../data/types';
import type { AreaDefinition, CheckpointDefinition } from '../data/types';
import { validateSaveV1 } from '../saves/SaveSchema';
import type { SaveV1 } from '../saves/SaveSchema';

export type CheckpointResult =
  | Readonly<{
      kind: 'activated' | 'restored';
      save: SaveV1;
      position: Readonly<{ x: number; y: number }>;
      facing: 'left' | 'right';
      events: readonly Readonly<{ kind: 'autosave-requested' }>[];
    }>
  | Readonly<{ kind: 'unchanged'; save: SaveV1; events: readonly [] }>
  | Readonly<{
      kind: 'rejected';
      reason: 'unknown-area' | 'unknown-checkpoint' | 'invalid-safe-position' | 'invalid-save';
      save: SaveV1;
      events: readonly [];
    }>;

type OwnedCheckpoint = Readonly<{ area: AreaDefinition; checkpoint: CheckpointDefinition }>;
const EMPTY = Object.freeze([]) as readonly [];

export class CheckpointSystem {
  private readonly areas = new Map<string, AreaDefinition>();
  private readonly checkpoints = new Map<string, OwnedCheckpoint>();
  private heldCheckpointId: string | null = null;

  public constructor(areas: readonly AreaDefinition[]) {
    for (const area of areas) {
      if (this.areas.has(area.areaId)) throw new RangeError('Checkpoint areas cannot repeat.');
      this.areas.set(area.areaId, area);
      for (const checkpoint of area.checkpoints) {
        if (this.checkpoints.has(checkpoint.checkpointId)) {
          throw new RangeError('Checkpoint IDs cannot repeat across areas.');
        }
        this.checkpoints.set(checkpoint.checkpointId, { area, checkpoint });
      }
    }
  }

  public activate(
    save: SaveV1,
    destination: Readonly<{ areaId: string; checkpointId: string }>,
  ): CheckpointResult {
    const validation = validateSaveV1(save);
    if (validation.kind === 'invalid') return rejected(save, 'invalid-save');
    const current = this.resolve(
      validation.value.location.areaId,
      validation.value.location.checkpointId,
    );
    if ('reason' in current) return rejected(validation.value, 'invalid-save');
    const resolved = this.resolve(destination.areaId, destination.checkpointId);
    if ('reason' in resolved) return rejected(validation.value, resolved.reason);
    if (this.heldCheckpointId === destination.checkpointId) {
      return deepFreeze({
        kind: 'unchanged',
        save: immutableClone(validation.value),
        events: EMPTY,
      });
    }
    const patched = patchAtCheckpoint(validation.value, resolved.area, resolved.checkpoint);
    if (patched === null) return rejected(validation.value, 'invalid-save');
    this.heldCheckpointId = destination.checkpointId;
    return deepFreeze({
      kind: 'activated',
      save: immutableClone(patched),
      position: resolved.checkpoint.canonicalPosition,
      facing: resolved.checkpoint.facing,
      events: [{ kind: 'autosave-requested' }],
    });
  }

  public releaseInteraction(): void {
    this.heldCheckpointId = null;
  }

  public cancelActivation(checkpointId: string): boolean {
    if (this.heldCheckpointId !== checkpointId) return false;
    this.heldCheckpointId = null;
    return true;
  }

  public restore(save: SaveV1): CheckpointResult {
    const validation = validateSaveV1(save);
    if (validation.kind === 'invalid') return rejected(save, 'invalid-save');
    const resolved = this.resolve(
      validation.value.location.areaId,
      validation.value.location.checkpointId,
    );
    if ('reason' in resolved) return rejected(validation.value, 'invalid-save');
    const patched = patchAtCheckpoint(validation.value, resolved.area, resolved.checkpoint);
    if (patched === null) return rejected(validation.value, 'invalid-save');
    return deepFreeze({
      kind: 'restored',
      save: immutableClone(patched),
      position: resolved.checkpoint.canonicalPosition,
      facing: resolved.checkpoint.facing,
      events: [],
    });
  }

  private resolve(
    areaId: string,
    checkpointId: string,
  ):
    | OwnedCheckpoint
    | Readonly<{
        reason: 'unknown-area' | 'unknown-checkpoint' | 'invalid-safe-position';
      }> {
    if (!isStableId(areaId) || !this.areas.has(areaId)) return { reason: 'unknown-area' };
    if (!isStableId(checkpointId)) return { reason: 'unknown-checkpoint' };
    const owned = this.checkpoints.get(checkpointId);
    if (owned === undefined || owned.area.areaId !== areaId)
      return { reason: 'unknown-checkpoint' };
    const room = owned.area.rooms.find(({ roomId }) => roomId === owned.checkpoint.roomId);
    if (
      room === undefined ||
      !safePoint(owned.checkpoint.canonicalPosition) ||
      !rectContainsPoint(owned.checkpoint.safeZone, owned.checkpoint.canonicalPosition) ||
      !rectContainsPoint(room.bounds, owned.checkpoint.canonicalPosition) ||
      !rectContainsPoint(owned.area.bounds, owned.checkpoint.canonicalPosition)
    )
      return { reason: 'invalid-safe-position' };
    return owned;
  }
}

function rejected(
  save: SaveV1,
  reason: Extract<CheckpointResult, { kind: 'rejected' }>['reason'],
): CheckpointResult {
  return deepFreeze({ kind: 'rejected', reason, save: immutableClone(save), events: EMPTY });
}

function patchAtCheckpoint(
  save: SaveV1,
  area: AreaDefinition,
  checkpoint: CheckpointDefinition,
): SaveV1 | null {
  const candidate: SaveV1 = {
    ...save,
    location: {
      regionId: area.regionId,
      areaId: area.areaId,
      checkpointId: checkpoint.checkpointId,
      safePosition: { ...checkpoint.canonicalPosition },
    },
    player: {
      ...save.player,
      currentHealth: save.player.baseStats.maxHealth,
      currentMana: save.player.baseStats.maxMana,
    },
  };
  const result = validateSaveV1(candidate);
  return result.kind === 'valid' ? result.value : null;
}

function safePoint(point: Readonly<{ x: number; y: number }>): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}
