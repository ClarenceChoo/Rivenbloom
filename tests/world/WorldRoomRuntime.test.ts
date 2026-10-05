import { describe, expect, test } from 'vitest';

import { stableId } from '../../src/game/core/StableId';
import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { createNewSave } from '../../src/game/saves/SaveSchema';
import type { SaveV1 } from '../../src/game/saves/SaveSchema';
import { AreaLoader } from '../../src/game/world/AreaLoader';
import { WorldRoomRuntime } from '../../src/game/world/WorldRoomRuntime';
import { applyProgressionTransaction } from '../../src/game/world/WorldProgression';
import { PlayerController } from '../../src/game/entities/player/PlayerController';
import { InputService } from '../../src/game/input/InputService';
import type { InputDevicePort } from '../../src/game/input/InputService';

function save(): SaveV1 {
  const { newGame } = CONTENT_REGISTRY;
  return createNewSave({
    nowEpochMs: 100,
    location: {
      regionId: newGame.initialRegionId,
      areaId: newGame.initialAreaId,
      checkpointId: newGame.initialCheckpointId,
      safePosition: { x: 256, y: 608 },
    },
    baseStats: newGame.baseStats,
    initialQuests: newGame.initialQuests,
    startingAbilities: newGame.startingAbilities,
  });
}

function runtime(roomId: string, current = save()) {
  const loader = new AreaLoader(CONTENT_REGISTRY);
  const area = loader.load(CONTENT_REGISTRY.areas.find(({ areaId }) => areaId === 'brackenreach')!);
  return new WorldRoomRuntime({
    registry: CONTENT_REGISTRY,
    loader,
    area,
    roomId: stableId<'room'>(roomId),
    save: current,
    baseline: { lastStepIndex: 0, simulationTimeMs: 0 },
    readCameraBounds: () => ({ x: 0, y: 0, width: 1_280, height: 720 }),
  });
}

describe('WorldRoomRuntime', () => {
  test('applies authored hazard contact on the shared clock and respects its re-hit interval', () => {
    const current = save();
    const loader = new AreaLoader(CONTENT_REGISTRY);
    const area = loader.load(
      CONTENT_REGISTRY.areas.find(({ areaId }) => areaId === 'singing-hollows')!,
    );
    const roomId = stableId<'room'>('root-memory-chamber');
    const room = new WorldRoomRuntime({
      registry: CONTENT_REGISTRY,
      loader,
      area,
      roomId,
      save: current,
      baseline: { lastStepIndex: 0, simulationTimeMs: 0 },
      readCameraBounds: () => ({ x: 3520, y: 0, width: 1_280, height: 720 }),
    });
    const inputPort: InputDevicePort = {
      read: () => ({
        focused: true,
        keyboard: {
          heldCodes: [],
          pressed: [],
          released: [],
          activityAtMs: null,
        },
        gamepad: null,
      }),
      clearTransient: () => undefined,
    };
    const controller = new PlayerController({
      input: new InputService(inputPort),
      roomId,
      position: { x: 5180, y: 788 },
      surfaces: area.surfacesFor(roomId),
      zones: area.zonesFor(roomId),
      movementBounds: area.room(roomId)!.bounds,
      fixedStepObserver: (frame) => {
        room.advance(frame, current);
      },
    });
    room.bindPlayer({
      readSnapshot: () => controller.snapshot(),
      readTarget: () => controller.hurtboxTarget(),
      receiveImpact: (impact) => controller.receiveImpact(impact),
      captureCombatEvents: () => controller.captureFixedStepCombatEvents(),
      requestHitStop: (hitStopMs) => controller.requestSharedHitStop(hitStopMs),
      restoreManaTo: (maximumMana, occurredAtMs) =>
        controller.restoreManaTo(maximumMana, occurredAtMs),
      readMaximumMana: () => 40,
    });

    controller.update(0, 1 / 60);
    const firstHealth = controller.snapshot().vitality.currentHealth;
    expect(firstHealth).toBeLessThan(100);
    expect(
      controller.rebindRoom({
        roomId,
        position: { x: 5180, y: 788 },
        facing: 'right',
        surfaces: area.surfacesFor(roomId),
        zones: area.zonesFor(roomId),
        movementBounds: area.room(roomId)!.bounds,
      }),
    ).toBe(true);
    let render = 1;
    while (controller.snapshot().combatSimulationTimeMs < 600) {
      controller.update(render * 17, 1 / 60);
      render += 1;
    }
    expect(controller.snapshot().vitality.currentHealth).toBe(firstHealth);
    while (controller.snapshot().combatSimulationTimeMs < 700) {
      controller.update(render * 17, 1 / 60);
      render += 1;
    }
    expect(controller.snapshot().vitality.currentHealth).toBe(firstHealth);
    while (controller.snapshot().combatSimulationTimeMs < 1_400) {
      controller.update(render * 17, 1 / 60);
      render += 1;
    }
    expect(controller.snapshot().vitality.currentHealth).toBeLessThan(firstHealth);
  });

  test('composes exact encounter spawns and separate stable environment targets', () => {
    const room = runtime('brackenreach-trail');
    const snapshot = room.snapshot();

    expect(snapshot.roomId).toBe('brackenreach-trail');
    expect(snapshot.activeSpawnIds).toEqual(['trail-briar-east', 'trail-briar-west']);
    expect(room.targets().map(({ targetId }) => targetId)).toEqual(['split-cedar-root-knot']);
    expect(snapshot.objects.breakables).toEqual([
      { breakableId: 'split-cedar-root-knot', state: 'closed' },
    ]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(room.dispose()).toBe(true);
    expect(room.dispose()).toBe(false);
    expect(room.targets()).toEqual([]);
  });

  test('suppresses the completed Sentinel from a reconstructed room runtime', () => {
    const current = save();
    const completed = applyProgressionTransaction(current, {
      commands: [{ kind: 'set-fact', factId: stableId<'quest-flag'>('briar-core-claimed') }],
    });
    expect(completed.kind).toBe('accepted');
    if (completed.kind !== 'accepted') return;

    const room = runtime('reliquary-verge', completed.save);
    expect(room.snapshot().activeSpawnIds).toEqual([]);
    expect(room.targets()).toEqual([]);
  });
});
