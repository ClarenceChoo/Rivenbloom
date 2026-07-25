import Phaser from 'phaser';
import { DEFAULT_ACCESSIBILITY_SETTINGS } from '../config/accessibility';
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
import type { SaveRepository } from '../saves/SaveRepository';
import { SaveService } from '../saves/SaveService';
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
    const input = new InputService({ settings: DEFAULT_ACCESSIBILITY_SETTINGS });
    let repository: SaveRepository = new IndexedDbSaveRepository();
    let warning: string | undefined;
    try {
      await repository.list();
    } catch {
      repository = new MemorySaveRepository();
      warning = 'Persistent saves are unavailable. This session can still be exported.';
    }
    const saves = new SaveService(repository);
    services.register(InputServiceToken, input);
    services.register(SaveRepositoryToken, repository);
    services.register(SaveServiceToken, saves);
    services.register(AccessibilitySettingsToken, DEFAULT_ACCESSIBILITY_SETTINGS);
    this.registry.set(GAME_SERVICES_REGISTRY_KEY, services);
    if (warning !== undefined) this.registry.set(SAVE_WARNING_REGISTRY_KEY, warning);
    this.game.events.once(Phaser.Core.Events.DESTROY, () => {
      saves.dispose();
      input.dispose();
      if (repository instanceof IndexedDbSaveRepository) void repository.close();
    });
    this.scene.start(SceneKeys.Preload);
  }
}
