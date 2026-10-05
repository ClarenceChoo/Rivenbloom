import { freezeCombatImpact } from './CombatImpact';
import type { CombatImpact } from './CombatImpact';

const WEAPON_LEVEL_BONUS = 8;

export function applyPlayerAttackPower(
  impact: CombatImpact,
  stats: Readonly<{ attackPower: number; weaponLevel: number }>,
): CombatImpact {
  if (
    impact.source.teamId !== 'player' ||
    impact.damage.damageType !== 'physical' ||
    impact.damage.baseDamage === 0
  )
    return impact;
  return freezeCombatImpact({
    ...impact,
    damage: {
      ...impact.damage,
      baseDamage: Math.min(
        Number.MAX_SAFE_INTEGER,
        impact.damage.baseDamage + stats.attackPower + stats.weaponLevel * WEAPON_LEVEL_BONUS,
      ),
    },
  });
}
