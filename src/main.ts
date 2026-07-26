import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import { PreloadScene } from './game/scenes/PreloadScene';
import { TitleScene } from './game/scenes/TitleScene';
import { TransitionScene } from './game/scenes/TransitionScene';
import { WorldScene } from './game/scenes/WorldScene';
import './styles/global.css';
import './styles/shell.css';

export const LOGICAL_WIDTH = 1280;
export const LOGICAL_HEIGHT = 720;

export function createGame(parent: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
    backgroundColor: '#10120f',
    scene: [BootScene, PreloadScene, TitleScene, TransitionScene, WorldScene],
    dom: {
      createContainer: true
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  });
}

createGame('app');
