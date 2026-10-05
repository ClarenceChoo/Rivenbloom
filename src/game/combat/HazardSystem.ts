import type { CombatantId, HazardId } from '../core/StableId';

type Contact = { overlapping: boolean; lastHitAtMs: number };

export class HazardSystem {
  private readonly contacts = new Map<string, Contact>();
  private lastObservedMs: number | null = null;

  public sample(
    hazardId: HazardId,
    targetId: CombatantId,
    overlapping: boolean,
    nowMs: number,
    rehitIntervalMs: number,
  ): boolean {
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new RangeError('Invalid simulation time.');
    if (!Number.isFinite(rehitIntervalMs) || rehitIntervalMs <= 0) {
      throw new RangeError('Hazard re-hit interval must be positive and finite.');
    }
    if (this.lastObservedMs !== null && nowMs < this.lastObservedMs) {
      throw new RangeError('Simulation time cannot move backwards.');
    }
    this.lastObservedMs = nowMs;
    const key = `${hazardId}:${targetId}`;
    const contact = this.contacts.get(key);
    if (!overlapping) {
      this.contacts.delete(key);
      return false;
    }
    if (contact === undefined || !contact.overlapping) {
      this.contacts.set(key, { overlapping: true, lastHitAtMs: nowMs });
      return true;
    }
    if (nowMs - contact.lastHitAtMs < rehitIntervalMs) return false;
    contact.lastHitAtMs = nowMs;
    return true;
  }
}
