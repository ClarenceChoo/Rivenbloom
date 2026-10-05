import { describe, expect, it } from 'vitest';

import { BrowserGamepadHapticsPort } from '../../src/game/input/BrowserInputDeviceAdapter';
import { InputService } from '../../src/game/input/InputService';
import type { HapticsPort, HapticsPulse, HapticsResult } from '../../src/game/input/Haptics';
import type { InputDevicePort, InputDeviceSnapshot } from '../../src/game/input/InputService';

class HapticsInputPort implements InputDevicePort {
  public snapshot: InputDeviceSnapshot = gamepadSnapshot(true);
  public read(): InputDeviceSnapshot {
    return this.snapshot;
  }
  public clearTransient(): void {}
}

class RecordingHaptics implements HapticsPort {
  public readonly pulses: HapticsPulse[] = [];
  public stops = 0;
  public result: HapticsResult | Error = 'played';

  public async pulse(pulse: HapticsPulse): Promise<HapticsResult> {
    this.pulses.push(pulse);
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }

  public stop(): void {
    this.stops += 1;
  }
}

function gamepadSnapshot(connected: boolean): InputDeviceSnapshot {
  return {
    focused: true,
    keyboard: { heldCodes: [], pressed: [], released: [], activityAtMs: null },
    gamepad: {
      id: 'pad-1',
      connected,
      buttons: [],
      axes: [],
      activityAtMs: null,
    },
  };
}

describe('optional input haptics', () => {
  it('clamps pulse parameters and never affects semantic input', async () => {
    const port = new HapticsInputPort();
    const haptics = new RecordingHaptics();
    const input = new InputService(port, { haptics });
    const before = input.sample(0);

    await expect(
      input.pulseHaptics({
        durationMs: 5_000,
        weakMagnitude: 2,
        strongMagnitude: Number.NaN,
      }),
    ).resolves.toBe('played');

    expect(haptics.pulses).toEqual([{ durationMs: 1_000, weakMagnitude: 1, strongMagnitude: 0 }]);
    expect(input.sample(0)).toBe(before);
  });

  it('turns rejection into failure and suppresses retries until reconnect', async () => {
    const port = new HapticsInputPort();
    const haptics = new RecordingHaptics();
    haptics.result = new Error('actuator failed');
    const input = new InputService(port, { haptics });
    input.sample(0);

    await expect(
      input.pulseHaptics({ durationMs: 20, weakMagnitude: 0.5, strongMagnitude: 1 }),
    ).resolves.toBe('failed');
    await expect(
      input.pulseHaptics({ durationMs: 20, weakMagnitude: 0.5, strongMagnitude: 1 }),
    ).resolves.toBe('failed');
    expect(haptics.pulses).toHaveLength(1);
    port.snapshot = gamepadSnapshot(false);
    input.sample(10);
    await expect(
      input.pulseHaptics({ durationMs: 20, weakMagnitude: 0.5, strongMagnitude: 1 }),
    ).resolves.toBe('unsupported');
    port.snapshot = gamepadSnapshot(true);
    input.sample(20);
    port.snapshot = gamepadSnapshot(true);
    input.sample(30);
    haptics.result = 'played';
    await expect(
      input.pulseHaptics({ durationMs: 20, weakMagnitude: 0.5, strongMagnitude: 1 }),
    ).resolves.toBe('played');
    expect(haptics.pulses).toHaveLength(2);
  });

  it('is harmless without a haptics port and stops on focus loss and shutdown', async () => {
    const port = new HapticsInputPort();
    const haptics = new RecordingHaptics();
    const input = new InputService(port, { haptics });
    input.sample(0);
    port.snapshot = { ...gamepadSnapshot(true), focused: false };
    input.sample(10);
    input.shutdown();
    expect(haptics.stops).toBe(2);

    const withoutHaptics = new InputService(new HapticsInputPort());
    withoutHaptics.sample(0);
    await expect(
      withoutHaptics.pulseHaptics({ durationMs: 20, weakMagnitude: 1, strongMagnitude: 1 }),
    ).resolves.toBe('unsupported');
  });

  it('turns a real browser actuator rejection into a harmless failed result', async () => {
    const gamepad: Gamepad = {
      id: 'rejecting-pad',
      connected: true,
      mapping: 'standard',
      index: 0,
      timestamp: 0,
      buttons: [],
      axes: [],
      vibrationActuator: {
        playEffect: async () => {
          throw new Error('browser actuator rejected');
        },
        reset: async () => 'complete',
      },
    };
    const haptics = new BrowserGamepadHapticsPort(() => gamepad);

    await expect(
      haptics.pulse({ durationMs: 25, weakMagnitude: 0.25, strongMagnitude: 0.75 }),
    ).resolves.toBe('failed');
  });
});
