import { describe, expect, test } from 'vitest';

import {
  INITIAL_PLAYER_COMBAT_STATE,
  stepPlayerCombat,
} from '../../src/game/entities/player/PlayerCombatModel';
import { stableId } from '../../src/game/core/StableId';

const intent = (patch = {}) => ({
  nowMs: 0,
  grounded: true,
  lightBufferId: null,
  heavyPressed: false,
  heavyReleased: false,
  heavyHeld: false,
  blockPressed: false,
  blockHeld: false,
  reset: null,
  ...patch,
});

const context = (patch = {}) => ({ activeAttackFrame: null, attackComplete: false, ...patch });

describe('stepPlayerCombat', () => {
  test('starts grounded light one or one airborne slash and consumes accepted buffer once', () => {
    const grounded = stepPlayerCombat(
      INITIAL_PLAYER_COMBAT_STATE,
      intent({ lightBufferId: 7 }),
      context(),
    );
    expect(grounded.commands).toEqual([
      { kind: 'request-state', state: 'attackLight' },
      { kind: 'start-attack', attackId: 'mara-light-one' },
    ]);
    expect(grounded.consumedBufferIds).toEqual([7]);
    const duplicate = stepPlayerCombat(
      grounded.state,
      intent({ lightBufferId: 7 }),
      context({ activeAttackFrame: 8 }),
    );
    expect(duplicate.consumedBufferIds).toEqual([]);

    const airborne = stepPlayerCombat(
      INITIAL_PLAYER_COMBAT_STATE,
      intent({ grounded: false, lightBufferId: 8 }),
      context(),
    );
    expect(airborne.commands).toContainEqual({ kind: 'start-attack', attackId: 'mara-air-slash' });
    const repeated = stepPlayerCombat(
      airborne.state,
      intent({ grounded: false, lightBufferId: 9 }),
      context({ attackComplete: true }),
    );
    expect(repeated.consumedBufferIds).toEqual([]);
    expect(repeated.commands).toEqual([]);
  });

  test('chains one to two to three only in authored cancel windows and never consumes rejection', () => {
    const first = stepPlayerCombat(
      INITIAL_PLAYER_COMBAT_STATE,
      intent({ lightBufferId: 1 }),
      context(),
    );
    const early = stepPlayerCombat(
      first.state,
      intent({ lightBufferId: 2 }),
      context({ activeAttackFrame: 2 }),
    );
    expect(early.consumedBufferIds).toEqual([]);

    const second = stepPlayerCombat(
      first.state,
      intent({ lightBufferId: 2 }),
      context({ activeAttackFrame: 8 }),
    );
    expect(second.consumedBufferIds).toEqual([2]);
    expect(second.commands).toContainEqual({ kind: 'start-attack', attackId: 'mara-light-two' });
    const replayedFirst = stepPlayerCombat(
      second.state,
      intent({ lightBufferId: 1 }),
      context({ activeAttackFrame: 9 }),
    );
    expect(replayedFirst.consumedBufferIds).toEqual([]);
    const third = stepPlayerCombat(
      second.state,
      intent({ lightBufferId: 3 }),
      context({ activeAttackFrame: 9 }),
    );
    expect(third.commands).toContainEqual({ kind: 'start-attack', attackId: 'mara-light-three' });
  });

  test('cancels an early heavy release, fires after minimum charge, and auto-fires at maximum', () => {
    const charging = stepPlayerCombat(
      INITIAL_PLAYER_COMBAT_STATE,
      intent({ nowMs: 100, heavyPressed: true, heavyHeld: true }),
      context(),
    );
    const early = stepPlayerCombat(
      charging.state,
      intent({ nowMs: 449, heavyReleased: true }),
      context(),
    );
    expect(early.commands).toEqual([{ kind: 'request-state', state: 'idle' }]);

    const charged = stepPlayerCombat(
      charging.state,
      intent({ nowMs: 450, heavyReleased: true }),
      context(),
    );
    expect(charged.commands).toContainEqual({
      kind: 'start-attack',
      attackId: 'mara-charged-heavy',
    });
    expect(charged.clearHeavyToggleLatch).toBe(false);

    const auto = stepPlayerCombat(
      charging.state,
      intent({ nowMs: 1000, heavyHeld: true }),
      context(),
    );
    expect(auto.commands).toContainEqual({ kind: 'start-attack', attackId: 'mara-charged-heavy' });
    expect(auto.clearHeavyToggleLatch).toBe(true);
  });

  test('opens a 120 ms parry then remains blocking while held and exits on release', () => {
    const opened = stepPlayerCombat(
      INITIAL_PLAYER_COMBAT_STATE,
      intent({ nowMs: 50, blockPressed: true, blockHeld: true }),
      context(),
    );
    expect(opened.state.parryUntilMs).toBe(170);
    expect(opened.commands).toEqual([{ kind: 'request-state', state: 'parry' }]);

    const blocking = stepPlayerCombat(
      opened.state,
      intent({ nowMs: 170, blockHeld: true }),
      context(),
    );
    expect(blocking.commands).toEqual([{ kind: 'request-state', state: 'block' }]);
    const released = stepPlayerCombat(blocking.state, intent({ nowMs: 171 }), context());
    expect(released.commands).toEqual([{ kind: 'request-state', state: 'idle' }]);
    expect(released.state.guarding).toBe(false);
  });

  test.each(['hurt', 'dead', 'respawn'] as const)(
    '%s resets attacks, charge, guard, buffers, and air attack use',
    (reset) => {
      const dirty = {
        activeAttackId: stableId<'attack'>('mara-air-slash'),
        heavyChargeStartedAtMs: 10,
        guarding: true,
        parryUntilMs: 130,
        airAttackUsed: true,
        wasGrounded: false,
        highestConsumedLightBufferId: 4,
      };
      const result = stepPlayerCombat(dirty, intent({ nowMs: 50, reset }), context());
      expect(result.state).toEqual(INITIAL_PLAYER_COMBAT_STATE);
      expect(result.consumedBufferIds).toEqual([]);
    },
  );

  test('landing restores the single airborne attack', () => {
    const state = { ...INITIAL_PLAYER_COMBAT_STATE, airAttackUsed: true, wasGrounded: false };
    expect(stepPlayerCombat(state, intent({ grounded: true }), context()).state.airAttackUsed).toBe(
      false,
    );
  });
});
