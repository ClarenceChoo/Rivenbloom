import type {
  GamepadDeviceSnapshot,
  InputDevicePort,
  InputDeviceSnapshot,
  InputEdge,
} from './InputService';
import type { HapticsPort, HapticsPulse, HapticsResult } from './Haptics';

export interface MonotonicClock {
  nowMs(): number;
}

export interface BrowserEventSource {
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void;
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void;
}

export interface BrowserDocumentSource extends BrowserEventSource {
  readonly visibilityState: DocumentVisibilityState;
  hasFocus(): boolean;
}

export type BrowserInputEnvironment = Readonly<{
  window: BrowserEventSource;
  document: BrowserDocumentSource;
  getGamepads: () => readonly (Gamepad | null)[];
}>;

export class BrowserInputDeviceAdapter implements InputDevicePort {
  private readonly heldCodes = new Set<string>();
  private readonly pressed: InputEdge[] = [];
  private readonly released: InputEdge[] = [];
  private activityAtMs: number | null = null;
  private focused = false;

  private readonly keyDownListener: EventListener = (event) => {
    const keyboard = event as KeyboardEvent;
    if (keyboard.repeat || this.heldCodes.has(keyboard.code)) return;
    const atMs = this.eventTime();
    this.heldCodes.add(keyboard.code);
    this.pressed.push(Object.freeze({ code: keyboard.code, atMs }));
    this.activityAtMs = atMs;
  };

  private readonly keyUpListener: EventListener = (event) => {
    const keyboard = event as KeyboardEvent;
    if (!this.heldCodes.delete(keyboard.code)) return;
    const atMs = this.eventTime();
    this.released.push(Object.freeze({ code: keyboard.code, atMs }));
    this.activityAtMs = atMs;
  };

  private readonly blurListener: EventListener = () => {
    this.focused = false;
    this.clearKeyboardState();
  };

  private readonly focusListener: EventListener = () => {
    this.focused = this.computeFocused();
  };

  private readonly visibilityListener: EventListener = () => {
    if (this.environment.document.visibilityState === 'hidden') {
      this.focused = false;
      this.clearKeyboardState();
    } else {
      this.focused = this.computeFocused();
    }
  };

  public constructor(
    private readonly clock: MonotonicClock,
    private readonly environment: BrowserInputEnvironment = defaultBrowserEnvironment(),
  ) {
    this.focused = this.computeFocused();
    this.environment.window.addEventListener('keydown', this.keyDownListener);
    this.environment.window.addEventListener('keyup', this.keyUpListener);
    this.environment.window.addEventListener('blur', this.blurListener);
    this.environment.window.addEventListener('focus', this.focusListener);
    this.environment.document.addEventListener('visibilitychange', this.visibilityListener);
  }

  public read(): InputDeviceSnapshot {
    const snapshot = Object.freeze({
      focused: this.focused,
      keyboard: Object.freeze({
        heldCodes: Object.freeze([...this.heldCodes].sort()),
        pressed: Object.freeze([...this.pressed]),
        released: Object.freeze([...this.released]),
        activityAtMs: this.activityAtMs,
      }),
      gamepad: this.readGamepad(),
    });
    this.pressed.length = 0;
    this.released.length = 0;
    this.activityAtMs = null;
    return snapshot;
  }

  public clearTransient(): void {
    this.pressed.length = 0;
    this.released.length = 0;
    this.activityAtMs = null;
  }

  public shutdown(): void {
    this.environment.window.removeEventListener('keydown', this.keyDownListener);
    this.environment.window.removeEventListener('keyup', this.keyUpListener);
    this.environment.window.removeEventListener('blur', this.blurListener);
    this.environment.window.removeEventListener('focus', this.focusListener);
    this.environment.document.removeEventListener('visibilitychange', this.visibilityListener);
    this.clearKeyboardState();
    this.focused = false;
  }

  private readGamepad(): GamepadDeviceSnapshot | null {
    let gamepads: readonly (Gamepad | null)[];
    try {
      gamepads = this.environment.getGamepads();
    } catch {
      return null;
    }
    const gamepad = gamepads.find(
      (candidate): candidate is Gamepad =>
        candidate !== null && candidate.connected && candidate.mapping === 'standard',
    );
    if (gamepad === undefined) return null;
    return Object.freeze({
      id: gamepad.id,
      connected: true,
      buttons: Object.freeze(Array.from(gamepad.buttons, (button) => button.value)),
      axes: Object.freeze([...gamepad.axes]),
      activityAtMs: null,
    });
  }

  private eventTime(): number {
    const nowMs = this.clock.nowMs();
    if (!Number.isFinite(nowMs) || nowMs < 0) {
      throw new RangeError('Browser input clock must be finite and non-negative.');
    }
    return nowMs;
  }

  private computeFocused(): boolean {
    if (this.environment.document.visibilityState === 'hidden') return false;
    return this.environment.document.hasFocus();
  }

  private clearKeyboardState(): void {
    this.heldCodes.clear();
    this.clearTransient();
  }
}

export class BrowserGamepadHapticsPort implements HapticsPort {
  public constructor(private readonly getGamepad: () => Gamepad | null) {}

  public async pulse(pulse: HapticsPulse): Promise<HapticsResult> {
    const gamepad = this.getGamepad();
    const actuator = gamepad?.vibrationActuator;
    if (gamepad === null || !gamepad.connected || actuator === undefined) return 'unsupported';
    try {
      const result = await actuator.playEffect('dual-rumble', {
        duration: pulse.durationMs,
        weakMagnitude: pulse.weakMagnitude,
        strongMagnitude: pulse.strongMagnitude,
      });
      return result === 'complete' ? 'played' : 'failed';
    } catch {
      return 'failed';
    }
  }

  public stop(): void {
    const actuator = this.getGamepad()?.vibrationActuator;
    if (actuator === undefined) return;
    void actuator.reset().catch(() => undefined);
  }
}

function defaultBrowserEnvironment(): BrowserInputEnvironment {
  return {
    window,
    document,
    getGamepads: () => navigator.getGamepads(),
  };
}
