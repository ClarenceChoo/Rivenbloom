import type { AbilityId } from '../combat/CombatTypes';

export type AbilityCooldown = {
  readonly id: AbilityId;
  readonly cooldownMs: number;
};

export class CooldownTracker {
  private readonly cooldowns: ReadonlyMap<AbilityId, number>;
  private readonly lastUsedAt = new Map<AbilityId, number>();
  private latestObservedAt: number | undefined;

  public constructor(cooldowns: readonly AbilityCooldown[]) {
    this.cooldowns = new Map(
      cooldowns.map(({ id, cooldownMs }) => {
        if (!Number.isFinite(cooldownMs) || cooldownMs < 0) {
          throw new RangeError(`Ability ${id} requires a finite non-negative cooldown.`);
        }

        return [id, cooldownMs];
      })
    );
  }

  public tryUse(id: AbilityId, nowMs: number): boolean {
    if (
      !Number.isFinite(nowMs) ||
      (this.latestObservedAt !== undefined && nowMs < this.latestObservedAt)
    ) {
      return false;
    }

    this.latestObservedAt = nowMs;
    const cooldownMs = this.cooldowns.get(id);
    if (cooldownMs === undefined) {
      return false;
    }

    const previousUse = this.lastUsedAt.get(id);
    if (previousUse !== undefined && nowMs < previousUse + cooldownMs) {
      return false;
    }

    this.lastUsedAt.set(id, nowMs);
    return true;
  }
}
