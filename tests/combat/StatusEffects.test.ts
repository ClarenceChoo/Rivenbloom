import { describe, expect, it } from 'vitest';
import {
  damageTypeId,
  type DamagePacket,
  type DefenseSnapshot
} from '../../src/game/combat/CombatTypes';
import {
  advanceStatuses,
  applyStatus,
  createStatusState,
  resolveDamageWithStatusHooks,
  type StatusDefinition
} from '../../src/game/combat/StatusEffects';

const stacking: StatusDefinition = {
  id: 'spore-exposure',
  stacking: 'stack',
  maximumStacks: 3,
  durationFrames: 5,
  incomingDamageByType: { spore: 0.1 }
};

const refreshing: StatusDefinition = {
  id: 'resonant-stagger',
  stacking: 'refresh',
  maximumStacks: 1,
  durationFrames: 3
};

const replacing: StatusDefinition = {
  id: 'hazard-ward',
  stacking: 'replace',
  maximumStacks: 1,
  durationFrames: 8,
  incomingDamageBySource: { hazard: -0.5 }
};

describe('StatusEffects', () => {
  it('caps stacks, refreshes their expiry, and removes them on the exact expiry frame', () => {
    let state = createStatusState();
    state = applyStatus(state, stacking, 'spore-scribe');
    state = advanceStatuses(state, 2);
    state = applyStatus(state, stacking, 'spore-scribe');
    state = applyStatus(state, stacking, 'spore-scribe');
    state = applyStatus(state, stacking, 'spore-scribe');

    expect(state.effects).toEqual([
      {
        definition: stacking,
        sourceId: 'spore-scribe',
        stacks: 3,
        expiresAtFrame: 7
      }
    ]);
    expect(advanceStatuses(state, 4).effects).toHaveLength(1);
    expect(advanceStatuses(state, 5).effects).toEqual([]);
  });

  it('refreshes without stacking and replaces the source for replace rules', () => {
    let state = applyStatus(createStatusState(), refreshing, 'pulse-one');
    state = advanceStatuses(state, 2);
    state = applyStatus(state, refreshing, 'pulse-two');
    state = applyStatus(state, replacing, 'first-hazard');
    state = applyStatus(state, replacing, 'second-hazard');

    expect(state.effects.find(({ definition }) => definition.id === 'resonant-stagger')).toEqual({
      definition: refreshing,
      sourceId: 'pulse-two',
      stacks: 1,
      expiresAtFrame: 5
    });
    expect(state.effects.find(({ definition }) => definition.id === 'hazard-ward')).toEqual({
      definition: replacing,
      sourceId: 'second-hazard',
      stacks: 1,
      expiresAtFrame: 10
    });
  });

  it('applies deterministic source and type hooks before shared damage resolution', () => {
    let statuses = createStatusState();
    statuses = applyStatus(statuses, stacking, 'spore-scribe');
    statuses = applyStatus(statuses, stacking, 'spore-scribe');
    statuses = applyStatus(statuses, replacing, 'seed-lantern');
    const packet: DamagePacket = {
      amount: 20,
      damageType: damageTypeId('spore'),
      criticalMultiplier: 1,
      poiseDamage: 8,
      knockback: 40
    };
    const defense: DefenseSnapshot = {
      armor: 0,
      resistances: {},
      guard: { kind: 'none' },
      invulnerable: false
    };

    const hazard = resolveDamageWithStatusHooks({ kind: 'hazard', packet }, defense, statuses);
    const projectile = resolveDamageWithStatusHooks(
      { kind: 'projectile', packet },
      defense,
      statuses
    );

    expect(hazard.healthDamage).toBe(12);
    expect(projectile.healthDamage).toBe(24);
  });
});
