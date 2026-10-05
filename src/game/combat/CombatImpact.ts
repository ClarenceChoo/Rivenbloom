import type { CombatantId, DamageTypeId, StableId, StatusEffectId, TeamId } from '../core/StableId';
import type { DamagePacket, DamageResult } from './CombatTypes';

export type CombatAttackId = StableId<'attack'>;
export type CombatProjectileId = StableId<'projectile'>;
export type ImpactDelivery = 'melee' | 'projectile' | 'radial' | 'hazard';
export type ImpactTag =
  'blockable' | 'parryable' | 'projectile' | 'unblockable' | 'rootglass-affecting';
export type ImpactFacing = 'left' | 'right';
export type ImpactVector = Readonly<{ x: number; y: number }>;

export type ImpactSource = Readonly<{
  ownerId: CombatantId;
  teamId: TeamId;
  position: ImpactVector;
  facing: ImpactFacing;
}>;

export type CombatImpact = Readonly<{
  attackId: CombatAttackId;
  targetId: CombatantId;
  source: ImpactSource;
  occurredAtMs: number;
  delivery: ImpactDelivery;
  damage: DamagePacket;
  knockback: ImpactVector;
  hitStopMs: number;
  tags: readonly ImpactTag[];
  projectile: Readonly<{
    instanceId: number;
    projectileId: CombatProjectileId;
  }> | null;
}>;

export type ProjectileDisposition = 'continue' | 'consume';

export type CombatResolutionCommand =
  | Readonly<{ kind: 'punish-attacker'; statusId: StatusEffectId }>
  | Readonly<{ kind: 'guard-break' }>;

export type CombatImpactResolution =
  | Readonly<{
      kind: 'unresolved';
      projectileDisposition: 'continue';
      commands: readonly [];
    }>
  | Readonly<{
      kind: 'ignored';
      reason: 'invulnerable' | 'invalid-target' | 'dead' | 'disposed';
      projectileDisposition: 'continue';
      commands: readonly [];
    }>
  | Readonly<{
      kind: 'parried';
      guard: 'parry';
      manaSpent: 0;
      projectileDisposition: 'continue';
      commands: readonly CombatResolutionCommand[];
    }>
  | Readonly<{
      kind: 'absorbed';
      guard: 'aegis';
      manaSpent: number;
      consumedStatusId: StatusEffectId;
      grantedStatusId: StatusEffectId;
      projectileDisposition: 'consume';
      commands: readonly CombatResolutionCommand[];
    }>
  | Readonly<{
      kind: 'resolved';
      guard: 'none' | 'block' | 'guard-break';
      manaSpent: number;
      damage: DamageResult;
      remainingHealth: number;
      remainingPoise: number;
      staggered: boolean;
      defeated: boolean;
      projectileDisposition: ProjectileDisposition;
      commands: readonly CombatResolutionCommand[];
    }>;

export type CombatVitalitySnapshot = Readonly<{
  currentHealth: number;
  maxHealth: number;
  currentPoise: number;
  maxPoise: number;
  armour: number;
  resistances: Readonly<Partial<Record<DamageTypeId, number>>>;
}>;

export const UNRESOLVED_COMBAT_IMPACT: CombatImpactResolution = Object.freeze({
  kind: 'unresolved',
  projectileDisposition: 'continue',
  commands: Object.freeze([]) as readonly [],
});

export function freezeCombatImpact(impact: CombatImpact): CombatImpact {
  return Object.freeze({
    ...impact,
    source: Object.freeze({
      ...impact.source,
      position: Object.freeze({ ...impact.source.position }),
    }),
    damage: Object.freeze({
      ...impact.damage,
      critical: Object.freeze({ ...impact.damage.critical }),
    }),
    knockback: Object.freeze({ ...impact.knockback }),
    tags: Object.freeze([...impact.tags]),
    projectile: impact.projectile === null ? null : Object.freeze({ ...impact.projectile }),
  });
}

export function freezeCombatImpactResolution(
  resolution: CombatImpactResolution,
): CombatImpactResolution {
  if (resolution.kind === 'unresolved' || resolution.kind === 'ignored') {
    return Object.freeze({
      ...resolution,
      commands: Object.freeze([]) as readonly [],
    });
  }
  if (resolution.kind === 'resolved') {
    return Object.freeze({
      ...resolution,
      damage: Object.freeze({ ...resolution.damage }),
      commands: freezeCommands(resolution.commands),
    });
  }
  return Object.freeze({
    ...resolution,
    commands: freezeCommands(resolution.commands),
  });
}

export function freezeCombatVitality(vitality: CombatVitalitySnapshot): CombatVitalitySnapshot {
  return Object.freeze({
    ...vitality,
    resistances: Object.freeze({ ...vitality.resistances }),
  });
}

function freezeCommands(
  commands: readonly CombatResolutionCommand[],
): readonly CombatResolutionCommand[] {
  return Object.freeze(commands.map((command) => Object.freeze({ ...command })));
}
