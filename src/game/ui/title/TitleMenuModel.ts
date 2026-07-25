import type { SaveSlotId } from '../../saves/SaveSchema';
import type { SaveSlotPreview } from '../../saves/SaveRepository';

export type TitleSlotMode = 'continue' | 'new-game';

export type TitleCommand =
  | { readonly type: 'new-game'; readonly slotId: SaveSlotId }
  | { readonly type: 'load-slot'; readonly slotId: SaveSlotId }
  | { readonly type: 'delete-slot'; readonly slotId: SaveSlotId }
  | { readonly type: 'open-settings' }
  | { readonly type: 'open-credits' };

export const advanceSelection = (current: number, direction: -1 | 1, total: number): number => {
  if (total <= 0) return 0;
  return (current + direction + total) % total;
};

export const formatPlaytime = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  return [hours, minutes, remainingSeconds]
    .map((part) => part.toString().padStart(2, '0'))
    .join(':');
};

export const formatAreaName = (areaId: string): string =>
  areaId === 'wrens-rest'
    ? "WREN'S REST"
    : areaId
        .split('-')
        .filter((word) => word.length > 0)
        .join(' ')
        .toUpperCase();

export const resolveSlotCommand = (
  mode: TitleSlotMode,
  slot: SaveSlotPreview
): TitleCommand | null => {
  if (mode === 'continue') {
    return slot.status === 'available' || slot.status === 'recoverable'
      ? { type: 'load-slot', slotId: slot.slotId }
      : null;
  }
  return { type: 'new-game', slotId: slot.slotId };
};
