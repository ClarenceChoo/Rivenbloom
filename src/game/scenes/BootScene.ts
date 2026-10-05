import Phaser from 'phaser';

import {
  APP_SERVICES_REGISTRY_KEY,
  type AppServices,
  type RivenbloomEventMap,
} from '../core/AppServices';
import {
  AppServiceRuntime,
  createBootSaveServices,
  replaceAppServiceRuntime,
} from '../core/AppServiceRuntime';
import { GameEvents } from '../core/GameEvents';
import { SceneScope } from '../core/SceneScope';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { BrowserInputDeviceAdapter } from '../input/BrowserInputDeviceAdapter';
import { InputService } from '../input/InputService';
import { updateDevBridge } from '../testing/devBridge';
import { SceneKeys } from './SceneKeys';
import { AudioDirector } from '../audio/AudioDirector';
import { tauriInvokeFromRuntime } from '../saves/TauriSaveRepository';

export class BootScene extends Phaser.Scene {
  public constructor() {
    super(SceneKeys.Boot);
  }

  public create(): void {
    const scope = this.createScope();
    const saveServices = createBootSaveServices({
      indexedDbFactory: globalThis.indexedDB,
      tauriInvoke: tauriInvokeFromRuntime(),
    });
    const inputAdapter = new BrowserInputDeviceAdapter({ nowMs: () => performance.now() });
    const inputService = new InputService(inputAdapter);
    const services = new ServiceRegistry<AppServices>();
    const events = new GameEvents<RivenbloomEventMap>();
    const audioDirector = new AudioDirector({
      caption: (copy) => events.emit('audio-caption', { copy }),
    });
    services.register('events', events);
    services.register('saveRepository', saveServices.repository);
    services.register('saveService', saveServices.saveService);
    services.register('inputAdapter', inputAdapter);
    services.register('inputService', inputService);
    services.register('audioDirector', audioDirector);
    const disposeServices = () => void runtime.dispose();
    const runtime = new AppServiceRuntime(services, [
      () => this.game.events.off(Phaser.Core.Events.DESTROY, disposeServices),
      () => inputService.shutdown(),
      () => inputAdapter.shutdown(),
      () => audioDirector.dispose(),
      async () => {
        await saveServices.saveService.flush().catch(() => undefined);
        saveServices.close();
      },
    ]);
    const previous: unknown = this.registry.get(APP_SERVICES_REGISTRY_KEY);
    this.registry.set(APP_SERVICES_REGISTRY_KEY, replaceAppServiceRuntime(previous, runtime));
    this.game.events.once(Phaser.Core.Events.DESTROY, disposeServices);

    if (import.meta.env.DEV) updateDevBridge({ activeScene: SceneKeys.Boot });
    this.scene.start(SceneKeys.Preload);
    void scope;
  }

  private createScope(): SceneScope {
    const scope = new SceneScope();
    const shutdown = () => scope.dispose();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, shutdown);
    scope.add(() => this.events.off(Phaser.Scenes.Events.SHUTDOWN, shutdown));
    return scope;
  }
}
