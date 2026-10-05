import { describe, expect, it } from 'vitest';

import { itemId, questFlagId } from '../../src/game/core/StableId';
import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { createNewSave } from '../../src/game/saves/SaveSchema';
import type { SaveV1 } from '../../src/game/saves/SaveSchema';
import {
  applyProgressionTransaction,
  claimProgressionReward,
} from '../../src/game/world/WorldProgression';

function save(patch: Partial<SaveV1['player']> = {}): SaveV1 {
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
  return { ...created, player: { ...created.player, ...patch } };
}

describe('WorldProgression', () => {
  it('applies ordered commands atomically, sorts sets, and preserves unrelated save fields', () => {
    const before = save({ currency: 12 });
    const result = applyProgressionTransaction(before, {
      commands: [
        { kind: 'spend-currency', amount: 8 },
        { kind: 'grant-item', itemId: itemId('sunmoss-draught'), quantity: 1 },
        { kind: 'set-fact', factId: questFlagId('silent-bloom-accepted') },
      ],
    });
    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') return;
    expect(result.save.player.currency).toBe(4);
    expect(result.save.inventory).toContainEqual({ itemId: 'sunmoss-draught', quantity: 1 });
    expect(result.save.quests.stages).toContainEqual({
      questId: 'the-silent-bloom',
      stageId: 'trace-listening-arch',
    });
    expect(result.save.metadata).toEqual(before.metadata);
    expect(Object.isFrozen(result.save.inventory)).toBe(true);
    expect(result.events.map(({ kind }) => kind)).toEqual([
      'currency-spent',
      'item-granted',
      'fact-set',
      'quest-advanced',
    ]);
  });

  it('rejects insufficient funds and full stacks without partial mutation', () => {
    const before = save({ currency: 7 });
    const insufficient = applyProgressionTransaction(before, {
      commands: [
        { kind: 'spend-currency', amount: 8 },
        { kind: 'grant-item', itemId: itemId('sunmoss-draught'), quantity: 1 },
      ],
    });
    expect(insufficient).toMatchObject({ kind: 'rejected', save: before });

    const full = applyProgressionTransaction(
      { ...before, inventory: [{ itemId: itemId('sunmoss-draught'), quantity: 5 }] },
      { commands: [{ kind: 'grant-item', itemId: itemId('sunmoss-draught'), quantity: 1 }] },
    );
    expect(full).toMatchObject({ kind: 'rejected' });
    expect(full.save.inventory).toEqual([{ itemId: 'sunmoss-draught', quantity: 5 }]);
  });

  it('grants exact Aegis, folio, lantern, Heart, Wellspring, and blade rewards once across reload', () => {
    let current = save({ currency: 100 });
    current = accepted(
      applyProgressionTransaction(current, {
        commands: [{ kind: 'grant-item', itemId: itemId('cartographers-folio'), quantity: 1 }],
      }),
    );
    current = accepted(
      applyProgressionTransaction(current, {
        commands: [
          { kind: 'set-fact', factId: questFlagId('absent-lantern-trail-lit') },
          { kind: 'set-fact', factId: questFlagId('absent-lantern-hollows-lit') },
          { kind: 'set-fact', factId: questFlagId('absent-lantern-reliquary-lit') },
        ],
      }),
    );
    current = accepted(
      applyProgressionTransaction(current, {
        commands: [{ kind: 'grant-item', itemId: itemId('briar-core'), quantity: 1 }],
      }),
    );

    for (const rewardId of [
      'aegis-veil',
      'lost-folio',
      'lanterns-for-the-absent',
      'heart-petal',
      'wellspring-seed',
      'blade-reforge',
    ] as const) {
      const claimed = claimProgressionReward(current, rewardId);
      expect(claimed.kind).toBe('accepted');
      current = accepted(claimed);
      expect(claimProgressionReward(structuredClone(current), rewardId).kind).toBe('unchanged');
    }

    expect(current.player).toMatchObject({
      currentHealth: 120,
      currentMana: 56,
      healthUpgrades: 1,
      manaUpgrades: 2,
      experience: 180,
      currency: 75,
      weaponLevel: 1,
    });
    expect(current.player.unlockedAbilities).toContain('aegis-veil');
    expect(current.inventory).toContainEqual({ itemId: 'quiet-step', quantity: 1 });
    expect(current.inventory.some(({ itemId }) => itemId === 'cartographers-folio')).toBe(false);
    expect(current.inventory.some(({ itemId }) => itemId === 'briar-core')).toBe(false);
  });

  it('does not publish a candidate when reward prerequisites are missing', () => {
    expect(claimProgressionReward(save({ currency: 49 }), 'blade-reforge')).toMatchObject({
      kind: 'rejected',
      reason: 'insufficient-currency',
    });
    expect(claimProgressionReward(save({ currency: 50 }), 'blade-reforge')).toMatchObject({
      kind: 'rejected',
      reason: 'insufficient-item',
    });
  });

  it('requires all three lantern facts before granting only the completion reward', () => {
    const initial = save();
    const empty = claimProgressionReward(initial, 'lanterns-for-the-absent');
    expect(empty).toMatchObject({ kind: 'rejected', reason: 'missing-prerequisite' });
    expect(empty.save).toEqual(initial);

    let partial = initial;
    for (const fact of ['absent-lantern-reliquary-lit', 'absent-lantern-trail-lit'] as const) {
      partial = accepted(
        applyProgressionTransaction(partial, {
          commands: [{ kind: 'set-fact', factId: questFlagId(fact) }],
        }),
      );
      expect(claimProgressionReward(partial, 'lanterns-for-the-absent')).toMatchObject({
        kind: 'rejected',
        reason: 'missing-prerequisite',
      });
    }
    const ready = accepted(
      applyProgressionTransaction(partial, {
        commands: [
          {
            kind: 'set-fact',
            factId: questFlagId('absent-lantern-hollows-lit'),
          },
        ],
      }),
    );
    const claimed = claimProgressionReward(ready, 'lanterns-for-the-absent');
    expect(claimed.kind).toBe('accepted');
    if (claimed.kind !== 'accepted') return;
    expect(claimed.save.player.baseStats.maxMana).toBe(48);
    expect(claimed.save.player.experience).toBe(80);
    expect(claimed.save.quests.flags).toEqual(
      expect.arrayContaining([
        'absent-lantern-hollows-lit',
        'absent-lantern-reliquary-lit',
        'absent-lantern-trail-lit',
        'lanterns-for-the-absent-complete',
      ]),
    );
    expect(
      claimProgressionReward(structuredClone(claimed.save), 'lanterns-for-the-absent').kind,
    ).toBe('unchanged');
  });

  it.each([
    ['absent-lantern-trail-lit', 'absent-lantern-hollows-lit', 'absent-lantern-reliquary-lit'],
    ['absent-lantern-trail-lit', 'absent-lantern-reliquary-lit', 'absent-lantern-hollows-lit'],
    ['absent-lantern-hollows-lit', 'absent-lantern-trail-lit', 'absent-lantern-reliquary-lit'],
    ['absent-lantern-hollows-lit', 'absent-lantern-reliquary-lit', 'absent-lantern-trail-lit'],
    ['absent-lantern-reliquary-lit', 'absent-lantern-trail-lit', 'absent-lantern-hollows-lit'],
    ['absent-lantern-reliquary-lit', 'absent-lantern-hollows-lit', 'absent-lantern-trail-lit'],
  ] as const)('claims the lantern reward after pre-existing fact order %s, %s, %s', (...order) => {
    let current = save();
    for (const factId of order) {
      current = accepted(
        applyProgressionTransaction(current, {
          commands: [{ kind: 'set-fact', factId: questFlagId(factId) }],
        }),
      );
    }
    const result = claimProgressionReward(current, 'lanterns-for-the-absent');
    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') return;
    expect(result.save.player.baseStats.maxMana).toBe(48);
    expect(result.save.player.experience).toBe(80);
  });

  it('validates before reward-ledger idempotency and freezes every result shape', () => {
    const claimed = claimProgressionReward(save(), 'heart-petal');
    expect(claimed.kind).toBe('accepted');
    if (claimed.kind !== 'accepted') return;
    const invalidLedgerSave = {
      ...claimed.save,
      player: {
        ...claimed.save.player,
        currentHealth: claimed.save.player.baseStats.maxHealth + 1,
      },
    };
    const invalid = claimProgressionReward(invalidLedgerSave, 'heart-petal');
    expect(invalid).toMatchObject({ kind: 'rejected', reason: 'invalid-save' });

    const unchanged = claimProgressionReward(structuredClone(claimed.save), 'heart-petal');
    const rejected = applyProgressionTransaction(save(), {
      commands: [{ kind: 'spend-currency', amount: 1 }],
    });
    for (const result of [claimed, unchanged, rejected, invalid]) {
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.events)).toBe(true);
      expect(Object.isFrozen(result.save)).toBe(true);
      expect(Object.isFrozen(result.save.player)).toBe(true);
    }
  });
});

function accepted(
  result: ReturnType<typeof applyProgressionTransaction>,
): Extract<ReturnType<typeof applyProgressionTransaction>, { kind: 'accepted' }>['save'] {
  if (result.kind !== 'accepted') throw new Error(`Expected accepted, got ${result.kind}.`);
  return result.save;
}
