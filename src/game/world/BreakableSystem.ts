import type { BreakableDefinition, DamageType } from '../data/types';

export type { BreakableDefinition };

export type BreakableHit = {
  readonly amount: number;
  readonly damageType: DamageType;
};

export type BreakableResult =
  | { readonly kind: 'unknown-breakable' }
  | { readonly kind: 'resisted'; readonly breakableId: string }
  | { readonly kind: 'already-broken'; readonly breakableId: string }
  | {
      readonly kind: 'damaged';
      readonly breakableId: string;
      readonly remainingHealth: number;
    }
  | {
      readonly kind: 'broken';
      readonly breakableId: string;
      readonly persistentFlagId: string;
    };

export class BreakableSystem {
  private readonly remaining = new Map<string, number>();
  private readonly broken: Set<string>;

  public constructor(
    private readonly breakables: readonly BreakableDefinition[],
    brokenFlagIds: readonly string[] = []
  ) {
    this.broken = new Set(
      breakables
        .filter(({ persistentFlagId }) => brokenFlagIds.includes(persistentFlagId))
        .map(({ id }) => id)
    );
    for (const breakable of breakables) {
      if (!this.broken.has(breakable.id)) this.remaining.set(breakable.id, breakable.health);
    }
  }

  public get brokenFlagIds(): readonly string[] {
    return this.breakables
      .filter(({ id }) => this.broken.has(id))
      .map(({ persistentFlagId }) => persistentFlagId)
      .sort();
  }

  public isBroken(breakableId: string): boolean {
    return this.broken.has(breakableId);
  }

  public applyHit(breakableId: string, hit: BreakableHit): BreakableResult {
    const breakable = this.breakables.find(({ id }) => id === breakableId);
    if (breakable === undefined) return { kind: 'unknown-breakable' };
    if (this.broken.has(breakableId)) return { kind: 'already-broken', breakableId };
    if (
      breakable.requiredDamageType !== undefined &&
      hit.damageType !== breakable.requiredDamageType
    ) {
      return { kind: 'resisted', breakableId };
    }
    const remaining = Math.max(
      0,
      (this.remaining.get(breakableId) ?? breakable.health) - Math.max(0, hit.amount)
    );
    if (remaining > 0) {
      this.remaining.set(breakableId, remaining);
      return { kind: 'damaged', breakableId, remainingHealth: remaining };
    }
    this.remaining.delete(breakableId);
    this.broken.add(breakableId);
    return { kind: 'broken', breakableId, persistentFlagId: breakable.persistentFlagId };
  }
}
