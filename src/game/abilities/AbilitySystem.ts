import type { PlayerStateName } from '../entities/player/PlayerState';
import type { Facing } from '../physics/MovementModel';
import { abilityDefinitions } from '../data/abilities';
import type { AbilityDefinition } from '../data/types';

export type AbilityActorSnapshot = {
  readonly actorId: string;
  readonly mana: number;
  readonly maximumMana: number;
  readonly state: PlayerStateName;
  readonly grounded: boolean;
  readonly facing: Facing;
  readonly nowMs: number;
  readonly unlockedAbilityIds: readonly string[];
  readonly cooldownReadyAt: Readonly<Record<string, number>>;
};

export type ProjectileDirective = {
  readonly kind: 'projectile';
  readonly attackId: string;
  readonly ownerId: string;
  readonly facing: Facing;
  readonly lifetimeFrames: number;
};

export type DashDirective = {
  readonly kind: 'dash';
  readonly velocityX: number;
  readonly durationFrames: number;
  readonly invulnerableFrames: number;
};

export type BarrierDirective = {
  readonly kind: 'barrier';
  readonly durationFrames: number;
  readonly manaPerConversion: number;
  readonly conversionAvailable: boolean;
  readonly effectCueId: string;
};

export type AreaStatusDirective = {
  readonly kind: 'area-status';
  readonly radius: number;
  readonly statusId: string;
  readonly statusDurationFrames: number;
  readonly mechanismHookId: string;
};

export type AbilityEffectDirective =
  | ProjectileDirective
  | DashDirective
  | BarrierDirective
  | AreaStatusDirective;

export type AbilityFailureReason =
  | 'unknown-ability'
  | 'locked'
  | 'insufficient-mana'
  | 'cooldown'
  | 'invalid-state'
  | 'requires-grounded';

export type AbilityResult =
  | {
      readonly kind: 'failure';
      readonly reason: AbilityFailureReason;
      readonly actor: AbilityActorSnapshot;
    }
  | {
      readonly kind: 'success';
      readonly abilityId: string;
      readonly actor: AbilityActorSnapshot;
      readonly nextState: 'cast' | 'dash';
      readonly effects: readonly AbilityEffectDirective[];
      readonly cueIds: {
        readonly effect: string;
        readonly sound: string;
      };
    };

const ACTIVE_STATES: readonly PlayerStateName[] = [
  'idle',
  'run',
  'jump',
  'fall',
  'land',
  'block',
  'parry'
];

const abilityEffects = (
  definition: AbilityDefinition,
  actor: AbilityActorSnapshot
): readonly AbilityEffectDirective[] => {
  switch (definition.id) {
    case 'lumen-bolt':
      return [
        {
          kind: 'projectile',
          attackId: definition.attackId ?? 'lumen-bolt-burst',
          ownerId: actor.actorId,
          facing: actor.facing,
          lifetimeFrames: 48
        }
      ];
    case 'wayfinder-dash':
      return [
        {
          kind: 'dash',
          velocityX: actor.facing === 'right' ? 620 : -620,
          durationFrames: 12,
          invulnerableFrames: 12
        }
      ];
    case 'aegis-veil':
      return [
        {
          kind: 'barrier',
          durationFrames: 90,
          manaPerConversion: 8,
          conversionAvailable: true,
          effectCueId: 'aegis-veil-barrier'
        }
      ];
    case 'resonant-pulse':
      return [
        {
          kind: 'area-status',
          radius: 180,
          statusId: 'resonant-stagger',
          statusDurationFrames: 30,
          mechanismHookId: 'awaken-resonant'
        }
      ];
    default:
      return [];
  }
};

export class AbilitySystem {
  private readonly definitions: ReadonlyMap<string, AbilityDefinition>;

  public constructor(definitions: readonly AbilityDefinition[] = abilityDefinitions) {
    this.definitions = new Map(definitions.map((definition) => [definition.id, definition]));
  }

  public tryCast(abilityId: string, actorSnapshot: AbilityActorSnapshot): AbilityResult {
    const definition = this.definitions.get(abilityId);
    if (definition === undefined) {
      return { kind: 'failure', reason: 'unknown-ability', actor: actorSnapshot };
    }
    if (!actorSnapshot.unlockedAbilityIds.includes(abilityId)) {
      return { kind: 'failure', reason: 'locked', actor: actorSnapshot };
    }
    if (actorSnapshot.mana < definition.manaCost) {
      return { kind: 'failure', reason: 'insufficient-mana', actor: actorSnapshot };
    }
    if ((actorSnapshot.cooldownReadyAt[abilityId] ?? 0) > actorSnapshot.nowMs) {
      return { kind: 'failure', reason: 'cooldown', actor: actorSnapshot };
    }
    if (!ACTIVE_STATES.includes(actorSnapshot.state)) {
      return { kind: 'failure', reason: 'invalid-state', actor: actorSnapshot };
    }
    if (
      (definition.id === 'aegis-veil' || definition.id === 'resonant-pulse') &&
      !actorSnapshot.grounded
    ) {
      return { kind: 'failure', reason: 'requires-grounded', actor: actorSnapshot };
    }
    const nextActor: AbilityActorSnapshot = {
      ...actorSnapshot,
      mana: actorSnapshot.mana - definition.manaCost,
      cooldownReadyAt: {
        ...actorSnapshot.cooldownReadyAt,
        [abilityId]: actorSnapshot.nowMs + definition.cooldownMs
      }
    };
    return {
      kind: 'success',
      abilityId,
      actor: nextActor,
      nextState: definition.id === 'wayfinder-dash' ? 'dash' : 'cast',
      effects: abilityEffects(definition, actorSnapshot),
      cueIds: {
        effect: `${abilityId}-effect`,
        sound: `${abilityId}-sound`
      }
    };
  }
}

export type ProjectileSnapshot = {
  readonly id: string;
  readonly ownerId: string;
};

export type BarrierConversionResult = {
  readonly converted: boolean;
  readonly barrier: BarrierDirective;
  readonly actor: AbilityActorSnapshot;
  readonly projectileId: string;
};

export const resolveAegisProjectile = (
  barrier: BarrierDirective,
  projectile: ProjectileSnapshot,
  actor: AbilityActorSnapshot
): BarrierConversionResult => {
  if (!barrier.conversionAvailable || projectile.ownerId === actor.actorId) {
    return { converted: false, barrier, actor, projectileId: projectile.id };
  }
  return {
    converted: true,
    barrier: { ...barrier, conversionAvailable: false },
    actor: {
      ...actor,
      mana: Math.min(actor.maximumMana, actor.mana + barrier.manaPerConversion)
    },
    projectileId: projectile.id
  };
};

export type ResonantTarget = {
  readonly id: string;
  readonly kind: 'enemy' | 'mechanism';
  readonly tags: readonly string[];
  readonly distance: number;
};

export type ResonantHook =
  | {
      readonly kind: 'apply-status';
      readonly targetId: string;
      readonly statusId: string;
      readonly durationFrames: number;
    }
  | {
      readonly kind: 'awaken-mechanism';
      readonly targetId: string;
      readonly mechanismHookId: string;
    };

export const resolveResonantPulseTargets = (
  directive: AreaStatusDirective,
  targets: readonly ResonantTarget[]
): readonly ResonantHook[] =>
  targets.flatMap((target): readonly ResonantHook[] => {
    if (target.distance > directive.radius) return [];
    if (target.kind === 'enemy' && target.tags.includes('rootglass')) {
      return [
        {
          kind: 'apply-status',
          targetId: target.id,
          statusId: directive.statusId,
          durationFrames: directive.statusDurationFrames
        }
      ];
    }
    if (target.kind === 'mechanism' && target.tags.includes('resonant')) {
      return [
        {
          kind: 'awaken-mechanism',
          targetId: target.id,
          mechanismHookId: directive.mechanismHookId
        }
      ];
    }
    return [];
  });
