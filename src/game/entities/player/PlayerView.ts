import type Phaser from 'phaser';
import type { ActorDefinition } from '../../data/types';
import type { MovementStep, Vector2 } from '../../physics/MovementModel';

type LocomotionFrame = 'idle' | 'run-a' | 'run-b' | 'jump' | 'fall' | 'land' | 'climb' | 'hurt';

const FRAME_SIZE = 300;
const DISPLAY_SIZE = 120;
const RUN_FRAME_MS = 120;
const FRAME_CELLS: Readonly<
  Record<LocomotionFrame, { readonly column: number; readonly row: number }>
> = {
  idle: { column: 0, row: 0 },
  'run-a': { column: 1, row: 0 },
  'run-b': { column: 2, row: 0 },
  jump: { column: 0, row: 1 },
  fall: { column: 0, row: 1 },
  land: { column: 2, row: 1 },
  climb: { column: 1, row: 1 },
  hurt: { column: 3, row: 3 }
};

export class PlayerView {
  private readonly image: Phaser.GameObjects.Image;

  public constructor(scene: Phaser.Scene, actor: ActorDefinition, position: Vector2) {
    const texture = scene.textures.get(actor.render.assetKey);
    for (const [name, cell] of Object.entries(FRAME_CELLS)) {
      const frameName = this.frameName(name as LocomotionFrame);
      if (texture.has(frameName)) continue;
      texture.add(
        frameName,
        0,
        cell.column * FRAME_SIZE,
        cell.row * FRAME_SIZE,
        FRAME_SIZE,
        FRAME_SIZE
      );
    }
    this.image = scene.add
      .image(position.x, position.y, actor.render.assetKey, this.frameName('idle'))
      .setOrigin(0.5, 0.92)
      .setDisplaySize(DISPLAY_SIZE, DISPLAY_SIZE)
      .setDepth(actor.render.depth)
      .setData('actorId', actor.id);
  }

  public apply(step: MovementStep, timeMs: number): void {
    this.image.setPosition(step.state.position.x, step.state.position.y);
    this.image.setFlipX(step.animation.facing === 'left');
    this.image.setFrame(this.frameName(this.selectFrame(step, timeMs)));
  }

  public dispose(): void {
    this.image.destroy();
  }

  private selectFrame(step: MovementStep, timeMs: number): LocomotionFrame {
    switch (step.animation.state) {
      case 'run':
        return Math.floor(timeMs / RUN_FRAME_MS) % 2 === 0 ? 'run-a' : 'run-b';
      case 'jump':
        return 'jump';
      case 'fall':
        return 'fall';
      case 'land':
        return 'land';
      case 'climb':
        return 'climb';
      case 'hurt':
        return 'hurt';
      default:
        return 'idle';
    }
  }

  private frameName(frame: LocomotionFrame): string {
    return `mara-locomotion-${frame}`;
  }
}
