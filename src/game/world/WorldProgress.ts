import { experienceForDefeat } from '../config/balance';
import { questDefinitions } from '../data/quests';
import type { SaveV1 } from '../saves/SaveSchema';
import {
  applyQuestTransition,
  createQuestStore,
  questTriggerEventId
} from '../quests/QuestRuntime';
import { questEventId, type QuestStore, type QuestTransition } from '../quests/QuestStore';
import type { PuzzleResult } from './PuzzleSystem';

export type ProgressChange = {
  readonly save: SaveV1;
  readonly first: boolean;
};

export type QuestSignal = {
  readonly questId: string;
  readonly questStageId?: string;
};

export type QuestAdvance = {
  readonly save: SaveV1;
  readonly transitions: readonly QuestTransition[];
};

export type DefeatAward = {
  readonly save: SaveV1;
  readonly xpAwarded: number;
};

export type PuzzleProgress = {
  readonly save: SaveV1;
  readonly first: boolean;
  readonly questSignal?: QuestSignal;
};

const withStableIdAdded = (ids: readonly string[], id: string): readonly string[] =>
  ids.includes(id) ? ids : [...ids, id];

/** Marks a room's discovery id on the save; replays report first: false. */
export const discoverRoom = (save: SaveV1, roomDiscoveryId: string): ProgressChange => {
  const first = !save.discoveredRoomIds.includes(roomDiscoveryId);
  return {
    first,
    save: first
      ? { ...save, discoveredRoomIds: withStableIdAdded(save.discoveredRoomIds, roomDiscoveryId) }
      : save
  };
};

/** Claims an optional discovery exactly once. */
export const claimDiscovery = (save: SaveV1, discoveryId: string): ProgressChange => {
  const first = !save.claimedDiscoveryIds.includes(discoveryId);
  return {
    first,
    save: first
      ? { ...save, claimedDiscoveryIds: withStableIdAdded(save.claimedDiscoveryIds, discoveryId) }
      : save
  };
};

/** Adds an item stack to the persisted inventory record. */
export const grantItem = (save: SaveV1, itemId: string, quantity = 1): SaveV1 => ({
  ...save,
  inventory: { ...save.inventory, [itemId]: (save.inventory[itemId] ?? 0) + quantity }
});

/**
 * Consumes a defeat: awards the authored XP for the actor and banks any
 * rolled drops. Defeats are combat outcomes, not persistent flags, so the
 * award applies every time an enemy instance dies.
 */
export const awardEnemyDefeat = (
  save: SaveV1,
  actorId: string,
  drops: readonly { readonly itemId: string; readonly quantity: number }[]
): DefeatAward => {
  const xpAwarded = experienceForDefeat(actorId);
  let next: SaveV1 = {
    ...save,
    player: { ...save.player, xp: save.player.xp + xpAwarded }
  };
  for (const drop of drops) {
    next = grantItem(next, drop.itemId, drop.quantity);
  }
  return { save: next, xpAwarded };
};

/** Persists a broken breakable wall through the solved-puzzle flag set. */
export const recordBrokenBreakable = (save: SaveV1, persistentFlagId: string): ProgressChange => {
  const first = !save.solvedPuzzleIds.includes(persistentFlagId);
  return {
    first,
    save: first
      ? { ...save, solvedPuzzleIds: withStableIdAdded(save.solvedPuzzleIds, persistentFlagId) }
      : save
  };
};

/**
 * Persists a solved mechanism: shortcuts land in the shortcut set, everything
 * else in the solved-puzzle set. First solves bank the authored reward item
 * and surface the mechanism's quest signal for routing.
 */
export const applyPuzzleResult = (save: SaveV1, result: PuzzleResult): PuzzleProgress => {
  if (result.kind !== 'solved') return { save, first: false };
  const flagged: SaveV1 =
    result.mechanismKind === 'shortcut'
      ? {
          ...save,
          activatedShortcutIds: withStableIdAdded(
            save.activatedShortcutIds,
            result.persistentFlagId
          )
        }
      : {
          ...save,
          solvedPuzzleIds: withStableIdAdded(save.solvedPuzzleIds, result.persistentFlagId)
        };
  const rewarded =
    result.firstSolve && result.rewardItemId !== undefined
      ? grantItem(flagged, result.rewardItemId)
      : flagged;
  return {
    save: rewarded,
    first: result.firstSolve,
    ...(result.firstSolve && result.questId !== undefined
      ? { questSignal: { questId: result.questId } }
      : {})
  };
};

/** Resolves the next incomplete stage of a quest from the persisted record. */
export const nextQuestStageId = (save: SaveV1, questId: string): string | undefined => {
  const quest = questDefinitions.find(({ id }) => id === questId);
  if (quest === undefined) return undefined;
  const recorded = save.questStages[questId];
  if (recorded === undefined) return quest.stages[0]?.id;
  const index = quest.stages.findIndex(({ id }) => id === recorded);
  if (index === -1) return quest.stages[0]?.id;
  return quest.stages[index + 1]?.id;
};

/**
 * Builds the session QuestStore and replays the save's recorded stages so
 * prerequisite gating continues from persisted progress.
 */
export const seedQuestStore = (save: SaveV1): QuestStore => {
  const store = createQuestStore();
  for (const quest of questDefinitions) {
    const recorded = save.questStages[quest.id];
    if (recorded === undefined) continue;
    for (const stage of quest.stages) {
      store.apply({ id: questEventId(questTriggerEventId(quest.id, stage.id)) });
      if (stage.id === recorded) break;
    }
  }
  return store;
};

/**
 * Routes quest signals (from dialogue, mechanisms, or bosses) through the
 * store. Signals without an explicit stage advance the quest's next
 * incomplete stage. Completed transitions grant their authored rewards.
 */
export const advanceQuests = (
  store: QuestStore,
  save: SaveV1,
  signals: readonly QuestSignal[]
): QuestAdvance => {
  const transitions: QuestTransition[] = [];
  let next = save;
  for (const signal of signals) {
    const stageId = signal.questStageId ?? nextQuestStageId(next, signal.questId);
    if (stageId === undefined) continue;
    const fired = store.apply({ id: questEventId(questTriggerEventId(signal.questId, stageId)) });
    for (const transition of fired) {
      next = applyQuestTransition(next, transition);
      transitions.push(transition);
    }
  }
  return { save: next, transitions };
};
