import { expect, test, vi } from 'vitest';
import type Phaser from 'phaser';
import { PlayerView } from '../../src/game/entities/player/PlayerView';
import type { PlayerControllerSnapshot } from '../../src/game/entities/player/PlayerController';

vi.mock('phaser', () => ({ default: {} }));

class Sprite {
  frame = '';
  texture = '';
  setOrigin() {
    return this;
  }
  setDepth() {
    return this;
  }
  setDisplaySize() {
    return this;
  }
  setScale() {
    return this;
  }
  setPosition() {
    return this;
  }
  setFlipX() {
    return this;
  }
  setAlpha() {
    return this;
  }
  setFrame(frame: string) {
    this.frame = frame;
    return this;
  }
  setTexture(texture: string, frame: string) {
    this.texture = texture;
    this.frame = frame;
    return this;
  }
  destroy() {}
}

function setup() {
  const sprite = new Sprite();
  const scene = {
    time: { now: 0 },
    textures: { exists: () => true, get: () => ({ has: () => false, add: () => undefined }) },
    add: { image: () => sprite },
  };
  const view = new PlayerView(scene as unknown as Phaser.Scene, 128);
  const sync = (
    state: PlayerControllerSnapshot['state'],
    animationIntent: PlayerControllerSnapshot['animationIntent'] = 'idle',
  ) => {
    view.sync({
      state,
      animationIntent,
      position: { x: 0, y: 600 },
      velocity: { x: 0, y: 0 },
    } as PlayerControllerSnapshot);
    return `${sprite.texture}/${sprite.frame}`;
  };
  return { scene, sync };
}

test('death and interaction have distinct authored poses instead of reusing hurt or idle', () => {
  const { sync } = setup();
  const hurt = sync('hurt');
  expect(sync('dead')).not.toBe(hurt);
  expect(sync('interact')).not.toBe(sync('idle'));
});

test('running presents six distinct strides over a complete animation cycle', () => {
  const { scene, sync } = setup();
  const frames = new Set<string>();
  for (let time = 0; time <= 600; time += 25) {
    scene.time.now = time;
    frames.add(sync('run', 'run'));
  }
  expect(frames.size).toBe(6);
});
