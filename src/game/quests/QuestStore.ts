import {
  parseStableId,
  stableId,
  type QuestId,
  type QuestStageId,
  type StableId
} from '../combat/CombatTypes';

export type QuestEventId = StableId<'quest-event'>;

export const parseQuestEventId = (value: string): QuestEventId | undefined =>
  parseStableId<'quest-event'>(value);

export const questEventId = (value: string): QuestEventId => {
  return stableId<'quest-event'>('quest event', value);
};

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
  private readonly completedStages = new Map<QuestId, Set<QuestStageId>>();

  public constructor(definitions: readonly QuestDefinition[]) {
    for (const quest of definitions) {
      const stageIds = new Set<QuestStageId>();
      for (const stage of quest.stages) {
        if (stageIds.has(stage.id)) {
          throw new Error(`Quest ${quest.id} has duplicate stage ID ${stage.id}.`);
        }

        stageIds.add(stage.id);
      }

      for (const stage of quest.stages) {
        const prerequisiteIds = new Set<QuestStageId>();
        for (const prerequisiteStageId of stage.prerequisiteStageIds) {
          if (prerequisiteIds.has(prerequisiteStageId)) {
            throw new Error(
              `Quest ${quest.id} stage ${stage.id} has duplicate prerequisite ${prerequisiteStageId}.`
            );
          }

          prerequisiteIds.add(prerequisiteStageId);

          if (!stageIds.has(prerequisiteStageId)) {
            throw new Error(
              `Quest ${quest.id} stage ${stage.id} has dangling prerequisite ${prerequisiteStageId}.`
            );
          }
        }
      }
    }

    this.definitions = definitions;
  }

  public apply(event: QuestEvent): readonly QuestTransition[] {
    const transitions: QuestTransition[] = [];

    for (const quest of this.definitions) {
      const completedStages = this.completedStages.get(quest.id) ?? new Set<QuestStageId>();
      this.completedStages.set(quest.id, completedStages);

      for (const stage of quest.stages) {
        if (
          stage.triggerEventId === event.id &&
          !completedStages.has(stage.id) &&
          stage.prerequisiteStageIds.every((stageId) => completedStages.has(stageId))
        ) {
          completedStages.add(stage.id);
          transitions.push({ questId: quest.id, stageId: stage.id, status: 'completed' });
        }
      }
    }

    return transitions;
  }
}
