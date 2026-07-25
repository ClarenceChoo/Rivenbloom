import Phaser from 'phaser';
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
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  });
}

createGame('app');
