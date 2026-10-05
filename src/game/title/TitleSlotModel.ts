import type { SaveReadResult } from '../saves/SaveRepository';
import type { SaveSlotId } from '../saves/SaveSchema';
import { AREA_DISPLAY_NAMES, isAreaLoadable } from '../data/areas';

const SLOT_LABELS: Readonly<Record<SaveSlotId, string>> = Object.freeze({
  'slot-1': 'Journey 1',
  'slot-2': 'Journey 2',
  'slot-3': 'Journey 3',
});

export type LoadingSlotState = Readonly<{
  kind: 'loading';
  slotId: SaveSlotId;
  label: string;
}>;

export type EmptySlotState = Readonly<{
  kind: 'empty';
  slotId: SaveSlotId;
  label: string;
}>;

export type ReadySlotState = Readonly<{
  kind: 'ready';
  slotId: SaveSlotId;
  label: string;
  areaLabel: string;
  canLoad: boolean;
  playTime: string;
  upgrades: string;
  lastPlayed: Readonly<{ dateTime: string; label: string }>;
  recoveryState: 'clean' | 'recovered' | 'has-corrupt-copy';
  corruptCopyCount: number;
}>;

export type CorruptSlotState = Readonly<{
  kind: 'corrupt';
  slotId: SaveSlotId;
  label: string;
  corruptCopyCount: number;
}>;

export type ErrorSlotState = Readonly<{
  kind: 'error';
  slotId: SaveSlotId;
  label: string;
  message: string;
}>;

export type TitleSlotState =
  LoadingSlotState | EmptySlotState | ReadySlotState | CorruptSlotState | ErrorSlotState;

export function loadingSlot(slotId: SaveSlotId): LoadingSlotState {
  return Object.freeze({ kind: 'loading', slotId, label: SLOT_LABELS[slotId] });
}

export function mapSlotResult(slotId: SaveSlotId, result: SaveReadResult): TitleSlotState {
  const label = SLOT_LABELS[slotId];
  if (result.kind === 'empty') return Object.freeze({ kind: 'empty', slotId, label });
  if (result.kind === 'corrupt') {
    return Object.freeze({
      kind: 'corrupt',
      slotId,
      label,
      corruptCopyCount: result.corruptCopies.length,
    });
  }

  const area = mapAreaLabel(result.save.location.areaId);
  return Object.freeze({
    kind: 'ready',
    slotId,
    label,
    areaLabel: area.label,
    canLoad: isAreaLoadable(result.save.location.areaId),
    playTime: formatPlayTime(result.save.metadata.playTimeMs),
    upgrades: formatUpgrades(result.save.player.healthUpgrades, result.save.player.manaUpgrades),
    lastPlayed: formatSnapshotTime(result.save.metadata.snapshotAtEpochMs),
    recoveryState:
      result.source === 'backup'
        ? 'recovered'
        : result.corruptCopies.length > 0
          ? 'has-corrupt-copy'
          : 'clean',
    corruptCopyCount: result.corruptCopies.length,
  });
}

export function mapSlotError(slotId: SaveSlotId): ErrorSlotState {
  return Object.freeze({
    kind: 'error',
    slotId,
    label: SLOT_LABELS[slotId],
    message: 'This journey could not be read.',
  });
}

export function mapAreaLabel(areaId: string): Readonly<{ label: string; known: boolean }> {
  const label = Object.hasOwn(AREA_DISPLAY_NAMES, areaId) ? AREA_DISPLAY_NAMES[areaId] : undefined;
  return label === undefined
    ? Object.freeze({ label: 'Unknown area', known: false })
    : Object.freeze({ label, known: true });
}

export function formatPlayTime(playTimeMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(playTimeMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatUpgrades(healthUpgrades: number, manaUpgrades: number): string {
  return `Heart Petals +${healthUpgrades} · Wellspring Seeds +${manaUpgrades}`;
}

export function formatSnapshotTime(
  snapshotAtEpochMs: number,
): Readonly<{ dateTime: string; label: string }> {
  const date = new Date(snapshotAtEpochMs);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ] as const;
  return Object.freeze({
    dateTime: date.toISOString(),
    label: `${String(date.getUTCDate()).padStart(2, '0')} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()} · ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')} UTC`,
  });
}
