import { describe, expect, test } from 'vitest';

import { stableId } from '../../src/game/core/StableId';
import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { createNewSave } from '../../src/game/saves/SaveSchema';
import type { SaveV1 } from '../../src/game/saves/SaveSchema';
import { matchesWorldPredicate, WORLD_ALWAYS } from '../../src/game/world/WorldPredicates';

function save(): SaveV1 {
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
  return {
    ...created,
    player: {
      ...created.player,
      unlockedAbilities: [stableId<'ability'>('lumen-bolt'), stableId<'ability'>('wayfinder-dash')],
    },
    inventory: [{ itemId: stableId<'item'>('rootglass-index-key'), quantity: 1 }],
    quests: {
      ...created.quests,
      flags: [stableId<'quest-flag'>('listening-arch-traced')],
    },
    worldProgress: {
      ...created.worldProgress,
      solvedPuzzles: [stableId<'puzzle'>('hollows-dash-circuit')],
      activatedShortcuts: [stableId<'shortcut'>('listening-arch-homeward-route')],
    },
  };
}

describe('WorldPredicates', () => {
  test('matches all conjunctive requirement and exclusion families', () => {
    expect(matchesWorldPredicate(WORLD_ALWAYS, save())).toBe(true);
    expect(
      matchesWorldPredicate(
        {
          requiresFacts: [stableId<'quest-flag'>('listening-arch-traced')],
          excludesFacts: [stableId<'quest-flag'>('pallid-cantor-defeated')],
          requiresAbilities: [stableId<'ability'>('wayfinder-dash')],
          requiresItems: [{ itemId: stableId<'item'>('rootglass-index-key'), quantity: 1 }],
          requiresSolvedPuzzles: [stableId<'puzzle'>('hollows-dash-circuit')],
          requiresActivatedShortcuts: [stableId<'shortcut'>('listening-arch-homeward-route')],
          requiresDefeatedBosses: [],
          excludesDefeatedBosses: [],
        },
        save(),
      ),
    ).toBe(true);
  });

  test('rejects unmet, excluded, malformed, and unknown requirements', () => {
    const baseline = save();
    expect(
      matchesWorldPredicate(
        { ...WORLD_ALWAYS, requiresAbilities: [stableId<'ability'>('aegis-veil')] },
        baseline,
      ),
    ).toBe(false);
    expect(
      matchesWorldPredicate(
        { ...WORLD_ALWAYS, excludesFacts: [stableId<'quest-flag'>('listening-arch-traced')] },
        baseline,
      ),
    ).toBe(false);
    expect(
      matchesWorldPredicate(
        {
          ...WORLD_ALWAYS,
          requiresItems: [{ itemId: stableId<'item'>('rootglass-index-key'), quantity: 2 }],
        },
        baseline,
      ),
    ).toBe(false);
    expect(
      matchesWorldPredicate(
        { ...WORLD_ALWAYS, requiresAbilities: [stableId<'ability'>('unknown-ability')] },
        baseline,
      ),
    ).toBe(false);
    expect(
      matchesWorldPredicate(
        {
          ...WORLD_ALWAYS,
          requiresItems: [{ itemId: stableId<'item'>('rootglass-index-key'), quantity: 0 }],
        },
        baseline,
      ),
    ).toBe(false);
    expect(matchesWorldPredicate(WORLD_ALWAYS, { ...baseline, schemaVersion: 2 } as never)).toBe(
      false,
    );
  });

  test('publishes one deeply frozen always predicate', () => {
    expect(Object.isFrozen(WORLD_ALWAYS)).toBe(true);
    expect(Object.values(WORLD_ALWAYS).every(Object.isFrozen)).toBe(true);
  });
});
