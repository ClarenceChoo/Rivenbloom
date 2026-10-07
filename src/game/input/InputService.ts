import { INPUT_ACTIONS } from './InputActions';
import { createBindingMap, rebindBindings, serializeBindingOverrides } from './bindings';
import { normalizeHapticsPulse } from './Haptics';
import { DEFAULT_SAVE_SETTINGS } from '../saves/SaveSchema';
import type { BindingOverride, SaveSettings } from '../saves/SaveSchema';
import type { HapticsPort, HapticsPulse, HapticsResult } from './Haptics';
import type { InputAction } from './InputActions';
import type { Binding, BindingMap, RebindResult } from './bindings';

export type InputDevice = 'keyboard' | 'gamepad';

export type InputEdge = Readonly<{
  code: string;
  atMs: number;
}>;

export type KeyboardDeviceSnapshot = Readonly<{
  heldCodes: readonly string[];
  pressed: readonly InputEdge[];
  released: readonly InputEdge[];
  activityAtMs: number | null;
}>;

export type GamepadDeviceSnapshot = Readonly<{
  id: string;
  connected: boolean;
  buttons: readonly number[];
  axes: readonly number[];
  activityAtMs: number | null;
}>;

export type InputDeviceSnapshot = Readonly<{
  focused: boolean;
  keyboard: KeyboardDeviceSnapshot;
  gamepad: GamepadDeviceSnapshot | null;
}>;

export interface InputDevicePort {
  read(): InputDeviceSnapshot;
  clearTransient(): void;
}

export type SustainedActionMode = SaveSettings['sustainedAction'];

export type InputServiceOptions = Readonly<{
  bindingOverrides?: readonly BindingOverride[];
  sustainedAction?: SustainedActionMode;
  haptics?: HapticsPort;
}>;

export type InputActionState = Readonly<{
  value: number;
  held: boolean;
  pressed: boolean;
  released: boolean;
  bufferedPressId: number | null;
}>;

export type InputVector = Readonly<{ x: number; y: number }>;

export type InputFrame = Readonly<{
  sampledAtMs: number;
  actions: Readonly<Record<InputAction, InputActionState>>;
  move: InputVector;
  navigation: InputVector;
  activeDevice: InputDevice | null;
  deviceChangedAtMs: number | null;
}>;

type BufferState = {
  id: number;
  pressedAtMs: number;
  consumed: boolean;
};

type GamepadSample = Readonly<{
  values: ReadonlyMap<string, number>;
  held: ReadonlyMap<string, boolean>;
  activated: ReadonlySet<string>;
  participatingSources: ReadonlySet<string>;
  activityAtMs: number | null;
}>;

const BUFFER_WINDOW_MS = 120;
const BUFFERED_ACTIONS: ReadonlySet<InputAction> = new Set([
  'jump',
  'attack-light',
  'attack-heavy',
  'dash',
  'cast',
  'interact',
  'pause',
]);

export class InputService {
  private bindings: BindingMap;
  private readonly previousPhysicalHeld = createActionRecord(false);
  private readonly lastPhysicalValues = createActionRecord(0);
  private readonly actionActivatedAtMs = createActionRecord<number | null>(null);
  private readonly latches = createActionRecord(false);
  private readonly buffers = new Map<InputAction, BufferState>();
  private readonly gamepadLatches = new Map<string, boolean>();
  private readonly previousGamepadValues = new Map<string, number>();
  private readonly axesOutsideDeadzone = new Map<number, boolean>();
  private readonly keyboardActivatedAtMs = new Map<string, number>();
  private readonly gamepadActivatedAtMs = new Map<string, number>();
  private lastSampleAtMs: number | null = null;
  private cachedFrame: InputFrame | null = null;
  private nextPressId = 1;
  private activeDevice: InputDevice | null = null;
  private deviceChangedAtMs: number | null = null;
  private sustainedActionMode: SustainedActionMode;
  private focused = true;
  private neutralGate = false;
  private readonly haptics: HapticsPort | null;
  private connectedGamepadId: string | null = null;
  private disabledHapticsResult: Exclude<HapticsResult, 'played'> | null = null;

  public constructor(
    private readonly devicePort: InputDevicePort,
    options: InputServiceOptions = {},
  ) {
    this.bindings = createBindingMap(options.bindingOverrides ?? []);
    this.sustainedActionMode = options.sustainedAction ?? DEFAULT_SAVE_SETTINGS.sustainedAction;
    this.haptics = options.haptics ?? null;
  }

  public sample(nowMs: number): InputFrame {
    this.validateSampleTime(nowMs);
    if (nowMs === this.lastSampleAtMs && this.cachedFrame !== null) return this.cachedFrame;

    const snapshot = this.devicePort.read();
    if (this.observeGamepadConnection(snapshot.gamepad)) {
      this.clearTransientState();
      this.neutralGate = true;
      this.devicePort.clearTransient();
      this.stopHaptics();
      return this.cacheNeutralFrame(nowMs);
    }
    if (!snapshot.focused) {
      if (this.focused) {
        this.focused = false;
        this.clearTransientState();
        this.neutralGate = true;
        this.devicePort.clearTransient();
        this.stopHaptics();
      }
      return this.cacheNeutralFrame(nowMs);
    }
    if (!this.focused) this.focused = true;
    if (this.neutralGate) {
      // Edges cleared at the handoff are stale; new edges after it are intentional.
      // Accept a fresh keyboard action without requiring a spare neutral frame,
      // but never use it to reactivate another held key or a non-neutral gamepad.
      const freshCodes = new Set(snapshot.keyboard.pressed.map(({ code }) => code));
      const freshKeyboardIntent =
        freshCodes.size > 0 &&
        snapshot.keyboard.heldCodes.every((code) => freshCodes.has(code)) &&
        isSnapshotNeutral({ ...snapshot, keyboard: { ...snapshot.keyboard, heldCodes: [] } });
      if (freshKeyboardIntent) {
        this.neutralGate = false;
      } else {
        if (isSnapshotNeutral(snapshot)) this.neutralGate = false;
        return this.cacheNeutralFrame(nowMs);
      }
    }
    const gamepad = this.sampleGamepad(snapshot.gamepad, nowMs);
    this.observeDeviceActivity(snapshot.keyboard, gamepad.activityAtMs, nowMs);
    const heldCodes = new Set(snapshot.keyboard.heldCodes);
    this.observeKeyboardSources(snapshot.keyboard, heldCodes, nowMs);
    this.observeGamepadSources(gamepad);
    const actions = {} as Record<InputAction, InputActionState>;

    for (const action of INPUT_ACTIONS) {
      const actionBindings = this.bindings[action];
      const codes = actionBindings
        .filter((binding) => binding.kind === 'keyboard')
        .map((binding) => binding.code);
      const keyboardHeld = codes.some((code) => heldCodes.has(code));
      const pressedEdges = snapshot.keyboard.pressed.filter((edge) => codes.includes(edge.code));
      const releasedEdges = snapshot.keyboard.released.filter((edge) => codes.includes(edge.code));
      const gamepadBindings = actionBindings.filter((binding) => binding.kind !== 'keyboard');
      const gamepadValue = Math.max(
        0,
        ...gamepadBindings.map((binding) => gamepad.values.get(gamepadBindingKey(binding)) ?? 0),
      );
      const gamepadHeld = gamepadBindings.some(
        (binding) => gamepad.held.get(gamepadBindingKey(binding)) === true,
      );
      const physicalHeld = keyboardHeld || gamepadHeld;
      const physicalValue = Math.max(keyboardHeld ? 1 : 0, gamepadValue);
      const wasPhysicalHeld = this.previousPhysicalHeld[action];
      const quickTap =
        !wasPhysicalHeld && !physicalHeld && pressedEdges.length > 0 && releasedEdges.length > 0;
      const physicalPressed = (!wasPhysicalHeld && physicalHeld) || quickTap;
      const physicalReleased = (wasPhysicalHeld && !physicalHeld) || quickTap;
      const keyboardActivationAtMs =
        pressedEdges.length > 0 ? latestEdgeTime(pressedEdges, nowMs) : null;
      const gamepadActivated = gamepadBindings.some((binding) =>
        gamepad.activated.has(gamepadBindingKey(binding)),
      );
      const pressAtMs = latestNullable(
        keyboardActivationAtMs,
        gamepadActivated ? gamepad.activityAtMs : null,
      );
      this.actionActivatedAtMs[action] = latestActiveSourceTime(
        codes
          .filter((code) => heldCodes.has(code))
          .map((code) => this.keyboardActivatedAtMs.get(code) ?? null),
        gamepadBindings
          .filter((binding) => gamepad.participatingSources.has(gamepadBindingKey(binding)))
          .map((binding) => this.gamepadActivatedAtMs.get(gamepadBindingKey(binding)) ?? null),
      );

      const logical = this.logicalState(
        action,
        physicalValue,
        physicalHeld,
        physicalPressed,
        physicalReleased,
      );

      if (logical.pressed && BUFFERED_ACTIONS.has(action)) {
        this.buffers.set(action, {
          id: this.nextPressId,
          pressedAtMs: pressAtMs ?? nowMs,
          consumed: false,
        });
        this.nextPressId += 1;
      }
      const buffer = this.buffers.get(action);
      const bufferedPressId =
        buffer !== undefined && !buffer.consumed && nowMs <= buffer.pressedAtMs + BUFFER_WINDOW_MS
          ? buffer.id
          : null;
      if (buffer !== undefined && nowMs > buffer.pressedAtMs + BUFFER_WINDOW_MS) {
        this.buffers.delete(action);
      }
      actions[action] = Object.freeze({
        value: logical.value,
        held: logical.held,
        pressed: logical.pressed,
        released: logical.released,
        bufferedPressId,
      });
      this.previousPhysicalHeld[action] = physicalHeld;
      this.lastPhysicalValues[action] = physicalValue;
    }

    const frame = freezeFrame({
      sampledAtMs: nowMs,
      actions,
      move: this.directionVector(actions, 'move-left', 'move-right', 'move-up', 'move-down'),
      navigation: this.directionVector(actions, 'ui-left', 'ui-right', 'ui-up', 'ui-down'),
      activeDevice: this.activeDevice,
      deviceChangedAtMs: this.deviceChangedAtMs,
    });
    this.lastSampleAtMs = nowMs;
    this.cachedFrame = frame;
    return frame;
  }

  public consume(action: InputAction, bufferedPressId: number): boolean {
    const buffer = this.buffers.get(action);
    if (
      buffer === undefined ||
      buffer.id !== bufferedPressId ||
      buffer.consumed ||
      this.lastSampleAtMs === null ||
      this.lastSampleAtMs > buffer.pressedAtMs + BUFFER_WINDOW_MS
    ) {
      return false;
    }
    buffer.consumed = true;
    return true;
  }

  public clearTransient(): void {
    this.devicePort.clearTransient();
    this.clearTransientState();
    this.neutralGate = true;
    if (this.lastSampleAtMs !== null) this.cacheNeutralFrame(this.lastSampleAtMs);
  }

  public rebind(action: InputAction, binding: Binding): RebindResult {
    const result = rebindBindings(this.bindings, action, binding);
    if (result.kind !== 'applied') return result;
    this.bindings = result.bindingMap;
    this.clearTransient();
    return result;
  }

  public getActiveDevice(): InputDevice | null {
    return this.activeDevice;
  }

  public getBindings(action: InputAction): readonly Binding[] {
    return this.bindings[action];
  }

  public serializeBindingOverrides(): readonly BindingOverride[] {
    return serializeBindingOverrides(this.bindings);
  }

  public async pulseHaptics(pulse: HapticsPulse): Promise<HapticsResult> {
    if (this.haptics === null || this.connectedGamepadId === null) return 'unsupported';
    if (this.disabledHapticsResult !== null) return this.disabledHapticsResult;
    try {
      const result = await this.haptics.pulse(normalizeHapticsPulse(pulse));
      if (result !== 'played') this.disabledHapticsResult = result;
      return result;
    } catch {
      this.disabledHapticsResult = 'failed';
      return 'failed';
    }
  }

  public shutdown(): void {
    this.stopHaptics();
    this.clearTransientState();
    if (this.lastSampleAtMs !== null) this.cacheNeutralFrame(this.lastSampleAtMs);
  }

  public clearLatch(action: InputAction): void {
    const wasLatched = this.latches[action];
    this.latches[action] = false;
    if (wasLatched && this.sustainedActionMode === 'toggle') {
      this.replaceCachedAction(action, {
        value: 0,
        held: false,
        pressed: false,
        released: false,
      });
    }
  }

  public setSustainedActionMode(mode: SustainedActionMode): void {
    if (mode === this.sustainedActionMode) return;
    this.sustainedActionMode = mode;
    for (const action of INPUT_ACTIONS) this.latches[action] = false;
    for (const action of ['block', 'attack-heavy'] as const) {
      this.replaceCachedAction(action, {
        value: mode === 'hold' ? this.lastPhysicalValues[action] : 0,
        held: mode === 'hold' ? this.previousPhysicalHeld[action] : false,
        pressed: false,
        released: false,
      });
    }
  }

  private validateSampleTime(nowMs: number): void {
    if (!Number.isFinite(nowMs) || nowMs < 0) {
      throw new RangeError('Input sample time must be finite and non-negative.');
    }
    if (this.lastSampleAtMs !== null && nowMs < this.lastSampleAtMs) {
      throw new RangeError('Input sample time must be monotonic.');
    }
  }

  private sampleGamepad(snapshot: GamepadDeviceSnapshot | null, nowMs: number): GamepadSample {
    if (snapshot === null || !snapshot.connected) {
      this.gamepadLatches.clear();
      this.previousGamepadValues.clear();
      this.axesOutsideDeadzone.clear();
      return {
        values: new Map(),
        held: new Map(),
        activated: new Set(),
        participatingSources: new Set(),
        activityAtMs: null,
      };
    }

    const values = new Map<string, number>();
    const held = new Map<string, boolean>();
    const activated = new Set<string>();
    const participatingSources = new Set<string>();
    let meaningfulActivity = false;
    const observedAxes = new Set<number>();
    for (const action of INPUT_ACTIONS) {
      for (const binding of this.bindings[action]) {
        if (binding.kind === 'keyboard') continue;
        const key = gamepadBindingKey(binding);
        const value =
          binding.kind === 'gamepad-button'
            ? normalizeButton(snapshot.buttons[binding.button])
            : directionalAxisValue(snapshot.axes[binding.axis], binding.direction);
        values.set(key, value);
        const previousValue = this.previousGamepadValues.get(key) ?? 0;
        this.previousGamepadValues.set(key, value);
        const wasHeld = this.gamepadLatches.get(key) ?? false;
        const isHeld = wasHeld ? value > 0.45 : value >= 0.55;
        held.set(key, isHeld);
        this.gamepadLatches.set(key, isHeld);
        if (
          (binding.kind === 'gamepad-button' && isHeld) ||
          (binding.kind === 'gamepad-axis' && value > 0)
        ) {
          participatingSources.add(key);
        }
        if (!wasHeld && isHeld) {
          activated.add(key);
          meaningfulActivity = true;
        } else if (wasHeld && !isHeld) {
          meaningfulActivity = true;
        }
        if (binding.kind === 'gamepad-axis' && previousValue === 0 && value > 0) {
          activated.add(key);
          meaningfulActivity = true;
        } else if (binding.kind === 'gamepad-axis' && previousValue > 0 && value === 0) {
          meaningfulActivity = true;
        }
        if (binding.kind === 'gamepad-axis') observedAxes.add(binding.axis);
      }
    }

    for (const axis of observedAxes) {
      const outside = Math.abs(normalizeAxis(snapshot.axes[axis])) > 0.2;
      const wasOutside = this.axesOutsideDeadzone.get(axis) ?? false;
      if (outside !== wasOutside) meaningfulActivity = true;
      this.axesOutsideDeadzone.set(axis, outside);
    }

    return {
      values,
      held,
      activated,
      participatingSources,
      activityAtMs: meaningfulActivity ? validActivityTime(snapshot.activityAtMs, nowMs) : null,
    };
  }

  private observeKeyboardSources(
    keyboard: KeyboardDeviceSnapshot,
    heldCodes: ReadonlySet<string>,
    nowMs: number,
  ): void {
    for (const edge of keyboard.pressed) {
      if (heldCodes.has(edge.code) && !this.keyboardActivatedAtMs.has(edge.code)) {
        this.keyboardActivatedAtMs.set(edge.code, validActivityTime(edge.atMs, nowMs));
      }
    }
    for (const code of heldCodes) {
      if (!this.keyboardActivatedAtMs.has(code)) this.keyboardActivatedAtMs.set(code, nowMs);
    }
    for (const code of this.keyboardActivatedAtMs.keys()) {
      if (!heldCodes.has(code)) this.keyboardActivatedAtMs.delete(code);
    }
  }

  private observeGamepadSources(gamepad: GamepadSample): void {
    for (const key of gamepad.activated) {
      if (gamepad.activityAtMs !== null && !this.gamepadActivatedAtMs.has(key)) {
        this.gamepadActivatedAtMs.set(key, gamepad.activityAtMs);
      }
    }
    for (const key of gamepad.values.keys()) {
      if (!gamepad.participatingSources.has(key)) this.gamepadActivatedAtMs.delete(key);
    }
  }

  private observeGamepadConnection(snapshot: GamepadDeviceSnapshot | null): boolean {
    const nextId = snapshot !== null && snapshot.connected ? snapshot.id : null;
    const disconnected = this.connectedGamepadId !== null && nextId !== this.connectedGamepadId;
    if (nextId !== this.connectedGamepadId) {
      this.connectedGamepadId = nextId;
      this.disabledHapticsResult = null;
    }
    return disconnected;
  }

  private stopHaptics(): void {
    try {
      this.haptics?.stop();
    } catch {
      // Haptics are progressive enhancement and never affect input rules.
    }
  }

  private logicalState(
    action: InputAction,
    physicalValue: number,
    physicalHeld: boolean,
    physicalPressed: boolean,
    physicalReleased: boolean,
  ): Readonly<{ value: number; held: boolean; pressed: boolean; released: boolean }> {
    if (action === 'cast') {
      return {
        value: physicalPressed ? physicalValue || 1 : 0,
        held: false,
        pressed: physicalPressed,
        released: false,
      };
    }
    if (
      this.sustainedActionMode !== 'toggle' ||
      (action !== 'block' && action !== 'attack-heavy')
    ) {
      return {
        value: physicalValue,
        held: physicalHeld,
        pressed: physicalPressed,
        released: physicalReleased,
      };
    }
    let pressed = false;
    let released = false;
    if (physicalPressed) {
      if (this.latches[action]) {
        this.latches[action] = false;
        released = true;
      } else {
        this.latches[action] = true;
        pressed = true;
      }
    }
    return {
      value: this.latches[action] ? 1 : 0,
      held: this.latches[action],
      pressed,
      released,
    };
  }

  private clearTransientState(): void {
    this.buffers.clear();
    this.gamepadLatches.clear();
    this.previousGamepadValues.clear();
    this.axesOutsideDeadzone.clear();
    this.keyboardActivatedAtMs.clear();
    this.gamepadActivatedAtMs.clear();
    for (const action of INPUT_ACTIONS) {
      this.previousPhysicalHeld[action] = false;
      this.lastPhysicalValues[action] = 0;
      this.actionActivatedAtMs[action] = null;
      this.latches[action] = false;
    }
  }

  private cacheNeutralFrame(nowMs: number): InputFrame {
    const actions = {} as Record<InputAction, InputActionState>;
    for (const action of INPUT_ACTIONS) {
      actions[action] = Object.freeze({
        value: 0,
        held: false,
        pressed: false,
        released: false,
        bufferedPressId: null,
      });
    }
    const frame = freezeFrame({
      sampledAtMs: nowMs,
      actions,
      move: { x: 0, y: 0 },
      navigation: { x: 0, y: 0 },
      activeDevice: this.activeDevice,
      deviceChangedAtMs: this.deviceChangedAtMs,
    });
    this.lastSampleAtMs = nowMs;
    this.cachedFrame = frame;
    return frame;
  }

  private replaceCachedAction(
    action: InputAction,
    state: Readonly<{ value: number; held: boolean; pressed: boolean; released: boolean }>,
  ): void {
    const cached = this.cachedFrame;
    if (cached === null) return;
    const actions = { ...cached.actions } as Record<InputAction, InputActionState>;
    actions[action] = Object.freeze({
      ...state,
      bufferedPressId: cached.actions[action].bufferedPressId,
    });
    this.cachedFrame = freezeFrame({
      sampledAtMs: cached.sampledAtMs,
      actions,
      move: this.directionVector(actions, 'move-left', 'move-right', 'move-up', 'move-down'),
      navigation: this.directionVector(actions, 'ui-left', 'ui-right', 'ui-up', 'ui-down'),
      activeDevice: cached.activeDevice,
      deviceChangedAtMs: cached.deviceChangedAtMs,
    });
  }

  private observeDeviceActivity(
    keyboard: KeyboardDeviceSnapshot,
    gamepadActivityAtMs: number | null,
    nowMs: number,
  ): void {
    const keyboardActivityAtMs =
      keyboard.pressed.length > 0 || keyboard.released.length > 0
        ? validActivityTime(keyboard.activityAtMs, nowMs)
        : null;
    let nextDevice: InputDevice | null = null;
    let nextAtMs: number | null = null;
    if (keyboardActivityAtMs !== null && gamepadActivityAtMs !== null) {
      if (keyboardActivityAtMs > gamepadActivityAtMs) {
        nextDevice = 'keyboard';
        nextAtMs = keyboardActivityAtMs;
      } else if (gamepadActivityAtMs > keyboardActivityAtMs) {
        nextDevice = 'gamepad';
        nextAtMs = gamepadActivityAtMs;
      } else {
        nextDevice = this.activeDevice ?? 'keyboard';
        nextAtMs = keyboardActivityAtMs;
      }
    } else if (keyboardActivityAtMs !== null) {
      nextDevice = 'keyboard';
      nextAtMs = keyboardActivityAtMs;
    } else if (gamepadActivityAtMs !== null) {
      nextDevice = 'gamepad';
      nextAtMs = gamepadActivityAtMs;
    }
    if (nextDevice !== null && nextDevice !== this.activeDevice) {
      this.activeDevice = nextDevice;
      this.deviceChangedAtMs = nextAtMs;
    }
  }

  private directionVector(
    actions: Readonly<Record<InputAction, InputActionState>>,
    left: InputAction,
    right: InputAction,
    up: InputAction,
    down: InputAction,
  ): InputVector {
    return {
      x: this.resolveOpposition(actions, left, right),
      y: this.resolveOpposition(actions, up, down),
    };
  }

  private resolveOpposition(
    actions: Readonly<Record<InputAction, InputActionState>>,
    negative: InputAction,
    positive: InputAction,
  ): number {
    const negativeValue = actions[negative].value;
    const positiveValue = actions[positive].value;
    if (negativeValue === 0) return positiveValue;
    if (positiveValue === 0) return -negativeValue;
    const negativeAt = this.actionActivatedAtMs[negative];
    const positiveAt = this.actionActivatedAtMs[positive];
    if (negativeAt === positiveAt) return 0;
    if (negativeAt === null) return positiveValue;
    if (positiveAt === null) return -negativeValue;
    return positiveAt > negativeAt ? positiveValue : -negativeValue;
  }
}

function createActionRecord<Value>(value: Value): Record<InputAction, Value> {
  return Object.fromEntries(INPUT_ACTIONS.map((action) => [action, value])) as Record<
    InputAction,
    Value
  >;
}

function latestEdgeTime(edges: readonly InputEdge[], fallback: number): number {
  let latest = -1;
  for (const edge of edges) {
    if (Number.isFinite(edge.atMs) && edge.atMs >= 0 && edge.atMs <= fallback) {
      latest = Math.max(latest, edge.atMs);
    }
  }
  return latest < 0 ? fallback : latest;
}

function validActivityTime(activityAtMs: number | null, fallback: number): number {
  return activityAtMs !== null &&
    Number.isFinite(activityAtMs) &&
    activityAtMs >= 0 &&
    activityAtMs <= fallback
    ? activityAtMs
    : fallback;
}

function latestNullable(left: number | null, right: number | null): number | null {
  if (left === null) return right;
  if (right === null) return left;
  return Math.max(left, right);
}

function latestActiveSourceTime(...groups: readonly (readonly (number | null)[])[]): number | null {
  let latest: number | null = null;
  for (const group of groups) {
    for (const value of group) {
      if (value !== null && (latest === null || value > latest)) latest = value;
    }
  }
  return latest;
}

function gamepadBindingKey(
  binding:
    | Readonly<{ kind: 'gamepad-button'; button: number }>
    | Readonly<{ kind: 'gamepad-axis'; axis: number; direction: -1 | 1 }>,
): string {
  return binding.kind === 'gamepad-button'
    ? `button:${binding.button}`
    : `axis:${binding.axis}:${binding.direction}`;
}

function normalizeButton(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(1, raw));
}

function normalizeAxis(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return 0;
  return Math.max(-1, Math.min(1, raw));
}

function directionalAxisValue(raw: number | undefined, direction: -1 | 1): number {
  const normalized = normalizeAxis(raw);
  const magnitude = Math.abs(normalized);
  if (magnitude <= 0.2) return 0;
  const rescaled = (magnitude - 0.2) / 0.8;
  return Math.max(0, rescaled * Math.sign(normalized) * direction);
}

function isSnapshotNeutral(snapshot: InputDeviceSnapshot): boolean {
  if (snapshot.keyboard.heldCodes.length > 0) return false;
  const gamepad = snapshot.gamepad;
  if (gamepad === null || !gamepad.connected) return true;
  return (
    gamepad.buttons.every((button) => normalizeButton(button) <= 0.45) &&
    gamepad.axes.every((axis) => Math.abs(normalizeAxis(axis)) <= 0.2)
  );
}

function freezeFrame(frame: {
  sampledAtMs: number;
  actions: Record<InputAction, InputActionState>;
  move: { x: number; y: number };
  navigation: { x: number; y: number };
  activeDevice: InputDevice | null;
  deviceChangedAtMs: number | null;
}): InputFrame {
  return Object.freeze({
    ...frame,
    actions: Object.freeze(frame.actions),
    move: Object.freeze(frame.move),
    navigation: Object.freeze(frame.navigation),
  });
}
