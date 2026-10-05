import Phaser from 'phaser';

import { AppServiceRuntime } from './AppServiceRuntime';
import { GameEvents } from './GameEvents';
import { ServiceRegistry } from './ServiceRegistry';
import type { BrowserInputDeviceAdapter } from '../input/BrowserInputDeviceAdapter';
import type { InputService } from '../input/InputService';
import type { PlayerCombatRuntimeEvent } from '../entities/player/PlayerCombatRuntime';
import type { WorldCombatJournalEvent } from '../world/WorldCombatRuntime';
import type { SaveRepository } from '../saves/SaveRepository';
import type { SaveService } from '../saves/SaveService';
import type { TitleCommand } from '../title/TitleCommands';
import type { AreaId, CheckpointId, RoomId, SaveSlotId } from '../saves/SaveSchema';
import type {
  WorldDomainEvent,
  WorldModalCommand,
  WorldModalState,
} from '../world/WorldModalController';
import type { WorldUiProjection } from '../world/WorldUiProjection';
import type {
  BossDefeatedEvent,
  BossHealthEvent,
  BossIntroEvent,
  BossPhaseEvent,
} from '../entities/bosses/BossEvents';
import type { MenuCommand } from '../scenes/MenuScene';
import type { MenuBindingResult } from '../scenes/MenuScene';
import type { AudioDirector } from '../audio/AudioDirector';

export type AreaLoadedEvent = Readonly<{
  slotId: SaveSlotId;
  mode: 'new' | 'load';
  areaId: AreaId;
  roomId: RoomId;
  checkpointId: CheckpointId;
  position: Readonly<{ x: number; y: number }>;
}>;

export type RivenbloomEventMap = Readonly<{
  'title-command': TitleCommand;
  'area-loaded': AreaLoadedEvent;
  'combat-event': PlayerCombatRuntimeEvent;
  'world-combat-event': WorldCombatJournalEvent;
  'world-modal-state': WorldModalState | null;
  'world-modal-command': WorldModalCommand;
  'world-ui': WorldUiProjection;
  'world-domain-event': WorldDomainEvent;
  'boss-intro': BossIntroEvent;
  'boss-phase': BossPhaseEvent;
  'boss-health': BossHealthEvent;
  'boss-defeated': BossDefeatedEvent;
  'menu-command': MenuCommand;
  'menu-action-result': string;
  'menu-binding-result': MenuBindingResult;
  'audio-caption': Readonly<{ copy: string }>;
}>;

export type AppServices = {
  events: GameEvents<RivenbloomEventMap>;
  saveRepository: SaveRepository;
  saveService: SaveService;
  inputAdapter: BrowserInputDeviceAdapter;
  inputService: InputService;
  audioDirector: AudioDirector;
};

export const APP_SERVICES_REGISTRY_KEY = 'rivenbloom-app-services';

export function appServices(scene: Phaser.Scene): ServiceRegistry<AppServices> {
  const candidate: unknown = scene.registry.get(APP_SERVICES_REGISTRY_KEY);
  if (!(candidate instanceof AppServiceRuntime)) {
    throw new Error('Rivenbloom application services are unavailable.');
  }
  return (candidate as AppServiceRuntime<AppServices>).services;
}
