import type { QuestFlagId, StableId } from '../core/StableId';
import { deepFreeze } from '../data/immutability';
import type { Rect, TriggerAction, TriggerId } from '../data/types';

export type WorldTriggerRule = Readonly<{
  triggerId: TriggerId;
  bounds: Rect;
  activation: 'enter' | 'interact';
  predicate: Readonly<{
    requiresFacts: readonly QuestFlagId[];
    excludesFacts: readonly QuestFlagId[];
  }>;
  action: TriggerAction;
}>;

export type TriggerEvaluation = Readonly<{
  actorBounds: Rect;
  interactionPressed: boolean;
  facts: readonly QuestFlagId[];
  fulfilledTriggerIds: readonly TriggerId[];
}>;

export type TriggerMatch = Readonly<{
  triggerId: TriggerId;
  action: TriggerAction;
}>;

export class TriggerSystem {
  private readonly inside = new Map<TriggerId, boolean>();
  private interactionHeld = false;
  private disposed = false;

  public constructor(private readonly triggers: readonly WorldTriggerRule[]) {
    const ids = new Set<TriggerId>();
    for (const trigger of triggers) {
      if (ids.has(trigger.triggerId)) throw new RangeError('Trigger IDs cannot repeat.');
      assertRect(trigger.bounds);
      ids.add(trigger.triggerId);
      this.inside.set(trigger.triggerId, false);
    }
  }

  public evaluate(input: TriggerEvaluation): readonly TriggerMatch[] {
    if (this.disposed) return Object.freeze([]);
    assertRect(input.actorBounds);
    const facts = new Set(input.facts);
    const fulfilled = new Set(input.fulfilledTriggerIds);
    const interactionEdge = input.interactionPressed && !this.interactionHeld;
    const matches: TriggerMatch[] = [];

    for (const trigger of this.triggers) {
      const isInside = overlaps(trigger.bounds, input.actorBounds);
      const entered = isInside && !this.inside.get(trigger.triggerId);
      this.inside.set(trigger.triggerId, isInside);
      if (!isInside || fulfilled.has(trigger.triggerId)) continue;
      if (!trigger.predicate.requiresFacts.every((factId) => facts.has(factId))) continue;
      if (trigger.predicate.excludesFacts.some((factId) => facts.has(factId))) continue;
      if (
        (trigger.activation === 'enter' && entered) ||
        (trigger.activation === 'interact' && interactionEdge)
      ) {
        matches.push({ triggerId: trigger.triggerId, action: trigger.action });
      }
    }

    this.interactionHeld = input.interactionPressed;
    return deepFreeze(matches);
  }

  public dispose(): boolean {
    if (this.disposed) return false;
    this.inside.clear();
    this.interactionHeld = false;
    this.disposed = true;
    return true;
  }

  public releaseInteraction(): void {
    this.interactionHeld = false;
  }
}

function overlaps(left: Rect, right: Rect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function assertRect(rect: Rect): void {
  if (
    !Number.isFinite(rect.x) ||
    !Number.isFinite(rect.y) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    throw new RangeError('Trigger rectangles must be finite and positive.');
  }
}

export type TriggerFulfillmentId = StableId<'trigger'>;
