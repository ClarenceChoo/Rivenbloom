import type { QuestId, QuestStageId, StableId } from '../combat/CombatTypes';

export type QuestEventId = StableId<'quest-event'>;

export type QuestEvent = {
  readonly id: QuestEventId;
};

export type QuestStageDefinition = {
  readonly id: QuestStageId;
  readonly triggerEventId: QuestEventId;
  readonly prerequisiteStageIds: readonly QuestStageId[];
};

export type QuestDefinition = {
  readonly id: QuestId;
  readonly stages: readonly QuestStageDefinition[];
};

export type QuestTransition = {
  readonly questId: QuestId;
  readonly stageId: QuestStageId;
  readonly status: 'completed';
};

export class QuestStore {
  private readonly definitions: readonly QuestDefinition[];
  private readonly completedStages = new Set<QuestStageId>();

  public constructor(definitions: readonly QuestDefinition[]) {
    this.definitions = definitions;
  }

  public apply(event: QuestEvent): readonly QuestTransition[] {
    const transitions: QuestTransition[] = [];

    for (const quest of this.definitions) {
      for (const stage of quest.stages) {
        if (
          stage.triggerEventId === event.id &&
          !this.completedStages.has(stage.id) &&
          stage.prerequisiteStageIds.every((stageId) => this.completedStages.has(stageId))
        ) {
          this.completedStages.add(stage.id);
          transitions.push({ questId: quest.id, stageId: stage.id, status: 'completed' });
        }
      }
    }

    return transitions;
  }
}
