import { isStableId } from '../core/StableId';
import type { QuestFlagId, QuestId, QuestStageId } from '../core/StableId';

export type QuestTransitionDefinition = Readonly<{
  toStageId: QuestStageId;
  requiresAll: readonly QuestFlagId[];
  requiresAny?: readonly QuestFlagId[];
}>;

export type QuestStageDefinition = Readonly<{
  stageId: QuestStageId;
  title?: string;
  objective?: string;
  transitions: readonly QuestTransitionDefinition[];
}>;

export type QuestDefinition = Readonly<{
  questId: QuestId;
  displayName?: string;
  initialStageId: QuestStageId;
  stages: readonly QuestStageDefinition[];
}>;

export type QuestEvent = Readonly<{
  factId: QuestFlagId;
}>;

export type QuestTransition = Readonly<{
  questId: QuestId;
  fromStageId: QuestStageId;
  toStageId: QuestStageId;
  causingFactId: QuestFlagId;
}>;

export type QuestSnapshot = Readonly<{
  stages: readonly Readonly<{
    questId: QuestId;
    stageId: QuestStageId;
  }>[];
  flags: readonly QuestFlagId[];
}>;

type NormalizedQuestDefinition = Readonly<{
  questId: QuestId;
  initialStageId: QuestStageId;
  stages: ReadonlyMap<QuestStageId, QuestStageDefinition>;
}>;

export class QuestStore {
  private readonly quests: readonly NormalizedQuestDefinition[];
  private readonly stages = new Map<QuestId, QuestStageId>();
  private readonly flags = new Set<QuestFlagId>();

  public constructor(definitions: readonly QuestDefinition[]) {
    const questIds = new Set<QuestId>();
    const quests = definitions.map((definition) => {
      const normalized = normalizeQuest(definition);

      if (questIds.has(normalized.questId)) {
        throw new RangeError('Quest definitions cannot repeat a quest ID.');
      }

      questIds.add(normalized.questId);
      this.stages.set(normalized.questId, normalized.initialStageId);
      return normalized;
    });

    this.quests = quests.sort(compareQuests);
  }

  public static hydrate(
    definitions: readonly QuestDefinition[],
    snapshot: QuestSnapshot,
    knownFactIds?: readonly QuestFlagId[],
  ): QuestStore {
    const store = new QuestStore(definitions);
    const knownFacts = knownFactIds === undefined ? null : new Set(knownFactIds);
    const seenQuests = new Set<QuestId>();
    const seenFacts = new Set<QuestFlagId>();

    for (const entry of snapshot.stages) {
      assertStableId(entry.questId, 'Quest snapshot quest ID');
      assertStableId(entry.stageId, 'Quest snapshot stage ID');
      if (seenQuests.has(entry.questId)) {
        throw new RangeError('Quest snapshot cannot repeat a quest ID.');
      }
      seenQuests.add(entry.questId);
      const quest = store.quests.find(({ questId }) => questId === entry.questId);
      if (quest === undefined) throw new RangeError('Quest snapshot references an unknown quest.');
      if (!quest.stages.has(entry.stageId)) {
        throw new RangeError('Quest snapshot references an unknown stage.');
      }
      store.stages.set(entry.questId, entry.stageId);
    }

    for (const factId of snapshot.flags) {
      assertStableId(factId, 'Quest snapshot fact ID');
      if (seenFacts.has(factId)) throw new RangeError('Quest snapshot cannot repeat a fact ID.');
      if (knownFacts !== null && !knownFacts.has(factId)) {
        throw new RangeError('Quest snapshot references an unknown fact.');
      }
      seenFacts.add(factId);
      store.flags.add(factId);
    }

    for (const quest of store.quests) {
      const stageId = store.stages.get(quest.questId);
      if (stageId === undefined) throw new RangeError('Quest state is missing an initial stage.');
      if (seenQuests.has(quest.questId)) {
        if (!isReachableWithFacts(quest, stageId, store.flags)) {
          throw new RangeError('Quest snapshot references an impossible stage.');
        }
        const stage = quest.stages.get(stageId);
        if (stage === undefined || eligible(stage, store.flags).length > 0) {
          throw new RangeError('Quest snapshot references an impossible unadvanced stage.');
        }
      } else {
        store.advanceQuestToFixedPoint(
          quest,
          questFlagForHydration(store.flags),
          [],
          store.stages,
          store.flags,
        );
      }
    }

    return store;
  }

  public apply(event: QuestEvent): readonly QuestTransition[] {
    if (!isStableId(event.factId)) {
      throw new RangeError('Quest fact ID must be a stable ID.');
    }

    if (this.flags.has(event.factId)) {
      return [];
    }

    const nextFlags = new Set(this.flags);
    nextFlags.add(event.factId);
    const nextStages = new Map(this.stages);
    const transitions: QuestTransition[] = [];

    for (const quest of this.quests) {
      this.advanceQuestToFixedPoint(quest, event.factId, transitions, nextStages, nextFlags);
    }

    this.flags.add(event.factId);
    this.stages.clear();
    nextStages.forEach((stageId, questId) => this.stages.set(questId, stageId));

    return transitions;
  }

  public snapshot(): QuestSnapshot {
    const stages = [...this.stages.entries()]
      .map(([questId, stageId]) => ({ questId, stageId }))
      .sort(compareQuestStages);
    const flags = [...this.flags].sort(compareStableIds);

    return { stages, flags };
  }

  private advanceQuestToFixedPoint(
    quest: NormalizedQuestDefinition,
    causingFactId: QuestFlagId,
    transitions: QuestTransition[],
    stages: Map<QuestId, QuestStageId>,
    flags: ReadonlySet<QuestFlagId>,
  ): void {
    let stageId = stages.get(quest.questId);

    if (stageId === undefined) {
      throw new RangeError('Quest state is missing an initial stage.');
    }

    while (true) {
      const stage = quest.stages.get(stageId);

      if (stage === undefined) {
        throw new RangeError('Quest state references an undefined stage.');
      }

      const eligibleTransitions = eligible(stage, flags);

      if (eligibleTransitions.length === 0) {
        return;
      }

      if (eligibleTransitions.length > 1) {
        throw new RangeError('Quest stage has multiple eligible outgoing transitions.');
      }

      const [transition] = eligibleTransitions;

      if (transition === undefined) {
        throw new RangeError('Quest stage has no eligible transition.');
      }

      const fromStageId = stageId;
      stageId = transition.toStageId;
      stages.set(quest.questId, stageId);
      transitions.push({
        questId: quest.questId,
        fromStageId,
        toStageId: stageId,
        causingFactId,
      });
    }
  }
}

function normalizeQuest(definition: QuestDefinition): NormalizedQuestDefinition {
  assertStableId(definition.questId, 'Quest ID');
  assertStableId(definition.initialStageId, 'Initial quest stage ID');

  if (definition.stages.length === 0) {
    throw new RangeError('Quest definitions require at least one stage.');
  }

  const stages = new Map<QuestStageId, QuestStageDefinition>();

  for (const stage of definition.stages) {
    assertStableId(stage.stageId, 'Quest stage ID');

    if (stages.has(stage.stageId)) {
      throw new RangeError('Quest definitions cannot repeat a stage ID.');
    }

    const transitions = stage.transitions.map((transition) => normalizeTransition(transition));
    stages.set(stage.stageId, { stageId: stage.stageId, transitions });
  }

  if (!stages.has(definition.initialStageId)) {
    throw new RangeError('Quest initial stage must be defined.');
  }

  for (const stage of stages.values()) {
    for (const transition of stage.transitions) {
      if (!stages.has(transition.toStageId)) {
        throw new RangeError('Quest transition destination must be defined.');
      }
    }
  }

  assertAcyclic(stages);

  return {
    questId: definition.questId,
    initialStageId: definition.initialStageId,
    stages,
  };
}

function normalizeTransition(transition: QuestTransitionDefinition): QuestTransitionDefinition {
  assertStableId(transition.toStageId, 'Quest transition destination ID');

  const facts = new Set<QuestFlagId>();

  for (const factId of transition.requiresAll) {
    assertStableId(factId, 'Quest prerequisite fact ID');

    if (facts.has(factId)) {
      throw new RangeError('Quest transition prerequisites cannot repeat a fact ID.');
    }

    facts.add(factId);
  }

  const anyFacts = new Set<QuestFlagId>();
  for (const factId of transition.requiresAny ?? []) {
    assertStableId(factId, 'Quest alternative prerequisite fact ID');
    if (anyFacts.has(factId)) {
      throw new RangeError('Quest transition alternative prerequisites cannot repeat a fact ID.');
    }
    anyFacts.add(factId);
  }

  return {
    toStageId: transition.toStageId,
    requiresAll: [...facts],
    ...(anyFacts.size > 0 ? { requiresAny: [...anyFacts] } : {}),
  };
}

function eligible(
  stage: QuestStageDefinition,
  flags: ReadonlySet<QuestFlagId>,
): readonly QuestTransitionDefinition[] {
  return stage.transitions.filter(
    (transition) =>
      transition.requiresAll.every((factId) => flags.has(factId)) &&
      (transition.requiresAny === undefined ||
        transition.requiresAny.length === 0 ||
        transition.requiresAny.some((factId) => flags.has(factId))),
  );
}

function isReachableWithFacts(
  quest: NormalizedQuestDefinition,
  target: QuestStageId,
  flags: ReadonlySet<QuestFlagId>,
): boolean {
  const pending = [quest.initialStageId];
  const visited = new Set<QuestStageId>();
  while (pending.length > 0) {
    const stageId = pending.shift();
    if (stageId === undefined || visited.has(stageId)) continue;
    if (stageId === target) return true;
    visited.add(stageId);
    const stage = quest.stages.get(stageId);
    if (stage === undefined) continue;
    for (const transition of eligible(stage, flags)) pending.push(transition.toStageId);
  }
  return false;
}

function questFlagForHydration(flags: ReadonlySet<QuestFlagId>): QuestFlagId {
  return flags.values().next().value ?? ('quest-hydration' as QuestFlagId);
}

function assertAcyclic(stages: ReadonlyMap<QuestStageId, QuestStageDefinition>): void {
  const marks = new Map<QuestStageId, 'visiting' | 'complete'>();

  const visit = (stageId: QuestStageId): void => {
    const mark = marks.get(stageId);

    if (mark === 'visiting') {
      throw new RangeError('Quest stage graph cannot contain a cycle.');
    }

    if (mark === 'complete') {
      return;
    }

    marks.set(stageId, 'visiting');
    const stage = stages.get(stageId);

    if (stage === undefined) {
      throw new RangeError('Quest stage graph references an undefined stage.');
    }

    for (const transition of stage.transitions) {
      visit(transition.toStageId);
    }

    marks.set(stageId, 'complete');
  };

  for (const stageId of stages.keys()) {
    visit(stageId);
  }
}

function assertStableId<Value extends string>(value: Value, label: string): asserts value is Value {
  if (!isStableId(value)) {
    throw new RangeError(`${label} must be a stable ID.`);
  }
}

function compareQuests(left: NormalizedQuestDefinition, right: NormalizedQuestDefinition): number {
  return compareStableIds(left.questId, right.questId);
}

function compareQuestStages(
  left: Readonly<{ questId: QuestId }>,
  right: Readonly<{ questId: QuestId }>,
): number {
  return compareStableIds(left.questId, right.questId);
}

function compareStableIds(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}
