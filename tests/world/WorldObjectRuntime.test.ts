import { describe, expect, test } from 'vitest';

import { abilityId, damageTypeId, stableId } from '../../src/game/core/StableId';
import { CONTENT_REGISTRY, PUZZLES } from '../../src/game/data/areas';
import { createNewSave } from '../../src/game/saves/SaveSchema';
import type { SaveV1 } from '../../src/game/saves/SaveSchema';
import { AreaLoader } from '../../src/game/world/AreaLoader';
import { WorldObjectRuntime } from '../../src/game/world/WorldObjectRuntime';
import { applyProgressionTransaction } from '../../src/game/world/WorldProgression';

function save(): SaveV1 {
  const { newGame } = CONTENT_REGISTRY;
  return createNewSave({
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
}

function room(areaId: string, roomId: string, current = save()) {
  const loader = new AreaLoader(CONTENT_REGISTRY);
  const area = loader.load(CONTENT_REGISTRY.areas.find((area) => area.areaId === areaId)!);
  return new WorldObjectRuntime({
    area,
    roomId: stableId<'room'>(roomId),
    puzzles: PUZZLES,
    registry: CONTENT_REGISTRY,
    save: current,
  });
}

describe('WorldObjectRuntime', () => {
  test('discovers a room and its room-entry discovery in one idempotent transaction', () => {
    const runtime = room('brackenreach', 'split-cedar-sanctum');
    const current = save();
    const proposal = runtime.prepareRoomEntry(current);

    expect(proposal).toMatchObject({
      kind: 'room-entry',
      commands: [
        { kind: 'discover-room', roomId: 'split-cedar-sanctum' },
        { kind: 'claim-discovery', discoveryId: 'split-cedar-sanctum-discovery' },
        { kind: 'grant-xp', amount: 20 },
      ],
    });
    const applied = applyProgressionTransaction(current, { commands: proposal!.commands });
    expect(applied.kind).toBe('accepted');
    if (applied.kind !== 'accepted' || proposal === null) return;
    expect(runtime.commit(proposal.token)).toBe(true);
    expect(runtime.prepareRoomEntry(applied.save)).toBeNull();
  });

  test('keeps a chest selectable until its ledger and reward transaction commits', () => {
    const runtime = room('brackenreach', 'brackenreach-trail');
    const current = save();
    const step = runtime.step({
      playerPosition: { x: 880, y: 608 },
      playerState: 'idle',
      interactBufferId: 1,
      pulseMechanismIds: [],
      nowMs: 17,
      save: current,
    });

    expect(step).toMatchObject({
      prompt: 'Open Wayfarer Cache',
      proposal: {
        kind: 'chest',
        consumedInteractBufferId: 1,
        commands: [
          { kind: 'open-chest', chestId: 'trail-wayfarer-cache' },
          { kind: 'grant-currency', amount: 20 },
        ],
      },
    });
    expect(
      runtime.step({
        playerPosition: { x: 880, y: 608 },
        playerState: 'idle',
        interactBufferId: 1,
        pulseMechanismIds: [],
        nowMs: 34,
        save: current,
      }).proposal,
    ).toEqual(step.proposal);
    expect(runtime.cancel(step.proposal!.token)).toBe(true);
    expect(
      runtime.step({
        playerPosition: { x: 880, y: 608 },
        playerState: 'idle',
        interactBufferId: 1,
        pulseMechanismIds: [],
        nowMs: 51,
        save: current,
      }).proposal,
    ).not.toBeNull();
  });

  test('only adopts an item-lock completion after commit and consumes its key atomically', () => {
    const current = {
      ...save(),
      inventory: [{ itemId: stableId<'item'>('rootglass-index-key'), quantity: 1 }],
    };
    const runtime = room('rootglass-reliquary', 'rootglass-vestibule', current);
    const input = {
      playerPosition: { x: 1400, y: 788 },
      playerState: 'idle' as const,
      interactBufferId: 3,
      pulseMechanismIds: [],
      nowMs: 17,
      save: current,
    };
    const first = runtime.step(input);

    expect(first.proposal).toMatchObject({
      kind: 'puzzle-completed',
      puzzleId: 'vestibule-index-seal',
      commands: [
        { kind: 'solve-puzzle', puzzleId: 'vestibule-index-seal' },
        { kind: 'consume-item', itemId: 'rootglass-index-key', quantity: 1 },
      ],
    });
    expect(runtime.snapshot(current).puzzles).toEqual([]);
    expect(runtime.cancel(first.proposal!.token)).toBe(true);
    expect(runtime.snapshot(current).puzzles).toEqual([]);
    const retry = runtime.step({ ...input, nowMs: 34 }).proposal;
    const applied = applyProgressionTransaction(current, { commands: retry!.commands });
    expect(applied.kind).toBe('accepted');
    if (applied.kind !== 'accepted' || retry === null) return;
    expect(runtime.commit(retry.token)).toBe(true);
    expect(runtime.snapshot(applied.save).puzzles).toEqual([
      { puzzleId: 'vestibule-index-seal', state: 'solved' },
    ]);
  });

  test.each([7488, 7664])(
    'accepts a reached pulse while casting at x=%i, even outside body overlap',
    (x) => {
      const baseline = save();
      const current = {
        ...baseline,
        player: {
          ...baseline.player,
          unlockedAbilities: [...baseline.player.unlockedAbilities, abilityId('resonant-pulse')],
        },
        quests: {
          ...baseline.quests,
          flags: [...baseline.quests.flags, stableId<'quest-flag'>('resonant-pulse-awakened')],
        },
      };
      const runtime = room('rootglass-reliquary', 'resonance-gallery', current);

      const step = runtime.step({
        playerPosition: { x, y: 900 },
        playerState: 'cast',
        interactBufferId: null,
        pulseMechanismIds: [stableId<'mechanism'>('gallery-memory-lens')],
        nowMs: 17,
        save: current,
      });

      expect(step.proposal).toMatchObject({
        kind: 'puzzle-advanced',
        puzzleId: 'gallery-choir-seal',
      });
    },
  );

  test('routes only an accepted positive player attack to a breakable shortcut proposal', () => {
    const runtime = room('brackenreach', 'brackenreach-trail');
    const current = save();
    const target = runtime.targets(current)[0];
    expect(target).toMatchObject({
      targetId: 'split-cedar-root-knot',
      teamId: 'environment',
      hurtboxes: [{ x: 1984, y: 448, width: 64, height: 160 }],
    });
    const impact = {
      attackId: stableId<'attack'>('mara-charged-heavy'),
      targetId: target!.targetId,
      source: {
        ownerId: stableId<'combatant'>('mara'),
        teamId: stableId<'team'>('player'),
        position: { x: 1920, y: 608 },
        facing: 'right' as const,
      },
      occurredAtMs: 17,
      delivery: 'melee' as const,
      damage: {
        baseDamage: 20,
        damageType: damageTypeId('physical'),
        poiseDamage: 10,
        critical: { kind: 'excluded' as const },
      },
      knockback: { x: 0, y: 0 },
      hitStopMs: 50,
      tags: ['blockable' as const],
      projectile: null,
    };

    expect(runtime.receiveImpact(impact, current).kind).toBe('resolved');
    expect(runtime.pendingProposal()).toMatchObject({
      kind: 'breakable',
      breakableId: 'split-cedar-root-knot',
      commands: [{ kind: 'activate-shortcut', shortcutId: 'split-cedar-root-knot-open' }],
    });
    expect(
      room('brackenreach', 'brackenreach-trail').receiveImpact(
        { ...impact, attackId: stableId<'attack'>('mara-light-one') },
        current,
      ).kind,
    ).toBe('ignored');
  });
});
