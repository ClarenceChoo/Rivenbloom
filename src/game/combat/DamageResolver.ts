import { isStableId } from '../core/StableId';
import type {
  CriticalState,
  DamagePacket,
  DamageResult,
  DefenseSnapshot,
  GuardState,
} from './CombatTypes';

const maximumSafeInteger = Number.MAX_SAFE_INTEGER;

type UnknownRecord = Readonly<Record<string, unknown>>;

export function resolveDamage(packet: DamagePacket, target: DefenseSnapshot): DamageResult {
  const packetRecord = asRecord(packet, 'damage packet');
  const targetRecord = asRecord(target, 'defense snapshot');
  const baseDamage = packetRecord.baseDamage;
  const poiseDamage = packetRecord.poiseDamage;
  const armour = targetRecord.armour;
  const currentPoise = targetRecord.currentPoise;
  const damageType = packetRecord.damageType;
  const resistances = asRecord(targetRecord.resistances, 'resistances');

  assertNonNegativeSafeInteger(baseDamage, 'base damage');
  assertNonNegativeSafeInteger(poiseDamage, 'poise damage');
  assertNonNegativeSafeInteger(armour, 'armour');
  assertCurrentPoise(currentPoise);

  if (!isStableId(damageType)) {
    throw new RangeError('Damage type must be a stable ID.');
  }

  const critical = resolveCritical(packetRecord.critical);
  const guard = resolveGuard(targetRecord.guard);
  const resistance = resolveResistance(resistances, damageType);

  if (guard.parried) {
    return {
      healthDamage: 0,
      poiseDamage: 0,
      remainingPoise: currentPoise,
      staggered: false,
      critical: false,
      parried: true,
    };
  }

  const afterCritical = assertFiniteDamage(baseDamage * critical.multiplier, 'critical damage');
  const afterArmour = Math.max(0, afterCritical - armour);
  const afterResistance = assertFiniteDamage(
    afterArmour * (1 - resistance),
    'resistance-adjusted damage',
  );
  const afterBlock = assertFiniteDamage(afterResistance * guard.multiplier, 'blocked damage');
  const healthDamage = Math.round(Math.max(0, afterBlock));

  assertNonNegativeSafeInteger(healthDamage, 'final damage');

  return resolvePoiseResult({
    healthDamage,
    poiseDamage,
    currentPoise,
    critical: critical.triggered,
  });
}

function resolvePoiseResult({
  healthDamage,
  poiseDamage,
  currentPoise,
  critical,
}: Readonly<{
  healthDamage: number;
  poiseDamage: number;
  currentPoise: number | null;
  critical: boolean;
}>): DamageResult {
  if (currentPoise === null) {
    return {
      healthDamage,
      poiseDamage,
      remainingPoise: null,
      staggered: false,
      critical,
      parried: false,
    };
  }

  const remainingPoise = Math.max(0, currentPoise - poiseDamage);

  return {
    healthDamage,
    poiseDamage,
    remainingPoise,
    staggered: currentPoise > 0 && remainingPoise === 0,
    critical,
    parried: false,
  };
}

function resolveCritical(value: unknown): Readonly<{ multiplier: number; triggered: boolean }> {
  const critical = asRecord(value, 'critical state') as CriticalState;

  if (critical.kind === 'excluded') {
    return { multiplier: 1, triggered: false };
  }

  if (critical.kind !== 'eligible') {
    throw new RangeError('Unknown critical state.');
  }

  if (typeof critical.triggered !== 'boolean') {
    throw new RangeError('Critical trigger must be a boolean.');
  }

  assertPositiveFiniteNumber(critical.multiplier, 'critical multiplier');
  return {
    multiplier: critical.triggered ? critical.multiplier : 1,
    triggered: critical.triggered,
  };
}

function resolveGuard(value: unknown): Readonly<{ multiplier: number; parried: boolean }> {
  const guard = asRecord(value, 'guard state') as GuardState;

  if (guard.kind === 'none') {
    return { multiplier: 1, parried: false };
  }

  if (guard.kind === 'parry') {
    return { multiplier: 0, parried: true };
  }

  if (guard.kind !== 'block') {
    throw new RangeError('Unknown guard state.');
  }

  assertFiniteNumberInRange(guard.multiplier, 0, 1, 'block multiplier');
  return { multiplier: guard.multiplier, parried: false };
}

function resolveResistance(resistances: UnknownRecord, damageType: string): number {
  for (const [resistanceType, resistance] of Object.entries(resistances)) {
    if (!isStableId(resistanceType)) {
      throw new RangeError('Resistance type must be a stable ID.');
    }

    assertFiniteNumberInRange(resistance, -1, 1, 'resistance');
  }

  const resistance = resistances[damageType];

  if (resistance === undefined) {
    return 0;
  }

  assertFiniteNumberInRange(resistance, -1, 1, 'resistance');
  return resistance;
}

function asRecord(value: unknown, label: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new RangeError(`${label} must be an object.`);
  }

  return value as UnknownRecord;
}

function assertCurrentPoise(value: unknown): asserts value is number | null {
  if (value === null) {
    return;
  }

  assertNonNegativeSafeInteger(value, 'current poise');
}

function assertNonNegativeSafeInteger(value: unknown, label: string): asserts value is number {
  if (!isNonNegativeSafeInteger(value)) {
    throw new RangeError(`${label} must be a non-negative safe integer.`);
  }
}

export function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function assertPositiveFiniteNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number.`);
  }
}

function assertFiniteNumberInRange(
  value: unknown,
  minimum: number,
  maximum: number,
  label: string,
): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be between ${minimum} and ${maximum}.`);
  }
}

function assertFiniteDamage(value: number, label: string): number {
  if (!isSupportedDamageValue(value)) {
    throw new RangeError(`${label} exceeds the supported range.`);
  }

  return value;
}

export function isSupportedDamageValue(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximumSafeInteger
  );
}
