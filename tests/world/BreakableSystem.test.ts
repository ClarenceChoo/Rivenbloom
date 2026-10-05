import { describe, expect, test } from 'vitest';

import { stableId } from '../../src/game/core/StableId';
import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { createNewSave } from '../../src/game/saves/SaveSchema';
import type { SaveV1 } from '../../src/game/saves/SaveSchema';
import { BreakableSystem } from '../../src/game/world/BreakableSystem';

function save(shortcuts: readonly string[] = []): SaveV1 {
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
    worldProgress: {
      ...created.worldProgress,
      activatedShortcuts: shortcuts.map((id) => stableId<'shortcut'>(id)),
    },
  };
}

describe('BreakableSystem', () => {
  test.each(['mara-charged-heavy', 'resonant-pulse-wave'])(
    'accepts player %s damage',
    (attackId) => {
      const system = new BreakableSystem();
      const result = system.apply(
        stableId<'breakable'>('split-cedar-root-knot'),
        {
          teamId: stableId<'team'>('player'),
          attackId: stableId<'attack'>(attackId),
          healthDamage: 1,
        },
        save(),
      );
      expect(result).toEqual({
        kind: 'activated',
        commands: [{ kind: 'activate-shortcut', shortcutId: 'split-cedar-root-knot-open' }],
      });
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.commands)).toBe(true);
    },
  );

  test('rejects wrong team, zero damage, wrong attack, unknown IDs, and invalid saves', () => {
    const system = new BreakableSystem();
    const base = {
      teamId: stableId<'team'>('player'),
      attackId: stableId<'attack'>('mara-charged-heavy'),
      healthDamage: 1,
    };
    expect(
      system.apply(
        stableId<'breakable'>('split-cedar-root-knot'),
        { ...base, teamId: stableId<'team'>('enemy') },
        save(),
      ).kind,
    ).toBe('rejected');
    expect(
      system.apply(
        stableId<'breakable'>('split-cedar-root-knot'),
        { ...base, healthDamage: 0 },
        save(),
      ).kind,
    ).toBe('rejected');
    expect(
      system.apply(
        stableId<'breakable'>('split-cedar-root-knot'),
        { ...base, attackId: stableId<'attack'>('mara-light-one') },
        save(),
      ).kind,
    ).toBe('rejected');
    expect(system.apply(stableId<'breakable'>('missing-wall'), base, save()).kind).toBe('rejected');
    expect(
      system.apply(stableId<'breakable'>('split-cedar-root-knot'), base, {
        ...save(),
        schemaVersion: 2,
      } as never).kind,
    ).toBe('rejected');
  });

  test('returns unchanged after persisted activation and deterministic proposals before install', () => {
    const system = new BreakableSystem();
    const activation = {
      teamId: stableId<'team'>('player'),
      attackId: stableId<'attack'>('resonant-pulse-wave'),
      healthDamage: 4,
    };
    const first = system.apply(
      stableId<'breakable'>('flooded-stacks-silt-wall'),
      activation,
      save(),
    );
    const replay = system.apply(
      stableId<'breakable'>('flooded-stacks-silt-wall'),
      activation,
      save(),
    );
    expect(replay).toEqual(first);
    expect(
      system.apply(
        stableId<'breakable'>('flooded-stacks-silt-wall'),
        activation,
        save(['flooded-stacks-silt-wall-open']),
      ),
    ).toEqual({ kind: 'unchanged', commands: [] });
  });
});
