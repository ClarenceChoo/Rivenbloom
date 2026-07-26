import type { PlayerSpawnDefinition } from '../../data/types';
import type { InputService } from '../../input/InputService';
import { advanceMovementFrame } from '../../physics/MovementFrame';
import {
  createMovementState,
  type MovementInput,
  type MovementState,
  type MovementTuning,
  type Vector2
} from '../../physics/MovementModel';
import type { PlatformRules } from '../../physics/PlatformRules';
import type { PlayerView } from './PlayerView';

export type PlayerControllerOptions = {
  readonly input: InputService;
  readonly platforms: PlatformRules;
  readonly view: PlayerView;
  readonly tuning: MovementTuning;
  readonly spawn: PlayerSpawnDefinition;
};

export class PlayerController {
  private state: MovementState;
  private pendingRespawn = false;
  private pendingKnockback: Vector2 | undefined;
  private disposed = false;

  public constructor(private readonly options: PlayerControllerOptions) {
    this.state = createMovementState(options.spawn.position, options.spawn.facing);
  }

  public get snapshot(): MovementState {
    return this.state;
  }

  public update(timeMs: number, deltaMs: number): void {
    if (this.disposed) return;
    const frame = this.options.input.sample(timeMs);
    const jumpPressed = frame.pressed.includes('jump');
    const movementInput: MovementInput = {
      moveX: frame.movement.x,
      moveY: frame.movement.y,
      jumpPressed,
      jumpHeld: frame.held.jump,
      dropPressed: jumpPressed && frame.movement.y > 0,
      respawn: this.pendingRespawn,
      ...(this.pendingKnockback === undefined ? {} : { knockback: this.pendingKnockback })
    };
    const step = advanceMovementFrame(
      this.state,
      movementInput,
      this.options.platforms,
      this.options.tuning,
      deltaMs / 1000
    );
    this.state = step.state;
    this.options.view.apply(step, timeMs);
    this.pendingRespawn = false;
    this.pendingKnockback = undefined;
  }

  public respawn(): void {
    this.pendingRespawn = true;
  }

  public applyKnockback(impulse: Vector2): void {
    this.pendingKnockback = impulse;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.options.view.dispose();
  }
}
