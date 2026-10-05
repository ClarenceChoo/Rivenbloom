import { describe, expect, it } from 'vitest';

import { stableId } from '../../src/game/core/StableId';
import { NPCS } from '../../src/game/data/npcs';
import { NpcController } from '../../src/game/entities/npcs/NpcController';

describe('NpcController', () => {
  it('maps stable NPC/spawn IDs, faces the player, and suppresses held interaction edges', () => {
    const controller = new NpcController(NPCS);
    const context = {
      spawnId: stableId<'actor-spawn'>('sela-at-chart-table'),
      npcPositionX: 400,
      playerPositionX: 300,
      interactionPressed: true,
      quests: { stages: [], flags: [] },
      defeatedBosses: [],
    } as const;
    expect(controller.evaluate(context)).toMatchObject({
      kind: 'interact',
      actorId: 'sela-quill',
      facing: 'left',
      prompt: 'Speak with Sela',
      dialogueId: 'sela-village',
    });
    expect(controller.evaluate(context).kind).toBe('prompt');
    controller.evaluate({ ...context, interactionPressed: false });
    expect(controller.evaluate(context).kind).toBe('interact');
  });

  it('rejects an unknown spawn and can be disposed repeatedly', () => {
    const controller = new NpcController(NPCS);
    expect(() =>
      controller.evaluate({
        spawnId: stableId<'actor-spawn'>('missing-npc'),
        npcPositionX: 0,
        playerPositionX: 0,
        interactionPressed: false,
        quests: { stages: [], flags: [] },
        defeatedBosses: [],
      }),
    ).toThrow(/unknown npc spawn/i);
    expect(controller.dispose()).toBe(true);
    expect(controller.dispose()).toBe(false);
  });
});
