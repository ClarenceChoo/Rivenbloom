export type StableId<TName extends string> = string & {
  readonly __stableId: TName;
};

export type AbilityId = StableId<'ability'>;
export type ItemId = StableId<'item'>;
export type DamageTypeId = StableId<'damage-type'>;
export type QuestId = StableId<'quest'>;
export type QuestStageId = StableId<'quest-stage'>;

export type GuardSnapshot =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'block';
      readonly damageMultiplier: number;
      readonly poiseMultiplier: number;
      readonly knockbackMultiplier: number;
    }
  | { readonly kind: 'parry' };

export type DamagePacket = {
  readonly amount: number;
  readonly damageType: DamageTypeId;
  readonly criticalMultiplier: number;
  readonly poiseDamage: number;
  readonly knockback: number;
};

export type DefenseSnapshot = {
  readonly armor: number;
  readonly resistances: Readonly<Partial<Record<DamageTypeId, number>>>;
  readonly guard: GuardSnapshot;
  readonly invulnerable: boolean;
};

export type DamageResult = {
  readonly healthDamage: number;
  readonly poiseDamage: number;
  readonly knockback: number;
  readonly criticalApplied: boolean;
  readonly blocked: boolean;
  readonly parried: boolean;
  readonly invulnerable: boolean;
};
