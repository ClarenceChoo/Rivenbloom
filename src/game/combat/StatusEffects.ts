import type { DamagePacket, DamageResult, DefenseSnapshot } from './CombatTypes';
import { resolveDamage } from './DamageResolver';

export type StatusStackingRule = 'stack' | 'refresh' | 'replace';
export type DamageSourceKind = 'melee' | 'projectile' | 'hazard';

export type StatusDefinition = {
  readonly id: string;
  readonly stacking: StatusStackingRule;
  readonly maximumStacks: number;
  readonly durationFrames: number;
  readonly incomingDamageByType?: Readonly<Record<string, number>>;
  readonly incomingDamageBySource?: Readonly<Partial<Record<DamageSourceKind, number>>>;
};

export type ActiveStatusEffect = {
  readonly definition: StatusDefinition;
  readonly sourceId: string;
  readonly stacks: number;
  readonly expiresAtFrame: number;
};

export type StatusState = {
  readonly frame: number;
  readonly effects: readonly ActiveStatusEffect[];
};

export type DamageSourceSnapshot = {
  readonly kind: DamageSourceKind;
  readonly packet: DamagePacket;
};

export const createStatusState = (): StatusState => ({ frame: 0, effects: [] });

const validDefinition = (definition: StatusDefinition): boolean =>
  Number.isInteger(definition.maximumStacks) &&
  definition.maximumStacks > 0 &&
  Number.isInteger(definition.durationFrames) &&
  definition.durationFrames > 0;

export const applyStatus = (
  state: StatusState,
  definition: StatusDefinition,
  sourceId: string
): StatusState => {
  if (!validDefinition(definition)) return state;
  const existing = state.effects.find((effect) => effect.definition.id === definition.id);
  const next: ActiveStatusEffect = {
    definition,
    sourceId,
    stacks:
      definition.stacking === 'stack'
        ? Math.min(definition.maximumStacks, (existing?.stacks ?? 0) + 1)
        : 1,
    expiresAtFrame: state.frame + definition.durationFrames
  };
  return {
    ...state,
    effects: [...state.effects.filter((effect) => effect.definition.id !== definition.id), next]
  };
};

export const advanceStatuses = (state: StatusState, frames = 1): StatusState => {
  const elapsed = Number.isFinite(frames) ? Math.max(0, Math.floor(frames)) : 0;
  const frame = state.frame + elapsed;
  return {
    frame,
    effects: state.effects.filter(({ expiresAtFrame }) => expiresAtFrame > frame)
  };
};

const modifierFactor = (status: ActiveStatusEffect, source: DamageSourceSnapshot): number => {
  const typeModifier = status.definition.incomingDamageByType?.[source.packet.damageType] ?? 0;
  const sourceModifier = status.definition.incomingDamageBySource?.[source.kind] ?? 0;
  const perStack = Math.max(0, 1 + typeModifier * status.stacks);
  return perStack * Math.max(0, 1 + sourceModifier);
};

export const resolveDamageWithStatusHooks = (
  source: DamageSourceSnapshot,
  target: DefenseSnapshot,
  statuses: StatusState
): DamageResult => {
  const amount = statuses.effects.reduce(
    (current, status) => current * modifierFactor(status, source),
    source.packet.amount
  );
  return resolveDamage({ ...source.packet, amount }, target);
};

export const COMBAT_STATUS_DEFINITIONS: readonly StatusDefinition[] = [
  {
    id: 'resonant-stagger',
    stacking: 'refresh',
    maximumStacks: 1,
    durationFrames: 30
  },
  {
    id: 'spore-exposure',
    stacking: 'stack',
    maximumStacks: 3,
    durationFrames: 180,
    incomingDamageByType: { spore: 0.1 }
  }
];
