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
  'interact',
  'cycle-ability-left',
  'cycle-ability-right',
  'menu',
  'confirm',
  'back'
] as const;

export type InputAction = (typeof INPUT_ACTIONS)[number];

export type InputDevice = 'keyboard' | 'gamepad';

export type InputFrame = {
  readonly movement: { readonly x: number; readonly y: number };
  readonly held: Readonly<Record<InputAction, boolean>>;
  readonly pressed: readonly InputAction[];
  readonly released: readonly InputAction[];
  readonly buffered: readonly InputAction[];
  readonly device: InputDevice;
};
