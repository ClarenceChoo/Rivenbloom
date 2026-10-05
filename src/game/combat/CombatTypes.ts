import type { DamageTypeId } from '../core/StableId';

export type CriticalState =
  | Readonly<{
      kind: 'excluded';
    }>
  | Readonly<{
      kind: 'eligible';
      triggered: boolean;
      multiplier: number;
    }>;

export type GuardState =
  | Readonly<{
      kind: 'none';
    }>
  | Readonly<{
      kind: 'block';
      multiplier: number;
    }>
  | Readonly<{
      kind: 'parry';
    }>;

export type DamagePacket = Readonly<{
  baseDamage: number;
  damageType: DamageTypeId;
  poiseDamage: number;
  critical: CriticalState;
}>;

export type DefenseSnapshot = Readonly<{
  armour: number;
  resistances: Readonly<Partial<Record<DamageTypeId, number>>>;
  currentPoise: number | null;
  guard: GuardState;
}>;

export type DamageResult = Readonly<{
  healthDamage: number;
  poiseDamage: number;
  remainingPoise: number | null;
  staggered: boolean;
  critical: boolean;
  parried: boolean;
}>;
