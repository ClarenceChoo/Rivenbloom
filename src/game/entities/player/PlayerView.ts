import type Phaser from 'phaser';
import type { ActorDefinition } from '../../data/types';
import type { PlayerCombatState } from '../../combat/PlayerCombat';
import type { MovementStep, Vector2 } from '../../physics/MovementModel';

type PlayerVisualFrame =
  | 'idle'
  | 'run-a'
  | 'run-b'
  | 'jump'
  | 'fall'
  | 'land'
  | 'climb'
  | 'attack-light-1'
  | 'attack-light-2'
  | 'attack-light-3'
  | 'air-attack'
  | 'charged-attack'
  | 'block'
  | 'cast'
  | 'dash'
  | 'hurt';

const FRAME_SIZE = 300;
const DISPLAY_SIZE = 120;
const RUN_FRAME_MS = 120;
const FRAME_CELLS: Readonly<
  Record<PlayerVisualFrame, { readonly column: number; readonly row: number }>
> = {
  idle: { column: 0, row: 0 },
  'run-a': { column: 1, row: 0 },
  'run-b': { column: 2, row: 0 },
  jump: { column: 0, row: 1 },
  fall: { column: 0, row: 1 },
  land: { column: 2, row: 1 },
  climb: { column: 1, row: 1 },
  'attack-light-1': { column: 0, row: 2 },
  'attack-light-2': { column: 1, row: 2 },
  'attack-light-3': { column: 2, row: 2 },
  'air-attack': { column: 3, row: 1 },
  'charged-attack': { column: 3, row: 2 },
  block: { column: 0, row: 3 },
  cast: { column: 1, row: 3 },
  dash: { column: 2, row: 3 },
  hurt: { column: 3, row: 3 }
};

export class PlayerView {
  private readonly image: Phaser.GameObjects.Image;

  public constructor(scene: Phaser.Scene, actor: ActorDefinition, position: Vector2) {
    const texture = scene.textures.get(actor.render.assetKey);
    for (const [name, cell] of Object.entries(FRAME_CELLS)) {
      const frameName = this.frameName(name as PlayerVisualFrame);
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

  public apply(step: MovementStep, timeMs: number, combat?: PlayerCombatState): void {
    this.image.setPosition(step.state.position.x, step.state.position.y);
    this.image.setFlipX(step.animation.facing === 'left');
    this.image.setFrame(this.frameName(this.selectFrame(step, timeMs, combat)));
  }

  public dispose(): void {
    this.image.destroy();
  }

  private selectFrame(
    step: MovementStep,
    timeMs: number,
    combat?: PlayerCombatState
  ): PlayerVisualFrame {
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
      case 'attackLight':
        return combat?.comboStage === 2
          ? 'attack-light-2'
          : combat?.comboStage === 3
            ? 'attack-light-3'
            : 'attack-light-1';
      case 'airAttack':
        return 'air-attack';
      case 'attackHeavy':
        return 'charged-attack';
      case 'block':
      case 'parry':
        return 'block';
      case 'cast':
        return 'cast';
      case 'dash':
        return 'dash';
      case 'hurt':
      case 'dead':
        return 'hurt';
      default:
        return 'idle';
    }
  }

  private frameName(frame: PlayerVisualFrame): string {
    return `mara-locomotion-${frame}`;
  }
}
