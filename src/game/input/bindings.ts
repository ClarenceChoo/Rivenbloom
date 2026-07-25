import { INPUT_ACTIONS, type InputAction } from './InputActions';

export type KeyboardBinding = { readonly kind: 'keyboard'; readonly code: string };
export type GamepadButtonBinding = { readonly kind: 'gamepad-button'; readonly button: number };
export type GamepadAxisBinding = {
  readonly kind: 'gamepad-axis';
  readonly axis: number;
  readonly direction: -1 | 1;
  readonly threshold: number;
};

export type Binding = KeyboardBinding | GamepadButtonBinding | GamepadAxisBinding;
export type BindingMap = Readonly<Record<InputAction, readonly Binding[]>>;

export const AXIS_DEADZONE = 0.25;
export const INPUT_BUFFER_MS = 120;

export const DEFAULT_BINDINGS: BindingMap = {
  'move-left': [
    { kind: 'keyboard', code: 'KeyA' },
    { kind: 'keyboard', code: 'ArrowLeft' },
    { kind: 'gamepad-axis', axis: 0, direction: -1, threshold: AXIS_DEADZONE },
    { kind: 'gamepad-button', button: 14 }
  ],
  'move-right': [
    { kind: 'keyboard', code: 'KeyD' },
    { kind: 'keyboard', code: 'ArrowRight' },
    { kind: 'gamepad-axis', axis: 0, direction: 1, threshold: AXIS_DEADZONE },
    { kind: 'gamepad-button', button: 15 }
  ],
  'move-up': [
    { kind: 'keyboard', code: 'KeyW' },
    { kind: 'keyboard', code: 'ArrowUp' },
    { kind: 'gamepad-axis', axis: 1, direction: -1, threshold: AXIS_DEADZONE },
    { kind: 'gamepad-button', button: 12 }
  ],
  'move-down': [
    { kind: 'keyboard', code: 'KeyS' },
    { kind: 'keyboard', code: 'ArrowDown' },
    { kind: 'gamepad-axis', axis: 1, direction: 1, threshold: AXIS_DEADZONE },
    { kind: 'gamepad-button', button: 13 }
  ],
  jump: [
    { kind: 'keyboard', code: 'Space' },
    { kind: 'gamepad-button', button: 0 }
  ],
  'attack-light': [
    { kind: 'keyboard', code: 'KeyX' },
    { kind: 'gamepad-button', button: 2 }
  ],
  'attack-heavy': [
    { kind: 'keyboard', code: 'KeyC' },
    { kind: 'gamepad-button', button: 3 }
  ],
  block: [
    { kind: 'keyboard', code: 'KeyF' },
    { kind: 'gamepad-button', button: 6 }
  ],
  dash: [
    { kind: 'keyboard', code: 'ShiftLeft' },
    { kind: 'gamepad-button', button: 1 }
  ],
  cast: [
    { kind: 'keyboard', code: 'KeyV' },
    { kind: 'gamepad-button', button: 7 }
  ],
  interact: [
    { kind: 'keyboard', code: 'KeyE' },
    { kind: 'gamepad-button', button: 0 }
  ],
  'cycle-ability-left': [
    { kind: 'keyboard', code: 'KeyQ' },
    { kind: 'gamepad-button', button: 4 }
  ],
  'cycle-ability-right': [
    { kind: 'keyboard', code: 'KeyR' },
    { kind: 'gamepad-button', button: 5 }
  ],
  menu: [
    { kind: 'keyboard', code: 'Escape' },
    { kind: 'gamepad-button', button: 9 }
  ],
  confirm: [
    { kind: 'keyboard', code: 'Enter' },
    { kind: 'gamepad-button', button: 0 }
  ],
  back: [
    { kind: 'keyboard', code: 'Backspace' },
    { kind: 'gamepad-button', button: 1 }
  ]
};

const BINDING_PATTERN = /^(keyboard|gamepad-button|gamepad-axis):(.+)$/;

export const serializeBinding = (binding: Binding): string => {
  switch (binding.kind) {
    case 'keyboard':
      return `keyboard:${binding.code}`;
    case 'gamepad-button':
      return `gamepad-button:${binding.button}`;
    case 'gamepad-axis':
      return `gamepad-axis:${binding.axis}:${binding.direction}:${binding.threshold}`;
  }
};

export const deserializeBinding = (serialized: string): Binding | undefined => {
  const match = BINDING_PATTERN.exec(serialized);
  if (match === null) return undefined;
  const [, kind, data] = match;
  if (kind === 'keyboard' && data.length > 0) return { kind, code: data };
  if (kind === 'gamepad-button' && /^\d+$/.test(data)) return { kind, button: Number(data) };
  if (kind === 'gamepad-axis') {
    const [axis, direction, threshold] = data.split(':');
    if (
      axis !== undefined &&
      direction !== undefined &&
      threshold !== undefined &&
      /^\d+$/.test(axis) &&
      (direction === '-1' || direction === '1') &&
      Number.isFinite(Number(threshold)) &&
      Number(threshold) > 0 &&
      Number(threshold) <= 1
    ) {
      return {
        kind,
        axis: Number(axis),
        direction: Number(direction) as -1 | 1,
        threshold: Number(threshold)
      };
    }
  }
  return undefined;
};

export const bindingsEqual = (left: Binding, right: Binding): boolean =>
  serializeBinding(left) === serializeBinding(right);

const isInputAction = (value: string): value is InputAction =>
  (INPUT_ACTIONS as readonly string[]).includes(value);

export const applySerializedBindings = (
  serialized: Readonly<Record<string, string>>,
  defaults: BindingMap = DEFAULT_BINDINGS
): BindingMap => {
  const next: Partial<Record<InputAction, readonly Binding[]>> = {};
  for (const action of INPUT_ACTIONS) next[action] = [...defaults[action]];
  for (const [action, value] of Object.entries(serialized)) {
    if (!isInputAction(action)) continue;
    const binding = deserializeBinding(value);
    if (binding !== undefined) next[action] = [binding];
  }
  return next as BindingMap;
};
