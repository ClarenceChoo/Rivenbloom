export type AttackerKind = 'melee' | 'ranged';

export type AttackRequest = {
  readonly kind: AttackerKind;
  readonly cooldownFrames: number;
  readonly onCamera: boolean;
};

export type AttackGrant =
  | { readonly granted: true }
  | {
      readonly granted: false;
      readonly reason: 'inactive' | 'offscreen' | 'cooling-down' | 'slots-full';
    };

type AttackerRecord = {
  active: boolean;
  holdingSlot: boolean;
  cooldownRemaining: number;
};

const DEFAULT_MAX_SIMULTANEOUS_ATTACKERS = 2;

export class EncounterDirector {
  private readonly attackers = new Map<string, AttackerRecord>();
  private readonly maxSimultaneousAttackers: number;

  public constructor(options: { readonly maxSimultaneousAttackers?: number } = {}) {
    this.maxSimultaneousAttackers = Math.max(
      1,
      options.maxSimultaneousAttackers ?? DEFAULT_MAX_SIMULTANEOUS_ATTACKERS
    );
  }

  public register(enemyId: string): void {
    if (this.attackers.has(enemyId)) return;
    this.attackers.set(enemyId, { active: true, holdingSlot: false, cooldownRemaining: 0 });
  }

  public get activeAttackerIds(): readonly string[] {
    return [...this.attackers.entries()]
      .filter(([, record]) => record.holdingSlot)
      .map(([enemyId]) => enemyId);
  }

  public requestAttack(enemyId: string, request: AttackRequest): AttackGrant {
    const record = this.attackers.get(enemyId);
    if (record === undefined || !record.active) return { granted: false, reason: 'inactive' };
    if (record.holdingSlot) return { granted: true };
    if (!request.onCamera) return { granted: false, reason: 'offscreen' };
    if (record.cooldownRemaining > 0) return { granted: false, reason: 'cooling-down' };
    if (this.activeAttackerIds.length >= this.maxSimultaneousAttackers) {
      return { granted: false, reason: 'slots-full' };
    }
    record.holdingSlot = true;
    record.cooldownRemaining = Math.max(0, request.cooldownFrames);
    return { granted: true };
  }

  public releaseAttack(enemyId: string): void {
    const record = this.attackers.get(enemyId);
    if (record === undefined) return;
    record.holdingSlot = false;
  }

  public deactivate(enemyId: string): void {
    const record = this.attackers.get(enemyId);
    if (record === undefined) return;
    record.active = false;
    record.holdingSlot = false;
  }

  public advance(frames = 1): void {
    const elapsed = Math.max(0, Math.floor(frames));
    for (const record of this.attackers.values()) {
      if (record.holdingSlot) continue;
      record.cooldownRemaining = Math.max(0, record.cooldownRemaining - elapsed);
    }
  }
}
