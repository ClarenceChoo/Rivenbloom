import {
  resolveResonantPulseTargets,
  type AreaStatusDirective,
  type ResonantTarget
} from '../abilities/AbilitySystem';
import type { PointDefinition } from '../data/types';
import type { DamageResult, DefenseSnapshot } from './CombatTypes';
import {
  COMBAT_STATUS_DEFINITIONS,
  advanceStatuses,
  applyStatus,
  createStatusState,
  resolveDamageWithStatusHooks,
  type DamageSourceSnapshot,
  type StatusDefinition,
  type StatusState
} from './StatusEffects';

export type CombatRuntimeTarget = Omit<ResonantTarget, 'distance'> & {
  readonly position: PointDefinition;
};

export type CombatRuntimeOutput =
  | {
      readonly kind: 'status-applied';
      readonly targetId: string;
      readonly statusId: string;
      readonly sourceId: string;
      readonly expiresAtFrame: number;
    }
  | {
      readonly kind: 'status-expired';
      readonly targetId: string;
      readonly statusId: string;
    }
  | {
      readonly kind: 'mechanism-requested';
      readonly targetId: string;
      readonly mechanismHookId: string;
      readonly sourceId: string;
    };

const distanceBetween = (left: PointDefinition, right: PointDefinition): number =>
  Math.hypot(right.x - left.x, right.y - left.y);

export class CombatAbilityRuntime {
  private readonly targets = new Map<string, CombatRuntimeTarget>();
  private readonly statuses = new Map<string, StatusState>();

  public constructor(targets: readonly CombatRuntimeTarget[]) {
    for (const target of targets) {
      this.targets.set(target.id, target);
      if (target.kind === 'enemy') this.statuses.set(target.id, createStatusState());
    }
  }

  public applyAreaStatus(
    directive: AreaStatusDirective,
    origin: PointDefinition,
    sourceId: string
  ): readonly CombatRuntimeOutput[] {
    const targets = [...this.targets.values()].map(
      (target): ResonantTarget => ({
        id: target.id,
        kind: target.kind,
        tags: target.tags,
        distance: distanceBetween(origin, target.position)
      })
    );
    return resolveResonantPulseTargets(directive, targets).flatMap(
      (hook): readonly CombatRuntimeOutput[] => {
        if (hook.kind === 'awaken-mechanism') {
          return [
            {
              kind: 'mechanism-requested',
              targetId: hook.targetId,
              mechanismHookId: hook.mechanismHookId,
              sourceId
            }
          ];
        }
        const authored = COMBAT_STATUS_DEFINITIONS.find(({ id }) => id === hook.statusId);
        if (authored === undefined) return [];
        const definition = { ...authored, durationFrames: hook.durationFrames };
        const state = this.applyStatus(hook.targetId, definition, sourceId);
        const effect = state.effects.find(({ definition: active }) => active.id === hook.statusId);
        return effect === undefined
          ? []
          : [
              {
                kind: 'status-applied',
                targetId: hook.targetId,
                statusId: hook.statusId,
                sourceId,
                expiresAtFrame: effect.expiresAtFrame
              }
            ];
      }
    );
  }

  public applyStatus(
    targetId: string,
    definition: StatusDefinition,
    sourceId: string
  ): StatusState {
    const current = this.statuses.get(targetId) ?? createStatusState();
    const next = applyStatus(current, definition, sourceId);
    this.statuses.set(targetId, next);
    return next;
  }

  public advance(frames = 1): readonly CombatRuntimeOutput[] {
    const outputs: CombatRuntimeOutput[] = [];
    for (const [targetId, current] of this.statuses) {
      const next = advanceStatuses(current, frames);
      for (const effect of current.effects) {
        if (next.effects.some(({ definition }) => definition.id === effect.definition.id)) continue;
        outputs.push({
          kind: 'status-expired',
          targetId,
          statusId: effect.definition.id
        });
      }
      this.statuses.set(targetId, next);
    }
    return outputs;
  }

  public statusState(targetId: string): StatusState {
    return this.statuses.get(targetId) ?? createStatusState();
  }

  public resolveDamage(
    targetId: string,
    source: DamageSourceSnapshot,
    defense: DefenseSnapshot
  ): DamageResult {
    return resolveDamageWithStatusHooks(
      source,
      defense,
      this.statuses.get(targetId) ?? createStatusState()
    );
  }
}
