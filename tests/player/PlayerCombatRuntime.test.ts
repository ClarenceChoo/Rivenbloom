import { describe, expect, test } from 'vitest';

import { abilityId, stableId } from '../../src/game/core/StableId';
import { DEFAULT_SAVE_SETTINGS } from '../../src/game/saves/SaveSchema';
import { PlayerCombatRuntime } from '../../src/game/entities/player/PlayerCombatRuntime';
import type { PlayerCombatRuntimeInput } from '../../src/game/entities/player/PlayerCombatRuntime';
import type { AbilityDefinition } from '../../src/game/data/types';
import type { CombatImpact, CombatImpactResolution } from '../../src/game/combat/CombatImpact';

const lumenBolt = abilityId('lumen-bolt');
const dash = abilityId('wayfinder-dash');
const aegis = abilityId('aegis-veil');
const pulse = abilityId('resonant-pulse');
const briarArc = abilityId('briar-arc');

const attackAbility: AbilityDefinition = Object.freeze({
  abilityId: briarArc,
  displayName: 'Briar Arc',
  manaCost: 5,
  cooldownMs: 300,
  unlockFactId: null,
  action: Object.freeze({ kind: 'attack', attackId: stableId<'attack'>('mara-light-one') }),
});

function input(patch: Partial<PlayerCombatRuntimeInput> = {}): PlayerCombatRuntimeInput {
  return {
    nowMs: 0,
    stepMs: 17,
    position: { x: 100, y: 200 },
    grounded: true,
    movementState: 'idle',
    playerState: 'idle',
    facing: 'right',
    lightBufferId: null,
    heavyPressed: false,
    heavyReleased: false,
    heavyHeld: false,
    blockPressed: false,
    blockHeld: false,
    dashBufferId: null,
    castBufferId: null,
    ...patch,
  };
}

function runtime(
  patch: Partial<ConstructorParameters<typeof PlayerCombatRuntime>[0]> = {},
): PlayerCombatRuntime {
  return new PlayerCombatRuntime({
    currentMana: 40,
    unlockedAbilityIds: [lumenBolt],
    initialFacing: 'right',
    settings: DEFAULT_SAVE_SETTINGS,
    targets: () => [],
    projectileCapacity: 2,
    ...patch,
  });
}

function resolvedImpact(
  healthDamage = 7,
  projectileDisposition: 'continue' | 'consume' = 'consume',
): CombatImpactResolution {
  return {
    kind: 'resolved',
    guard: 'none',
    manaSpent: 0,
    damage: {
      healthDamage,
      poiseDamage: 3,
      remainingPoise: 17,
      staggered: false,
      critical: false,
      parried: false,
    },
    remainingHealth: 33,
    remainingPoise: 17,
    staggered: false,
    defeated: false,
    projectileDisposition,
    commands: [],
  };
}

describe('PlayerCombatRuntime', () => {
  test('accepts one light buffer, samples frame zero, crosses every phase, and restores movement', () => {
    const combat = runtime();
    const accepted = combat.step(input({ lightBufferId: 7 }));

    expect(accepted.consumed.lightBufferId).toBe(7);
    expect(accepted.stateRequests).toEqual(['attackLight']);
    expect(accepted.movementImpulse).toEqual({ x: 80, y: 0 });
    expect(combat.snapshot()).toMatchObject({
      actionSequence: 1,
      lastAcceptedAction: 'attack-light',
      activeAttackId: 'mara-light-one',
      attackFrame: 0,
      attackPhase: 'anticipation',
    });

    const phases = new Set([combat.snapshot().attackPhase]);
    let completion = accepted;
    for (let frame = 1; frame <= 18; frame += 1) {
      completion = combat.step(input({ nowMs: frame * 17 }));
      phases.add(combat.snapshot().attackPhase);
    }

    expect(phases).toEqual(new Set(['anticipation', 'active', 'recovery', null]));
    expect(completion.stateRequests).toEqual(['idle']);
    expect(combat.snapshot()).toMatchObject({
      actionSequence: 1,
      activeAttackId: null,
      attackFrame: null,
      attackPhase: null,
    });
  });

  test('does not replay a consumed light and accepts a distinct combo only in the cancel window', () => {
    const combat = runtime();
    combat.step(input({ lightBufferId: 1 }));
    expect(combat.step(input({ nowMs: 17, lightBufferId: 1 })).consumed.lightBufferId).toBeNull();

    const early = combat.step(input({ nowMs: 34, lightBufferId: 2 }));
    expect(early.consumed.lightBufferId).toBeNull();
    expect(combat.snapshot().activeAttackId).toBe('mara-light-one');

    let combo = early;
    for (let frame = 3; frame <= 7; frame += 1) {
      combo = combat.step(input({ nowMs: frame * 17, lightBufferId: 2 }));
    }
    expect(combo.consumed.lightBufferId).toBe(2);
    expect(combat.snapshot()).toMatchObject({
      actionSequence: 2,
      activeAttackId: 'mara-light-two',
      attackFrame: 0,
    });
  });

  test('handles heavy early release, exact minimum fire, maximum auto-fire, and latch cleanup', () => {
    const early = runtime();
    expect(early.step(input({ heavyPressed: true, heavyHeld: true })).stateRequests).toEqual([
      'attackHeavy',
    ]);
    expect(
      early.step(input({ nowMs: 349, heavyReleased: true, heavyHeld: false })).stateRequests,
    ).toEqual(['idle']);
    expect(early.snapshot().actionSequence).toBe(0);

    const exact = runtime();
    exact.step(input({ nowMs: 10, heavyPressed: true, heavyHeld: true }));
    const fired = exact.step(input({ nowMs: 360, heavyReleased: true }));
    expect(fired.clearHeavyToggleLatch).toBe(false);
    expect(exact.snapshot()).toMatchObject({
      actionSequence: 1,
      lastAcceptedAction: 'attack-heavy',
      activeAttackId: 'mara-charged-heavy',
    });

    const automatic = runtime();
    automatic.step(input({ heavyPressed: true, heavyHeld: true }));
    const autoFired = automatic.step(input({ nowMs: 900, heavyHeld: true }));
    expect(autoFired.clearHeavyToggleLatch).toBe(true);
    expect(automatic.snapshot().activeAttackId).toBe('mara-charged-heavy');
  });

  test('transitions parry to block to movement and clears both sustained latches on interruption', () => {
    const combat = runtime();
    expect(combat.step(input({ blockPressed: true, blockHeld: true })).stateRequests).toEqual([
      'parry',
    ]);
    expect(combat.snapshot()).toMatchObject({ guarding: true, parryActive: true });
    expect(combat.step(input({ nowMs: 120, blockHeld: true })).stateRequests).toEqual(['block']);
    expect(combat.snapshot()).toMatchObject({ guarding: true, parryActive: false });
    expect(combat.step(input({ nowMs: 121 })).stateRequests).toEqual(['idle']);
    expect(combat.snapshot().guarding).toBe(false);

    combat.step(input({ nowMs: 122, blockPressed: true, blockHeld: true }));
    expect(combat.interrupt('hurt', 122)).toEqual({
      clearHeavyToggleLatch: true,
      clearBlockToggleLatch: true,
    });
    expect(combat.snapshot()).toMatchObject({ guarding: false, activeAttackId: null });
  });

  test('derives mana and unlocks, spends once, enforces exact cooldown, and preflights pool exhaustion', () => {
    const locked = runtime({ unlockedAbilityIds: [] });
    expect(locked.step(input({ castBufferId: 1 })).consumed.castBufferId).toBeNull();
    expect(locked.snapshot()).toMatchObject({ currentMana: 40, actionSequence: 0 });

    const combat = runtime({ projectileCapacity: 1 });
    const cast = combat.step(input({ castBufferId: 2 }));
    expect(cast.consumed.castBufferId).toBe(2);
    expect(cast.stateRequests).toEqual(['cast']);
    expect(combat.snapshot()).toMatchObject({
      actionSequence: 1,
      lastAcceptedAction: 'cast',
      currentMana: 32,
      selectedAbilityId: 'lumen-bolt',
      projectileCount: 1,
    });
    expect(combat.drainEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'mana-changed', previousMana: 40, currentMana: 32 }),
      ]),
    );

    combat.step(input({ nowMs: 449, castBufferId: 3 }));
    expect(combat.snapshot()).toMatchObject({ actionSequence: 1, currentMana: 32 });
    expect(combat.step(input({ nowMs: 450, castBufferId: 3 })).consumed.castBufferId).toBeNull();
    expect(combat.snapshot()).toMatchObject({ actionSequence: 1, currentMana: 32 });

    combat.step(input({ nowMs: 899 }));
    expect(combat.snapshot().projectileCount).toBe(1);
    combat.step(input({ nowMs: 900 }));
    expect(combat.snapshot().projectileCount).toBe(0);
    expect(combat.step(input({ nowMs: 900, castBufferId: 3 })).consumed.castBufferId).toBe(3);
    expect(combat.snapshot()).toMatchObject({ actionSequence: 2, currentMana: 24 });
  });

  test('spawns authored face-aware projectiles and filters owner and team contacts', () => {
    const enemy = {
      targetId: stableId<'combatant'>('reed-wisp'),
      teamId: stableId<'team'>('enemy'),
      hurtboxes: [{ x: 51, y: 124, width: 16, height: 16 }],
    };
    const combat = runtime({
      initialFacing: 'left',
      targets: () => [enemy],
      receiveImpact: () => resolvedImpact(),
    });

    combat.step(input({ facing: 'left', castBufferId: 1 }));
    combat.step(input({ nowMs: 50, facing: 'left' }));

    expect(combat.snapshot()).toMatchObject({ projectileCount: 0, confirmedHitCount: 1 });
    expect(combat.drainEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'projectile-contact',
          projectileId: 'lumen-bolt-projectile',
          targetId: 'reed-wisp',
        }),
      ]),
    );
  });

  test('uses exact authored dash end time, fixed facing, and the first 120 ms of invulnerability', () => {
    const combat = runtime({ unlockedAbilityIds: [dash] });
    const accepted = combat.step(input({ dashBufferId: 1 }));
    expect(accepted.consumed.dashBufferId).toBe(1);
    expect(accepted.movement).toEqual({
      kind: 'dash',
      speedX: 720,
      durationMs: 17,
      completes: false,
    });
    expect(combat.snapshot()).toMatchObject({
      lastAcceptedAction: 'dash',
      invulnerable: true,
    });

    let step = accepted;
    for (let nowMs = 17; nowMs <= 119; nowMs += 17) step = combat.step(input({ nowMs }));
    expect(step.movement).toEqual({
      kind: 'dash',
      speedX: 720,
      durationMs: 17,
      completes: false,
    });
    expect(combat.snapshot().invulnerable).toBe(true);
    step = combat.step(input({ nowMs: 120, facing: 'left' }));
    expect(step.movement).toEqual({
      kind: 'dash',
      speedX: 720,
      durationMs: 17,
      completes: false,
    });
    expect(combat.snapshot().invulnerable).toBe(false);

    expect(combat.step(input({ nowMs: 159, facing: 'left' })).movement).toEqual({
      kind: 'dash',
      speedX: 720,
      durationMs: 1,
      completes: true,
    });
    const ended = combat.step(input({ nowMs: 160, facing: 'left', movementState: 'run' }));
    expect(ended.movement).toEqual({ kind: 'normal' });
    expect(ended.stateRequests).toEqual([]);
  });

  test('rejects every buffered combat action while the owning player state is hurt or dead', () => {
    const combat = runtime({ unlockedAbilityIds: [lumenBolt, dash] });

    const hurt = combat.step(
      input({
        playerState: 'hurt',
        lightBufferId: 1,
        dashBufferId: 2,
        castBufferId: 3,
        blockPressed: true,
        blockHeld: true,
      }),
    );
    const dead = combat.step(
      input({
        nowMs: 17,
        playerState: 'dead',
        lightBufferId: 1,
        dashBufferId: 2,
        castBufferId: 3,
      }),
    );

    expect(hurt.movement).toEqual({ kind: 'committed' });
    expect(dead.movement).toEqual({ kind: 'committed' });
    expect(hurt.consumed).toEqual({
      lightBufferId: null,
      dashBufferId: null,
      castBufferId: null,
    });
    expect(dead.consumed).toEqual(hurt.consumed);
    expect(combat.snapshot()).toMatchObject({ actionSequence: 0, currentMana: 40 });
    expect(combat.drainEvents()).toEqual([]);
  });

  test('confirms one authored attack contact, emits logical feedback, and freezes deterministic steps', () => {
    const target = {
      targetId: stableId<'combatant'>('root-mite'),
      teamId: stableId<'team'>('enemy'),
      hurtboxes: [{ x: 130, y: 120, width: 20, height: 20 }],
    };
    const combat = runtime({
      targets: () => [target],
      receiveImpact: () => resolvedImpact(3),
    });
    combat.step(input({ lightBufferId: 1 }));
    for (let frame = 1; frame <= 8; frame += 1) combat.step(input({ nowMs: frame * 17 }));

    expect(combat.snapshot()).toMatchObject({ confirmedHitCount: 1, hitStopRemainingMs: 55 });
    const events = combat.drainEvents();
    expect(events.filter(({ kind }) => kind === 'attack-contact')).toHaveLength(1);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'attack-contact',
          resolution: expect.objectContaining({
            kind: 'resolved',
            damage: expect.objectContaining({ healthDamage: 3 }),
          }),
        }),
      ]),
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'feedback-requested', hitStopMs: 55 }),
        expect.objectContaining({
          kind: 'feedback-requested',
          commands: expect.arrayContaining([{ kind: 'damage-label', damage: 3 }]),
        }),
      ]),
    );
    expect(combat.consumeHitStop(17)).toBe(true);
    expect(combat.snapshot().hitStopRemainingMs).toBe(38);
    expect(combat.consumeHitStop(38)).toBe(true);
    expect(combat.snapshot().hitStopRemainingMs).toBe(0);
    expect(combat.consumeHitStop(17)).toBe(false);
  });

  test('reports raw geometry as contact without confirming damage or feedback by default', () => {
    const target = {
      targetId: stableId<'combatant'>('guarding-mite'),
      teamId: stableId<'team'>('enemy'),
      hurtboxes: [{ x: 130, y: 120, width: 20, height: 20 }],
    };
    const combat = runtime({ targets: () => [target] });
    combat.step(input({ lightBufferId: 1 }));
    for (let frame = 1; frame <= 8; frame += 1) combat.step(input({ nowMs: frame * 17 }));

    expect(combat.snapshot()).toMatchObject({ confirmedHitCount: 0, hitStopRemainingMs: 0 });
    const events = combat.drainEvents();
    expect(events.filter(({ kind }) => kind === 'attack-contact')).toHaveLength(1);
    expect(events.filter(({ kind }) => kind === 'feedback-requested')).toHaveLength(0);
  });

  test('reads moving hurtboxes from the target provider on every fixed combat step', () => {
    let targetX = 400;
    const combat = runtime({
      targets: () => [
        {
          targetId: stableId<'combatant'>('moving-mite'),
          teamId: stableId<'team'>('enemy'),
          hurtboxes: [{ x: targetX, y: 120, width: 20, height: 20 }],
        },
      ],
      receiveImpact: () => resolvedImpact(),
    });
    combat.step(input({ lightBufferId: 1 }));
    for (let frame = 1; frame < 5; frame += 1) combat.step(input({ nowMs: frame * 17 }));
    targetX = 130;
    combat.step(input({ nowMs: 85 }));

    expect(combat.snapshot().confirmedHitCount).toBe(1);
  });

  test('executes unlocked barrier and pulse commands as typed logical effects instead of ignoring them', () => {
    const barrier = runtime({ unlockedAbilityIds: [aegis], selectedAbilityId: aegis });
    expect(barrier.step(input({ castBufferId: 1 })).consumed.castBufferId).toBe(1);
    expect(barrier.snapshot().currentMana).toBe(28);
    expect(barrier.drainEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'barrier-applied',
          abilityId: 'aegis-veil',
          statusId: 'aegis-veil',
          expiresAtMs: 5000,
          absorptions: 1,
        }),
      ]),
    );

    const radial = runtime({ unlockedAbilityIds: [pulse], selectedAbilityId: pulse });
    expect(radial.step(input({ castBufferId: 2 })).consumed.castBufferId).toBe(2);
    expect(radial.snapshot().currentMana).toBe(24);
    expect(radial.drainEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'radial-pulse',
          abilityId: 'resonant-pulse',
          attackId: 'resonant-pulse-wave',
          ownerId: 'mara',
          teamId: 'player',
          origin: { x: 100, y: 200 },
          occurredAtMs: 0,
          radius: 160,
          mechanismTag: 'rootglass-affecting',
        }),
      ]),
    );
  });

  test('owns an injected attack ability as one cast until its attack instance completes', () => {
    const combat = runtime({
      abilityDefinitions: [attackAbility],
      unlockedAbilityIds: [briarArc],
      selectedAbilityId: briarArc,
    });

    const accepted = combat.step(input({ castBufferId: 4 }));
    expect(accepted).toMatchObject({
      stateRequests: ['cast'],
      consumed: { castBufferId: 4 },
      movement: { kind: 'committed' },
      movementImpulse: { x: 80, y: 0 },
    });
    expect(combat.snapshot()).toMatchObject({
      actionSequence: 1,
      lastAcceptedAction: 'cast',
      activeAttackId: 'mara-light-one',
      attackFrame: 0,
      currentMana: 35,
    });
    const acceptedEvents = combat.drainEvents();
    expect(acceptedEvents.filter(({ kind }) => kind === 'action-accepted')).toEqual([
      expect.objectContaining({
        kind: 'action-accepted',
        sequence: 1,
        action: 'cast',
        attackId: 'mara-light-one',
        abilityId: 'briar-arc',
      }),
    ]);
    expect(acceptedEvents.filter(({ kind }) => kind === 'ability-attack')).toEqual([
      expect.objectContaining({
        kind: 'ability-attack',
        abilityId: 'briar-arc',
        attackId: 'mara-light-one',
      }),
    ]);

    for (let frame = 1; frame < 18; frame += 1) {
      const active = combat.step(input({ nowMs: frame * 17, playerState: 'cast' }));
      expect(active.stateRequests).toEqual([]);
      expect(active.movement).toEqual({ kind: 'committed' });
      expect(active.movementImpulse).toBeNull();
    }
    const complete = combat.step(
      input({ nowMs: 18 * 17, playerState: 'cast', movementState: 'run' }),
    );

    expect(complete.stateRequests).toEqual(['run']);
    expect(complete.movement).toEqual({ kind: 'normal' });
    expect(complete.movementImpulse).toBeNull();
    expect(combat.snapshot()).toMatchObject({
      actionSequence: 1,
      activeAttackId: null,
      attackFrame: null,
      attackPhase: null,
    });
    expect(combat.drainEvents().filter(({ kind }) => kind === 'action-accepted')).toEqual([]);
  });

  test('respawn clears transients without refunding mana or rewinding cooldown and disposal is idempotent', () => {
    const combat = runtime();
    combat.step(input({ castBufferId: 1 }));
    expect(combat.respawn(0)).toEqual({ clearHeavyToggleLatch: true, clearBlockToggleLatch: true });
    expect(combat.snapshot()).toMatchObject({
      currentMana: 32,
      projectileCount: 0,
      activeAttackId: null,
      hitStopRemainingMs: 0,
      confirmedHitCount: 0,
    });
    expect(combat.step(input({ nowMs: 449, castBufferId: 2 })).consumed.castBufferId).toBeNull();
    expect(combat.dispose()).toBe(true);
    expect(combat.dispose()).toBe(false);
    expect(() => combat.step(input({ nowMs: 450 }))).toThrow(/disposed/i);
  });

  test('synchronizes live unlocks and cycles only through cast arts in authored order', () => {
    const combat = runtime({ unlockedAbilityIds: [lumenBolt, dash] });

    expect(combat.cycleSelectedAbility()).toBe(false);
    expect(combat.synchronizeUnlockedAbilities([lumenBolt, dash, aegis, pulse])).toBe(true);
    expect(combat.cycleSelectedAbility()).toBe(true);
    expect(combat.snapshot().selectedAbilityId).toBe(aegis);
    expect(combat.cycleSelectedAbility()).toBe(true);
    expect(combat.snapshot().selectedAbilityId).toBe(pulse);
    expect(combat.cycleSelectedAbility()).toBe(true);
    expect(combat.snapshot().selectedAbilityId).toBe(lumenBolt);
    expect(combat.drainEvents().filter(({ kind }) => kind === 'ability-selected')).toEqual([
      { kind: 'ability-selected', abilityId: aegis },
      { kind: 'ability-selected', abilityId: pulse },
      { kind: 'ability-selected', abilityId: lumenBolt },
    ]);
  });

  test('returns deeply immutable snapshots, steps, and drained event payloads', () => {
    const combat = runtime();
    const step = combat.step(input({ castBufferId: 1 }));
    const snapshot = combat.snapshot();
    const events = combat.drainEvents();

    expect(Object.isFrozen(step)).toBe(true);
    expect(Object.isFrozen(step.consumed)).toBe(true);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.projectiles)).toBe(true);
    expect(Object.isFrozen(snapshot.projectiles[0])).toBe(true);
    expect(Object.isFrozen(snapshot.projectiles[0]?.position)).toBe(true);
    expect(Object.isFrozen(events)).toBe(true);
    expect(events.every(Object.isFrozen)).toBe(true);
  });

  test('keeps unresolved projectiles active and consumes a projectile only after receiver resolution', () => {
    const enemy = {
      targetId: stableId<'combatant'>('root-mite'),
      teamId: stableId<'team'>('enemy'),
      hurtboxes: [{ x: 130, y: 124, width: 16, height: 16 }],
    };
    let resolution: CombatImpactResolution = {
      kind: 'unresolved',
      projectileDisposition: 'continue',
      commands: [],
    };
    const impacts: CombatImpact[] = [];
    const combat = runtime({
      targets: () => [enemy],
      receiveImpact: (impact) => {
        impacts.push(impact);
        return resolution;
      },
    });

    combat.step(input({ castBufferId: 1 }));
    combat.step(input({ nowMs: 100 }));
    expect(combat.snapshot()).toMatchObject({ projectileCount: 1, confirmedHitCount: 0 });
    expect(impacts).toHaveLength(1);

    resolution = resolvedImpact(5, 'consume');
    const second = runtime({ targets: () => [enemy], receiveImpact: () => resolution });
    second.step(input({ castBufferId: 1 }));
    second.step(input({ nowMs: 100 }));
    expect(second.snapshot()).toMatchObject({ projectileCount: 0, confirmedHitCount: 1 });
  });
});
