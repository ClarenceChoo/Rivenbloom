import Phaser from 'phaser';

import { appServices } from '../core/AppServices';
import { SceneScope } from '../core/SceneScope';
import { gamepadUiActions } from '../input/GamepadUiNavigation';
import { updateDevBridge } from '../testing/devBridge';
import { TitleController } from '../title/TitleController';
import type { TitleTransitionPayload } from '../title/TitleController';
import { createMenuShell } from '../ui/dom/menuShell';
import type { MenuShellHandle, TitleMenuIntent } from '../ui/dom/menuShell';
import { SceneKeys } from './SceneKeys';

export class TitleScene extends Phaser.Scene {
  private shell: MenuShellHandle | null = null;
  private controller: TitleController | null = null;
  private focusFrame: number | null = null;

  public constructor() {
    super(SceneKeys.Title);
  }

  public create(): void {
    const scope = new SceneScope();
    const shutdown = () => scope.dispose();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, shutdown);
    scope.add(() => this.events.off(Phaser.Scenes.Events.SHUTDOWN, shutdown));

    const services = appServices(this);
    services.get('audioDirector').setMusicLayer('menu');
    const saveService = services.get('saveService');
    const eventBus = services.get('events');
    const parent = this.game.canvas.parentElement;
    if (parent === null) throw new Error('The game stage is unavailable.');
    let titleWasReady = false;
    const controller = new TitleController(saveService, {
      onState: (state) => {
        this.shell?.render(state);
        if (import.meta.env.DEV) {
          updateDevBridge({
            activeScene: SceneKeys.Title,
            titleReady: state.titleReady,
            slotStates: state.slots.map(({ kind }) => kind),
            transition: null,
            world: null,
            player: null,
            camera: null,
          });
        }
        const becameReady = state.titleReady && !titleWasReady;
        titleWasReady = state.titleReady;
        if (becameReady) {
          if (this.focusFrame !== null) cancelAnimationFrame(this.focusFrame);
          this.focusFrame = requestAnimationFrame(() => {
            this.focusFrame = null;
            this.shell?.focus('initial');
          });
        }
      },
      onTransition: (payload: TitleTransitionPayload) => {
        this.scene.start(SceneKeys.Transition, { kind: 'world-entry', entry: payload });
      },
    });
    const shell = createMenuShell(parent, (intent) => this.handleIntent(intent));
    this.controller = controller;
    this.shell = shell;
    shell.render(controller.snapshot);

    const unsubscribe = eventBus.on('title-command', (command) => {
      void controller.issue(command);
    });
    scope.add(unsubscribe);
    scope.add(() => shell.destroy());
    scope.add(() => controller.stop());
    scope.add(() => {
      if (this.focusFrame !== null) cancelAnimationFrame(this.focusFrame);
      this.focusFrame = null;
      this.shell = null;
      this.controller = null;
    });

    if (import.meta.env.DEV) {
      updateDevBridge({
        activeScene: SceneKeys.Title,
        titleReady: false,
        slotStates: ['loading', 'loading', 'loading'],
        transition: null,
        world: null,
        player: null,
        camera: null,
      });
    }
    void controller.start();
  }

  public update(): void {
    const shell = this.shell;
    if (shell === null) return;
    const frame = appServices(this).get('inputService').sample(performance.now());
    for (const action of gamepadUiActions(frame)) shell.focus(action);
  }

  private handleIntent(intent: TitleMenuIntent): void {
    const controller = this.controller;
    if (controller === null) return;
    switch (intent.type) {
      case 'command':
        appServices(this).get('events').emit('title-command', intent.command);
        return;
      case 'select-slot':
        controller.selectSlot(intent.slotId);
        return;
      case 'open-manage':
        controller.openManage(intent.slotId);
        return;
      case 'preview-import':
        void controller.previewImport(intent.slotId, intent.contents);
        return;
      case 'export-slot':
        void controller.exportSlot(intent.slotId);
        return;
      case 'export-corrupt':
        void controller.exportCorrupt(intent.slotId);
        return;
      case 'update-settings':
        controller.updateSettings(intent.settings);
        return;
      case 'confirm-dialog':
        void controller.confirmDialog();
        return;
      case 'close-dialog':
        controller.closeDialog();
        return;
      case 'retry-slots':
        void controller.refresh();
        return;
      default:
        assertNever(intent);
    }
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled title menu intent: ${String(value)}`);
}
