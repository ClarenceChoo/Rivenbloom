import { describe, expect, it } from 'vitest';
import {
  advanceSelection,
  formatAreaName,
  formatPlaytime,
  resolveSlotCommand
} from '../../src/game/ui/title/TitleMenuModel';
import type { SaveSlotPreview } from '../../src/game/saves/SaveRepository';

const availableSlot: SaveSlotPreview = {
  slotId: 'slot-2',
  status: 'available',
  areaId: 'rootglass-reliquary',
  playtimeSeconds: 3661,
  updatedAt: Date.UTC(2026, 6, 26)
};

describe('title menu rules', () => {
  it('wraps semantic navigation across every available target', () => {
    expect(advanceSelection(0, -1, 4)).toBe(3);
    expect(advanceSelection(3, 1, 4)).toBe(0);
    expect(advanceSelection(1, 1, 4)).toBe(2);
  });

  it('formats stable save metadata as readable title copy', () => {
    expect(formatPlaytime(0)).toBe('00:00:00');
    expect(formatPlaytime(3661)).toBe('01:01:01');
    expect(formatAreaName('rootglass-reliquary')).toBe('ROOTGLASS RELIQUARY');
    expect(formatAreaName('wrens-rest')).toBe("WREN'S REST");
  });

  it('loads only available slots and starts a new game in the selected destination slot', () => {
    expect(resolveSlotCommand('continue', availableSlot)).toEqual({
      type: 'load-slot',
      slotId: 'slot-2'
    });
    expect(
      resolveSlotCommand('continue', {
        slotId: 'slot-1',
        status: 'empty'
      })
    ).toBeNull();
    expect(
      resolveSlotCommand('new-game', {
        slotId: 'slot-3',
        status: 'empty'
      })
    ).toEqual({ type: 'new-game', slotId: 'slot-3' });
  });
});
