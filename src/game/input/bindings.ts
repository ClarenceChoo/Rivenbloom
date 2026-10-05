import { stableId } from '../core/StableId';
import { INPUT_ACTIONS, inputActionContext, isInputAction } from './InputActions';
import type { BindingOverride, InputBinding } from '../saves/SaveSchema';
import type { InputAction } from './InputActions';

export type Binding = InputBinding;
export type BindingMap = Readonly<Record<InputAction, readonly Binding[]>>;

export type RebindResult =
  | Readonly<{
      kind: 'applied';
      changed: boolean;
      bindings: readonly Binding[];
      bindingMap: BindingMap;
    }>
  | Readonly<{ kind: 'conflict'; conflictingActions: readonly InputAction[] }>
  | Readonly<{ kind: 'invalid' }>;

const rawDefaults: Record<InputAction, readonly Binding[]> = {
  'move-left': [
    { kind: 'keyboard', code: 'ArrowLeft' },
    { kind: 'keyboard', code: 'KeyA' },
    { kind: 'gamepad-button', button: 14 },
    { kind: 'gamepad-axis', axis: 0, direction: -1 },
  ],
  'move-right': [
    { kind: 'keyboard', code: 'ArrowRight' },
    { kind: 'keyboard', code: 'KeyD' },
    { kind: 'gamepad-button', button: 15 },
    { kind: 'gamepad-axis', axis: 0, direction: 1 },
  ],
  'move-up': [
    { kind: 'keyboard', code: 'ArrowUp' },
    { kind: 'keyboard', code: 'KeyW' },
    { kind: 'gamepad-button', button: 12 },
    { kind: 'gamepad-axis', axis: 1, direction: -1 },
  ],
  'move-down': [
    { kind: 'keyboard', code: 'ArrowDown' },
    { kind: 'keyboard', code: 'KeyS' },
    { kind: 'gamepad-button', button: 13 },
    { kind: 'gamepad-axis', axis: 1, direction: 1 },
  ],
  jump: [
    { kind: 'keyboard', code: 'Space' },
    { kind: 'gamepad-button', button: 0 },
  ],
  'attack-light': [
    { kind: 'keyboard', code: 'KeyJ' },
    { kind: 'gamepad-button', button: 2 },
  ],
  'attack-heavy': [
    { kind: 'keyboard', code: 'KeyK' },
    { kind: 'gamepad-button', button: 3 },
  ],
  block: [
    { kind: 'keyboard', code: 'KeyL' },
    { kind: 'gamepad-button', button: 4 },
  ],
  dash: [
    { kind: 'keyboard', code: 'ShiftLeft' },
    { kind: 'gamepad-button', button: 1 },
  ],
  cast: [
    { kind: 'keyboard', code: 'KeyQ' },
    { kind: 'gamepad-button', button: 7 },
  ],
  'cycle-ability': [
    { kind: 'keyboard', code: 'KeyR' },
    { kind: 'gamepad-button', button: 6 },
  ],
  interact: [
    { kind: 'keyboard', code: 'KeyE' },
    { kind: 'gamepad-button', button: 5 },
  ],
  pause: [
    { kind: 'keyboard', code: 'Escape' },
    { kind: 'gamepad-button', button: 9 },
  ],
  'ui-left': [
    { kind: 'keyboard', code: 'ArrowLeft' },
    { kind: 'keyboard', code: 'KeyA' },
    { kind: 'gamepad-button', button: 14 },
    { kind: 'gamepad-axis', axis: 0, direction: -1 },
  ],
  'ui-right': [
    { kind: 'keyboard', code: 'ArrowRight' },
    { kind: 'keyboard', code: 'KeyD' },
    { kind: 'gamepad-button', button: 15 },
    { kind: 'gamepad-axis', axis: 0, direction: 1 },
  ],
  'ui-up': [
    { kind: 'keyboard', code: 'ArrowUp' },
    { kind: 'keyboard', code: 'KeyW' },
    { kind: 'gamepad-button', button: 12 },
    { kind: 'gamepad-axis', axis: 1, direction: -1 },
  ],
  'ui-down': [
    { kind: 'keyboard', code: 'ArrowDown' },
    { kind: 'keyboard', code: 'KeyS' },
    { kind: 'gamepad-button', button: 13 },
    { kind: 'gamepad-axis', axis: 1, direction: 1 },
  ],
  'ui-confirm': [
    { kind: 'keyboard', code: 'Enter' },
    { kind: 'keyboard', code: 'Space' },
    { kind: 'gamepad-button', button: 0 },
  ],
  'ui-cancel': [
    { kind: 'keyboard', code: 'Backspace' },
    { kind: 'keyboard', code: 'Escape' },
    { kind: 'gamepad-button', button: 1 },
  ],
};

export const DEFAULT_BINDINGS: BindingMap = freezeBindingMap(rawDefaults);

export function createBindingMap(overrides: readonly BindingOverride[]): BindingMap {
  const map = mutableDefaultMap();
  for (const override of overrides) {
    const actionId: string = override.actionId;
    if (!isInputAction(actionId)) continue;
    map[actionId] = canonicalBindings(override.bindings);
  }
  return freezeBindingMap(map);
}

export function rebindBindings(
  bindings: BindingMap,
  action: InputAction,
  binding: Binding,
): RebindResult {
  if (!isValidBinding(binding)) return Object.freeze({ kind: 'invalid' });
  const conflicts = INPUT_ACTIONS.filter(
    (candidate) =>
      candidate !== action &&
      inputActionContext(candidate) === inputActionContext(action) &&
      bindings[candidate].some((existing) => bindingsEqual(existing, binding)),
  ).sort();
  if (conflicts.length > 0) {
    return Object.freeze({ kind: 'conflict', conflictingActions: Object.freeze(conflicts) });
  }

  const family = bindingFamily(binding);
  const nextForAction = canonicalBindings([
    ...bindings[action].filter((existing) => bindingFamily(existing) !== family),
    binding,
  ]);
  const changed = !bindingListsEqual(bindings[action], nextForAction);
  if (!changed) {
    return Object.freeze({
      kind: 'applied',
      changed: false,
      bindings: bindings[action],
      bindingMap: bindings,
    });
  }
  const next = copyBindingMap(bindings);
  next[action] = nextForAction;
  const bindingMap = freezeBindingMap(next);
  return Object.freeze({
    kind: 'applied',
    changed: true,
    bindings: bindingMap[action],
    bindingMap,
  });
}

export function serializeBindingOverrides(bindings: BindingMap): readonly BindingOverride[] {
  const overrides = INPUT_ACTIONS.filter(
    (action) => !bindingListsEqual(canonicalBindings(bindings[action]), DEFAULT_BINDINGS[action]),
  )
    .sort()
    .map((action) =>
      Object.freeze({
        actionId: stableId<'input-action'>(action),
        bindings: canonicalBindings(bindings[action]),
      }),
    );
  return Object.freeze(overrides);
}

function mutableDefaultMap(): Record<InputAction, readonly Binding[]> {
  return copyBindingMap(DEFAULT_BINDINGS);
}

function copyBindingMap(bindings: BindingMap): Record<InputAction, readonly Binding[]> {
  return Object.fromEntries(INPUT_ACTIONS.map((action) => [action, bindings[action]])) as Record<
    InputAction,
    readonly Binding[]
  >;
}

function freezeBindingMap(bindings: Record<InputAction, readonly Binding[]>): BindingMap {
  for (const action of INPUT_ACTIONS) {
    bindings[action] = canonicalBindings(bindings[action]);
  }
  return Object.freeze(bindings);
}

function canonicalBindings(bindings: readonly Binding[]): readonly Binding[] {
  const canonical = [...bindings]
    .filter(isValidBinding)
    .sort(compareBindings)
    .filter((binding, index, sorted) => index === 0 || !bindingsEqual(binding, sorted[index - 1]));
  return Object.freeze(canonical.map((binding) => Object.freeze({ ...binding })));
}

function isValidBinding(binding: Binding): boolean {
  if (binding.kind === 'keyboard') {
    return (
      typeof binding.code === 'string' &&
      binding.code.length > 0 &&
      binding.code.trim() === binding.code
    );
  }
  if (binding.kind === 'gamepad-button')
    return Number.isSafeInteger(binding.button) && binding.button >= 0;
  return (
    Number.isSafeInteger(binding.axis) &&
    binding.axis >= 0 &&
    (binding.direction === -1 || binding.direction === 1)
  );
}

function bindingFamily(binding: Binding): 'keyboard' | 'gamepad' {
  return binding.kind === 'keyboard' ? 'keyboard' : 'gamepad';
}

function compareBindings(left: Binding, right: Binding): number {
  const kindOrder = bindingKindOrder(left) - bindingKindOrder(right);
  if (kindOrder !== 0) return kindOrder;
  if (left.kind === 'keyboard' && right.kind === 'keyboard') {
    if (left.code === right.code) return 0;
    return left.code < right.code ? -1 : 1;
  }
  if (left.kind === 'gamepad-button' && right.kind === 'gamepad-button') {
    return left.button - right.button;
  }
  if (left.kind === 'gamepad-axis' && right.kind === 'gamepad-axis') {
    return left.axis - right.axis || left.direction - right.direction;
  }
  return 0;
}

function bindingKindOrder(binding: Binding): number {
  if (binding.kind === 'keyboard') return 0;
  return binding.kind === 'gamepad-button' ? 1 : 2;
}

function bindingsEqual(left: Binding | undefined, right: Binding | undefined): boolean {
  if (left === undefined || right === undefined || left.kind !== right.kind) return false;
  if (left.kind === 'keyboard' && right.kind === 'keyboard') return left.code === right.code;
  if (left.kind === 'gamepad-button' && right.kind === 'gamepad-button') {
    return left.button === right.button;
  }
  return (
    left.kind === 'gamepad-axis' &&
    right.kind === 'gamepad-axis' &&
    left.axis === right.axis &&
    left.direction === right.direction
  );
}

function bindingListsEqual(left: readonly Binding[], right: readonly Binding[]): boolean {
  return (
    left.length === right.length &&
    left.every((binding, index) => bindingsEqual(binding, right[index]))
  );
}
