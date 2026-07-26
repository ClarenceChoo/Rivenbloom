import { maxHealthFor, maxManaFor } from '../config/balance';
import type { AreaDefinition, PlayerSpawnDefinition } from '../data/types';
import type { SaveV1 } from '../saves/SaveSchema';

export type RestoredCheckpoint = {
  readonly spawn: PlayerSpawnDefinition;
  readonly fromCheckpoint: boolean;
  readonly health: number;
  readonly mana: number;
};

export type CheckpointActivation = {
  readonly save: SaveV1;
  readonly firstActivation: boolean;
};

const checkpointFlag = (checkpointId: string): string => `checkpoint-${checkpointId}`;

export class CheckpointSystem {
  public constructor(private readonly area: AreaDefinition) {}

  /**
   * Rests at a seed-lantern: records the safe position, refills vitality, and
   * flags the checkpoint persistently. Re-activation is idempotent.
   */
  public activate(save: SaveV1, checkpointId: string, now: number): CheckpointActivation {
    const checkpoint = this.area.checkpoints.find(({ id }) => id === checkpointId);
    if (checkpoint === undefined) {
      throw new Error(`Unknown checkpoint "${checkpointId}" in area "${this.area.id}".`);
    }
    const flag = checkpointFlag(checkpointId);
    const firstActivation = !save.questFlags.includes(flag);
    return {
      firstActivation,
      save: {
        ...save,
        metadata: {
          ...save.metadata,
          areaId: this.area.id,
          safePosition: { ...checkpoint.position },
          updatedAt: now
        },
        player: {
          ...save.player,
          health: maxHealthFor(save.player.healthUpgrades),
          mana: maxManaFor(save.player.manaUpgrades)
        },
        questFlags: firstActivation ? [...save.questFlags, flag] : save.questFlags
      }
    };
  }

  /**
   * Resolves where a loaded or respawning player appears. A safe position
   * recorded in this area wins; anything else falls back to the default spawn.
   */
  public restore(save: SaveV1): RestoredCheckpoint {
    const health = Math.max(1, save.player.health);
    const mana = Math.max(0, save.player.mana);
    const safe = save.metadata.safePosition;
    const checkpoint =
      save.metadata.areaId === this.area.id
        ? this.area.checkpoints.find(
            ({ position, id }) =>
              save.questFlags.includes(checkpointFlag(id)) &&
              position.x === safe.x &&
              position.y === safe.y
          )
        : undefined;
    if (checkpoint !== undefined) {
      const room = this.area.rooms.find(({ id }) => id === checkpoint.roomId);
      return {
        fromCheckpoint: true,
        spawn: {
          id: checkpoint.spawnId,
          roomId: room?.id ?? checkpoint.roomId,
          position: { ...checkpoint.position },
          facing: 'right'
        },
        health,
        mana
      };
    }
    const fallback = this.defaultSpawn();
    return { fromCheckpoint: false, spawn: fallback, health, mana };
  }

  /** Death consumes no progress: vitality refills at the recorded checkpoint. */
  public respawnAfterDeath(
    save: SaveV1,
    now: number
  ): { save: SaveV1; restored: RestoredCheckpoint } {
    const revived: SaveV1 = {
      ...save,
      metadata: { ...save.metadata, updatedAt: now },
      player: {
        ...save.player,
        health: maxHealthFor(save.player.healthUpgrades),
        mana: maxManaFor(save.player.manaUpgrades)
      }
    };
    return { save: revived, restored: new CheckpointSystem(this.area).restore(revived) };
  }

  private defaultSpawn(): PlayerSpawnDefinition {
    const spawn = this.area.playerSpawns.find(({ id }) => id === this.area.defaultSpawnId);
    if (spawn === undefined) {
      throw new Error(`Area "${this.area.id}" is missing its default spawn.`);
    }
    return spawn;
  }
}
