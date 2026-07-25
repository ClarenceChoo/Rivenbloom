import Phaser from 'phaser';
import {
  AccessibilitySettingsState,
  DEFAULT_ACCESSIBILITY_SETTINGS
} from '../config/accessibility';
import {
  AccessibilitySettingsToken,
  GAME_SERVICES_REGISTRY_KEY,
  InputServiceToken,
  SAVE_WARNING_REGISTRY_KEY,
  SaveRepositoryToken,
  SaveServiceToken
} from '../core/GameServices';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { InputService } from '../input/InputService';
import { IndexedDbSaveRepository } from '../saves/IndexedDbSaveRepository';
import { MemorySaveRepository } from '../saves/MemorySaveRepository';
import type { SaveRepository, SaveSlotPreview } from '../saves/SaveRepository';
import { SaveService } from '../saves/SaveService';
import type { SaveV1 } from '../saves/SaveSchema';
import { SceneKeys } from './SceneKeys';

export class BootScene extends Phaser.Scene {
  public constructor() {
    super(SceneKeys.Boot);
  }

  public create(): void {
    if (this.game.renderer === undefined) {
      throw new Error('Rivenbloom requires an available Phaser renderer.');
    }
    void this.registerServices();
  }

  private async registerServices(): Promise<void> {
    const services = new ServiceRegistry();
    let repository: SaveRepository = new IndexedDbSaveRepository();
    let warning: string | undefined;
    let slots: readonly SaveSlotPreview[];
    try {
      slots = await repository.list();
    } catch {
      repository = new MemorySaveRepository();
      slots = await repository.list();
      warning = 'Persistent saves are unavailable. This session can still be exported.';
    }
    const saves = new SaveService(repository);
    const preferenceSave = await this.loadLatestSave(saves, slots);
    const settings = new AccessibilitySettingsState(
      preferenceSave?.settings ?? DEFAULT_ACCESSIBILITY_SETTINGS,
      preferenceSave?.slotId
    );
    const input = new InputService({
      settings: settings.current,
      ...(preferenceSave === undefined ? {} : { serializedBindings: preferenceSave.bindings })
    });
    services.register(InputServiceToken, input);
    services.register(SaveRepositoryToken, repository);
    services.register(SaveServiceToken, saves);
    services.register(AccessibilitySettingsToken, settings);
    this.registry.set(GAME_SERVICES_REGISTRY_KEY, services);
    if (warning !== undefined) this.registry.set(SAVE_WARNING_REGISTRY_KEY, warning);
    this.game.events.once(Phaser.Core.Events.DESTROY, () => {
      saves.dispose();
      input.dispose();
      if (repository instanceof IndexedDbSaveRepository) void repository.close();
    });
    this.scene.start(SceneKeys.Preload);
  }

  private async loadLatestSave(
    saves: SaveService,
    slots: readonly SaveSlotPreview[]
  ): Promise<SaveV1 | undefined> {
    const candidates = slots
      .filter((slot) => slot.status === 'available' || slot.status === 'recoverable')
      .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
    for (const candidate of candidates) {
      const loaded = await saves.load(candidate.slotId);
      if (loaded.kind === 'loaded') return loaded.save;
    }
    return undefined;
  }
}
