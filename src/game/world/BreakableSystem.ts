import type { TeamId } from '../core/StableId';
import { CONTENT_REGISTRY } from '../data/areas';
import { deepFreeze } from '../data/immutability';
import type { AttackId, BreakableDefinition, BreakableId, ContentRegistry } from '../data/types';
import { validateSaveV1 } from '../saves/SaveSchema';
import type { SaveV1 } from '../saves/SaveSchema';
import type { ProgressionCommand } from './WorldProgression';

export type BreakableActivation = Readonly<{
  teamId: TeamId;
  attackId: AttackId;
  healthDamage: number;
}>;

export type BreakableResult = Readonly<{
  kind: 'activated' | 'unchanged' | 'rejected';
  commands: readonly ProgressionCommand[];
}>;

const EMPTY_COMMANDS = Object.freeze([]) satisfies readonly ProgressionCommand[];
const UNCHANGED = deepFreeze({ kind: 'unchanged', commands: EMPTY_COMMANDS } as const);
const REJECTED = deepFreeze({ kind: 'rejected', commands: EMPTY_COMMANDS } as const);

export class BreakableSystem {
  private readonly byId: ReadonlyMap<BreakableId, BreakableDefinition>;

  public constructor(registry: ContentRegistry = CONTENT_REGISTRY) {
    this.byId = new Map(
      registry.areas.flatMap(({ breakables }) =>
        breakables.map((breakable) => [breakable.breakableId, breakable] as const),
      ),
    );
  }

  public apply(
    breakableId: BreakableId,
    activation: BreakableActivation,
    save: SaveV1,
  ): BreakableResult {
    const definition = this.byId.get(breakableId);
    const validated = validateSaveV1(save);
    if (
      definition === undefined ||
      validated.kind === 'invalid' ||
      activation.teamId !== 'player' ||
      !Number.isFinite(activation.healthDamage) ||
      activation.healthDamage <= 0 ||
      !definition.acceptedAttackIds.includes(activation.attackId)
    ) {
      return REJECTED;
    }
    if (validated.value.worldProgress.activatedShortcuts.includes(definition.shortcutId)) {
      return UNCHANGED;
    }
    return deepFreeze({
      kind: 'activated',
      commands: [
        { kind: 'activate-shortcut', shortcutId: definition.shortcutId },
      ] satisfies readonly ProgressionCommand[],
    });
  }
}
