import { expect, it } from 'vitest';
import { difficultyHealthDamage } from '../../src/game/combat/DifficultyRules';
it.each([
  ['story', 15],
  ['standard', 20],
  ['challenging', 25],
] as const)('scales %s positive damage and preserves zero', (difficulty, damage) => {
  expect(difficultyHealthDamage(20, difficulty)).toBe(damage);
  expect(difficultyHealthDamage(0, difficulty)).toBe(0);
  expect(difficultyHealthDamage(1, difficulty)).toBeGreaterThanOrEqual(1);
  expect(() => difficultyHealthDamage(-1, difficulty)).toThrow();
});
