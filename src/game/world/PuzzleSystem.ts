import { isStableId } from '../core/StableId';
import type { MechanismId } from '../data/types';
import { PUZZLES } from '../data/areas';
import { deepFreeze } from '../data/immutability';
import type {
  PuzzleActivation as PuzzleActivationKind,
  PuzzleDefinition,
  PuzzleProgramDefinition,
  PuzzleStepDefinition,
} from '../data/types';
import { validateSaveV1 } from '../saves/SaveSchema';
import type { PuzzleId, SaveV1 } from '../saves/SaveSchema';
import type { ProgressionCommand } from './WorldProgression';
import { matchesWorldPredicate } from './WorldPredicates';

export type PuzzleActivation = Readonly<{
  kind: PuzzleActivationKind;
  nowMs: number;
}>;

export type PuzzleTransientEntry = Readonly<{
  puzzleId: PuzzleId;
  startedAtMs: number | null;
  lastObservedAtMs: number;
  activatedMechanismIds: readonly MechanismId[];
  nextIndex: number;
}>;

export type PuzzleTransientSnapshot = Readonly<{
  entries: readonly PuzzleTransientEntry[];
}>;

export type PuzzleWorldState = Readonly<{
  save: SaveV1;
  transient: PuzzleTransientSnapshot;
}>;

export type PuzzleResult = Readonly<{
  kind: 'advanced' | 'completed' | 'unchanged' | 'rejected';
  transient: PuzzleTransientSnapshot;
  commands: readonly ProgressionCommand[];
}>;

const EMPTY_COMMANDS = Object.freeze([]) satisfies readonly ProgressionCommand[];
export const EMPTY_PUZZLE_TRANSIENT: PuzzleTransientSnapshot = deepFreeze({ entries: [] });

export class PuzzleSystem {
  private readonly byMechanism: ReadonlyMap<
    MechanismId,
    Readonly<{ puzzle: PuzzleDefinition; step: PuzzleStepDefinition }>
  >;

  public constructor(definitions: readonly PuzzleDefinition[] = PUZZLES) {
    const byMechanism = new Map<
      MechanismId,
      Readonly<{ puzzle: PuzzleDefinition; step: PuzzleStepDefinition }>
    >();
    for (const puzzle of definitions) {
      for (const step of stepsFor(puzzle)) byMechanism.set(step.mechanismId, { puzzle, step });
    }
    this.byMechanism = byMechanism;
  }

  public apply(
    mechanismId: MechanismId,
    activation: PuzzleActivation,
    worldState: PuzzleWorldState,
  ): PuzzleResult {
    if (!validTime(activation.nowMs) || !validTransient(worldState.transient)) {
      return result('rejected', worldState.transient);
    }
    const validated = validateSaveV1(worldState.save);
    if (validated.kind === 'invalid') return result('rejected', worldState.transient);
    const match = this.byMechanism.get(mechanismId);
    if (match === undefined || match.step.activation !== activation.kind) {
      return result('rejected', worldState.transient);
    }
    const { puzzle } = match;
    if (validated.value.worldProgress.solvedPuzzles.includes(puzzle.puzzleId)) {
      return result('unchanged', worldState.transient);
    }
    if (!matchesWorldPredicate(puzzle.predicate, validated.value)) {
      return result('rejected', worldState.transient);
    }
    if (
      puzzle.program.kind === 'single' &&
      puzzle.program.requiredWeaponLevel !== null &&
      validated.value.player.weaponLevel !== puzzle.program.requiredWeaponLevel
    ) {
      return result('rejected', worldState.transient);
    }

    const entry = worldState.transient.entries.find(({ puzzleId }) => puzzleId === puzzle.puzzleId);
    if (entry !== undefined && activation.nowMs < entry.lastObservedAtMs) {
      return result('rejected', worldState.transient);
    }

    switch (puzzle.program.kind) {
      case 'item-lock':
      case 'single':
        return complete(puzzle, worldState.transient);
      case 'timed-set':
        return this.applyTimedSet(
          puzzle,
          puzzle.program,
          mechanismId,
          activation.nowMs,
          worldState.transient,
          entry,
        );
      case 'ordered':
        return this.applyOrdered(
          puzzle,
          puzzle.program,
          mechanismId,
          activation.nowMs,
          worldState.transient,
          entry,
        );
    }
  }

  private applyTimedSet(
    puzzle: PuzzleDefinition,
    program: Extract<PuzzleProgramDefinition, { kind: 'timed-set' }>,
    mechanismId: MechanismId,
    nowMs: number,
    transient: PuzzleTransientSnapshot,
    current: PuzzleTransientEntry | undefined,
  ): PuzzleResult {
    const expired =
      current !== undefined &&
      current.startedAtMs !== null &&
      nowMs - current.startedAtMs > program.windowMs;
    const active = expired ? undefined : current;
    if (active?.activatedMechanismIds.includes(mechanismId) === true) {
      return result('unchanged', replaceEntry(transient, { ...active, lastObservedAtMs: nowMs }));
    }

    const activatedMechanismIds = [...(active?.activatedMechanismIds ?? []), mechanismId];
    if (activatedMechanismIds.length === program.steps.length) {
      return complete(puzzle, transient);
    }
    return result(
      'advanced',
      replaceEntry(transient, {
        puzzleId: puzzle.puzzleId,
        startedAtMs: active?.startedAtMs ?? nowMs,
        lastObservedAtMs: nowMs,
        activatedMechanismIds,
        nextIndex: 0,
      }),
    );
  }

  private applyOrdered(
    puzzle: PuzzleDefinition,
    program: Extract<PuzzleProgramDefinition, { kind: 'ordered' }>,
    mechanismId: MechanismId,
    nowMs: number,
    transient: PuzzleTransientSnapshot,
    current: PuzzleTransientEntry | undefined,
  ): PuzzleResult {
    const nextIndex = current?.nextIndex ?? 0;
    const expected = program.steps[nextIndex]?.mechanismId;
    const first = program.steps[0]?.mechanismId;
    const advancedIndex = mechanismId === expected ? nextIndex + 1 : mechanismId === first ? 1 : 0;
    if (advancedIndex === program.steps.length) return complete(puzzle, transient);
    return result(
      'advanced',
      replaceEntry(transient, {
        puzzleId: puzzle.puzzleId,
        startedAtMs: current?.startedAtMs ?? nowMs,
        lastObservedAtMs: nowMs,
        activatedMechanismIds: program.steps
          .slice(0, advancedIndex)
          .map(({ mechanismId: id }) => id),
        nextIndex: advancedIndex,
      }),
    );
  }
}

function complete(puzzle: PuzzleDefinition, transient: PuzzleTransientSnapshot): PuzzleResult {
  return result(
    'completed',
    deepFreeze({
      entries: transient.entries.filter(({ puzzleId }) => puzzleId !== puzzle.puzzleId),
    }),
    deepFreeze([
      { kind: 'solve-puzzle', puzzleId: puzzle.puzzleId },
      ...puzzle.rewardCommands,
    ] satisfies readonly ProgressionCommand[]),
  );
}

function result(
  kind: PuzzleResult['kind'],
  transient: PuzzleTransientSnapshot,
  commands: readonly ProgressionCommand[] = EMPTY_COMMANDS,
): PuzzleResult {
  return deepFreeze({ kind, transient, commands });
}

function replaceEntry(
  transient: PuzzleTransientSnapshot,
  entry: PuzzleTransientEntry,
): PuzzleTransientSnapshot {
  return deepFreeze({
    entries: [
      ...transient.entries.filter(({ puzzleId }) => puzzleId !== entry.puzzleId),
      entry,
    ].sort((left, right) =>
      left.puzzleId < right.puzzleId ? -1 : left.puzzleId > right.puzzleId ? 1 : 0,
    ),
  });
}

function stepsFor(puzzle: PuzzleDefinition): readonly PuzzleStepDefinition[] {
  return puzzle.program.kind === 'item-lock' || puzzle.program.kind === 'single'
    ? [puzzle.program.step]
    : puzzle.program.steps;
}

function validTransient(transient: PuzzleTransientSnapshot): boolean {
  if (transient === null || typeof transient !== 'object' || !Array.isArray(transient.entries)) {
    return false;
  }
  const puzzleIds = new Set<string>();
  return transient.entries.every((entry) => {
    if (
      entry === null ||
      typeof entry !== 'object' ||
      !isStableId(entry.puzzleId) ||
      puzzleIds.has(entry.puzzleId) ||
      (entry.startedAtMs !== null && !validTime(entry.startedAtMs)) ||
      !validTime(entry.lastObservedAtMs) ||
      !Number.isSafeInteger(entry.nextIndex) ||
      entry.nextIndex < 0 ||
      !Array.isArray(entry.activatedMechanismIds) ||
      entry.activatedMechanismIds.some((id: unknown) => !isStableId(id))
    ) {
      return false;
    }
    puzzleIds.add(entry.puzzleId);
    return true;
  });
}

function validTime(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
