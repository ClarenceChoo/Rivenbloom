import { expect, it } from 'vitest';
import { equippedCharmEffects } from '../../src/game/inventory/CharmRules';
it('applies only equipped charm definitions and removes benefits on unequip', () => {
  expect(equippedCharmEffects([])).toEqual({ briarMultiplier: 1, protectionMs: 0, parryMana: 0 });
  expect(equippedCharmEffects(['quiet-step', 'resin-heart', 'echo-thorn'])).toEqual({
    briarMultiplier: 0.8,
    protectionMs: 300,
    parryMana: 2,
  });
  expect(equippedCharmEffects(['quiet-step', 'quiet-step'])).toEqual({
    briarMultiplier: 0.8,
    protectionMs: 0,
    parryMana: 0,
  });
});
