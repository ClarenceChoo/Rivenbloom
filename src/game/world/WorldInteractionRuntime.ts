import { deepFreeze } from '../data/immutability';
import type {
  ActorSpawnDefinition,
  ActorSpawnId,
  NpcDefinition,
  TriggerDefinition,
  TriggerId,
} from '../data/types';
import type { PlayerState } from '../entities/player/PlayerState';
import { NpcController } from '../entities/npcs/NpcController';
import type { CheckpointId, RoomId } from '../saves/SaveSchema';
import type { LoadedArea } from './AreaLoader';
import { TriggerSystem } from './TriggerSystem';

export type WorldInteractionAction =
  | Readonly<{ kind: 'interact-npc'; spawnId: ActorSpawnId }>
  | Readonly<{ kind: 'activate-checkpoint'; areaId: string; checkpointId: string }>;

export type WorldInteractionNpcState = Readonly<{
  spawnId: ActorSpawnId;
  facing: 'left' | 'right';
  prompt: string;
}>;

export type WorldInteractionStep = Readonly<{
  kind: 'idle' | 'accepted';
  prompt: string | null;
  npcs: readonly WorldInteractionNpcState[];
  action: WorldInteractionAction | null;
  consumedInteractBufferId: number | null;
  halt: boolean;
}>;

export class WorldInteractionRuntime {
  private readonly triggerSystem: TriggerSystem;
  private readonly npcController: NpcController;
  private readonly triggers: readonly TriggerDefinition[];
  private readonly npcSpawns: readonly ActorSpawnDefinition[];
  private disposed = false;

  public constructor(
    private readonly area: LoadedArea,
    roomId: RoomId,
    npcs: readonly NpcDefinition[],
  ) {
    this.triggers = area.triggersFor(roomId);
    this.npcSpawns = area
      .actorsFor(roomId)
      .filter((spawn) => npcs.some((npc) => npc.spawnId === spawn.spawnId));
    this.npcController = new NpcController(
      npcs.filter((npc) => this.npcSpawns.some((spawn) => spawn.spawnId === npc.spawnId)),
    );
    this.triggerSystem = new TriggerSystem(
      this.triggers.map((trigger) => ({
        triggerId: trigger.triggerId,
        bounds: trigger.bounds,
        activation: trigger.activation,
        predicate: { requiresFacts: [], excludesFacts: [] },
        action: trigger.action,
      })),
    );
  }

  public step(
    input: Readonly<{
      playerPosition: Readonly<{ x: number; y: number }>;
      playerState: PlayerState;
      interactBufferId: number | null;
      facts: readonly import('../core/StableId').QuestFlagId[];
      fulfilledTriggerIds: readonly TriggerId[];
    }>,
  ): WorldInteractionStep {
    if (this.disposed) return idle(null, []);
    const bounds = {
      x: input.playerPosition.x - 24,
      y: input.playerPosition.y - 96,
      width: 48,
      height: 96,
    };
    const npcStates = this.npcSpawns.map((spawn) => {
      const npc = this.npcController.evaluate({
        spawnId: spawn.spawnId,
        npcPositionX: spawn.position.x,
        playerPositionX: input.playerPosition.x,
        interactionPressed: false,
        quests: { stages: [], flags: input.facts },
        defeatedBosses: [],
      });
      return { spawnId: spawn.spawnId, facing: npc.facing, prompt: npc.prompt };
    });
    const prompt = this.promptAt(bounds, npcStates);
    const matches = this.triggerSystem.evaluate({
      actorBounds: bounds,
      interactionPressed: input.interactBufferId !== null,
      facts: input.facts,
      fulfilledTriggerIds: input.fulfilledTriggerIds,
    });
    if (!movementState(input.playerState)) return idle(prompt, npcStates);
    const accepted = matches
      .map(({ action }) => action as unknown as WorldInteractionAction)
      .find((action) => this.acceptable(action));
    if (accepted === undefined) return idle(prompt, npcStates);
    return deepFreeze({
      kind: 'accepted',
      prompt,
      npcs: npcStates,
      action: accepted,
      consumedInteractBufferId: input.interactBufferId,
      halt: true,
    });
  }

  public dispose(): boolean {
    if (this.disposed) return false;
    this.triggerSystem.dispose();
    this.npcController.dispose();
    this.disposed = true;
    return true;
  }

  public cancelAcceptedInteraction(): void {
    if (this.disposed) return;
    this.triggerSystem.releaseInteraction();
  }

  private acceptable(action: WorldInteractionAction): boolean {
    if (action.kind === 'interact-npc') {
      return this.npcSpawns.some((spawn) => spawn.spawnId === action.spawnId);
    }
    return (
      action.areaId === this.area.definition.areaId &&
      this.area.checkpoint(action.checkpointId as CheckpointId) !== null
    );
  }

  private promptAt(
    bounds: Readonly<{ x: number; y: number; width: number; height: number }>,
    npcStates: readonly WorldInteractionNpcState[],
  ): string | null {
    const candidates = this.triggers
      .filter((trigger) => overlaps(trigger.bounds, bounds))
      .map((trigger, authoredIndex) => {
        const action = trigger.action as unknown as WorldInteractionAction;
        const checkpoint =
          action.kind === 'activate-checkpoint' && action.areaId === this.area.definition.areaId
            ? this.area.checkpoint(action.checkpointId as CheckpointId)
            : null;
        const label =
          action.kind === 'interact-npc'
            ? (npcStates.find(({ spawnId }) => spawnId === action.spawnId)?.prompt ?? null)
            : checkpoint !== null
              ? `Rest at ${checkpoint.displayName}`
              : null;
        return { authoredIndex, triggerId: trigger.triggerId, label };
      })
      .filter((candidate): candidate is typeof candidate & { label: string } =>
        Boolean(candidate.label),
      )
      .sort(
        (left, right) =>
          left.authoredIndex - right.authoredIndex || left.triggerId.localeCompare(right.triggerId),
      );
    return candidates[0]?.label ?? null;
  }
}

function movementState(state: PlayerState): boolean {
  return ['idle', 'run', 'jump', 'fall', 'land', 'climb'].includes(state);
}

function overlaps(
  left: Readonly<{ x: number; y: number; width: number; height: number }>,
  right: Readonly<{ x: number; y: number; width: number; height: number }>,
): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function idle(
  prompt: string | null,
  npcs: readonly WorldInteractionNpcState[],
): WorldInteractionStep {
  return deepFreeze({
    kind: 'idle',
    prompt,
    npcs,
    action: null,
    consumedInteractBufferId: null,
    halt: false,
  });
}
