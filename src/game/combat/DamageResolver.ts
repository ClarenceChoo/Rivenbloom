import type { DamagePacket, DamageResult, DefenseSnapshot } from './CombatTypes';

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const finiteNonNegative = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0;

const resistancePercent = (value: number | undefined): number =>
  value !== undefined && Number.isFinite(value) ? clamp(value, 0, 100) : 0;

export const resolveDamage = (packet: DamagePacket, target: DefenseSnapshot): DamageResult => {
  if (target.invulnerable) {
    return {
      healthDamage: 0,
      poiseDamage: 0,
      knockback: 0,
      criticalApplied: false,
      blocked: false,
      parried: false,
      invulnerable: true
    };
  }

  if (target.guard.kind === 'parry') {
    return {
      healthDamage: 0,
      poiseDamage: 0,
      knockback: 0,
      criticalApplied: false,
      blocked: false,
      parried: true,
      invulnerable: false
    };
  }

  const resistance = resistancePercent(target.resistances[packet.damageType]) / 100;
  const criticalApplied =
    target.guard.kind === 'none' &&
    Number.isFinite(packet.criticalMultiplier) &&
    packet.criticalMultiplier > 1;
  const criticalMultiplier = criticalApplied ? packet.criticalMultiplier : 1;
  const baseDamage =
    Math.max(
      0,
      finiteNonNegative(packet.amount) * criticalMultiplier - finiteNonNegative(target.armor)
    ) *
    (1 - resistance);
  const block = target.guard.kind === 'block' ? target.guard : undefined;

  return {
    healthDamage: baseDamage * finiteNonNegative(block?.damageMultiplier ?? 1),
    poiseDamage:
      finiteNonNegative(packet.poiseDamage) * finiteNonNegative(block?.poiseMultiplier ?? 1),
    knockback:
      finiteNonNegative(packet.knockback) * finiteNonNegative(block?.knockbackMultiplier ?? 1),
    criticalApplied,
    blocked: block !== undefined,
    parried: false,
    invulnerable: false
  };
};
