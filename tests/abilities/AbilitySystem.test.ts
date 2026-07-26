import { describe, expect, it } from 'vitest';
import {
  AbilitySystem,
  resolveAegisProjectile,
  resolveResonantPulseTargets,
  type AbilityActorSnapshot
} from '../../src/game/abilities/AbilitySystem';

const actor = (update: Partial<AbilityActorSnapshot> = {}): AbilityActorSnapshot => ({
  actorId: 'mara-vey',
  mana: 60,
  maximumMana: 60,
  state: 'idle',
  grounded: true,
  facing: 'right',
  nowMs: 1_000,
  unlockedAbilityIds: ['lumen-bolt', 'wayfinder-dash', 'aegis-veil', 'resonant-pulse'],
  cooldownReadyAt: {},
  ...update
});

describe('AbilitySystem', () => {
  it('returns explicit failures without changing actor resources', () => {
    const system = new AbilitySystem();
    const locked = actor({ unlockedAbilityIds: [] });
    const poor = actor({ mana: 11 });
    const cooling = actor({ cooldownReadyAt: { 'lumen-bolt': 1_001 } });
    const hurt = actor({ state: 'hurt' });
    const airborneGuard = actor({ grounded: false, state: 'fall' });

    expect(system.tryCast('missing-ability', actor())).toMatchObject({
      kind: 'failure',
      reason: 'unknown-ability'
    });
    expect(system.tryCast('lumen-bolt', locked)).toEqual({
      kind: 'failure',
      reason: 'locked',
      actor: locked
    });
    expect(system.tryCast('lumen-bolt', poor)).toEqual({
      kind: 'failure',
      reason: 'insufficient-mana',
      actor: poor
    });
    expect(system.tryCast('lumen-bolt', cooling)).toEqual({
      kind: 'failure',
      reason: 'cooldown',
      actor: cooling
    });
    expect(system.tryCast('lumen-bolt', hurt)).toEqual({
      kind: 'failure',
      reason: 'invalid-state',
      actor: hurt
    });
    expect(system.tryCast('aegis-veil', airborneGuard)).toEqual({
      kind: 'failure',
      reason: 'requires-grounded',
      actor: airborneGuard
    });
  });

  it.each([
    ['lumen-bolt', 48, 1_480, 'cast'],
    ['wayfinder-dash', 60, 1_420, 'dash'],
    ['aegis-veil', 42, 1_900, 'cast'],
    ['resonant-pulse', 50, 1_650, 'cast']
  ] as const)(
    'deducts exact mana and records exact cooldown for %s',
    (abilityId, expectedMana, expectedReadyAt, expectedState) => {
      const result = new AbilitySystem().tryCast(abilityId, actor());

      expect(result.kind).toBe('success');
      if (result.kind !== 'success') return;
      expect(result.actor.mana).toBe(expectedMana);
      expect(result.actor.cooldownReadyAt).toEqual({ [abilityId]: expectedReadyAt });
      expect(result.nextState).toBe(expectedState);
    }
  );

  it('directs Lumen Bolt as an authored facing projectile', () => {
    const result = new AbilitySystem().tryCast('lumen-bolt', actor({ facing: 'left' }));

    expect(result).toMatchObject({
      kind: 'success',
      effects: [
        {
          kind: 'projectile',
          attackId: 'lumen-bolt-burst',
          ownerId: 'mara-vey',
          facing: 'left',
          lifetimeFrames: 48
        }
      ]
    });
  });

  it('directs Wayfinder Dash with a bounded duration and matching invulnerability', () => {
    const result = new AbilitySystem().tryCast('wayfinder-dash', actor({ facing: 'left' }));

    expect(result).toMatchObject({
      kind: 'success',
      effects: [
        {
          kind: 'dash',
          velocityX: -620,
          durationFrames: 12,
          invulnerableFrames: 12
        }
      ]
    });
  });

  it('converts one projectile blocked by Aegis Veil into mana charge', () => {
    const result = new AbilitySystem().tryCast('aegis-veil', actor({ mana: 30 }));
    if (result.kind !== 'success') throw new Error('Expected Aegis Veil to cast.');
    const barrier = result.effects[0];
    if (barrier?.kind !== 'barrier') throw new Error('Expected barrier directive.');

    const first = resolveAegisProjectile(
      barrier,
      {
        id: 'pollen-bolt-1',
        ownerId: 'spore-scribe'
      },
      result.actor
    );
    const second = resolveAegisProjectile(
      first.barrier,
      {
        id: 'pollen-bolt-2',
        ownerId: 'spore-scribe'
      },
      first.actor
    );

    expect(first).toMatchObject({
      converted: true,
      actor: { mana: 20 },
      barrier: { conversionAvailable: false }
    });
    expect(second).toMatchObject({
      converted: false,
      actor: { mana: 20 },
      barrier: { conversionAvailable: false }
    });
  });

  it('returns enemy stagger and mechanism awakening hooks from Resonant Pulse', () => {
    const result = new AbilitySystem().tryCast('resonant-pulse', actor());
    if (result.kind !== 'success') throw new Error('Expected Resonant Pulse to cast.');
    const area = result.effects[0];
    if (area?.kind !== 'area-status') throw new Error('Expected area status directive.');

    const hooks = resolveResonantPulseTargets(area, [
      { id: 'rootglass-enemy', kind: 'enemy', tags: ['rootglass'], distance: 120 },
      { id: 'amber-lens', kind: 'mechanism', tags: ['resonant'], distance: 160 },
      { id: 'outside', kind: 'enemy', tags: ['rootglass'], distance: 181 },
      { id: 'ordinary-enemy', kind: 'enemy', tags: [], distance: 80 }
    ]);

    expect(hooks).toEqual([
      {
        kind: 'apply-status',
        targetId: 'rootglass-enemy',
        statusId: 'resonant-stagger',
        durationFrames: 30
      },
      {
        kind: 'awaken-mechanism',
        targetId: 'amber-lens',
        mechanismHookId: 'awaken-resonant'
      }
    ]);
  });
});
