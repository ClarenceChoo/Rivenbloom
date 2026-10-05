import { expect, it } from 'vitest';
import { stepRange, repeatDue } from '../../src/game/ui/dom/GamepadFormNavigation';
it('steps sliders by their native step and clamps at their bounds', () => {
  expect(stepRange(0.95, 1, 0, 1, 0.1)).toBe(1);
  expect(stepRange(0.05, -1, 0, 1, 0.1)).toBe(0);
  expect(stepRange(1, 1, 0.75, 1.5, 0.05)).toBe(1.05);
});
it('repeats only after the initial delay, then at 100ms intervals', () => {
  expect(repeatDue(349, 0, false)).toBe(false);
  expect(repeatDue(350, 0, false)).toBe(true);
  expect(repeatDue(449, 350, true)).toBe(false);
  expect(repeatDue(450, 350, true)).toBe(true);
});
