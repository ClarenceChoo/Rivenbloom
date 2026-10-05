import { ITEMS } from '../data/items';
export function equippedCharmEffects(ids: readonly string[]) {
  const result = { briarMultiplier: 1, protectionMs: 0, parryMana: 0 };
  for (const item of ITEMS) {
    if (!ids.includes(item.itemId)) continue;
    const effect = item.charmEffect;
    if (effect?.kind === 'briar-damage') result.briarMultiplier *= effect.amount;
    if (effect?.kind === 'hit-protection') result.protectionMs += effect.amount;
    if (effect?.kind === 'parry-mana') result.parryMana += effect.amount;
  }
  return Object.freeze(result);
}
