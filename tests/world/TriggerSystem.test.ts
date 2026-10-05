import { describe, expect, it } from 'vitest';

import { stableId } from '../../src/game/core/StableId';
import { TriggerSystem } from '../../src/game/world/TriggerSystem';

const triggers = [
  {
    triggerId: stableId<'trigger'>('first-trigger'),
    bounds: { x: 0, y: 0, width: 20, height: 20 },
    activation: 'enter',
    predicate: { requiresFacts: [], excludesFacts: [] },
    action: { kind: 'set-fact', factId: stableId<'quest-flag'>('first-entered') },
  },
  {
    triggerId: stableId<'trigger'>('second-trigger'),
    bounds: { x: 0, y: 0, width: 20, height: 20 },
    activation: 'interact',
    predicate: { requiresFacts: [], excludesFacts: [] },
    action: { kind: 'start-dialogue', dialogueId: stableId<'dialogue'>('sela-village') },
  },
] as const;

describe('TriggerSystem', () => {
  it('fires enter once, rearms after exit, and preserves authored overlap order', () => {
    const system = new TriggerSystem(triggers);
    const inside = {
      actorBounds: { x: 5, y: 5, width: 4, height: 4 },
      interactionPressed: true,
      facts: [],
      fulfilledTriggerIds: [],
    } as const;
    expect(system.evaluate(inside).map(({ triggerId }) => triggerId)).toEqual([
      'first-trigger',
      'second-trigger',
    ]);
    expect(system.evaluate(inside)).toEqual([]);
    system.evaluate({
      ...inside,
      actorBounds: { x: 30, y: 30, width: 4, height: 4 },
      interactionPressed: false,
    });
    expect(
      system.evaluate({ ...inside, interactionPressed: false }).map(({ triggerId }) => triggerId),
    ).toEqual(['first-trigger']);
  });

  it('silences disabled predicates and fulfilled triggers', () => {
    const system = new TriggerSystem([
      {
        ...triggers[0],
        predicate: { requiresFacts: [stableId<'quest-flag'>('gate-open')], excludesFacts: [] },
      },
    ]);
    const input = {
      actorBounds: { x: 1, y: 1, width: 2, height: 2 },
      interactionPressed: false,
      facts: [],
      fulfilledTriggerIds: [],
    } as const;
    expect(system.evaluate(input)).toEqual([]);
    expect(
      system.evaluate({
        ...input,
        facts: [stableId<'quest-flag'>('gate-open')],
        fulfilledTriggerIds: [stableId<'trigger'>('first-trigger')],
      }),
    ).toEqual([]);
  });
});
