import { describe, expect, it } from 'vitest';

import { stableId } from '../../src/game/core/StableId';
import { DEFAULT_SAVE_SETTINGS } from '../../src/game/saves/SaveSchema';
import type { InputDevicePort, InputDeviceSnapshot } from '../../src/game/input/InputService';
import { InputService } from '../../src/game/input/InputService';
import { PlayerController } from '../../src/game/entities/player/PlayerController';

class NeutralPort implements InputDevicePort {
  public read(): InputDeviceSnapshot {
    return {
      focused: true,
      keyboard: { heldCodes: [], pressed: [], released: [], activityAtMs: null },
      gamepad: null,
    };
  }

  public clearTransient(): void {}
}

function player() {
  return new PlayerController({
    input: new InputService(new NeutralPort()),
    position: { x: 100, y: 608 },
    surfaces: [
      {
        surfaceId: stableId<'surface'>('test-ground'),
        kind: 'solid',
        roomId: stableId<'room'>('test-room'),
        bounds: { x: 0, y: 608, width: 800, height: 112 },
        materialId: stableId<'material'>('test-stone'),
      },
    ],
    zones: [],
    vitals: {
      currentHealth: 12,
      maxHealth: 100,
      maxPoise: 40,
      armour: 3,
      resistances: {},
    },
    combat: {
      currentMana: 3,
      unlockedAbilityIds: [],
      initialFacing: 'right',
      settings: DEFAULT_SAVE_SETTINGS,
      targets: () => [],
    },
  });
}

describe('Player interaction and checkpoint restore', () => {
  it('enters interaction only from movement, stops horizontal motion, and clears on close', () => {
    const controller = player();
    expect(controller.beginInteraction()).toBe(true);
    expect(controller.snapshot()).toMatchObject({
      state: 'interact',
      velocity: { x: 0 },
      combat: { activeAttackId: null, guarding: false },
    });
    expect(controller.beginInteraction()).toBe(false);
    expect(controller.endInteraction()).toBe(true);
    expect(controller.snapshot().state).toBe('idle');
    expect(controller.endInteraction()).toBe(false);
  });

  it('restores exact health, mana, poise, position, and transient combat state without respawn', () => {
    const controller = player();
    controller.restAtCheckpoint({ x: 256, y: 608 }, { currentHealth: 100, currentMana: 40 });
    expect(controller.snapshot()).toMatchObject({
      position: { x: 256, y: 608 },
      state: 'idle',
      vitality: { currentHealth: 100, currentPoise: 40 },
      combat: {
        currentMana: 40,
        activeAttackId: null,
        guarding: false,
        projectileCount: 0,
        statuses: [],
      },
    });
  });
});
