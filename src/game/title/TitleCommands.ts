import type { SaveSlotId } from '../saves/SaveSchema';

export type TitleCommand =
  | Readonly<{ type: 'new-game'; slotId: SaveSlotId }>
  | Readonly<{ type: 'load-slot'; slotId: SaveSlotId }>
  | Readonly<{ type: 'delete-slot'; slotId: SaveSlotId }>
  | Readonly<{ type: 'open-settings' }>
  | Readonly<{ type: 'open-credits' }>;

export function commandSlotId(command: TitleCommand): SaveSlotId | null {
  switch (command.type) {
    case 'new-game':
    case 'load-slot':
    case 'delete-slot':
      return command.slotId;
    case 'open-settings':
    case 'open-credits':
      return null;
    default:
      return assertNever(command);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled title command: ${String(value)}`);
}
