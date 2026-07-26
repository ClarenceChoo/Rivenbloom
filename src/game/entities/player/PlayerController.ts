import type { PlayerSpawnDefinition } from '../../data/types';
import type { InputService } from '../../input/InputService';
import {
  createMovementState,
  stepMovement,
  type MovementInput,
  type MovementState,
  type MovementStep,
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
    const ignoreOneWay = this.state.dropThroughRemaining > 0;
    const contacts = this.options.platforms.query(this.state.position, {
      ignoreOneWay
    });
    const step = stepMovement(
      this.state,
      movementInput,
      contacts,
      this.options.tuning,
      deltaMs / 1000
    );
    const resolution = this.options.platforms.resolve(
      this.state.position,
      step.state.position,
      step.state.velocity,
      { ignoreOneWay: step.state.dropThroughRemaining > 0 }
    );
    this.state = {
      ...step.state,
      position: resolution.position,
      velocity: resolution.velocity
    };
    const resolvedStep: MovementStep = {
      ...step,
      state: this.state,
      animation: {
        ...step.animation,
        state: this.state.machine.value,
        facing: this.state.facing
      }
    };
    this.options.view.apply(resolvedStep, timeMs);
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
