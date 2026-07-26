import { describe, expect, it } from 'vitest';
import {
  advancePlayerCombatFrame,
  applyCombatMovementLocks,
  createPlayerCombatState,
  type PlayerCombatContext,
  type PlayerCombatInput
} from '../../src/game/combat/PlayerCombat';
import {
  createPlayerStateMachine,
  type PlayerStateMachine
} from '../../src/game/entities/player/PlayerState';
import type { MovementInput } from '../../src/game/physics/MovementModel';

const neutral: PlayerCombatInput = {
  lightPressed: false,
  heavyPressed: false,
  heavyHeld: false,
  heavyReleased: false,
  blockPressed: false,
  blockHeld: false,
  blockReleased: false,
  dashPressed: false,
  castPressed: false,
  cycleLeftPressed: false,
  cycleRightPressed: false
};

const movement: MovementInput = {
  moveX: 1,
  moveY: 0,
  jumpPressed: true,
  jumpHeld: true,
  dropPressed: false,
  respawn: false
};

const context = (
  machine: PlayerStateMachine,
  update: Partial<PlayerCombatContext> = {}
): PlayerCombatContext => ({
  machine,
  grounded: true,
  facing: 'right',
  locomotionState: 'idle',
  nowMs: 1_000,
  ...update
});

describe('advancePlayerCombatFrame', () => {
  it('buffers three explicit light stages only inside cancel windows and resets after stage three', () => {
    let state = createPlayerCombatState();
    let machine = createPlayerStateMachine();
    const step = (input: PlayerCombatInput): void => {
      const result = advancePlayerCombatFrame(state, input, context(machine), 1 / 60);
      state = result.state;
      machine = result.machine;
    };

    step({ ...neutral, lightPressed: true });
    expect(state).toMatchObject({ comboStage: 1, activeAttackId: 'mara-light-combo-1' });
    expect(machine.value).toBe('attackLight');
    for (let frame = 0; frame < 2; frame += 1) step(neutral);
    step({ ...neutral, lightPressed: true });
    for (let frame = 0; frame < 13; frame += 1) step(neutral);
    expect(state).toMatchObject({ comboStage: 1, actionFrame: 17 });
    for (let frame = 0; frame < 2; frame += 1) step(neutral);
    expect(state).toMatchObject({ comboStage: 2, activeAttackId: 'mara-light-combo-2' });

    for (let frame = 0; frame < 4; frame += 1) step(neutral);
    step({ ...neutral, lightPressed: true });
    for (let frame = 0; frame < 13; frame += 1) step(neutral);
    expect(state).toMatchObject({ comboStage: 2, actionFrame: 18 });
    for (let frame = 0; frame < 2; frame += 1) step(neutral);
    expect(state).toMatchObject({ comboStage: 3, activeAttackId: 'mara-light-combo-3' });

    for (let frame = 0; frame < 20; frame += 1) step(neutral);
    expect(state).toMatchObject({ comboStage: 0, activeAttackId: undefined });
    expect(machine.value).toBe('idle');
  });

  it('does not carry an early combo press into the cancel window', () => {
    let state = createPlayerCombatState();
    let machine = createPlayerStateMachine();
    const step = (input: PlayerCombatInput): void => {
      const result = advancePlayerCombatFrame(state, input, context(machine), 1 / 60);
      state = result.state;
      machine = result.machine;
    };

    step({ ...neutral, lightPressed: true });
    step({ ...neutral, lightPressed: true });
    for (let frame = 0; frame < 18; frame += 1) step(neutral);

    expect(state.comboStage).toBe(0);
    expect(machine.value).toBe('idle');
  });

  it('selects air slash when airborne and charged strike only at the hand-derived threshold', () => {
    const airborne = advancePlayerCombatFrame(
      createPlayerCombatState(),
      { ...neutral, lightPressed: true },
      context(createPlayerStateMachine('fall'), {
        grounded: false,
        locomotionState: 'fall'
      }),
      1 / 60
    );
    expect(airborne.state.activeAttackId).toBe('mara-air-slash');
    expect(airborne.machine.value).toBe('airAttack');

    let state = createPlayerCombatState();
    let machine = createPlayerStateMachine();
    let result = advancePlayerCombatFrame(
      state,
      { ...neutral, heavyPressed: true, heavyHeld: true },
      context(machine),
      1 / 60
    );
    state = result.state;
    machine = result.machine;
    for (let frame = 0; frame < 17; frame += 1) {
      result = advancePlayerCombatFrame(
        state,
        { ...neutral, heavyHeld: true },
        context(machine),
        1 / 60
      );
      state = result.state;
      machine = result.machine;
    }
    result = advancePlayerCombatFrame(
      state,
      { ...neutral, heavyReleased: true },
      context(machine),
      1 / 60
    );

    expect(result.state.activeAttackId).toBe('mara-charged-strike');
    expect(result.directives).toContainEqual({
      kind: 'activate-attack',
      attackId: 'mara-charged-strike'
    });
  });

  it('uses an explicit parry window before settling into block and releases to locomotion', () => {
    let state = createPlayerCombatState();
    let machine = createPlayerStateMachine();
    let result = advancePlayerCombatFrame(
      state,
      { ...neutral, blockPressed: true, blockHeld: true },
      context(machine),
      1 / 60
    );
    state = result.state;
    machine = result.machine;
    expect(result.guard).toEqual({ kind: 'parry' });
    expect(machine.value).toBe('parry');

    for (let frame = 0; frame < 5; frame += 1) {
      result = advancePlayerCombatFrame(
        state,
        { ...neutral, blockHeld: true },
        context(machine),
        1 / 60
      );
      state = result.state;
      machine = result.machine;
    }
    expect(result.guard).toMatchObject({ kind: 'block', damageMultiplier: 0.35 });
    expect(machine.value).toBe('block');

    result = advancePlayerCombatFrame(
      state,
      { ...neutral, blockReleased: true },
      context(machine),
      1 / 60
    );
    expect(result.guard).toEqual({ kind: 'none' });
    expect(result.machine.value).toBe('idle');
  });

  it('keeps Wayfinder Dash invulnerable for exactly its twelve movement-locked frames', () => {
    let state = createPlayerCombatState();
    let machine = createPlayerStateMachine();
    const observations: { readonly invulnerable: boolean; readonly locked: boolean }[] = [];
    for (let frame = 0; frame < 13; frame += 1) {
      const result = advancePlayerCombatFrame(
        state,
        frame === 0 ? { ...neutral, dashPressed: true } : neutral,
        context(machine, { nowMs: 1_000 + frame * (1_000 / 60) }),
        1 / 60
      );
      state = result.state;
      machine = result.machine;
      observations.push({
        invulnerable: result.invulnerable,
        locked: result.movementLocked
      });
    }

    expect(observations.slice(0, 12)).toEqual(
      Array.from({ length: 12 }, () => ({ invulnerable: true, locked: true }))
    );
    expect(observations[12]).toEqual({ invulnerable: false, locked: false });
    expect(machine.value).toBe('idle');
  });

  it('matches combat timing and locomotion locks at 30 and 60 Hz without changing idle input', () => {
    const pressed = { ...neutral, lightPressed: true };
    const at30 = advancePlayerCombatFrame(
      createPlayerCombatState(),
      pressed,
      context(createPlayerStateMachine()),
      1 / 30
    );
    const first60 = advancePlayerCombatFrame(
      createPlayerCombatState(),
      pressed,
      context(createPlayerStateMachine()),
      1 / 60
    );
    const second60 = advancePlayerCombatFrame(
      first60.state,
      neutral,
      context(first60.machine),
      1 / 60
    );

    expect(at30.state.actionFrame).toBe(2);
    expect(second60.state.actionFrame).toBe(2);
    expect(applyCombatMovementLocks(movement, at30)).toEqual({
      ...movement,
      moveX: 0,
      jumpPressed: false,
      jumpHeld: false
    });
    const idle = advancePlayerCombatFrame(
      createPlayerCombatState(),
      neutral,
      context(createPlayerStateMachine()),
      1 / 60
    );
    expect(applyCombatMovementLocks(movement, idle)).toBe(movement);
  });

  it('emits one Lumen Bolt directive and applies its exact mana/cooldown state', () => {
    const result = advancePlayerCombatFrame(
      createPlayerCombatState(),
      { ...neutral, castPressed: true },
      context(createPlayerStateMachine()),
      1 / 60
    );

    expect(result.state).toMatchObject({
      mana: 48,
      cooldownReadyAt: { 'lumen-bolt': 1_480 },
      selectedAbilityId: 'lumen-bolt'
    });
    expect(result.directives).toContainEqual({
      kind: 'ability-effect',
      effect: {
        kind: 'projectile',
        attackId: 'lumen-bolt-burst',
        ownerId: 'mara-vey',
        facing: 'right',
        lifetimeFrames: 48
      }
    });
  });

  it('cycles semantic cast selection through Aegis Veil and Resonant Pulse', () => {
    const start = createPlayerCombatState();
    const selectedAegis = advancePlayerCombatFrame(
      start,
      { ...neutral, cycleRightPressed: true },
      context(createPlayerStateMachine()),
      1 / 60
    );
    const aegis = advancePlayerCombatFrame(
      selectedAegis.state,
      { ...neutral, castPressed: true },
      context(selectedAegis.machine),
      1 / 60
    );
    const selectedPulse = advancePlayerCombatFrame(
      start,
      { ...neutral, cycleLeftPressed: true },
      context(createPlayerStateMachine()),
      1 / 60
    );
    const pulse = advancePlayerCombatFrame(
      selectedPulse.state,
      { ...neutral, castPressed: true },
      context(selectedPulse.machine),
      1 / 60
    );

    expect(selectedAegis.state.selectedAbilityId).toBe('aegis-veil');
    expect(aegis.directives).toContainEqual({
      kind: 'ability-effect',
      effect: {
        kind: 'barrier',
        durationFrames: 90,
        manaPerConversion: 8,
        conversionAvailable: true,
        effectCueId: 'aegis-veil-barrier'
      }
    });
    expect(selectedPulse.state.selectedAbilityId).toBe('resonant-pulse');
    expect(pulse.directives).toContainEqual({
      kind: 'ability-effect',
      effect: {
        kind: 'area-status',
        radius: 180,
        statusId: 'resonant-stagger',
        statusDurationFrames: 30,
        mechanismHookId: 'awaken-resonant'
      }
    });
  });
});
