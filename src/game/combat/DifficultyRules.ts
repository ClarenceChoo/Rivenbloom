import type { SaveSettings } from '../saves/SaveSchema';
export function difficultyHealthDamage(
  damage: number,
  difficulty: SaveSettings['difficulty'],
): number {
  if (!Number.isSafeInteger(damage) || damage < 0)
    throw new RangeError('Damage must be a non-negative safe integer.');
  if (damage === 0) return 0;
  const multiplier = { story: 0.75, standard: 1, challenging: 1.25 }[difficulty];
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(1, Math.round(damage * multiplier)));
}
