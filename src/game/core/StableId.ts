declare const stableIdKind: unique symbol;

export type StableId<Kind extends string> = string & {
  readonly [stableIdKind]: Kind;
};

export type DamageTypeId = StableId<'damage-type'>;
export type AbilityId = StableId<'ability'>;
export type ItemId = StableId<'item'>;
export type EquipmentSlotId = StableId<'equipment-slot'>;
export type QuestId = StableId<'quest'>;
export type QuestStageId = StableId<'quest-stage'>;
export type QuestFlagId = StableId<'quest-flag'>;
export type CombatantId = StableId<'combatant'>;
export type TeamId = StableId<'team'>;
export type StatusEffectId = StableId<'status'>;
export type ProjectileId = StableId<'projectile'>;
export type HazardId = StableId<'hazard'>;
export type ParticleProfileId = StableId<'particle-profile'>;
export type AudioCueId = StableId<'audio-cue'>;

const stableIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isStableId(value: unknown): value is StableId<string> {
  return typeof value === 'string' && stableIdPattern.test(value);
}

export function stableId<Kind extends string>(value: string): StableId<Kind> {
  if (!isStableId(value)) {
    throw new RangeError(`Invalid stable ID: ${value}`);
  }

  return value as StableId<Kind>;
}

export function damageTypeId(value: string): DamageTypeId {
  return stableId<'damage-type'>(value);
}

export function abilityId(value: string): AbilityId {
  return stableId<'ability'>(value);
}

export function itemId(value: string): ItemId {
  return stableId<'item'>(value);
}

export function equipmentSlotId(value: string): EquipmentSlotId {
  return stableId<'equipment-slot'>(value);
}

export function questId(value: string): QuestId {
  return stableId<'quest'>(value);
}

export function questStageId(value: string): QuestStageId {
  return stableId<'quest-stage'>(value);
}

export function questFlagId(value: string): QuestFlagId {
  return stableId<'quest-flag'>(value);
}
