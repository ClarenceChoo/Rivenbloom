import type { DamagePacket, DamageResult, DefenseSnapshot } from './CombatTypes';

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

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

  const resistance = clamp(target.resistances[packet.damageType] ?? 0, 0, 100) / 100;
  const criticalApplied = target.guard.kind === 'none' && packet.criticalMultiplier > 1;
  const criticalMultiplier = criticalApplied ? packet.criticalMultiplier : 1;
  const baseDamage =
    Math.max(0, packet.amount * criticalMultiplier - Math.max(0, target.armor)) * (1 - resistance);
  const block = target.guard.kind === 'block' ? target.guard : undefined;

  return {
    healthDamage: baseDamage * (block?.damageMultiplier ?? 1),
    poiseDamage: Math.max(0, packet.poiseDamage) * (block?.poiseMultiplier ?? 1),
    knockback: Math.max(0, packet.knockback) * (block?.knockbackMultiplier ?? 1),
    criticalApplied,
    blocked: block !== undefined,
    parried: false,
    invulnerable: false
  };
};
