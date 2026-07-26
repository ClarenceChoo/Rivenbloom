import { describe, expect, it } from 'vitest';
import type { AreaStatusDirective } from '../../src/game/abilities/AbilitySystem';
import { CombatAbilityRuntime } from '../../src/game/combat/CombatAbilityRuntime';
import { damageTypeId, type DamagePacket } from '../../src/game/combat/CombatTypes';
import {
  COMBAT_STATUS_DEFINITIONS,
  type StatusDefinition
} from '../../src/game/combat/StatusEffects';

const pulse: AreaStatusDirective = {
  kind: 'area-status',
  radius: 180,
  statusId: 'resonant-stagger',
  statusDurationFrames: 30,
  mechanismHookId: 'awaken-resonant'
};

describe('CombatAbilityRuntime', () => {
  it('applies Pulse status, requests an in-range mechanism, and expires on frame thirty', () => {
    const runtime = new CombatAbilityRuntime([
      {
        id: 'arch-briar-scrapper',
        kind: 'enemy',
        tags: ['rootglass'],
        position: { x: 1_740, y: 566 }
      },
      {
        id: 'brackenreach-listening-arch',
        kind: 'mechanism',
        tags: ['resonant'],
        position: { x: 1_972, y: 566 }
      }
    ]);

    const applied = runtime.applyAreaStatus(pulse, { x: 1_792, y: 566 }, 'mara-vey');
    const beforeExpiry = runtime.advance(29);
    const expired = runtime.advance();

    expect(applied).toEqual([
      {
        kind: 'status-applied',
        targetId: 'arch-briar-scrapper',
        statusId: 'resonant-stagger',
        sourceId: 'mara-vey',
        expiresAtFrame: 30
      },
      {
        kind: 'mechanism-requested',
        targetId: 'brackenreach-listening-arch',
        mechanismHookId: 'awaken-resonant',
        sourceId: 'mara-vey'
      }
    ]);
    expect(beforeExpiry).toEqual([]);
    expect(runtime.statusState('arch-briar-scrapper').effects).toHaveLength(0);
    expect(expired).toEqual([
      {
        kind: 'status-expired',
        targetId: 'arch-briar-scrapper',
        statusId: 'resonant-stagger'
      }
    ]);
  });

  it('routes projectile and hazard packets through active status modifiers', () => {
    const runtime = new CombatAbilityRuntime([
      {
        id: 'target',
        kind: 'enemy',
        tags: ['rootglass'],
        position: { x: 0, y: 0 }
      }
    ]);
    const spore = COMBAT_STATUS_DEFINITIONS.find(({ id }) => id === 'spore-exposure');
    if (spore === undefined) throw new Error('Expected authored spore status.');
    const hazardWard: StatusDefinition = {
      id: 'hazard-ward',
      stacking: 'replace',
      maximumStacks: 1,
      durationFrames: 60,
      incomingDamageBySource: { hazard: -0.5 }
    };
    runtime.applyStatus('target', spore, 'spore-scribe');
    runtime.applyStatus('target', spore, 'spore-scribe');
    runtime.applyStatus('target', hazardWard, 'seed-lantern');
    const packet: DamagePacket = {
      amount: 20,
      damageType: damageTypeId('spore'),
      criticalMultiplier: 1,
      poiseDamage: 8,
      knockback: 40
    };
    const defense = {
      armor: 0,
      resistances: {},
      guard: { kind: 'none' as const },
      invulnerable: false
    };

    const projectile = runtime.resolveDamage('target', { kind: 'projectile', packet }, defense);
    const hazard = runtime.resolveDamage('target', { kind: 'hazard', packet }, defense);

    expect(projectile.healthDamage).toBe(24);
    expect(hazard.healthDamage).toBe(12);
  });
});
