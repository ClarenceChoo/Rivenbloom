import type { CombatantId } from '../core/StableId';

export type AttackSlotClass = 'close' | 'ranged' | 'elite';

export type AttackSlotRequest = Readonly<{
  combatantId: CombatantId;
  slotClass: AttackSlotClass;
  pressureCost: 1 | 2;
  telegraphMs: number;
  activeMs: number;
}>;

export type AttackLease = Readonly<{
  combatantId: CombatantId;
  slotClass: AttackSlotClass;
  pressureCost: 1 | 2;
  sequence: number;
  grantedAtMs: number;
  expiresAtMs: number;
}>;

export type EncounterDirectorSnapshot = Readonly<{
  disposed: boolean;
  pressure: number;
  lastGranteeId: CombatantId | null;
  pending: readonly AttackSlotRequest[];
  leases: readonly AttackLease[];
}>;

const LEASE_SAFETY_MS = 100;

export class EncounterDirector {
  private readonly pending = new Map<CombatantId, AttackSlotRequest>();
  private readonly leases = new Map<CombatantId, AttackLease>();
  private lastGranteeId: CombatantId | null = null;
  private lastNowMs = 0;
  private nextSequence = 1;
  private disposed = false;

  public request(request: AttackSlotRequest, nowMs: number): AttackLease | null {
    this.assertUsable();
    this.assertTime(nowMs);
    assertRequest(request);
    this.expire(nowMs);

    const existing = this.leases.get(request.combatantId);
    if (existing !== undefined) return existing;
    this.pending.set(request.combatantId, freezeRequest(request));
    return (
      this.grantPending(nowMs).find(({ combatantId }) => combatantId === request.combatantId) ??
      null
    );
  }

  public advance(nowMs: number): readonly AttackLease[] {
    this.assertUsable();
    this.assertTime(nowMs);
    this.expire(nowMs);
    return Object.freeze(this.grantPending(nowMs));
  }

  public release(lease: AttackLease, nowMs: number): readonly AttackLease[] {
    if (this.disposed) return Object.freeze([]);
    this.assertTime(nowMs);
    this.expire(nowMs);
    const active = this.leases.get(lease.combatantId);
    if (active?.sequence === lease.sequence) this.leases.delete(lease.combatantId);
    return Object.freeze(this.grantPending(nowMs));
  }

  public withdraw(combatantId: CombatantId, nowMs: number): readonly AttackLease[] {
    return this.removeCombatant(combatantId, nowMs);
  }

  public interrupt(combatantId: CombatantId, nowMs: number): readonly AttackLease[] {
    return this.removeCombatant(combatantId, nowMs);
  }

  public sleep(combatantId: CombatantId, nowMs: number): readonly AttackLease[] {
    return this.removeCombatant(combatantId, nowMs);
  }

  public death(combatantId: CombatantId, nowMs: number): readonly AttackLease[] {
    return this.removeCombatant(combatantId, nowMs);
  }

  public snapshot(): EncounterDirectorSnapshot {
    const leases = [...this.leases.values()].sort((a, b) =>
      a.combatantId.localeCompare(b.combatantId),
    );
    const pending = [...this.pending.values()].sort((a, b) =>
      a.combatantId.localeCompare(b.combatantId),
    );
    return Object.freeze({
      disposed: this.disposed,
      pressure: leases.reduce((sum, lease) => sum + lease.pressureCost, 0),
      lastGranteeId: this.lastGranteeId,
      pending: Object.freeze(pending),
      leases: Object.freeze(leases),
    });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.pending.clear();
    this.leases.clear();
  }

  private removeCombatant(combatantId: CombatantId, nowMs: number): readonly AttackLease[] {
    if (this.disposed) return Object.freeze([]);
    this.assertTime(nowMs);
    this.expire(nowMs);
    this.pending.delete(combatantId);
    this.leases.delete(combatantId);
    return Object.freeze(this.grantPending(nowMs));
  }

  private expire(nowMs: number): void {
    for (const [combatantId, lease] of this.leases) {
      if (lease.expiresAtMs <= nowMs) this.leases.delete(combatantId);
    }
  }

  private grantPending(nowMs: number): AttackLease[] {
    const granted: AttackLease[] = [];
    const candidates = this.circularPending();
    for (const request of candidates) {
      if (!this.canGrant(request)) continue;
      const duration = request.telegraphMs + request.activeMs + LEASE_SAFETY_MS;
      if (!Number.isSafeInteger(duration) || !Number.isSafeInteger(nowMs + duration)) {
        throw new RangeError('Attack lease deadline exceeds the safe clock range.');
      }
      const lease = Object.freeze({
        combatantId: request.combatantId,
        slotClass: request.slotClass,
        pressureCost: request.pressureCost,
        sequence: this.nextSequence,
        grantedAtMs: nowMs,
        expiresAtMs: nowMs + duration,
      });
      this.nextSequence += 1;
      if (!Number.isSafeInteger(this.nextSequence)) {
        throw new RangeError('Attack lease sequence exceeded the safe range.');
      }
      this.pending.delete(request.combatantId);
      this.leases.set(request.combatantId, lease);
      this.lastGranteeId = request.combatantId;
      granted.push(lease);
    }
    return granted;
  }

  private circularPending(): readonly AttackSlotRequest[] {
    const sorted = [...this.pending.values()].sort((a, b) =>
      a.combatantId.localeCompare(b.combatantId),
    );
    if (this.lastGranteeId === null || sorted.length < 2) return sorted;
    const split = sorted.findIndex(({ combatantId }) => combatantId > this.lastGranteeId!);
    if (split < 0) return sorted;
    return [...sorted.slice(split), ...sorted.slice(0, split)];
  }

  private canGrant(request: AttackSlotRequest): boolean {
    const active = [...this.leases.values()];
    const pressure = active.reduce((sum, lease) => sum + lease.pressureCost, 0);
    if (pressure + request.pressureCost > 2) return false;
    if (request.slotClass === 'elite') return active.length === 0;
    if (active.some(({ slotClass }) => slotClass === 'elite')) return false;
    return !active.some(({ slotClass }) => slotClass === request.slotClass);
  }

  private assertTime(nowMs: number): void {
    if (!Number.isSafeInteger(nowMs) || nowMs < 0 || nowMs < this.lastNowMs) {
      throw new RangeError('Encounter time must be a monotonic non-negative safe integer.');
    }
    this.lastNowMs = nowMs;
  }

  private assertUsable(): void {
    if (this.disposed) throw new Error('Encounter director is disposed.');
  }
}

function assertRequest(request: AttackSlotRequest): void {
  if (!['close', 'ranged', 'elite'].includes(request.slotClass)) {
    throw new RangeError('Attack slot class is invalid.');
  }
  if (request.pressureCost !== 1 && request.pressureCost !== 2) {
    throw new RangeError('Attack pressure must be one or two.');
  }
  if (
    (request.slotClass === 'elite') !== (request.pressureCost === 2) ||
    !Number.isSafeInteger(request.telegraphMs) ||
    request.telegraphMs < 0 ||
    !Number.isSafeInteger(request.activeMs) ||
    request.activeMs <= 0
  ) {
    throw new RangeError('Attack slot request has invalid timing or pressure.');
  }
}

function freezeRequest(request: AttackSlotRequest): AttackSlotRequest {
  return Object.freeze({ ...request });
}
