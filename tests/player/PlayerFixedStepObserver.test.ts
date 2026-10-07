import { describe, expect, test } from 'vitest';

import { stableId } from '../../src/game/core/StableId';
import { PlayerController } from '../../src/game/entities/player/PlayerController';
import type { PlayerControllerSnapshot } from '../../src/game/entities/player/PlayerController';
import { InputService } from '../../src/game/input/InputService';
import type {
  InputDevicePort,
  InputDeviceSnapshot,
  InputEdge,
} from '../../src/game/input/InputService';
import type { SurfaceDefinition } from '../../src/game/data/types';
import { DEFAULT_SAVE_SETTINGS } from '../../src/game/saves/SaveSchema';

class CountingPort implements InputDevicePort {
  public reads = 0;
  public heldCodes: readonly string[] = [];
  public pressed: readonly InputEdge[] = [];
  public released: readonly InputEdge[] = [];

  public read(): InputDeviceSnapshot {
    this.reads += 1;
    const snapshot = {
      focused: true,
      keyboard: {
        heldCodes: this.heldCodes,
        pressed: this.pressed,
        released: this.released,
        activityAtMs: null,
      },
      gamepad: null,
    };
    this.pressed = [];
    this.released = [];
    return snapshot;
  }

  public clearTransient(): void {}
}

const GROUND: SurfaceDefinition = {
  surfaceId: stableId<'surface'>('observer-ground'),
  kind: 'solid',
  roomId: stableId<'room'>('observer-room'),
  bounds: { x: 0, y: 608, width: 1_000, height: 112 },
  materialId: stableId<'material'>('observer-stone'),
};

describe('PlayerController fixed-step observer', () => {
  test('retains a short Pause press across a render frame with no simulation step', () => {
    const port = new CountingPort();
    const input = new InputService(port);
    let pauses = 0;
    const controller = new PlayerController({
      input,
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      fixedStepObserver: ({ input: frame }) => {
        if (frame.pauseBufferId != null && input.consume('pause', frame.pauseBufferId)) {
          pauses += 1;
        }
      },
    });
    port.heldCodes = ['Escape'];
    controller.update(8, 0.008);
    expect(pauses).toBe(0);
    port.heldCodes = [];
    controller.update(17, 0.009);
    expect(pauses).toBe(1);
    controller.update(50, 0.033);
    expect(pauses).toBe(1);
  });

  test('delivers a quick pause tap sampled between fixed steps exactly once', () => {
    const port = new CountingPort();
    const input = new InputService(port);
    let pauses = 0;
    const controller = new PlayerController({
      input,
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      fixedStepObserver: (frame) => {
        const pressId = frame.input.pauseBufferId;
        if (pressId != null && input.consume('pause', pressId)) {
          pauses += 1;
          return { halt: true };
        }
      },
    });
    controller.update(0, 1 / 60);
    port.pressed = [{ code: 'Escape', atMs: 1 }];
    port.released = [{ code: 'Escape', atMs: 2 }];

    controller.update(2, 0.001);
    expect(pauses).toBe(0);
    controller.update(20, 1 / 60);
    expect(pauses).toBe(1);
    controller.update(40, 0.05);
    expect(pauses).toBe(1);
  });

  test('publishes every advanced substep from one sampled input frame', () => {
    const port = new CountingPort();
    const frames: unknown[] = [];
    const controller = new PlayerController({
      input: new InputService(port),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      fixedStepObserver: (frame) => {
        frames.push(frame);
      },
    });

    controller.update(50, 0.05);

    expect(port.reads).toBe(1);
    expect(frames).toHaveLength(3);
    expect(frames).toMatchObject([
      { stepIndex: 1, startTimeMs: 0, endTimeMs: 17 },
      { stepIndex: 2, startTimeMs: 17, endTimeMs: 33 },
      { stepIndex: 3, startTimeMs: 33, endTimeMs: 50 },
    ]);
    expect(Object.isFrozen(frames[0])).toBe(true);
  });

  test('publishes dash substeps but not discarded hit-stop wall time', () => {
    const port = new CountingPort();
    port.heldCodes = ['ShiftLeft'];
    const frames: Array<Readonly<{ stepIndex: number; player: Readonly<{ state: string }> }>> = [];
    const controller = new PlayerController({
      input: new InputService(port),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      combat: {
        currentMana: 40,
        unlockedAbilityIds: [stableId<'ability'>('wayfinder-dash')],
        initialFacing: 'right',
        settings: DEFAULT_SAVE_SETTINGS,
        targets: () => [],
      },
      fixedStepObserver: (frame) => {
        frames.push(frame);
      },
    });

    controller.update(0, 0.05);
    expect(frames).toHaveLength(3);
    expect(frames.every(({ player }) => player.state === 'dash')).toBe(true);
    const advancedBeforeStop = frames.length;
    controller.requestSharedHitStop(34);
    controller.update(50, 0.05);

    expect(frames).toHaveLength(advancedBeforeStop + 1);
    expect(port.reads).toBe(2);
  });

  test('applies a block press on the first actually advanced step after partial hit-stop', () => {
    const port = new CountingPort();
    const frames: PlayerControllerSnapshot[] = [];
    const controller = new PlayerController({
      input: new InputService(port),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      fixedStepObserver: ({ player }) => {
        frames.push(player);
      },
    });
    controller.update(0, 0);
    controller.requestSharedHitStop(17);
    port.heldCodes = ['KeyL'];

    controller.update(17, 0.05);

    expect(port.reads).toBe(2);
    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({
      state: 'parry',
      combat: { guarding: true, parryActive: true },
    });
  });

  test('applies a heavy press on the first actually advanced step after partial hit-stop', () => {
    const port = new CountingPort();
    const frames: PlayerControllerSnapshot[] = [];
    const controller = new PlayerController({
      input: new InputService(port),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      fixedStepObserver: ({ player }) => {
        frames.push(player);
      },
    });
    controller.update(0, 0);
    controller.requestSharedHitStop(17);
    port.heldCodes = ['KeyK'];

    controller.update(17, 0.05);

    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({
      state: 'attackHeavy',
      combat: { activeAttackId: null },
    });
  });

  test('applies a heavy release on the first actually advanced step after partial hit-stop', () => {
    const port = new CountingPort();
    const frames: PlayerControllerSnapshot[] = [];
    const controller = new PlayerController({
      input: new InputService(port),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      fixedStepObserver: ({ player }) => {
        frames.push(player);
      },
    });
    controller.update(0, 0);
    port.heldCodes = ['KeyK'];
    for (let render = 1; render <= 21; render += 1) {
      controller.update(render * 17, 1 / 60);
    }
    expect(controller.snapshot()).toMatchObject({
      state: 'attackHeavy',
      combat: { activeAttackId: null },
    });
    frames.length = 0;
    controller.requestSharedHitStop(17);
    port.heldCodes = [];

    controller.update(22 * 17, 0.05);

    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({
      state: 'attackHeavy',
      combat: {
        lastAcceptedAction: 'attack-heavy',
        activeAttackId: 'mara-charged-heavy',
      },
    });
  });

  test('halts remaining sampled substeps without retaining simulation debt', () => {
    const frames: number[] = [];
    const controller = new PlayerController({
      input: new InputService(new CountingPort()),
      position: { x: 256, y: 608 },
      surfaces: [GROUND],
      zones: [],
      fixedStepObserver: (frame) => {
        frames.push(frame.stepIndex);
        return { halt: true };
      },
    });

    const halted = controller.update(0, 0.05);
    controller.update(50, 0);

    expect(frames).toEqual([1]);
    expect(halted.pendingSimulationSeconds).toBeCloseTo(0);
  });
});
