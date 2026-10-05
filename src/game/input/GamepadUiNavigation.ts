import type { InputFrame } from './InputService';

export type GamepadUiAction = 'previous' | 'next' | 'decrease' | 'increase' | 'confirm' | 'cancel';

export function gamepadUiActions(frame: InputFrame): readonly GamepadUiAction[] {
  if (frame.activeDevice !== 'gamepad') return [];

  const actions: GamepadUiAction[] = [];
  if (frame.actions['ui-up'].pressed) actions.push('previous');
  if (frame.actions['ui-down'].pressed) actions.push('next');
  if (frame.actions['ui-left'].pressed) actions.push('decrease');
  if (frame.actions['ui-right'].pressed) actions.push('increase');
  if (frame.actions['ui-confirm'].pressed) actions.push('confirm');
  if (frame.actions['ui-cancel'].pressed) actions.push('cancel');
  return Object.freeze(actions);
}
