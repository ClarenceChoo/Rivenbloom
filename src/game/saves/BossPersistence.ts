import { itemId, questFlagId, stableId } from '../core/StableId';
import { deepFreeze } from '../data/immutability';
import type { ProgressionCommand, ProgressionEvent } from '../world/WorldProgression';
import { applyProgressionTransaction } from '../world/WorldProgression';
import { validateSaveV1 } from './SaveSchema';
import type { SaveV1 } from './SaveSchema';

export type BossDefeatPreparation =
  | Readonly<{
      kind: 'prepared';
      save: SaveV1;
      commands: readonly ProgressionCommand[];
      events: readonly ProgressionEvent[];
    }>
  | Readonly<{ kind: 'already-complete'; save: SaveV1; events: readonly [] }>
  | Readonly<{
      kind: 'rejected';
      reason: 'invalid-save' | 'invalid-stamp' | 'invalid-vitals' | 'progression-rejected';
      save: SaveV1;
      events: readonly [];
    }>;

export type BossDefeatPreparationInput = Readonly<{
  vitals: Readonly<{ currentHealth: number; currentMana: number }>;
  stamp: Readonly<{ snapshotAtEpochMs: number; playTimeMs: number }>;
}>;

export const PALLID_CANTOR_DEFEAT_COMMANDS = deepFreeze([
  { kind: 'defeat-boss', bossId: stableId<'boss'>('pallid-cantor') },
  { kind: 'grant-item', itemId: itemId('cantor-sigil'), quantity: 1 },
  { kind: 'set-fact', factId: questFlagId('pallid-cantor-defeated') },
] satisfies readonly ProgressionCommand[]);

const EMPTY_EVENTS = Object.freeze([]) as readonly [];

export function prepareBossDefeat(
  latest: SaveV1,
  input: BossDefeatPreparationInput,
): BossDefeatPreparation {
  const validated = validateSaveV1(latest);
  if (validated.kind === 'invalid') return rejected(latest, 'invalid-save');
  if (validated.value.worldProgress.defeatedBosses.includes(stableId<'boss'>('pallid-cantor'))) {
    return deepFreeze({ kind: 'already-complete', save: latest, events: EMPTY_EVENTS });
  }
  if (
    !Number.isSafeInteger(input.stamp.snapshotAtEpochMs) ||
    input.stamp.snapshotAtEpochMs < validated.value.metadata.snapshotAtEpochMs ||
    !Number.isSafeInteger(input.stamp.playTimeMs) ||
    input.stamp.playTimeMs < validated.value.metadata.playTimeMs
  ) {
    return rejected(latest, 'invalid-stamp');
  }
  if (
    !Number.isSafeInteger(input.vitals.currentHealth) ||
    input.vitals.currentHealth < 0 ||
    input.vitals.currentHealth > validated.value.player.baseStats.maxHealth ||
    !Number.isSafeInteger(input.vitals.currentMana) ||
    input.vitals.currentMana < 0 ||
    input.vitals.currentMana > validated.value.player.baseStats.maxMana
  ) {
    return rejected(latest, 'invalid-vitals');
  }

  const composed: SaveV1 = {
    ...validated.value,
    metadata: {
      ...validated.value.metadata,
      snapshotAtEpochMs: input.stamp.snapshotAtEpochMs,
      playTimeMs: input.stamp.playTimeMs,
    },
    location: {
      regionId: stableId<'region'>('brackenreach'),
      areaId: stableId<'area'>('hollow-choir'),
      checkpointId: stableId<'checkpoint'>('choir-threshold-lantern'),
      safePosition: { x: 256, y: 900 },
    },
    player: {
      ...validated.value.player,
      currentHealth: input.vitals.currentHealth,
      currentMana: input.vitals.currentMana,
    },
  };
  const progression = applyProgressionTransaction(composed, {
    commands: PALLID_CANTOR_DEFEAT_COMMANDS,
  });
  if (progression.kind !== 'accepted') return rejected(latest, 'progression-rejected');
  return deepFreeze({
    kind: 'prepared',
    save: progression.save,
    commands: PALLID_CANTOR_DEFEAT_COMMANDS,
    events: progression.events,
  });
}

function rejected(
  save: SaveV1,
  reason: Extract<BossDefeatPreparation, { kind: 'rejected' }>['reason'],
): BossDefeatPreparation {
  return deepFreeze({ kind: 'rejected', reason, save, events: EMPTY_EVENTS });
}
