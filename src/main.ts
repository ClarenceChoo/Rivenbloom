import { appServices } from './game/core/AppServices';
import { SceneKeys } from './game/scenes/SceneKeys';
import Phaser from 'phaser';

import { BootScene } from './game/scenes/BootScene';
import { PreloadScene } from './game/scenes/PreloadScene';
import { TitleScene } from './game/scenes/TitleScene';
import { TransitionScene } from './game/scenes/TransitionScene';
import { WorldScene } from './game/scenes/WorldScene';
import { DialogueScene } from './game/scenes/DialogueScene';
import { UIScene } from './game/scenes/UIScene';
import { MenuScene } from './game/scenes/MenuScene';
import { installDevBridge } from './game/testing/devBridge';
import './styles/global.css';
import './styles/shell.css';

const LOGICAL_WIDTH = 1280;
const LOGICAL_HEIGHT = 720;

export function createGame(parent: string | HTMLElement): Phaser.Game {
  const app = typeof parent === 'string' ? document.getElementById(parent) : parent;
  if (app === null) throw new Error('Rivenbloom requires an application root.');
  app.replaceChildren();
  const stage = document.createElement('div');
  stage.className = 'game-stage';
  app.append(stage);
  const inputNotice = document.createElement('p');
  inputNotice.className = 'desktop-input-notice';
  inputNotice.textContent =
    'Play with a keyboard or gamepad. Landscape gives you more room; touch controls are not available.';
  app.append(inputNotice);

  const removeDevBridge = import.meta.env.DEV ? installDevBridge() : () => undefined;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: stage,
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
    backgroundColor: '#171325',
    transparent: true,
    dom: { createContainer: true },
    scene: [
      BootScene,
      PreloadScene,
      TitleScene,
      TransitionScene,
      WorldScene,
      DialogueScene,
      UIScene,
      MenuScene,
    ],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
    },
    render: {
      antialias: true,
      pixelArt: false,
    },
    input: {
      keyboard: false,
      mouse: false,
      touch: false,
      gamepad: false,
    },
  });
  game.canvas.setAttribute('aria-hidden', 'true');
  game.canvas.tabIndex = -1;
  game.events.once(Phaser.Core.Events.DESTROY, removeDevBridge);
  return game;
}

const game = createGame('app');
let updateAccepted = false;

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  globalThis.addEventListener('load', () => {
    void registerServiceWorker();
  });
}

async function registerServiceWorker(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing || !updateAccepted) return;
      refreshing = true;
      globalThis.location.reload();
    });
    if (registration.waiting !== null) showUpdatePrompt(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller !== null) {
          showUpdatePrompt(installing);
        }
      });
    });
  } catch {
    // The offline shell is progressive enhancement; gameplay remains available.
  }
}

function showUpdatePrompt(worker: ServiceWorker): void {
  const stage = document.querySelector<HTMLElement>('.game-stage');
  if (stage === null || stage.querySelector('.pwa-update') !== null) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pwa-update';
  button.textContent = 'Update ready · Reload';
  button.addEventListener('click', () => {
    button.disabled = true;
    const world = game.scene.getScene(SceneKeys.World);
    const activeScenes = game.scene.getScenes(true).map((scene) => scene.scene.key);
    for (const key of activeScenes) game.scene.pause(key);
    stage.inert = true;
    const services = appServices(world);
    services.get('inputService').clearTransient();
    void services
      .get('saveService')
      .flush()
      .then(() => {
        if (
          services
            .get('saveService')
            .getNotices()
            .some((notice) => notice.code === 'storage-fallback')
        )
          throw new Error('Export your session before updating.');
        updateAccepted = true;
        worker.postMessage({ type: 'SKIP_WAITING' });
      })
      .catch(() => {
        button.disabled = false;
        button.textContent = 'Update postponed · save or export, then retry';
        stage.inert = false;
        for (const key of activeScenes) game.scene.resume(key);
      });
  });
  stage.append(button);
}
