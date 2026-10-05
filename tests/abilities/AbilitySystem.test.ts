import { describe, expect, test } from 'vitest';

import { AbilitySystem } from '../../src/game/abilities/AbilitySystem';
import { ABILITIES } from '../../src/game/data/abilities';
import { abilityId } from '../../src/game/core/StableId';

const lumenBolt = abilityId('lumen-bolt');
const dash = abilityId('wayfinder-dash');
const aegis = abilityId('aegis-veil');
const pulse = abilityId('resonant-pulse');

const actor = (patch = {}) => ({
  mana: 40,
  unlockedAbilityIds: [lumenBolt, dash, aegis, pulse],
  state: 'idle' as const,
  nowMs: 100,
  ...patch,
});

describe('AbilitySystem', () => {
  test('rejects fractional authored mana and cooldown definitions', () => {
    expect(() => new AbilitySystem([{ ...ABILITIES[0]!, manaCost: 0.5 }])).toThrow(RangeError);
    expect(() => new AbilitySystem([{ ...ABILITIES[0]!, cooldownMs: 1.5 }])).toThrow(RangeError);
  });

  test('fails atomically for unknown, locked, illegal-state, mana, and cooldown checks', () => {
    const system = new AbilitySystem(ABILITIES);
    expect(system.tryCast(abilityId('missing'), actor())).toMatchObject({ reason: 'unknown' });
    expect(system.tryCast(dash, actor({ unlockedAbilityIds: [lumenBolt] }))).toMatchObject({
      reason: 'locked',
      mana: 40,
    });
    expect(system.tryCast(lumenBolt, actor({ state: 'hurt' }))).toMatchObject({
      reason: 'illegal-state',
      mana: 40,
    });
    expect(system.tryCast(lumenBolt, actor({ mana: 7 }))).toMatchObject({
      reason: 'insufficient-mana',
      mana: 7,
    });
    expect(system.tryCast(lumenBolt, actor())).toMatchObject({ kind: 'accepted', mana: 32 });
    expect(system.tryCast(lumenBolt, actor({ nowMs: 549 }))).toMatchObject({
      reason: 'cooldown',
      mana: 40,
    });
  });

  test('accepts exact cooldown readiness and rejects backward simulation time without mutation', () => {
    const system = new AbilitySystem(ABILITIES);
    expect(system.tryCast(lumenBolt, actor({ nowMs: 100 }))).toMatchObject({ kind: 'accepted' });
    expect(system.tryCast(lumenBolt, actor({ nowMs: 550 }))).toMatchObject({ kind: 'accepted' });
    expect(system.tryCast(lumenBolt, actor({ nowMs: 549 }))).toMatchObject({
      kind: 'rejected',
      reason: 'time-regressed',
      mana: 40,
    });
    expect(system.readyAt(lumenBolt)).toBe(1000);
  });

  test('emits exactly one stable data-only command for each authored combat ability', () => {
    expect(new AbilitySystem(ABILITIES).tryCast(lumenBolt, actor())).toMatchObject({
      kind: 'accepted',
      commands: [
        {
          kind: 'spawn-projectile',
          projectileId: 'lumen-bolt-projectile',
          attackId: 'lumen-bolt-impact',
          speed: 720,
          lifetimeMs: 900,
          bounds: { x: 32, y: -76, width: 16, height: 16 },
        },
      ],
    });
    expect(new AbilitySystem(ABILITIES).tryCast(dash, actor())).toMatchObject({
      kind: 'accepted',
      commands: [
        {
          kind: 'dash',
          speed: 720,
          durationMs: 160,
          invulnerableMs: 120,
          invulnerabilityStatusId: 'dash-invulnerable',
        },
      ],
    });
    expect(new AbilitySystem(ABILITIES).tryCast(aegis, actor())).toMatchObject({
      kind: 'accepted',
      commands: [
        { kind: 'apply-barrier', statusId: 'aegis-veil', durationMs: 5000, absorptions: 1 },
      ],
    });
    expect(new AbilitySystem(ABILITIES).tryCast(pulse, actor())).toMatchObject({
      kind: 'accepted',
      commands: [
        {
          kind: 'radial-pulse',
          attackId: 'resonant-pulse-wave',
          radius: 160,
          mechanismTag: 'rootglass-affecting',
        },
      ],
    });
  });

  test('returns immutable cast results and commands', () => {
    const result = new AbilitySystem(ABILITIES).tryCast(lumenBolt, actor());
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.commands)).toBe(true);
    expect(Object.isFrozen(result.commands[0])).toBe(true);
    expect(
      Object.isFrozen(
        result.commands[0]?.kind === 'spawn-projectile' ? result.commands[0].bounds : null,
      ),
    ).toBe(true);
  });

  test('rejects malformed actor mana without charging cooldown', () => {
    const system = new AbilitySystem(ABILITIES);
    expect(system.tryCast(lumenBolt, actor({ mana: Number.NaN }))).toMatchObject({
      kind: 'rejected',
      reason: 'invalid-actor',
    });
    expect(system.readyAt(lumenBolt)).toBeNull();
  });

  test('advances observed time on every valid-time rejection before another ability cast', () => {
    const cases = [
      (system: AbilitySystem) => system.tryCast(abilityId('missing'), actor({ nowMs: 200 })),
      (system: AbilitySystem) =>
        system.tryCast(dash, actor({ nowMs: 200, unlockedAbilityIds: [lumenBolt] })),
      (system: AbilitySystem) => system.tryCast(lumenBolt, actor({ nowMs: 200, state: 'hurt' })),
      (system: AbilitySystem) => system.tryCast(lumenBolt, actor({ nowMs: 200, mana: 7 })),
    ];

    for (const rejectAtTwoHundred of cases) {
      const system = new AbilitySystem(ABILITIES);
      expect(rejectAtTwoHundred(system)).toMatchObject({ kind: 'rejected' });
      expect(system.tryCast(pulse, actor({ nowMs: 199 }))).toMatchObject({
        kind: 'rejected',
        reason: 'time-regressed',
      });
      expect(system.readyAt(pulse)).toBeNull();
    }

    const cooldown = new AbilitySystem(ABILITIES);
    expect(cooldown.tryCast(lumenBolt, actor({ nowMs: 0 }))).toMatchObject({ kind: 'accepted' });
    expect(cooldown.tryCast(lumenBolt, actor({ nowMs: 300 }))).toMatchObject({
      reason: 'cooldown',
    });
    expect(cooldown.tryCast(dash, actor({ nowMs: 299 }))).toMatchObject({
      reason: 'time-regressed',
    });
    expect(cooldown.readyAt(dash)).toBeNull();
  });

  test('rejects malformed time without advancing the valid-time observation', () => {
    const system = new AbilitySystem(ABILITIES);
    expect(system.tryCast(lumenBolt, actor({ nowMs: Number.NaN }))).toMatchObject({
      kind: 'rejected',
      reason: 'invalid-time',
    });
    expect(system.tryCast(lumenBolt, actor({ nowMs: 0 }))).toMatchObject({ kind: 'accepted' });
  });
});
