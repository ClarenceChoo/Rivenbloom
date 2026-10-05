import { isStableId } from '../core/StableId';
import type { AbilityId } from '../core/StableId';

export type AbilityCooldownDefinitions = Readonly<Record<AbilityId, number>>;

export type CooldownSnapshot = Readonly<{
  lastObservedMs: number | null;
  readyAt: readonly Readonly<{
    abilityId: AbilityId;
    readyAtMs: number;
  }>[];
}>;

const maximumMilliseconds = Number.MAX_SAFE_INTEGER;

export class CooldownTracker {
  private readonly durations = new Map<AbilityId, number>();
  private readonly readyAtMs = new Map<AbilityId, number>();
  private lastObservedMs: number | null = null;

  public constructor(definitions: AbilityCooldownDefinitions) {
    for (const [id, durationMs] of Object.entries(definitions)) {
      if (!isStableId(id)) {
        throw new RangeError('Ability ID must be a stable ID.');
      }

      assertMilliseconds(durationMs, 'Cooldown duration');
      this.durations.set(id as AbilityId, durationMs);
    }
  }

  public tryUse(id: AbilityId, nowMs: number): boolean {
    if (!isStableId(id) || !this.durations.has(id)) {
      throw new RangeError(`Unknown ability: ${id}`);
    }

    assertMilliseconds(nowMs, 'Cooldown time');

    if (this.lastObservedMs !== null && nowMs < this.lastObservedMs) {
      throw new RangeError('Cooldown time cannot move backwards.');
    }

    const readyAtMs = this.readyAtMs.get(id);

    if (readyAtMs !== undefined && nowMs < readyAtMs) {
      this.lastObservedMs = nowMs;
      return false;
    }

    const durationMs = this.durations.get(id);

    if (durationMs === undefined) {
      throw new RangeError(`Unknown ability: ${id}`);
    }

    const nextReadyAtMs = nowMs + durationMs;

    if (!Number.isFinite(nextReadyAtMs) || nextReadyAtMs > maximumMilliseconds) {
      throw new RangeError('Cooldown readiness exceeds the supported range.');
    }

    this.readyAtMs.set(id, nextReadyAtMs);
    this.lastObservedMs = nowMs;
    return true;
  }

  public snapshot(): CooldownSnapshot {
    const readyAt = [...this.readyAtMs.entries()]
      .map(([abilityId, readyAtMs]) => ({ abilityId, readyAtMs }))
      .sort(compareAbilityReadiness);

    return {
      lastObservedMs: this.lastObservedMs,
      readyAt,
    };
  }
}

function assertMilliseconds(value: unknown, label: string): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > maximumMilliseconds
  ) {
    throw new RangeError(
      `${label} must be a non-negative finite number within the supported range.`,
    );
  }
}

function compareAbilityReadiness(
  left: Readonly<{ abilityId: AbilityId }>,
  right: Readonly<{ abilityId: AbilityId }>,
): number {
  if (left.abilityId < right.abilityId) {
    return -1;
  }

  if (left.abilityId > right.abilityId) {
    return 1;
  }

  return 0;
}
