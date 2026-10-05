import type { AbilityId, ProjectileId, StatusEffectId } from '../core/StableId';
import type { AbilityDefinition, AttackId, Rect } from '../data/types';
import type { PlayerState } from '../entities/player/PlayerState';

export type AbilityActorSnapshot = Readonly<{
  mana: number;
  unlockedAbilityIds: readonly AbilityId[];
  state: PlayerState;
  nowMs: number;
}>;

export type AbilityCommand =
  | Readonly<{
      kind: 'attack';
      attackId: AttackId;
    }>
  | Readonly<{
      kind: 'spawn-projectile';
      abilityId: AbilityId;
      projectileId: ProjectileId;
      attackId: AttackId;
      speed: number;
      lifetimeMs: number;
      bounds: Rect;
    }>
  | Readonly<{
      kind: 'dash';
      abilityId: AbilityId;
      speed: number;
      durationMs: number;
      invulnerableMs: number;
      invulnerabilityStatusId: StatusEffectId;
    }>
  | Readonly<{
      kind: 'apply-barrier';
      abilityId: AbilityId;
      statusId: StatusEffectId;
      durationMs: number;
      absorptions: number;
    }>
  | Readonly<{
      kind: 'radial-pulse';
      abilityId: AbilityId;
      attackId: AttackId;
      radius: number;
      mechanismTag: 'rootglass-affecting';
    }>
  | Readonly<{
      kind: 'restore';
      abilityId: AbilityId;
      resource: 'health' | 'mana';
      amount: number;
    }>;

export type AbilityResult =
  | Readonly<{
      kind: 'accepted';
      mana: number;
      readyAtMs: number;
      commands: readonly [AbilityCommand];
    }>
  | Readonly<{
      kind: 'rejected';
      reason:
        | 'unknown'
        | 'locked'
        | 'illegal-state'
        | 'insufficient-mana'
        | 'cooldown'
        | 'invalid-actor'
        | 'invalid-time'
        | 'time-regressed';
      mana: number;
      commands: readonly [];
    }>;

const LEGAL_STATES: ReadonlySet<PlayerState> = new Set(['idle', 'run', 'jump', 'fall', 'land']);

export class AbilitySystem {
  private readonly definitions: ReadonlyMap<AbilityId, AbilityDefinition>;
  private readonly readyAtMs = new Map<AbilityId, number>();
  private lastObservedMs: number | null = null;

  public constructor(definitions: readonly AbilityDefinition[]) {
    for (const definition of definitions) {
      assertNonNegativeSafeInteger(definition.manaCost, 'Ability mana cost');
      assertNonNegativeSafeInteger(definition.cooldownMs, 'Ability cooldown');
    }
    this.definitions = new Map(definitions.map((definition) => [definition.abilityId, definition]));
  }

  public tryCast(abilityId: AbilityId, actor: AbilityActorSnapshot): AbilityResult {
    if (!Number.isSafeInteger(actor.nowMs) || actor.nowMs < 0) {
      return rejected('invalid-time', actor.mana);
    }
    if (this.lastObservedMs !== null && actor.nowMs < this.lastObservedMs) {
      return rejected('time-regressed', actor.mana);
    }
    this.lastObservedMs = actor.nowMs;
    const definition = this.definitions.get(abilityId);
    if (definition === undefined) return rejected('unknown', actor.mana);
    if (!Number.isSafeInteger(actor.mana) || actor.mana < 0) {
      return rejected('invalid-actor', actor.mana);
    }
    if (!actor.unlockedAbilityIds.includes(abilityId)) return rejected('locked', actor.mana);
    if (!LEGAL_STATES.has(actor.state)) return rejected('illegal-state', actor.mana);
    if (actor.mana < definition.manaCost) return rejected('insufficient-mana', actor.mana);
    const currentReadyAt = this.readyAtMs.get(abilityId) ?? 0;
    if (actor.nowMs < currentReadyAt) return rejected('cooldown', actor.mana);
    const readyAtMs = actor.nowMs + definition.cooldownMs;
    if (!Number.isSafeInteger(readyAtMs)) return rejected('time-regressed', actor.mana);

    const command = commandFor(definition);
    this.readyAtMs.set(abilityId, readyAtMs);
    return Object.freeze({
      kind: 'accepted',
      mana: actor.mana - definition.manaCost,
      readyAtMs,
      commands: Object.freeze([command]) as readonly [AbilityCommand],
    });
  }

  public readyAt(abilityId: AbilityId): number | null {
    return this.readyAtMs.get(abilityId) ?? null;
  }
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer.`);
  }
}

function rejected(
  reason: Extract<AbilityResult, { kind: 'rejected' }>['reason'],
  mana: number,
): AbilityResult {
  return Object.freeze({
    kind: 'rejected',
    reason,
    mana,
    commands: Object.freeze([]) as readonly [],
  });
}

function commandFor(definition: AbilityDefinition): AbilityCommand {
  const action = definition.action;
  switch (action.kind) {
    case 'attack':
      return Object.freeze({ kind: 'attack', attackId: action.attackId });
    case 'projectile':
      return Object.freeze({
        kind: 'spawn-projectile',
        abilityId: definition.abilityId,
        projectileId: action.projectileId,
        attackId: action.attackId,
        speed: action.speed,
        lifetimeMs: action.lifetimeMs,
        bounds: Object.freeze({ ...action.bounds }),
      });
    case 'dash':
      return Object.freeze({
        kind: 'dash',
        abilityId: definition.abilityId,
        speed: action.speed,
        durationMs: action.durationMs,
        invulnerableMs: action.invulnerableMs,
        invulnerabilityStatusId: action.invulnerabilityStatusId,
      });
    case 'barrier':
      return Object.freeze({
        kind: 'apply-barrier',
        abilityId: definition.abilityId,
        statusId: action.statusId,
        durationMs: action.durationMs,
        absorptions: action.projectileAbsorptions,
      });
    case 'pulse':
      return Object.freeze({
        kind: 'radial-pulse',
        abilityId: definition.abilityId,
        attackId: action.attackId,
        radius: action.radius,
        mechanismTag: action.mechanismTag,
      });
    case 'restore':
      return Object.freeze({
        kind: 'restore',
        abilityId: definition.abilityId,
        resource: action.resource,
        amount: action.amount,
      });
  }
}
