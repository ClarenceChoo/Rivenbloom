import type { InputAction } from '../input/InputActions';
import type { InputService } from '../input/InputService';
export function inputLabel(input: InputService, action: InputAction): string {
  const bindings = input.getBindings(action);
  if (input.getActiveDevice() === 'gamepad') {
    const binding = bindings.find((binding) => binding.kind === 'gamepad-button');
    const names: Record<number, string> = {
      0: 'A / Cross',
      1: 'B / Circle',
      2: 'X / Square',
      3: 'Y / Triangle',
      4: 'LB / L1',
      5: 'RB / R1',
      6: 'LT / L2',
      7: 'RT / R2',
      9: 'Menu',
      12: 'D-pad up',
      13: 'D-pad down',
      14: 'D-pad left',
      15: 'D-pad right',
    };
    if (binding?.kind === 'gamepad-button')
      return names[binding.button] ?? `Button ${binding.button}`;
  }
  const binding = bindings.find((binding) => binding.kind === 'keyboard');
  return binding?.kind === 'keyboard'
    ? binding.code
        .replace(/^Key|^Digit/, '')
        .replace('Arrow', '')
        .replace('ShiftLeft', 'Shift')
        .replace('ShiftRight', 'Shift') || binding.code
    : action;
}
export function controlsHelp(input: InputService): string {
  return (
    [
      ['move-left', 'Move left'],
      ['move-right', 'right'],
      ['jump', 'Jump'],
      ['attack-light', 'Attack'],
      ['attack-heavy', 'Heavy attack'],
      ['block', 'Guard'],
      ['dash', 'Dash (once learned)'],
      ['cast', 'Cast'],
      ['cycle-ability', 'Change art'],
      ['interact', 'Interact'],
      ['pause', 'Map / journal'],
    ] as const
  )
    .map(([action, label]) => `${label}: ${inputLabel(input, action)}`)
    .join(' · ');
}
