import type { MechanismDefinition } from '../data/types';

export type PuzzleActivation = {
  readonly kind: 'interact' | 'ability';
  readonly abilityId?: string;
};

export type PuzzleWorldState = {
  readonly solvedPuzzleIds: readonly string[];
  readonly activatedShortcutIds: readonly string[];
  readonly unlockedAbilities: readonly string[];
};

export type PuzzleResult =
  | {
      readonly kind: 'solved';
      readonly mechanismId: string;
      readonly mechanismKind: MechanismDefinition['kind'];
      readonly persistentFlagId: string;
      readonly firstSolve: boolean;
      readonly questId?: string;
      readonly rewardItemId?: string;
    }
  | {
      readonly kind: 'rejected';
      readonly reason: 'unknown-mechanism' | 'missing-ability' | 'wrong-activation';
    };

/** Mechanism kinds a plain interaction press can operate. */
const INTERACT_KINDS: readonly MechanismDefinition['kind'][] = [
  'listening-arch',
  'shortcut',
  'seed-lantern',
  'rootglass-forge'
];

export class PuzzleSystem {
  public constructor(private readonly mechanisms: readonly MechanismDefinition[]) {}

  /**
   * Applies an activation to a mechanism. Lenses only answer the ability that
   * wakes them; everything else answers an interaction press. Solves are
   * idempotent — replays report firstSolve: false and grant nothing again.
   */
  public apply(
    mechanismId: string,
    activation: PuzzleActivation,
    worldState: PuzzleWorldState
  ): PuzzleResult {
    const mechanism = this.mechanisms.find(({ id }) => id === mechanismId);
    if (mechanism === undefined) return { kind: 'rejected', reason: 'unknown-mechanism' };
    if (mechanism.kind === 'lens') {
      if (activation.kind !== 'ability') return { kind: 'rejected', reason: 'wrong-activation' };
    } else if (activation.kind !== 'interact' || !INTERACT_KINDS.includes(mechanism.kind)) {
      return { kind: 'rejected', reason: 'wrong-activation' };
    }
    if (mechanism.requiredAbilityId !== undefined) {
      const satisfied =
        activation.abilityId === mechanism.requiredAbilityId ||
        (activation.kind === 'interact' &&
          worldState.unlockedAbilities.includes(mechanism.requiredAbilityId));
      if (!satisfied) return { kind: 'rejected', reason: 'missing-ability' };
    }
    if (mechanism.kind === 'lens' && activation.abilityId !== 'resonant-pulse') {
      return { kind: 'rejected', reason: 'missing-ability' };
    }
    const solvedSet =
      mechanism.kind === 'shortcut' ? worldState.activatedShortcutIds : worldState.solvedPuzzleIds;
    const firstSolve = !solvedSet.includes(mechanism.persistentFlagId);
    return {
      kind: 'solved',
      mechanismId: mechanism.id,
      mechanismKind: mechanism.kind,
      persistentFlagId: mechanism.persistentFlagId,
      firstSolve,
      ...(mechanism.questId === undefined ? {} : { questId: mechanism.questId }),
      ...(mechanism.rewardItemId === undefined || !firstSolve
        ? {}
        : { rewardItemId: mechanism.rewardItemId })
    };
  }
}
