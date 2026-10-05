import type { StatusEffectId } from '../core/StableId';

export type StatusEffectSnapshot = Readonly<{
  statusId: StatusEffectId;
  expiresAtMs: number;
}>;

export class StatusEffects {
  private readonly expiry = new Map<StatusEffectId, number>();
  private lastObservedMs: number | null = null;

  public apply(statusId: StatusEffectId, durationMs: number, nowMs: number): void {
    this.assertTime(nowMs);
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      throw new RangeError('Status duration must be positive and finite.');
    }
    const expiresAtMs = nowMs + durationMs;
    if (!Number.isSafeInteger(expiresAtMs)) {
      throw new RangeError('Status expiry exceeds the supported range.');
    }
    this.expiry.set(statusId, expiresAtMs);
    this.lastObservedMs = nowMs;
  }

  public has(statusId: StatusEffectId, nowMs: number): boolean {
    return this.snapshot(nowMs).some((effect) => effect.statusId === statusId);
  }

  public remove(statusId: StatusEffectId, nowMs: number): boolean {
    this.snapshot(nowMs);
    return this.expiry.delete(statusId);
  }

  public snapshot(nowMs: number): readonly StatusEffectSnapshot[] {
    this.assertTime(nowMs);
    this.lastObservedMs = nowMs;
    for (const [statusId, expiresAtMs] of this.expiry) {
      if (nowMs >= expiresAtMs) this.expiry.delete(statusId);
    }
    return Object.freeze(
      [...this.expiry.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([statusId, expiresAtMs]) => Object.freeze({ statusId, expiresAtMs })),
    );
  }

  public clear(): boolean {
    if (this.expiry.size === 0) return false;
    this.expiry.clear();
    return true;
  }

  private assertTime(nowMs: number): void {
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new RangeError('Invalid simulation time.');
    if (this.lastObservedMs !== null && nowMs < this.lastObservedMs) {
      throw new RangeError('Simulation time cannot move backwards.');
    }
  }
}
