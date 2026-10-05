import type { BossId } from '../../saves/SaveSchema';
import type { QuestSnapshot } from '../../quests/QuestStore';
import type { ActorSpawnId } from '../../data/types';
import type { NpcDefinition } from '../../data/types';
import { deepFreeze } from '../../data/immutability';

export type NpcInteractionInput = Readonly<{
  spawnId: ActorSpawnId;
  npcPositionX: number;
  playerPositionX: number;
  interactionPressed: boolean;
  quests: QuestSnapshot;
  defeatedBosses: readonly BossId[];
}>;

export type NpcInteractionResult = Readonly<{
  kind: 'prompt' | 'interact';
  actorId: NpcDefinition['actorId'];
  spawnId: ActorSpawnId;
  prompt: string;
  facing: 'left' | 'right';
  dialogueId: NpcDefinition['dialogueId'];
}>;

export class NpcController {
  private readonly bySpawn = new Map<ActorSpawnId, NpcDefinition>();
  private readonly held = new Set<ActorSpawnId>();
  private disposed = false;

  public constructor(definitions: readonly NpcDefinition[]) {
    for (const definition of definitions) {
      if (this.bySpawn.has(definition.spawnId)) {
        throw new RangeError('NPC definitions cannot repeat a spawn ID.');
      }
      this.bySpawn.set(definition.spawnId, definition);
    }
  }

  public evaluate(input: NpcInteractionInput): NpcInteractionResult {
    if (this.disposed) throw new Error('NPC controller is disposed.');
    const definition = this.bySpawn.get(input.spawnId);
    if (definition === undefined) throw new RangeError('Unknown NPC spawn.');
    if (!Number.isFinite(input.npcPositionX) || !Number.isFinite(input.playerPositionX)) {
      throw new RangeError('NPC interaction positions must be finite.');
    }
    if (!input.interactionPressed) this.held.delete(input.spawnId);
    const interactionEdge = input.interactionPressed && !this.held.has(input.spawnId);
    if (input.interactionPressed) this.held.add(input.spawnId);
    const facing =
      input.playerPositionX === input.npcPositionX
        ? definition.defaultFacing
        : input.playerPositionX < input.npcPositionX
          ? 'left'
          : 'right';
    return deepFreeze({
      kind: interactionEdge ? 'interact' : 'prompt',
      actorId: definition.actorId,
      spawnId: definition.spawnId,
      prompt: definition.prompt,
      facing,
      dialogueId: definition.dialogueId,
    });
  }

  public dispose(): boolean {
    if (this.disposed) return false;
    this.held.clear();
    this.disposed = true;
    return true;
  }
}
