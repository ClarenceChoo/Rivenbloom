import { isStableId } from '../core/StableId';
import type { DialogueChoiceId, DialogueId, DialogueNodeId } from '../data/types';
import { deepFreeze, immutableClone } from '../data/immutability';
import type {
  DialogueCondition,
  DialogueDefinition,
  DialogueEffect,
  DialogueNodeDefinition,
} from '../data/types';
import type { QuestSnapshot } from '../quests/QuestStore';
import type { BossId } from '../saves/SaveSchema';
import type { ProgressionRewardId } from '../world/WorldProgression';

export type DialogueContext = Readonly<{
  quests: QuestSnapshot;
  defeatedBosses: readonly BossId[];
}>;

export type DialoguePage = Readonly<{
  dialogueId: DialogueId;
  nodeId: DialogueNodeId;
  speakerActorId: DialogueNodeDefinition['speakerActorId'];
  text: string;
  choices: readonly Readonly<{ choiceId: DialogueChoiceId; text: string }>[];
}>;

export type DialogueStartResult =
  | Readonly<{ kind: 'started'; page: DialoguePage }>
  | Readonly<{
      kind: 'rejected';
      reason: 'missing-dialogue' | 'ambiguous-entry' | 'no-eligible-entry' | 'disposed';
    }>;

export type DialogueChoiceResult =
  | Readonly<{
      kind: 'page';
      page: DialoguePage;
      effects: readonly DialogueEffect[];
      rewardId: ProgressionRewardId | null;
    }>
  | Readonly<{
      kind: 'closed';
      effects: readonly DialogueEffect[];
      rewardId: ProgressionRewardId | null;
    }>
  | Readonly<{
      kind: 'rejected';
      reason: 'not-active' | 'invalid-choice' | 'ineligible-target' | 'disposed';
    }>;

type IndexedDialogue = Readonly<{
  definition: DialogueDefinition;
  nodes: ReadonlyMap<DialogueNodeId, DialogueNodeDefinition>;
}>;

export class DialogueController {
  private readonly dialogues = new Map<DialogueId, IndexedDialogue>();
  private active: Readonly<{
    dialogue: IndexedDialogue;
    node: DialogueNodeDefinition;
    context: DialogueContext;
  }> | null = null;
  private disposed = false;

  public constructor(definitions: readonly DialogueDefinition[]) {
    for (const definition of definitions) {
      validateDialogue(definition);
      if (this.dialogues.has(definition.dialogueId))
        throw new RangeError('Dialogue IDs cannot repeat.');
      this.dialogues.set(definition.dialogueId, {
        definition,
        nodes: new Map(definition.nodes.map((node) => [node.nodeId, node])),
      });
    }
  }

  public start(dialogueId: DialogueId, context: DialogueContext): DialogueStartResult {
    if (this.disposed) return { kind: 'rejected', reason: 'disposed' };
    if (!isStableId(dialogueId)) return { kind: 'rejected', reason: 'missing-dialogue' };
    const dialogue = this.dialogues.get(dialogueId);
    if (dialogue === undefined) return { kind: 'rejected', reason: 'missing-dialogue' };
    const entryIds = dialogue.definition.entryNodeIds ?? [dialogue.definition.entryNodeId];
    const entries = entryIds
      .map((nodeId) => dialogue.nodes.get(nodeId))
      .filter((node): node is DialogueNodeDefinition => node !== undefined)
      .filter((node) => eligible(node, context));
    if (entries.length === 0) return { kind: 'rejected', reason: 'no-eligible-entry' };
    if (entries.length > 1) return { kind: 'rejected', reason: 'ambiguous-entry' };
    const node = entries[0]!;
    this.active = { dialogue, node, context: immutableClone(context) };
    return { kind: 'started', page: page(dialogueId, node, context) };
  }

  public choose(choiceId: DialogueChoiceId): DialogueChoiceResult {
    return this.resolveChoice(choiceId, true);
  }

  public preview(choiceId: DialogueChoiceId): DialogueChoiceResult {
    return this.resolveChoice(choiceId, false);
  }

  private resolveChoice(choiceId: DialogueChoiceId, commit: boolean): DialogueChoiceResult {
    if (this.disposed) return { kind: 'rejected', reason: 'disposed' };
    if (this.active === null) return { kind: 'rejected', reason: 'not-active' };
    const choice = this.active.node.choices.find(
      (candidate) =>
        candidate.choiceId === choiceId &&
        conditionEligible(candidate.condition, this.active!.context),
    );
    if (choice === undefined) return { kind: 'rejected', reason: 'invalid-choice' };
    const effects = immutableClone(choice.effects);
    const rewardId = choice.rewardId ?? null;
    if (choice.targetNodeId === null) {
      if (commit) this.active = null;
      return deepFreeze({ kind: 'closed', effects, rewardId });
    }
    const target = this.active.dialogue.nodes.get(choice.targetNodeId);
    if (target === undefined || !eligible(target, this.active.context)) {
      return { kind: 'rejected', reason: 'ineligible-target' };
    }
    if (commit) this.active = { ...this.active, node: target };
    return deepFreeze({
      kind: 'page',
      page: page(this.active.dialogue.definition.dialogueId, target, this.active.context),
      effects,
      rewardId,
    });
  }

  public close(): boolean {
    if (this.active === null) return false;
    this.active = null;
    return true;
  }

  public dispose(): boolean {
    if (this.disposed) return false;
    this.active = null;
    this.disposed = true;
    return true;
  }
}

function page(
  dialogueId: DialogueId,
  node: DialogueNodeDefinition,
  context: DialogueContext,
): DialoguePage {
  return deepFreeze({
    dialogueId,
    nodeId: node.nodeId,
    speakerActorId: node.speakerActorId,
    text: node.text,
    choices: node.choices
      .filter((choice) => conditionEligible(choice.condition, context))
      .map(({ choiceId, text }) => ({ choiceId, text })),
  });
}

function eligible(node: DialogueNodeDefinition, context: DialogueContext): boolean {
  return (
    node.requiresAll.every((factId) => context.quests.flags.includes(factId)) &&
    conditionEligible(node.condition, context)
  );
}

function conditionEligible(
  condition: DialogueCondition | undefined,
  context: DialogueContext,
): boolean {
  if (condition === undefined) return true;
  const flags = new Set(context.quests.flags);
  const bosses = new Set(context.defeatedBosses);
  if (!(condition.requiresFacts ?? []).every((id) => flags.has(id))) return false;
  if ((condition.excludesFacts ?? []).some((id) => flags.has(id))) return false;
  if (!(condition.requiresDefeatedBosses ?? []).every((id) => bosses.has(id))) return false;
  if ((condition.excludesDefeatedBosses ?? []).some((id) => bosses.has(id))) return false;
  if (
    !(condition.questStages ?? []).every((required) =>
      context.quests.stages.some(
        ({ questId, stageId }) =>
          questId === required.questId && required.stageIds.includes(stageId),
      ),
    )
  )
    return false;
  if (
    (condition.excludesQuestStages ?? []).some((excluded) =>
      context.quests.stages.some(
        ({ questId, stageId }) =>
          questId === excluded.questId && excluded.stageIds.includes(stageId),
      ),
    )
  )
    return false;
  return true;
}

function validateDialogue(definition: DialogueDefinition): void {
  if (!isStableId(definition.dialogueId)) throw new RangeError('Dialogue ID must be stable.');
  const nodes = new Map<DialogueNodeId, DialogueNodeDefinition>();
  for (const node of definition.nodes) {
    if (nodes.has(node.nodeId)) throw new RangeError('Dialogue nodes cannot repeat.');
    nodes.set(node.nodeId, node);
    const choices = new Set<DialogueChoiceId>();
    for (const choice of node.choices) {
      if (choices.has(choice.choiceId)) throw new RangeError('Dialogue choices cannot repeat.');
      choices.add(choice.choiceId);
    }
  }
  const entries = definition.entryNodeIds ?? [definition.entryNodeId];
  if (
    !nodes.has(definition.entryNodeId) ||
    entries.length === 0 ||
    entries.some((id) => !nodes.has(id))
  ) {
    throw new RangeError('Dialogue entry node must exist.');
  }
  if (new Set(entries).size !== entries.length) {
    throw new RangeError('Dialogue entry nodes cannot repeat.');
  }
  for (const node of nodes.values()) {
    for (const choice of node.choices) {
      if (choice.targetNodeId !== null && !nodes.has(choice.targetNodeId)) {
        throw new RangeError('Dialogue choice target node must exist.');
      }
    }
  }
  for (const entry of entries) {
    if (!hasExit(entry, nodes, new Set())) {
      throw new RangeError('Dialogue cycle must have an exit.');
    }
  }
  validateEligibleContexts(
    entries.map((entry) => nodes.get(entry)!),
    nodes,
  );
}

function hasExit(
  nodeId: DialogueNodeId,
  nodes: ReadonlyMap<DialogueNodeId, DialogueNodeDefinition>,
  path: ReadonlySet<DialogueNodeId>,
): boolean {
  if (path.has(nodeId)) return false;
  const node = nodes.get(nodeId);
  if (node === undefined) return false;
  if (node.choices.some(({ targetNodeId }) => targetNodeId === null)) return true;
  const nextPath = new Set(path);
  nextPath.add(nodeId);
  return node.choices.some(
    ({ targetNodeId }) => targetNodeId !== null && hasExit(targetNodeId, nodes, nextPath),
  );
}

function validateEligibleContexts(
  entries: readonly DialogueNodeDefinition[],
  nodes: ReadonlyMap<DialogueNodeId, DialogueNodeDefinition>,
): void {
  const facts = new Set<QuestSnapshot['flags'][number]>();
  const bosses = new Set<BossId>();
  const stageDomains = new Map<
    QuestSnapshot['stages'][number]['questId'],
    Set<QuestSnapshot['stages'][number]['stageId']>
  >();
  for (const node of nodes.values()) {
    node.requiresAll.forEach((factId) => facts.add(factId));
    collectConditionDomain(node.condition, facts, bosses, stageDomains);
    node.choices.forEach((choice) =>
      collectConditionDomain(choice.condition, facts, bosses, stageDomains),
    );
  }
  if (facts.size + bosses.size > 12) {
    throw new RangeError('Dialogue condition space is too large to validate safely.');
  }

  let eligibleContextFound = false;
  for (const selectedFacts of subsets([...facts])) {
    for (const selectedBosses of subsets([...bosses])) {
      for (const stages of stageSnapshots([...stageDomains.entries()])) {
        const context: DialogueContext = {
          quests: { stages, flags: selectedFacts },
          defeatedBosses: selectedBosses,
        };
        const eligibleEntries = entries.filter((entry) => eligible(entry, context));
        if (eligibleEntries.length > 1) {
          throw new RangeError('Dialogue entry conditions are ambiguous.');
        }
        if (eligibleEntries.length === 0) continue;
        eligibleContextFound = true;
        if (!hasEligibleExit(eligibleEntries[0]!, nodes, context, new Set())) {
          throw new RangeError('Dialogue eligible context must have an exit.');
        }
      }
    }
  }
  if (!eligibleContextFound) {
    throw new RangeError('Dialogue requires at least one eligible entry context.');
  }
}

function collectConditionDomain(
  condition: DialogueCondition | undefined,
  facts: Set<QuestSnapshot['flags'][number]>,
  bosses: Set<BossId>,
  stageDomains: Map<
    QuestSnapshot['stages'][number]['questId'],
    Set<QuestSnapshot['stages'][number]['stageId']>
  >,
): void {
  if (condition === undefined) return;
  [...(condition.requiresFacts ?? []), ...(condition.excludesFacts ?? [])].forEach((factId) =>
    facts.add(factId),
  );
  [
    ...(condition.requiresDefeatedBosses ?? []),
    ...(condition.excludesDefeatedBosses ?? []),
  ].forEach((bossId) => bosses.add(bossId));
  for (const requirement of [
    ...(condition.questStages ?? []),
    ...(condition.excludesQuestStages ?? []),
  ]) {
    const stages = stageDomains.get(requirement.questId) ?? new Set();
    requirement.stageIds.forEach((stageId) => stages.add(stageId));
    stageDomains.set(requirement.questId, stages);
  }
}

function subsets<Value>(values: readonly Value[]): readonly (readonly Value[])[] {
  const result: Value[][] = [[]];
  for (const value of values) {
    result.push(...result.map((existing) => [...existing, value]));
  }
  return result;
}

function stageSnapshots(
  domains: readonly Readonly<
    [
      QuestSnapshot['stages'][number]['questId'],
      ReadonlySet<QuestSnapshot['stages'][number]['stageId']>,
    ]
  >[],
): readonly QuestSnapshot['stages'][] {
  let snapshots: QuestSnapshot['stages'][] = [[]];
  for (const [questId, stages] of domains) {
    snapshots = snapshots.flatMap((snapshot) => [
      snapshot,
      ...[...stages].map((stageId) => [...snapshot, { questId, stageId }]),
    ]);
  }
  return snapshots;
}

function hasEligibleExit(
  node: DialogueNodeDefinition,
  nodes: ReadonlyMap<DialogueNodeId, DialogueNodeDefinition>,
  context: DialogueContext,
  path: ReadonlySet<DialogueNodeId>,
): boolean {
  if (path.has(node.nodeId) || !eligible(node, context)) return false;
  const choices = node.choices.filter((choice) => conditionEligible(choice.condition, context));
  if (choices.some(({ targetNodeId }) => targetNodeId === null)) return true;
  const nextPath = new Set(path);
  nextPath.add(node.nodeId);
  return choices.some(({ targetNodeId }) => {
    if (targetNodeId === null) return true;
    const target = nodes.get(targetNodeId);
    return target !== undefined && hasEligibleExit(target, nodes, context, nextPath);
  });
}
