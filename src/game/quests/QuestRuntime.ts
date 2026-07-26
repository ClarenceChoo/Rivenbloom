import { questId, questStageId } from '../combat/CombatTypes';
import { questDefinitions } from '../data/quests';
import type { SaveV1 } from '../saves/SaveSchema';
import { QuestStore, questEventId, type QuestTransition } from './QuestStore';

/** Convention shared by dialogue, mechanisms, and bosses when signalling quests. */
export const questTriggerEventId = (quest: string, stage: string): string =>
  `advance-${quest}-${stage}`;

/** Builds the runtime QuestStore from the authored content definitions. */
export const createQuestStore = (): QuestStore =>
  new QuestStore(
    questDefinitions.map((quest) => ({
      id: questId(quest.id),
      stages: quest.stages.map((stage, index) => {
        const previous = quest.stages[index - 1];
        return {
          id: questStageId(stage.id),
          triggerEventId: questEventId(questTriggerEventId(quest.id, stage.id)),
          prerequisiteStageIds: previous === undefined ? [] : [questStageId(previous.id)]
        };
      })
    }))
  );

const grantFlag = (transition: QuestTransition): string =>
  `granted-${transition.questId}-${transition.stageId}`;

/**
 * Applies a completed stage to the save: records the latest stage and grants
 * the authored items and abilities exactly once, no matter how often the
 * transition replays.
 */
export const applyQuestTransition = (save: SaveV1, transition: QuestTransition): SaveV1 => {
  const quest = questDefinitions.find(({ id }) => id === transition.questId);
  const stage = quest?.stages.find(({ id }) => id === transition.stageId);
  if (quest === undefined || stage === undefined) return save;
  const staged: SaveV1 = {
    ...save,
    questStages: { ...save.questStages, [quest.id]: stage.id }
  };
  const flag = grantFlag(transition);
  if (save.questFlags.includes(flag)) return staged;
  const inventory = { ...staged.inventory };
  for (const itemId of stage.grantedItemIds) {
    inventory[itemId] = (inventory[itemId] ?? 0) + 1;
  }
  return {
    ...staged,
    inventory,
    unlockedAbilities: [...new Set([...staged.unlockedAbilities, ...stage.grantedAbilityIds])],
    questFlags: [...staged.questFlags, flag]
  };
};
