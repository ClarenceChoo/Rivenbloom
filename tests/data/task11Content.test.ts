import { describe, expect, it } from 'vitest';

import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { validateContent } from '../../src/game/data/ContentValidation';
import { DIALOGUE } from '../../src/game/data/dialogue';
import { ITEMS } from '../../src/game/data/items';
import type { ProgressionCommand } from '../../src/game/world/WorldProgression';

describe('Task 11 content metadata and references', () => {
  it('retains display category and description through spread and structured clone', () => {
    const briarCore = ITEMS.find(({ itemId }) => itemId === 'briar-core');
    expect(briarCore).toBeDefined();
    if (briarCore === undefined) return;

    expect({ ...briarCore }).toMatchObject({
      category: 'material',
      description: 'A resin-bright heart cut from an elder briar guardian.',
    });
    expect(structuredClone(briarCore)).toMatchObject({
      category: 'material',
      description: 'A resin-bright heart cut from an elder briar guardian.',
    });
    expect(Object.isFrozen(briarCore)).toBe(true);
  });

  it('still rejects a canonical dialogue speaker omitted from the supplied actor registry', () => {
    const selaDialogue = DIALOGUE.find(({ dialogueId }) => dialogueId === 'sela-village');
    expect(selaDialogue).toBeDefined();
    if (selaDialogue === undefined) return;
    const withoutSela = CONTENT_REGISTRY.actors.filter(({ actorId }) => actorId !== 'sela-quill');

    expect(
      validateContent({ ...CONTENT_REGISTRY, actors: withoutSela, dialogue: [selaDialogue] }),
    ).toContainEqual(
      expect.objectContaining({
        code: 'missing-reference',
        path: '/dialogue/0/nodes/0/speakerActorId',
      }),
    );
  });

  it('validates the structure, numeric domains, and references of every progression command kind', () => {
    const invalidCommands = [
      { kind: 'set-fact', factId: 'Missing Fact' },
      { kind: 'grant-item', itemId: 'sunmoss-draught', quantity: 0 },
      { kind: 'consume-item', itemId: 'missing-item', quantity: 1 },
      { kind: 'grant-currency', amount: 0 },
      { kind: 'spend-currency', amount: -1 },
      { kind: 'grant-xp', amount: Number.MAX_SAFE_INTEGER + 1 },
      { kind: 'unlock-ability', abilityId: 'missing-ability' },
      { kind: 'increase-health', amount: 0 },
      { kind: 'increase-mana', amount: Number.NaN },
      { kind: 'upgrade-weapon', fromLevel: -1, toLevel: 1 },
      { kind: 'open-chest', chestId: 'Bad Chest' },
      { kind: 'activate-shortcut', shortcutId: 'Bad Shortcut' },
      { kind: 'solve-puzzle', puzzleId: 'Bad Puzzle' },
      { kind: 'discover-room', roomId: 'Bad Room' },
      { kind: 'claim-discovery', discoveryId: 'Bad Discovery' },
      { kind: 'defeat-boss', bossId: 'Bad Boss' },
      { kind: 'rest', unexpected: true },
      { kind: 'unknown-command' },
      null,
    ] as unknown as readonly ProgressionCommand[];
    const offer = CONTENT_REGISTRY.shopOffers[0]!;
    const issues = validateContent({
      ...CONTENT_REGISTRY,
      shopOffers: [{ ...offer, commands: invalidCommands }],
    });

    for (const index of invalidCommands.keys()) {
      expect(issues.some(({ path }) => path.startsWith(`/shopOffers/0/commands/${index}`))).toBe(
        true,
      );
    }
  });

  it('applies the same command validator to dialogue effects and validates sold-out fact references', () => {
    const dialogue = DIALOGUE[0]!;
    const firstNode = dialogue.nodes[0]!;
    const firstChoice = firstNode.choices[0]!;
    const issues = validateContent({
      ...CONTENT_REGISTRY,
      dialogue: [
        {
          ...dialogue,
          nodes: [
            {
              ...firstNode,
              choices: [
                {
                  ...firstChoice,
                  rewardId: 'unknown-reward',
                  effects: [
                    {
                      kind: 'grant-item',
                      itemId: ITEMS[0]!.itemId,
                      quantity: 0,
                    },
                  ],
                } as unknown as typeof firstChoice,
              ],
            },
            ...dialogue.nodes.slice(1),
          ],
        },
      ],
      shopOffers: [
        {
          ...CONTENT_REGISTRY.shopOffers[0]!,
          soldOutFactId: 'missing-sold-out-fact',
        } as (typeof CONTENT_REGISTRY.shopOffers)[number],
      ],
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/dialogue/0/nodes/0/choices/0/effects/0/quantity',
          code: 'invalid-value',
        }),
        expect.objectContaining({
          path: '/dialogue/0/nodes/0/choices/0/rewardId',
          code: 'invalid-value',
        }),
        expect.objectContaining({
          path: '/shopOffers/0/soldOutFactId',
          code: 'missing-reference',
        }),
      ]),
    );
  });
});
