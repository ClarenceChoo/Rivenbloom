export const INPUT_ACTIONS = [
  'move-left',
  'move-right',
  'move-up',
  'move-down',
  'jump',
  'attack-light',
  'attack-heavy',
  'block',
  'dash',
  'cast',
  'cycle-ability',
  'interact',
  'pause',
  'ui-left',
  'ui-right',
  'ui-up',
  'ui-down',
  'ui-confirm',
  'ui-cancel',
] as const;

export type InputAction = (typeof INPUT_ACTIONS)[number];
export type InputContext = 'gameplay' | 'ui' | 'system';

const INPUT_ACTION_SET: ReadonlySet<string> = new Set(INPUT_ACTIONS);

export function isInputAction(value: string): value is InputAction {
  return INPUT_ACTION_SET.has(value);
}

export function inputActionContext(action: InputAction): InputContext {
  if (action === 'pause') return 'system';
  return action.startsWith('ui-') ? 'ui' : 'gameplay';
}
