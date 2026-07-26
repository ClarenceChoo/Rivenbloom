import { actorDefinitions } from '../data/actors';
import { dialogueDefinitions } from '../data/dialogue';
import type { ActorDefinition, DialogueDefinition, DialogueNodeDefinition } from '../data/types';

export type DialogueContext = {
  readonly questStages: Readonly<Record<string, string>>;
  readonly questFlags: readonly string[];
};

export type DialogueChoiceView = {
  readonly id: string;
  readonly text: string;
};

export type DialogueQuestSignal = {
  readonly questId: string;
  readonly questStageId?: string;
};

export type DialoguePage = {
  readonly dialogueId: string;
  readonly nodeId: string;
  readonly speakerActorId: string;
  readonly speakerName: string;
  readonly text: string;
  readonly choices: readonly DialogueChoiceView[];
  readonly questSignal: DialogueQuestSignal | undefined;
  readonly isTerminal: boolean;
};

export class DialogueController {
  public constructor(
    private readonly definitions: readonly DialogueDefinition[] = dialogueDefinitions,
    private readonly actors: readonly ActorDefinition[] = actorDefinitions
  ) {}

  public start(dialogueId: string, context: DialogueContext): DialoguePage {
    const definition = this.definition(dialogueId);
    return this.page(definition, this.node(definition, definition.entryNodeId), context);
  }

  public advance(
    current: DialoguePage,
    context: DialogueContext,
    choiceId?: string
  ): DialoguePage | undefined {
    const definition = this.definition(current.dialogueId);
    const node = this.node(definition, current.nodeId);
    let nextNodeId: string | undefined;
    if (choiceId !== undefined) {
      const choice = node.choices.find(({ id }) => id === choiceId);
      if (choice === undefined || !this.choiceAvailable(choice.requiredQuestId, context)) {
        throw new Error(`Choice "${choiceId}" is not available on node "${node.id}".`);
      }
      nextNodeId = choice.nextNodeId;
    } else {
      if (this.visibleChoices(node, context).length > 0) {
        throw new Error(`Node "${node.id}" requires a choice to advance.`);
      }
      nextNodeId = node.nextNodeId;
    }
    if (nextNodeId === undefined) return undefined;
    return this.page(definition, this.node(definition, nextNodeId), context);
  }

  private page(
    definition: DialogueDefinition,
    node: DialogueNodeDefinition,
    context: DialogueContext
  ): DialoguePage {
    const speaker = this.actors.find(({ id }) => id === node.speakerActorId);
    const choices = this.visibleChoices(node, context).map(({ id, text }) => ({ id, text }));
    return {
      dialogueId: definition.id,
      nodeId: node.id,
      speakerActorId: node.speakerActorId,
      speakerName: speaker?.displayName ?? node.speakerActorId,
      text: node.text,
      choices,
      questSignal:
        node.questId === undefined
          ? undefined
          : {
              questId: node.questId,
              ...(node.questStageId === undefined ? {} : { questStageId: node.questStageId })
            },
      isTerminal: node.nextNodeId === undefined && choices.length === 0
    };
  }

  private visibleChoices(
    node: DialogueNodeDefinition,
    context: DialogueContext
  ): readonly DialogueNodeDefinition['choices'][number][] {
    return node.choices.filter(({ requiredQuestId }) =>
      this.choiceAvailable(requiredQuestId, context)
    );
  }

  private choiceAvailable(requiredQuestId: string | undefined, context: DialogueContext): boolean {
    return requiredQuestId === undefined || requiredQuestId in context.questStages;
  }

  private definition(dialogueId: string): DialogueDefinition {
    const definition = this.definitions.find(({ id }) => id === dialogueId);
    if (definition === undefined) throw new Error(`Unknown dialogue "${dialogueId}".`);
    return definition;
  }

  private node(definition: DialogueDefinition, nodeId: string): DialogueNodeDefinition {
    const node = definition.nodes.find(({ id }) => id === nodeId);
    if (node === undefined) {
      throw new Error(`Dialogue "${definition.id}" has no node "${nodeId}".`);
    }
    return node;
  }
}
