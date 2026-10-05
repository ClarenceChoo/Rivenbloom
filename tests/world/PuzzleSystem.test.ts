import { describe, expect, test } from 'vitest';

import { stableId } from '../../src/game/core/StableId';
import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { createNewSave } from '../../src/game/saves/SaveSchema';
import type { SaveV1 } from '../../src/game/saves/SaveSchema';
import { EMPTY_PUZZLE_TRANSIENT, PuzzleSystem } from '../../src/game/world/PuzzleSystem';

function save(patch: Partial<SaveV1> = {}): SaveV1 {
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
  return { ...created, ...patch };
}

const enter = (nowMs: number) => ({ kind: 'enter' as const, nowMs });
const interact = (nowMs: number) => ({ kind: 'interact' as const, nowMs });
const pulse = (nowMs: number) => ({ kind: 'resonant-pulse' as const, nowMs });

describe('PuzzleSystem', () => {
  test('completes the dash circuit in all six orders at the inclusive 9000 ms boundary', () => {
    const system = new PuzzleSystem();
    const plates = [
      'dash-circuit-dew-plate',
      'dash-circuit-rib-plate',
      'dash-circuit-song-plate',
    ] as const;

    for (const order of permutations(plates)) {
      let transient = EMPTY_PUZZLE_TRANSIENT;
      const first = system.apply(stableId<'mechanism'>(order[0]), enter(100), {
        save: save(),
        transient,
      });
      expect(first.kind).toBe('advanced');
      transient = first.transient;
      const second = system.apply(stableId<'mechanism'>(order[1]), enter(1_000), {
        save: save(),
        transient,
      });
      expect(second.kind).toBe('advanced');
      transient = second.transient;
      const third = system.apply(stableId<'mechanism'>(order[2]), enter(9_100), {
        save: save(),
        transient,
      });
      expect(third).toMatchObject({
        kind: 'completed',
        commands: [
          { kind: 'solve-puzzle', puzzleId: 'hollows-dash-circuit' },
          { kind: 'unlock-ability', abilityId: 'wayfinder-dash' },
          { kind: 'set-fact', factId: 'wayfinder-dash-awakened' },
        ],
      });
      expect(third.transient).toEqual(EMPTY_PUZZLE_TRANSIENT);
    }
  });

  test('treats duplicate plates as unchanged and restarts after 9001 ms', () => {
    const system = new PuzzleSystem();
    const first = system.apply(stableId<'mechanism'>('dash-circuit-dew-plate'), enter(0), {
      save: save(),
      transient: EMPTY_PUZZLE_TRANSIENT,
    });
    const duplicate = system.apply(stableId<'mechanism'>('dash-circuit-dew-plate'), enter(500), {
      save: save(),
      transient: first.transient,
    });
    expect(duplicate.kind).toBe('unchanged');
    const expired = system.apply(stableId<'mechanism'>('dash-circuit-rib-plate'), enter(9_001), {
      save: save(),
      transient: duplicate.transient,
    });
    expect(expired.kind).toBe('advanced');
    expect(expired.transient.entries[0]?.activatedMechanismIds).toEqual(['dash-circuit-rib-plate']);
  });

  test('requires and consumes the index key in one ordered completion proposal', () => {
    const system = new PuzzleSystem();
    expect(
      system.apply(stableId<'mechanism'>('vestibule-index-lock'), interact(10), {
        save: save(),
        transient: EMPTY_PUZZLE_TRANSIENT,
      }).kind,
    ).toBe('rejected');

    const keyed = save({
      inventory: [{ itemId: stableId<'item'>('rootglass-index-key'), quantity: 1 }],
    });
    expect(
      system.apply(stableId<'mechanism'>('vestibule-index-lock'), interact(10), {
        save: keyed,
        transient: EMPTY_PUZZLE_TRANSIENT,
      }),
    ).toMatchObject({
      kind: 'completed',
      commands: [
        { kind: 'solve-puzzle', puzzleId: 'vestibule-index-seal' },
        { kind: 'consume-item', itemId: 'rootglass-index-key', quantity: 1 },
      ],
    });
  });

  test('enforces forge prerequisites and exact weapon level one', () => {
    const system = new PuzzleSystem();
    const baseline = save();
    const eligible = save({
      player: { ...baseline.player, weaponLevel: 1 },
      quests: {
        ...baseline.quests,
        flags: [stableId<'quest-flag'>('surveyor-edge-reforged')],
      },
      worldProgress: {
        ...baseline.worldProgress,
        solvedPuzzles: [stableId<'puzzle'>('vestibule-index-seal')],
      },
    });
    expect(
      system.apply(stableId<'mechanism'>('reliquary-forge-anvil'), interact(20), {
        save: { ...eligible, player: { ...eligible.player, weaponLevel: 0 } },
        transient: EMPTY_PUZZLE_TRANSIENT,
      }).kind,
    ).toBe('rejected');
    expect(
      system.apply(stableId<'mechanism'>('reliquary-forge-anvil'), interact(20), {
        save: eligible,
        transient: EMPTY_PUZZLE_TRANSIENT,
      }),
    ).toMatchObject({
      kind: 'completed',
      commands: [
        { kind: 'solve-puzzle', puzzleId: 'reliquary-forge-awakening' },
        { kind: 'unlock-ability', abilityId: 'resonant-pulse' },
        { kind: 'set-fact', factId: 'resonant-pulse-awakened' },
        { kind: 'upgrade-weapon', fromLevel: 1, toLevel: 2 },
        { kind: 'set-fact', factId: 'rootglass-edge-forged' },
      ],
    });
  });

  test('resets ordered puzzles on wrong input and immediately restarts on their first step', () => {
    const system = new PuzzleSystem();
    const baseline = save();
    const eligible = save({
      quests: {
        ...baseline.quests,
        flags: [stableId<'quest-flag'>('resonant-pulse-awakened')],
      },
    });
    const first = system.apply(stableId<'mechanism'>('east-lens-root-dial'), interact(0), {
      save: eligible,
      transient: EMPTY_PUZZLE_TRANSIENT,
    });
    expect(first.kind).toBe('advanced');
    const wrong = system.apply(stableId<'mechanism'>('east-lens-bloom-dial'), interact(1), {
      save: eligible,
      transient: first.transient,
    });
    expect(wrong.kind).toBe('advanced');
    expect(wrong.transient.entries[0]?.nextIndex).toBe(0);
    const restarted = system.apply(stableId<'mechanism'>('east-lens-root-dial'), interact(2), {
      save: eligible,
      transient: wrong.transient,
    });
    expect(restarted.transient.entries[0]?.nextIndex).toBe(1);
  });

  test('requires pulse, pulse, interact for the choir seal and ignores solved replay', () => {
    const system = new PuzzleSystem();
    const baseline = save();
    const eligible = save({
      player: {
        ...baseline.player,
        unlockedAbilities: [
          stableId<'ability'>('lumen-bolt'),
          stableId<'ability'>('resonant-pulse'),
        ],
      },
      quests: {
        ...baseline.quests,
        flags: [stableId<'quest-flag'>('resonant-pulse-awakened')],
      },
    });
    const memory = system.apply(stableId<'mechanism'>('gallery-memory-lens'), pulse(0), {
      save: eligible,
      transient: EMPTY_PUZZLE_TRANSIENT,
    });
    const breath = system.apply(stableId<'mechanism'>('gallery-breath-lens'), pulse(1), {
      save: eligible,
      transient: memory.transient,
    });
    const song = system.apply(stableId<'mechanism'>('gallery-song-lens'), interact(2), {
      save: eligible,
      transient: breath.transient,
    });
    expect(song).toMatchObject({
      kind: 'completed',
      commands: [{ kind: 'solve-puzzle', puzzleId: 'gallery-choir-seal' }],
    });

    const solved = {
      ...eligible,
      worldProgress: {
        ...eligible.worldProgress,
        solvedPuzzles: [stableId<'puzzle'>('gallery-choir-seal')],
      },
    };
    expect(
      system.apply(stableId<'mechanism'>('gallery-memory-lens'), pulse(3), {
        save: solved,
        transient: EMPTY_PUZZLE_TRANSIENT,
      }),
    ).toMatchObject({ kind: 'unchanged', commands: [] });
  });

  test('rejects unknown mechanisms, wrong activation, invalid time, and invalid saves', () => {
    const system = new PuzzleSystem();
    for (const result of [
      system.apply(stableId<'mechanism'>('unknown-mechanism'), interact(0), {
        save: save(),
        transient: EMPTY_PUZZLE_TRANSIENT,
      }),
      system.apply(stableId<'mechanism'>('vestibule-index-lock'), enter(0), {
        save: save(),
        transient: EMPTY_PUZZLE_TRANSIENT,
      }),
      system.apply(stableId<'mechanism'>('dash-circuit-dew-plate'), enter(-1), {
        save: save(),
        transient: EMPTY_PUZZLE_TRANSIENT,
      }),
      system.apply(stableId<'mechanism'>('dash-circuit-dew-plate'), enter(0), {
        save: { ...save(), schemaVersion: 2 } as never,
        transient: EMPTY_PUZZLE_TRANSIENT,
      }),
    ]) {
      expect(result).toMatchObject({ kind: 'rejected', commands: [] });
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.transient)).toBe(true);
    }
  });
});

function permutations<const Value extends readonly string[]>(values: Value): string[][] {
  if (values.length <= 1) return [[...values]];
  return values.flatMap((value, index) =>
    permutations(values.filter((_, candidate) => candidate !== index)).map((rest) => [
      value,
      ...rest,
    ]),
  );
}
