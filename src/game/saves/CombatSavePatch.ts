import type { SaveSlotId, SaveV1 } from './SaveSchema';

export interface CombatAutosavePort {
  queueAutosave(slotId: SaveSlotId, save: SaveV1): void;
}

export function queueCombatManaAutosave(
  saveService: CombatAutosavePort,
  slotId: SaveSlotId,
  save: SaveV1,
  currentMana: number,
  snapshotAtEpochMs: number,
  playTimeMs: number,
): SaveV1 {
  return queueCombatVitalityAutosave(
    saveService,
    slotId,
    save,
    { currentHealth: save.player.currentHealth, currentMana },
    snapshotAtEpochMs,
    playTimeMs,
  );
}

export type CombatVitalitySavePatch = Readonly<{
  currentHealth: number;
  currentMana: number;
}>;

export function queueCombatVitalityAutosave(
  saveService: CombatAutosavePort,
  slotId: SaveSlotId,
  save: SaveV1,
  vitality: CombatVitalitySavePatch,
  snapshotAtEpochMs: number,
  playTimeMs: number,
): SaveV1 {
  if (
    !Number.isSafeInteger(vitality.currentHealth) ||
    vitality.currentHealth < 0 ||
    vitality.currentHealth > save.player.baseStats.maxHealth
  ) {
    throw new RangeError('Combat autosave health is outside the player range.');
  }
  if (
    !Number.isSafeInteger(vitality.currentMana) ||
    vitality.currentMana < 0 ||
    vitality.currentMana > save.player.baseStats.maxMana
  ) {
    throw new RangeError('Combat autosave mana is outside the player range.');
  }
  if (
    !Number.isSafeInteger(snapshotAtEpochMs) ||
    snapshotAtEpochMs < save.metadata.snapshotAtEpochMs
  ) {
    throw new RangeError('Combat autosave timestamp cannot regress.');
  }
  if (!Number.isSafeInteger(playTimeMs) || playTimeMs < save.metadata.playTimeMs) {
    throw new RangeError('Combat autosave play time cannot regress.');
  }
  const patched: SaveV1 = Object.freeze({
    ...save,
    metadata: Object.freeze({
      ...save.metadata,
      snapshotAtEpochMs,
      playTimeMs,
    }),
    player: Object.freeze({
      ...save.player,
      currentHealth: vitality.currentHealth,
      currentMana: vitality.currentMana,
    }),
  });
  saveService.queueAutosave(slotId, patched);
  return patched;
}
