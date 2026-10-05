import { stableId } from '../core/StableId';
import type { StatusEffectId } from '../core/StableId';
import type { GuardState } from './CombatTypes';
import type { AttackTag } from '../data/types';

export type GuardImpact = Readonly<{
  delivery: 'melee' | 'projectile' | 'radial' | 'hazard';
  tags: readonly AttackTag[];
  sourceX: number;
}>;

export type GuardSnapshot = Readonly<{
  positionX: number;
  facing: 'left' | 'right';
  mana: number;
  invulnerable: boolean;
  parryActive: boolean;
  blocking: boolean;
  aegisActive: boolean;
}>;

export type GuardCommand =
  | Readonly<{ kind: 'punish-attacker'; statusId: StatusEffectId }>
  | Readonly<{ kind: 'guard-break' }>;

export type GuardResolution =
  | Readonly<{ kind: 'ignored' }>
  | Readonly<{
      kind: 'absorbed';
      manaSpent: number;
      consumeProjectile: true;
      consumeAegis: true;
      grantStatusId: StatusEffectId;
      commands: readonly [];
    }>
  | Readonly<{
      kind: 'resolved';
      guard: GuardState;
      manaSpent: number;
      consumeProjectile: boolean;
      consumeAegis: boolean;
      grantStatusId: StatusEffectId | null;
      commands: readonly GuardCommand[];
    }>;

const none = Object.freeze({ kind: 'none' } as const);

export function resolveGuardImpact(impact: GuardImpact, defender: GuardSnapshot): GuardResolution {
  if (defender.invulnerable) return Object.freeze({ kind: 'ignored' });
  const front =
    defender.facing === 'right'
      ? impact.sourceX >= defender.positionX
      : impact.sourceX <= defender.positionX;
  const unblockable = impact.tags.includes('unblockable');
  if (!front || unblockable) return resolved(none, 0);

  if (defender.parryActive && impact.tags.includes('parryable')) {
    return resolved(Object.freeze({ kind: 'parry' }), 0, {
      commands: [
        Object.freeze({
          kind: 'punish-attacker',
          statusId: stableId<'status'>('staggered'),
        }),
      ],
    });
  }

  if (!defender.blocking || !impact.tags.includes('blockable')) return resolved(none, 0);
  if (defender.mana < 4) {
    return resolved(none, 0, { commands: [Object.freeze({ kind: 'guard-break' })] });
  }
  if (defender.aegisActive && impact.delivery === 'projectile') {
    return Object.freeze({
      kind: 'absorbed',
      manaSpent: 4,
      consumeProjectile: true,
      consumeAegis: true,
      grantStatusId: stableId<'status'>('aegis-charge'),
      commands: Object.freeze([]) as readonly [],
    });
  }
  return resolved(Object.freeze({ kind: 'block', multiplier: 0.35 }), 4);
}

function resolved(
  guard: GuardState,
  manaSpent: number,
  patch: Readonly<{
    consumeProjectile?: boolean;
    consumeAegis?: boolean;
    grantStatusId?: StatusEffectId | null;
    commands?: readonly GuardCommand[];
  }> = {},
): GuardResolution {
  return Object.freeze({
    kind: 'resolved',
    guard,
    manaSpent,
    consumeProjectile: false,
    consumeAegis: false,
    grantStatusId: null,
    commands: Object.freeze([...(patch.commands ?? [])]),
    ...patch,
    ...(patch.commands === undefined ? {} : { commands: Object.freeze([...patch.commands]) }),
  });
}
