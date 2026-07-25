export type StableId<TName extends string> = string & {
  readonly __stableId: TName;
};

export type AbilityId = StableId<'ability'>;
export type ItemId = StableId<'item'>;
export type DamageTypeId = StableId<'damage-type'>;
export type QuestId = StableId<'quest'>;
export type QuestStageId = StableId<'quest-stage'>;

const stableIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const isStableId = (value: string): boolean => stableIdPattern.test(value);

export const parseStableId = <TName extends string>(value: string): StableId<TName> | undefined =>
  isStableId(value) ? (value as StableId<TName>) : undefined;

export const stableId = <TName extends string>(kind: string, value: string): StableId<TName> => {
  const parsed = parseStableId<TName>(value);
  if (parsed === undefined) {
    throw new Error(`Invalid ${kind} ID "${value}": expected lowercase-kebab-case.`);
  }

  return parsed;
};

export const parseAbilityId = (value: string): AbilityId | undefined =>
  parseStableId<'ability'>(value);
export const parseItemId = (value: string): ItemId | undefined => parseStableId<'item'>(value);
export const parseDamageTypeId = (value: string): DamageTypeId | undefined =>
  parseStableId<'damage-type'>(value);
export const parseQuestId = (value: string): QuestId | undefined => parseStableId<'quest'>(value);
export const parseQuestStageId = (value: string): QuestStageId | undefined =>
  parseStableId<'quest-stage'>(value);

export const abilityId = (value: string): AbilityId => stableId<'ability'>('ability', value);
export const itemId = (value: string): ItemId => stableId<'item'>('item', value);
export const damageTypeId = (value: string): DamageTypeId =>
  stableId<'damage-type'>('damage type', value);
export const questId = (value: string): QuestId => stableId<'quest'>('quest', value);
export const questStageId = (value: string): QuestStageId =>
  stableId<'quest-stage'>('quest stage', value);

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
