import { stableId } from '../../core/StableId';
import type { AttackId } from '../../data/types';
import { ATTACKS } from '../../data/attacks';
import type { PlayerState } from './PlayerState';

export type PlayerCombatState = Readonly<{
  activeAttackId: AttackId | null;
  heavyChargeStartedAtMs: number | null;
  guarding: boolean;
  parryUntilMs: number | null;
  airAttackUsed: boolean;
  wasGrounded: boolean;
  highestConsumedLightBufferId: number | null;
}>;

export const INITIAL_PLAYER_COMBAT_STATE: PlayerCombatState = Object.freeze({
  activeAttackId: null,
  heavyChargeStartedAtMs: null,
  guarding: false,
  parryUntilMs: null,
  airAttackUsed: false,
  wasGrounded: true,
  highestConsumedLightBufferId: null,
});

export type PlayerCombatIntent = Readonly<{
  nowMs: number;
  grounded: boolean;
  lightBufferId: number | null;
  heavyPressed: boolean;
  heavyReleased: boolean;
  heavyHeld: boolean;
  blockPressed: boolean;
  blockHeld: boolean;
  reset: 'hurt' | 'dead' | 'respawn' | null;
}>;

export type PlayerCombatContext = Readonly<{
  activeAttackFrame: number | null;
  attackComplete: boolean;
}>;

export type PlayerCombatCommand =
  | Readonly<{ kind: 'request-state'; state: PlayerState }>
  | Readonly<{ kind: 'start-attack'; attackId: AttackId }>
  | Readonly<{ kind: 'request-ability'; ability: 'dash' | 'cast' }>;

export type PlayerCombatStep = Readonly<{
  state: PlayerCombatState;
  commands: readonly PlayerCombatCommand[];
  consumedBufferIds: readonly number[];
  clearHeavyToggleLatch: boolean;
}>;

const HEAVY_CHARGE = (() => {
  const charge = ATTACKS.find(({ attackId }) => attackId === 'mara-charged-heavy')?.charge;
  if (charge === undefined || charge === null) {
    throw new Error('Charged heavy attack requires charge timing metadata.');
  }
  return charge;
})();
const PARRY_WINDOW_MS = 120;

export function stepPlayerCombat(
  previous: PlayerCombatState,
  intent: PlayerCombatIntent,
  context: PlayerCombatContext,
): PlayerCombatStep {
  if (intent.reset !== null) return result(INITIAL_PLAYER_COMBAT_STATE);

  let state: PlayerCombatState = Object.freeze({
    ...previous,
    activeAttackId: context.attackComplete ? null : previous.activeAttackId,
    airAttackUsed: intent.grounded && !previous.wasGrounded ? false : previous.airAttackUsed,
    wasGrounded: intent.grounded,
  });
  const commands: PlayerCombatCommand[] = [];
  const consumedBufferIds: number[] = [];
  let clearHeavyToggleLatch = false;

  if (
    intent.blockPressed &&
    state.activeAttackId === null &&
    state.heavyChargeStartedAtMs === null
  ) {
    state = Object.freeze({
      ...state,
      guarding: true,
      parryUntilMs: intent.nowMs + PARRY_WINDOW_MS,
    });
    commands.push(Object.freeze({ kind: 'request-state', state: 'parry' }));
  } else if (state.guarding) {
    if (!intent.blockHeld) {
      state = Object.freeze({ ...state, guarding: false, parryUntilMs: null });
      commands.push(Object.freeze({ kind: 'request-state', state: 'idle' }));
    } else if (state.parryUntilMs !== null && intent.nowMs >= state.parryUntilMs) {
      state = Object.freeze({ ...state, parryUntilMs: null });
      commands.push(Object.freeze({ kind: 'request-state', state: 'block' }));
    }
  }

  if (!state.guarding && intent.heavyPressed && state.activeAttackId === null) {
    state = Object.freeze({ ...state, heavyChargeStartedAtMs: intent.nowMs });
    commands.push(Object.freeze({ kind: 'request-state', state: 'attackHeavy' }));
  }

  if (state.heavyChargeStartedAtMs !== null) {
    const chargeMs = intent.nowMs - state.heavyChargeStartedAtMs;
    const autoRelease = chargeMs >= HEAVY_CHARGE.maximumMs;
    if (intent.heavyReleased || autoRelease) {
      if (chargeMs >= HEAVY_CHARGE.minimumMs) {
        const attackId = stableId<'attack'>('mara-charged-heavy');
        state = Object.freeze({ ...state, heavyChargeStartedAtMs: null, activeAttackId: attackId });
        commands.push(Object.freeze({ kind: 'start-attack', attackId }));
        clearHeavyToggleLatch = autoRelease;
      } else {
        state = Object.freeze({ ...state, heavyChargeStartedAtMs: null });
        commands.push(Object.freeze({ kind: 'request-state', state: 'idle' }));
      }
    }
  }

  if (!state.guarding && state.heavyChargeStartedAtMs === null && intent.lightBufferId !== null) {
    const attackId =
      state.highestConsumedLightBufferId !== null &&
      intent.lightBufferId <= state.highestConsumedLightBufferId
        ? null
        : acceptedLightAttack(state, intent, context);
    if (attackId !== null) {
      state = Object.freeze({
        ...state,
        activeAttackId: attackId,
        airAttackUsed: attackId === 'mara-air-slash' ? true : state.airAttackUsed,
        highestConsumedLightBufferId: intent.lightBufferId,
      });
      consumedBufferIds.push(intent.lightBufferId);
      commands.push(
        Object.freeze({
          kind: 'request-state',
          state: attackId === 'mara-air-slash' ? 'airAttack' : 'attackLight',
        }),
        Object.freeze({ kind: 'start-attack', attackId }),
      );
    }
  }

  return result(state, commands, consumedBufferIds, clearHeavyToggleLatch);
}

function acceptedLightAttack(
  state: PlayerCombatState,
  intent: PlayerCombatIntent,
  context: PlayerCombatContext,
): AttackId | null {
  if (state.activeAttackId === null) {
    if (!intent.grounded) {
      return state.airAttackUsed ? null : stableId<'attack'>('mara-air-slash');
    }
    return stableId<'attack'>('mara-light-one');
  }
  if (context.activeAttackFrame === null) return null;
  const definition = ATTACKS.find(({ attackId }) => attackId === state.activeAttackId);
  const window = definition?.cancelWindows.find(
    ({ fromFrame, toFrame }) =>
      context.activeAttackFrame! >= fromFrame && context.activeAttackFrame! <= toFrame,
  );
  return window?.intoAttackIds[0] ?? null;
}

function result(
  state: PlayerCombatState,
  commands: readonly PlayerCombatCommand[] = [],
  consumedBufferIds: readonly number[] = [],
  clearHeavyToggleLatch = false,
): PlayerCombatStep {
  return Object.freeze({
    state,
    commands: Object.freeze([...commands]),
    consumedBufferIds: Object.freeze([...consumedBufferIds]),
    clearHeavyToggleLatch,
  });
}
