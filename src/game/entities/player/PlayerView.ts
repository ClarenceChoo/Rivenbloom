import Phaser from 'phaser';
import {
  maraGroundAnchor,
  MARA_LOCOMOTION_FRAMES,
  MARA_LOCOMOTION_REFERENCE_HEIGHT,
  MARA_RUN_CYCLE,
} from '../../data/artFrames';

import type { Vec2 } from '../../data/types';
import type { PlayerControllerSnapshot } from './PlayerController';

export function playerVisualCenter(feet: Vec2, visualHeight: number): Vec2 {
  return Object.freeze({ x: feet.x, y: feet.y - visualHeight / 2 });
}

export class PlayerView {
  private readonly sprite: Phaser.GameObjects.Image;
  private frameStep = 0;
  private lastTimeMs: number | null = null;
  private previousState: PlayerControllerSnapshot['state'] | null = null;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly visualHeight: number,
  ) {
    const key = 'rivenbloom-mara-animation-sheet';
    if (!scene.textures.exists(key) || !scene.textures.exists('rivenbloom-mara-locomotion')) {
      throw new Error('Required Mara production art is unavailable.');
    }
    const texture = scene.textures.get(key);
    const locomotion = scene.textures.get('rivenbloom-mara-locomotion');
    for (const [index, frame] of MARA_LOCOMOTION_FRAMES.entries()) {
      const name = `mara-motion-${index}`;
      if (!locomotion.has(name))
        locomotion.add(name, 0, frame.x, frame.y, frame.width, frame.height);
    }
    for (let row = 0; row < 3; row += 1) {
      const y = row === 0 ? 0 : row === 1 ? 341 : 682;
      const height = row === 2 ? 342 : 341;
      for (let column = 0; column < 6; column += 1) {
        const index = row * 6 + column;
        const name = `mara-${index}`;
        if (!texture.has(name)) texture.add(name, 0, column * 256, y, 256, height);
      }
    }
    this.sprite = scene.add.image(0, 0, key, 'mara-0').setOrigin(0.5, 1).setDepth(100);
    this.sprite.setDisplaySize(this.visualHeight * 0.75, this.visualHeight);
  }

  public sync(snapshot: PlayerControllerSnapshot): void {
    const now = this.scene.time.now;
    const elapsed = this.lastTimeMs === null ? 0 : Math.max(0, Math.min(50, now - this.lastTimeMs));
    this.lastTimeMs = now;
    this.frameStep = this.previousState === snapshot.state ? this.frameStep + elapsed * 0.06 : 0;
    this.previousState = snapshot.state;
    const motion =
      snapshot.state === 'dead'
        ? 6
        : snapshot.state === 'interact'
          ? 7
          : snapshot.state === 'run' && snapshot.animationIntent === 'run'
            ? MARA_RUN_CYCLE[Math.floor(this.frameStep / 5) % MARA_RUN_CYCLE.length]!
            : null;
    if (motion !== null) {
      const frame = MARA_LOCOMOTION_FRAMES[motion]!;
      this.sprite
        .setTexture('rivenbloom-mara-locomotion', `mara-motion-${motion}`)
        .setScale(this.visualHeight / MARA_LOCOMOTION_REFERENCE_HEIGHT)
        .setOrigin(0.5, (frame.groundY - frame.y) / frame.height);
    } else {
      const frame = selectMaraFrame(snapshot, this.frameStep);
      this.sprite
        .setTexture('rivenbloom-mara-animation-sheet', `mara-${frame}`)
        .setScale(this.visualHeight / 341)
        .setOrigin(0.5, maraGroundAnchor(frame));
    }
    this.sprite.setPosition(snapshot.position.x, snapshot.position.y);
    if (snapshot.velocity.x < -0.01) this.sprite.setFlipX(true);
    if (snapshot.velocity.x > 0.01) this.sprite.setFlipX(false);
    this.sprite.setAlpha(snapshot.state === 'hurt' ? 0.72 : 1);
  }

  public destroy(): void {
    this.sprite.destroy();
  }
}

function selectMaraFrame(snapshot: PlayerControllerSnapshot, step: number): number {
  switch (snapshot.state) {
    case 'attackLight':
      return [6, 7, 8][Math.min(2, Math.floor(step / 3))] ?? 8;
    case 'attackHeavy':
      return step < 6 ? 10 : 11;
    case 'airAttack':
      return 9;
    case 'block':
      return 12;
    case 'parry':
      return 13;
    case 'cast':
      return 14;
    case 'dash':
      return 15;
    case 'climb':
      return 16;
    case 'hurt':
      return 17;
    default:
      break;
  }

  switch (snapshot.animationIntent) {
    case 'run':
      return Math.floor(step / 5) % 2 === 0 ? 1 : 2;
    case 'jump':
      return 3;
    case 'fall':
      return 4;
    case 'land':
      return 5;
    case 'climb':
      return 16;
    case 'idle':
      return 0;
  }
}
