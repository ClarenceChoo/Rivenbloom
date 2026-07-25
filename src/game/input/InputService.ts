import { GameEvents } from '../core/GameEvents';
import { INPUT_ACTIONS, type InputAction, type InputDevice, type InputFrame } from './InputActions';
import {
  normalizeAccessibilitySettings,
  type AccessibilitySettingsUpdate
} from '../config/accessibility';
import {
  DEFAULT_BINDINGS,
  INPUT_BUFFER_MS,
  applySerializedBindings,
  bindingsEqual,
  deserializeBinding,
  serializeBinding,
  type Binding,
  type BindingMap
} from './bindings';

export type GamepadSnapshot = {
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[];
  readonly axes: readonly number[];
  readonly vibrationActuator?: {
    readonly playEffect: (
      type: 'dual-rumble',
      parameters: {
        readonly duration: number;
        readonly strongMagnitude: number;
        readonly weakMagnitude: number;
      }
    ) => Promise<unknown>;
  };
};

export type InputServiceOptions = {
  readonly target?: EventTarget;
  readonly gamepads?: () => readonly GamepadSnapshot[];
  readonly bindings?: BindingMap;
  readonly serializedBindings?: Readonly<Record<string, string>>;
  readonly settings?: AccessibilitySettingsUpdate;
  readonly events?: GameEvents;
};

export type RebindResult =
  | { readonly kind: 'rebound'; readonly action: InputAction }
  | { readonly kind: 'conflict'; readonly action: InputAction };

const actionRecord = (value: boolean): Record<InputAction, boolean> =>
  Object.fromEntries(INPUT_ACTIONS.map((action) => [action, value])) as Record<
    InputAction,
    boolean
  >;

const cloneBindings = (bindings: BindingMap): BindingMap =>
  INPUT_ACTIONS.reduce<Partial<Record<InputAction, readonly Binding[]>>>(
    (copy, action) => ({ ...copy, [action]: [...bindings[action]] }),
    {}
  ) as BindingMap;

const browserGamepads = (): readonly GamepadSnapshot[] => {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return [];
  return Array.from(navigator.getGamepads())
    .filter((gamepad): gamepad is Gamepad => gamepad !== null)
    .map((gamepad) => {
      const haptics = gamepad as unknown as Pick<GamepadSnapshot, 'vibrationActuator'>;
      return {
        axes: Array.from(gamepad.axes),
        buttons: Array.from(gamepad.buttons),
        ...(haptics.vibrationActuator === undefined
          ? {}
          : { vibrationActuator: haptics.vibrationActuator })
      };
    });
};

export class InputService {
  private readonly keys = new Set<string>();
  private bindings: BindingMap;
  private readonly gamepads: () => readonly GamepadSnapshot[];
  private readonly target: EventTarget | undefined;
  private readonly events: GameEvents | undefined;
  private previousHeld = actionRecord(false);
  private readonly bufferedAt = new Map<InputAction, number>();
  private readonly overrides = new Map<InputAction, Binding>();
  private readonly holdToToggle: boolean;
  private blockToggled = false;
  private device: InputDevice = 'keyboard';

  public constructor(options: InputServiceOptions = {}) {
    this.bindings = cloneBindings(
      options.bindings ??
        (options.serializedBindings === undefined
          ? DEFAULT_BINDINGS
          : applySerializedBindings(options.serializedBindings))
    );
    for (const action of INPUT_ACTIONS) {
      const serialized = options.serializedBindings?.[action];
      const binding = serialized === undefined ? undefined : deserializeBinding(serialized);
      if (binding !== undefined) this.overrides.set(action, binding);
    }
    this.gamepads = options.gamepads ?? browserGamepads;
    this.holdToToggle = normalizeAccessibilitySettings(options.settings).holdToToggle;
    this.events = options.events;
    const target = options.target ?? (typeof window === 'undefined' ? undefined : window);
    target?.addEventListener('keydown', this.onKeyDown);
    target?.addEventListener('keyup', this.onKeyUp);
    target?.addEventListener('blur', this.clearTransient);
    this.target = target;
  }

  public sample(nowMs: number): Readonly<InputFrame> {
    const physicalHeld = actionRecord(false);
    for (const action of INPUT_ACTIONS) {
      physicalHeld[action] = this.bindings[action].some((binding) => this.isBindingActive(binding));
    }
    const pressed = INPUT_ACTIONS.filter(
      (action) => physicalHeld[action] && !this.previousHeld[action]
    );
    const released = INPUT_ACTIONS.filter(
      (action) => !physicalHeld[action] && this.previousHeld[action]
    );
    if (this.holdToToggle && pressed.includes('block')) this.blockToggled = !this.blockToggled;
    const held = {
      ...physicalHeld,
      block: this.holdToToggle ? this.blockToggled : physicalHeld.block
    };
    for (const action of pressed) this.bufferedAt.set(action, nowMs);
    const buffered = INPUT_ACTIONS.filter((action) => {
      const pressedAt = this.bufferedAt.get(action);
      if (pressedAt === undefined || nowMs - pressedAt > INPUT_BUFFER_MS) return false;
      return true;
    });
    for (const action of INPUT_ACTIONS) {
      if (!buffered.includes(action)) this.bufferedAt.delete(action);
    }
    this.previousHeld = physicalHeld;
    const device = this.hasActiveGamepadBinding() ? 'gamepad' : 'keyboard';
    if (device !== this.device) {
      this.device = device;
      this.events?.emit('input:device-changed', { device });
    }
    return {
      movement: {
        x: Number(held['move-right']) - Number(held['move-left']),
        y: Number(held['move-down']) - Number(held['move-up'])
      },
      held,
      pressed,
      released,
      buffered,
      device
    };
  }

  public clearTransient = (): void => {
    this.keys.clear();
    this.previousHeld = actionRecord(false);
    this.bufferedAt.clear();
    this.blockToggled = false;
  };

  public dispose(): void {
    this.target?.removeEventListener('keydown', this.onKeyDown);
    this.target?.removeEventListener('keyup', this.onKeyUp);
    this.target?.removeEventListener('blur', this.clearTransient);
    this.clearTransient();
  }

  public rebind(action: InputAction, binding: Binding): RebindResult {
    const conflictingAction = INPUT_ACTIONS.find(
      (candidate) =>
        candidate !== action &&
        this.bindings[candidate].some((existing) => bindingsEqual(existing, binding))
    );
    if (conflictingAction !== undefined) return { kind: 'conflict', action: conflictingAction };
    this.bindings = { ...this.bindings, [action]: [binding] };
    this.overrides.set(action, binding);
    this.events?.emit('input:binding-changed', {
      actionId: action,
      binding: serializeBinding(binding)
    });
    return { kind: 'rebound', action };
  }

  public serializeBindings(): Readonly<Record<string, string>> {
    return Object.fromEntries(
      [...this.overrides].map(([action, binding]) => [action, serializeBinding(binding)])
    );
  }

  public async pulseHaptics(durationMs: number, magnitude = 0.5): Promise<boolean> {
    const actuator = this.gamepads().find(
      (gamepad) => gamepad.vibrationActuator !== undefined
    )?.vibrationActuator;
    if (actuator === undefined) return false;
    const normalizedDuration = Math.max(0, Math.floor(durationMs));
    const normalizedMagnitude = Math.max(0, Math.min(1, magnitude));
    try {
      await actuator.playEffect('dual-rumble', {
        duration: normalizedDuration,
        strongMagnitude: normalizedMagnitude,
        weakMagnitude: normalizedMagnitude
      });
      return true;
    } catch {
      return false;
    }
  }

  private readonly onKeyDown = (event: Event): void => {
    const code = (event as KeyboardEvent).code;
    if (code.length > 0) this.keys.add(code);
  };

  private readonly onKeyUp = (event: Event): void => {
    this.keys.delete((event as KeyboardEvent).code);
  };

  private isBindingActive(binding: BindingMap[InputAction][number]): boolean {
    if (binding.kind === 'keyboard') return this.keys.has(binding.code);
    return this.gamepads().some((gamepad) => {
      if (binding.kind === 'gamepad-button') {
        const button = gamepad.buttons[binding.button];
        return button?.pressed === true || (button?.value ?? 0) >= 0.5;
      }
      return (gamepad.axes[binding.axis] ?? 0) * binding.direction >= binding.threshold;
    });
  }

  private hasActiveGamepadBinding(): boolean {
    return INPUT_ACTIONS.some((action) =>
      this.bindings[action].some(
        (binding) => binding.kind !== 'keyboard' && this.isBindingActive(binding)
      )
    );
  }
}
