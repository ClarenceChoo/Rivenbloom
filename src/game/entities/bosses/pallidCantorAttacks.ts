import { stableId } from '../../core/StableId';
import type { AttackId, Rect } from '../../data/types';
import { deepFreeze } from '../../data/immutability';

export type PallidCantorAttackProgram = Readonly<{
  attackId: AttackId;
  totalSteps: number;
  telegraph: readonly Readonly<{ from: number; to: number }>[];
  active: readonly Readonly<{ from: number; to: number }>[];
  emissions: readonly number[];
}>;

export const PALLID_CANTOR_PHASE_ONE_ATTACKS = ids([
  'pallid-cantor-note-volley',
  'pallid-cantor-fan-sweep',
  'pallid-cantor-chime-slam',
  'pallid-cantor-spearfall',
]);

export const PALLID_CANTOR_PHASE_TWO_ATTACKS = ids([
  'pallid-cantor-inversion-fan',
  'pallid-cantor-note-chain',
  'pallid-cantor-hover-chime',
  'pallid-cantor-spear-cascade',
]);

export const PALLID_CANTOR_ATTACK_PROGRAMS: readonly PallidCantorAttackProgram[] = deepFreeze([
  program('pallid-cantor-note-volley', 84, [[0, 29]], [], [30, 40, 50]),
  program('pallid-cantor-fan-sweep', 72, [[0, 29]], [[30, 37]]),
  program('pallid-cantor-chime-slam', 78, [[0, 35]], [[36, 41]]),
  program('pallid-cantor-spearfall', 96, [[0, 41]], [[42, 49]], [42]),
  program(
    'pallid-cantor-inversion-fan',
    108,
    [
      [0, 35],
      [42, 59],
    ],
    [
      [36, 41],
      [60, 65],
    ],
  ),
  program('pallid-cantor-note-chain', 96, [[0, 23]], [], [24, 33, 42, 51, 60]),
  program('pallid-cantor-hover-chime', 90, [[0, 41]], [[42, 47]]),
  program(
    'pallid-cantor-spear-cascade',
    120,
    [
      [0, 29],
      [36, 53],
      [60, 77],
    ],
    [
      [30, 35],
      [54, 59],
      [78, 83],
    ],
    [30, 54, 78],
  ),
]);

export const INVERSION_FAN_ZONES: readonly Rect[] = deepFreeze([
  { x: 192, y: 300, width: 480, height: 600 },
  { x: 1248, y: 300, width: 480, height: 600 },
  { x: 576, y: 300, width: 768, height: 600 },
]);

export function spearLaneIndices(rotation: number): readonly number[] {
  if (!Number.isSafeInteger(rotation) || rotation < 0)
    throw new RangeError('Invalid spear rotation.');
  return Object.freeze([0, 2, 4].map((index) => (index + rotation) % 5));
}

function ids(values: readonly string[]): readonly AttackId[] {
  return Object.freeze(values.map((value) => stableId<'attack'>(value)));
}

function program(
  attackId: string,
  totalSteps: number,
  telegraph: readonly (readonly [number, number])[],
  active: readonly (readonly [number, number])[],
  emissions: readonly number[] = [],
): PallidCantorAttackProgram {
  return {
    attackId: stableId<'attack'>(attackId),
    totalSteps,
    telegraph: telegraph.map(([from, to]) => ({ from, to })),
    active: active.map(([from, to]) => ({ from, to })),
    emissions: [...emissions],
  };
}
