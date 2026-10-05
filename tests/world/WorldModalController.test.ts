import { describe, expect, it } from 'vitest';

import { itemId, questFlagId, questId, questStageId, stableId } from '../../src/game/core/StableId';
import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import type { ContentRegistry } from '../../src/game/data/types';
import { createNewSave } from '../../src/game/saves/SaveSchema';
import type { SaveV1 } from '../../src/game/saves/SaveSchema';
import { RuntimeSaveCoordinator } from '../../src/game/world/RuntimeSaveCoordinator';
import { WorldModalController } from '../../src/game/world/WorldModalController';
import type { WorldDomainEvent } from '../../src/game/world/WorldModalController';

function save(currency = 0): SaveV1 {
  const { newGame } = CONTENT_REGISTRY;
  const created = createNewSave({
    nowEpochMs: 100,
    location: {
      regionId: newGame.initialRegionId,
      areaId: newGame.initialAreaId,
      checkpointId: newGame.initialCheckpointId,
      safePosition: { x: 256, y: 608 },
    },
    baseStats: newGame.baseStats,
    initialQuests: newGame.initialQuests,
    startingAbilities: newGame.startingAbilities,
  });
  return { ...created, player: { ...created.player, currency } };
}

function seedQuest(
  current: SaveV1,
  id: 'the-silent-bloom' | 'lost-folio' | 'lanterns-for-the-absent',
  stage: string,
  flags: readonly string[],
): SaveV1 {
  return {
    ...current,
    quests: {
      stages: current.quests.stages.map((entry) =>
        entry.questId === id ? { questId: questId(id), stageId: questStageId(stage) } : entry,
      ),
      flags: [...new Set([...current.quests.flags, ...flags.map(questFlagId)])].sort(),
    },
  };
}

function chooseFirst(controller: WorldModalController, current: SaveV1, spawnId: string) {
  const opened = controller.openNpc(spawnId, current);
  expect(opened.kind).toBe('opened');
  if (opened.kind !== 'opened') throw new Error(`Expected ${spawnId} dialogue to open.`);
  const choiceId = opened.state.choices[0]?.choiceId;
  if (choiceId === undefined) throw new Error(`Expected ${spawnId} dialogue to offer a choice.`);
  return {
    opened,
    result: controller.issue(
      {
        kind: 'choose',
        sessionId: opened.state.sessionId,
        revision: opened.state.revision,
        choiceId,
      },
      current,
    ),
  };
}

function progressionEvents(events: readonly WorldDomainEvent[]) {
  return events
    .filter(
      (event): event is Extract<WorldDomainEvent, { kind: 'progression' }> =>
        event.kind === 'progression',
    )
    .map(({ event }) => event);
}

describe('WorldModalController', () => {
  it('applies an authored multi-effect choice atomically and ignores stale duplicate commands', () => {
    const controller = new WorldModalController(CONTENT_REGISTRY);
    const opened = controller.openNpc('sela-at-chart-table', save());
    expect(opened.kind).toBe('opened');
    if (opened.kind !== 'opened') return;
    expect(opened.state).toMatchObject({
      mode: 'dialogue',
      speaker: 'Sela Quill',
      copy: 'The root-song has gone thin beneath my maps. Will you follow where the ink trembles?',
    });
    const choiceId = opened.state.choices[0]!.choiceId;
    const command = {
      kind: 'choose' as const,
      sessionId: opened.state.sessionId,
      revision: opened.state.revision,
      choiceId,
    };

    const accepted = controller.issue(command, save());
    expect(accepted.kind).toBe('closed');
    if (accepted.kind !== 'closed') return;
    expect(accepted.save?.quests.flags).toContain('silent-bloom-accepted');
    expect(accepted.save?.quests.stages).toContainEqual({
      questId: 'the-silent-bloom',
      stageId: 'trace-listening-arch',
    });
    expect(accepted.events.map(({ sequence }) => sequence)).toEqual([1, 2]);

    const stale = controller.issue(command, accepted.save!);
    expect(stale).toMatchObject({ kind: 'ignored', state: null, save: null, events: [] });
  });

  it('moves a shopkeeper dialogue into shop mode and rejects a zero-currency purchase without a save', () => {
    const controller = new WorldModalController(CONTENT_REGISTRY);
    const opened = controller.openNpc('piri-at-herb-stall', save());
    expect(opened.kind).toBe('opened');
    if (opened.kind !== 'opened') return;
    const shop = controller.issue(
      {
        kind: 'choose',
        sessionId: opened.state.sessionId,
        revision: opened.state.revision,
        choiceId: opened.state.choices[0]!.choiceId,
      },
      save(),
    );
    expect(shop.kind).toBe('updated');
    if (shop.kind !== 'updated' || shop.state === null) return;
    expect(shop.state.mode).toBe('shop');
    expect(shop.state.offers.length).toBeGreaterThan(0);

    const rejected = controller.issue(
      {
        kind: 'purchase',
        sessionId: shop.state.sessionId,
        revision: shop.state.revision,
        offerId: shop.state.offers[0]!.offerId,
      },
      save(),
    );
    expect(rejected.kind).toBe('rejected');
    if (rejected.kind !== 'rejected') return;
    expect(rejected.save).toBeNull();
    expect(rejected.events).toEqual([]);
    expect(rejected.state?.error).toMatch(/currency|available|funds/i);
    expect(rejected.state?.revision).toBe(shop.state.revision + 1);
  });

  it('keeps the current page and advances the revision when authored effects are rejected', () => {
    const controller = new WorldModalController(CONTENT_REGISTRY);
    const opened = controller.openNpc('sela-at-chart-table', save());
    expect(opened.kind).toBe('opened');
    if (opened.kind !== 'opened') return;
    const impossible = {
      ...save(),
      quests: { ...save().quests, flags: ['not-authored'] },
    } as unknown as SaveV1;
    const result = controller.issue(
      {
        kind: 'choose',
        sessionId: opened.state.sessionId,
        revision: opened.state.revision,
        choiceId: opened.state.choices[0]!.choiceId,
      },
      impossible,
    );

    expect(result.kind).toBe('rejected');
    expect(result.save).toBeNull();
    expect(result.state?.copy).toBe(opened.state.copy);
    expect(result.state?.revision).toBe(opened.state.revision + 1);
  });

  it('does not commit a choice until its candidate installs and recovers the page after a queue failure', () => {
    const modal = new WorldModalController(CONTENT_REGISTRY);
    const opened = modal.openNpc('sela-at-chart-table', save());
    expect(opened.kind).toBe('opened');
    if (opened.kind !== 'opened') return;
    const prepared = modal.prepare(
      {
        kind: 'choose',
        sessionId: opened.state.sessionId,
        revision: opened.state.revision,
        choiceId: opened.state.choices[0]!.choiceId,
      },
      save(),
    );
    expect(prepared.kind).toBe('prepared');
    if (prepared.kind !== 'prepared' || prepared.save === null) return;
    expect(modal.snapshot).toBe(opened.state);

    const saves = new RuntimeSaveCoordinator('slot-1', save(), {
      queueAutosave: () => {
        throw new Error('storage unavailable');
      },
    });
    expect(saves.install(prepared.save, { snapshotAtEpochMs: 101, playTimeMs: 1 }).kind).toBe(
      'failed',
    );
    const failed = modal.fail(prepared.token, 'Progress could not be saved. Try again.');

    expect(failed).toMatchObject({ kind: 'rejected', save: null, events: [] });
    expect(failed.state).toMatchObject({
      copy: opened.state.copy,
      revision: opened.state.revision + 1,
      error: 'Progress could not be saved. Try again.',
    });
    expect(modal.snapshot).toBe(failed.state);
  });

  it('delivers Piri the root-memory and claims Aegis through one atomic live choice', () => {
    const seeded = seedQuest(save(), 'the-silent-bloom', 'bring-root-memory-to-piri', [
      'silent-bloom-accepted',
      'listening-arch-traced',
      'root-memory-recovered',
    ]);
    const controller = new WorldModalController(CONTENT_REGISTRY);
    const { opened, result } = chooseFirst(controller, seeded, 'piri-at-herb-stall');

    expect(opened.state.copy).toMatch(/root remembers rain/i);
    expect(result.kind).toBe('updated');
    expect(result.save?.quests.flags).toEqual(
      expect.arrayContaining(['root-memory-delivered', 'aegis-veil-learned']),
    );
    expect(result.save?.quests.stages).toContainEqual({
      questId: 'the-silent-bloom',
      stageId: 'seek-briar-core',
    });
    expect(result.save?.player.unlockedAbilities).toContain('aegis-veil');
    expect(result.save?.player.experience).toBe(40);
    expect(progressionEvents(result.events)).toEqual([
      { kind: 'fact-set', id: 'root-memory-delivered', amount: null },
      { kind: 'quest-advanced', id: 'the-silent-bloom', amount: null },
      { kind: 'ability-unlocked', id: 'aegis-veil', amount: null },
      { kind: 'xp-granted', id: null, amount: 40 },
      { kind: 'fact-set', id: 'aegis-veil-learned', amount: null },
    ]);

    const reloaded = structuredClone(result.save!);
    const repeat = chooseFirst(
      new WorldModalController(CONTENT_REGISTRY),
      reloaded,
      'piri-at-herb-stall',
    );
    expect(repeat.opened.state.copy).toMatch(/memory rests safely/i);
    expect(repeat.result.save).toBeNull();
    expect(repeat.result.events).toEqual([]);
  });

  it('publishes no partial candidate when authored effects succeed but the composed reward rejects', () => {
    const piri = CONTENT_REGISTRY.dialogue.find(({ dialogueId }) => dialogueId === 'piri-village')!;
    const rootMemory = piri.nodes.find(({ nodeId }) => nodeId === 'piri-root-memory')!;
    const registry: ContentRegistry = {
      ...CONTENT_REGISTRY,
      dialogue: CONTENT_REGISTRY.dialogue.map((dialogue) =>
        dialogue.dialogueId !== piri.dialogueId
          ? dialogue
          : {
              ...dialogue,
              nodes: dialogue.nodes.map((node) =>
                node.nodeId !== rootMemory.nodeId
                  ? node
                  : {
                      ...node,
                      choices: node.choices.map((choice) => ({
                        ...choice,
                        rewardId: 'lost-folio' as const,
                      })),
                    },
              ),
            },
      ),
    };
    const seeded = seedQuest(save(), 'the-silent-bloom', 'bring-root-memory-to-piri', [
      'silent-bloom-accepted',
      'listening-arch-traced',
      'root-memory-recovered',
    ]);
    const failed = chooseFirst(new WorldModalController(registry), seeded, 'piri-at-herb-stall');

    expect(failed.result).toMatchObject({ kind: 'rejected', save: null, events: [] });
    expect(failed.result.state?.error).toMatch(/item/i);
    expect(seeded.quests.flags).not.toContain('root-memory-delivered');
    expect(seeded.player.unlockedAbilities).not.toContain('aegis-veil');
  });

  it("returns Sela's folio through the live route exactly once and rejects missing inventory atomically", () => {
    const ready = {
      ...seedQuest(
        seedQuest(save(), 'the-silent-bloom', 'trace-listening-arch', ['silent-bloom-accepted']),
        'lost-folio',
        'return-to-sela',
        ['cartographers-folio-found'],
      ),
      inventory: [{ itemId: itemId('cartographers-folio'), quantity: 1 }],
    };
    const controller = new WorldModalController(CONTENT_REGISTRY);
    const { opened, result } = chooseFirst(controller, ready, 'sela-at-chart-table');

    expect(opened.state.copy).toMatch(/missing pages/i);
    expect(result.kind).toBe('closed');
    expect(result.save?.inventory).toContainEqual({ itemId: 'quiet-step', quantity: 1 });
    expect(result.save?.inventory).not.toContainEqual({
      itemId: 'cartographers-folio',
      quantity: 1,
    });
    expect(result.save?.player).toMatchObject({ experience: 60, currency: 25 });
    expect(result.save?.quests.stages).toContainEqual({
      questId: 'lost-folio',
      stageId: 'complete',
    });
    expect(progressionEvents(result.events).map(({ kind }) => kind)).toEqual([
      'item-consumed',
      'item-granted',
      'xp-granted',
      'currency-granted',
      'fact-set',
      'quest-advanced',
    ]);

    const repeated = chooseFirst(
      new WorldModalController(CONTENT_REGISTRY),
      structuredClone(result.save!),
      'sela-at-chart-table',
    );
    expect(repeated.opened.state.copy).not.toMatch(/missing pages/i);
    expect(repeated.result.save).toBeNull();
    expect(repeated.result.events).toEqual([]);

    const missingItem = seedQuest(save(), 'lost-folio', 'return-to-sela', [
      'cartographers-folio-found',
    ]);
    const failed = chooseFirst(
      new WorldModalController(CONTENT_REGISTRY),
      missingItem,
      'sela-at-chart-table',
    );
    expect(failed.result).toMatchObject({ kind: 'rejected', save: null, events: [] });
    expect(failed.result.state?.error).toMatch(/item/i);
    expect(missingItem.quests.flags).not.toContain('cartographers-folio-returned');
  });

  it('turns in all three lanterns to Piri and preserves the reward ledger across reload', () => {
    const ready = seedQuest(save(), 'lanterns-for-the-absent', 'return-to-piri', [
      'absent-lantern-trail-lit',
      'absent-lantern-hollows-lit',
      'absent-lantern-reliquary-lit',
    ]);
    const controller = new WorldModalController(CONTENT_REGISTRY);
    const { opened, result } = chooseFirst(controller, ready, 'piri-at-herb-stall');

    expect(opened.state.copy).toMatch(/three lanterns/i);
    expect(result.kind).toBe('updated');
    expect(result.save?.player.baseStats.maxMana).toBe(48);
    expect(result.save?.player.currentMana).toBe(48);
    expect(result.save?.player.experience).toBe(80);
    expect(result.save?.quests.flags).toContain('lanterns-for-the-absent-complete');
    expect(result.save?.quests.stages).toContainEqual({
      questId: 'lanterns-for-the-absent',
      stageId: 'complete',
    });
    expect(progressionEvents(result.events).map(({ kind }) => kind)).toEqual([
      'mana-increased',
      'xp-granted',
      'fact-set',
      'quest-advanced',
    ]);

    const repeated = chooseFirst(
      new WorldModalController(CONTENT_REGISTRY),
      structuredClone(result.save!),
      'piri-at-herb-stall',
    );
    expect(repeated.opened.state.copy).not.toMatch(/three lanterns burned/i);
    expect(repeated.result.save).toBeNull();
    expect(repeated.result.events).toEqual([]);
  });

  it('lets Sela restore the bloom after the Cantor and exposes a distinct effect-free follow-up', () => {
    const ready = {
      ...seedQuest(save(), 'the-silent-bloom', 'return-to-sela', [
        'silent-bloom-accepted',
        'listening-arch-traced',
        'root-memory-delivered',
        'briar-core-claimed',
        'surveyor-edge-reforged',
        'rootglass-reliquary-entered',
        'pallid-cantor-defeated',
      ]),
      worldProgress: {
        ...save().worldProgress,
        defeatedBosses: [stableId<'boss'>('pallid-cantor')],
      },
    };
    const controller = new WorldModalController(CONTENT_REGISTRY);
    const { opened, result } = chooseFirst(controller, ready, 'sela-at-chart-table');

    expect(opened.state.copy).toMatch(/cantor is silent/i);
    expect(result.save?.quests.flags).toContain('silent-bloom-restored');
    expect(result.save?.quests.stages).toContainEqual({
      questId: 'the-silent-bloom',
      stageId: 'complete',
    });
    expect(progressionEvents(result.events).map(({ kind }) => kind)).toEqual([
      'fact-set',
      'quest-advanced',
    ]);

    const followUp = chooseFirst(
      new WorldModalController(CONTENT_REGISTRY),
      structuredClone(result.save!),
      'sela-at-chart-table',
    );
    expect(followUp.opened.state.copy).toMatch(/bloom is open again/i);
    expect(followUp.opened.state.copy).not.toBe(opened.state.copy);
    expect(followUp.result.save).toBeNull();
    expect(followUp.result.events).toEqual([]);
  });
});

it('merchant farewell closes dialogue while Browse wares opens the shop', () => {
  const controller = new WorldModalController(CONTENT_REGISTRY);
  const npc = CONTENT_REGISTRY.npcs.find((npc) => npc.shopId !== null)!;
  const current = save();
  const opened = controller.openNpc(npc.spawnId, current);
  expect(opened.kind).toBe('opened');
  if (opened.kind !== 'opened') return;
  expect(opened.state.choices.some((choice) => choice.text === 'Browse wares')).toBe(true);
  const leave = opened.state.choices.find((choice) => choice.text === 'Until next time.')!;
  const result = controller.issue(
    {
      kind: 'choose',
      sessionId: opened.state.sessionId,
      revision: opened.state.revision,
      choiceId: leave.choiceId,
    },
    current,
  );
  expect(result.kind).toBe('closed');
});
