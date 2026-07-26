import type { PlayerSpawnDefinition } from '../../data/types';
import type { InputService } from '../../input/InputService';
import {
  advancePlayerCombatFrame,
  applyCombatMovementLocks,
  createPlayerCombatState,
  type PlayerCombatDirective,
  type PlayerCombatState,
  type PlayerCombatStep
} from '../../combat/PlayerCombat';
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
  private combatState: PlayerCombatState = createPlayerCombatState();
  private combatStep: PlayerCombatStep | undefined;
  private readonly combatDirectives: PlayerCombatDirective[] = [];
  private pendingRespawn = false;
  private pendingKnockback: Vector2 | undefined;
  private disposed = false;

  public constructor(private readonly options: PlayerControllerOptions) {
    this.state = createMovementState(options.spawn.position, options.spawn.facing);
  }

  public get snapshot(): MovementState {
    return this.state;
  }

  public get combatSnapshot(): PlayerCombatState {
    return this.combatState;
  }

  public get latestCombatStep(): PlayerCombatStep | undefined {
    return this.combatStep;
  }

  public update(timeMs: number, deltaMs: number): void {
    if (this.disposed) return;
    const frame = this.options.input.sample(timeMs);
    const jumpPressed = frame.pressed.includes('jump');
    const rawMovementInput: MovementInput = {
      moveX: frame.movement.x,
      moveY: frame.movement.y,
      jumpPressed,
      jumpHeld: frame.held.jump,
      dropPressed: jumpPressed && frame.movement.y > 0,
      respawn: this.pendingRespawn,
      ...(this.pendingKnockback === undefined ? {} : { knockback: this.pendingKnockback })
    };
    const locomotionState = this.state.grounded
      ? frame.movement.x === 0
        ? 'idle'
        : 'run'
      : this.state.velocity.y < 0
        ? 'jump'
        : 'fall';
    const combat = advancePlayerCombatFrame(
      this.combatState,
      {
        lightPressed: frame.pressed.includes('attack-light'),
        heavyPressed: frame.pressed.includes('attack-heavy'),
        heavyHeld: frame.held['attack-heavy'],
        heavyReleased: frame.released.includes('attack-heavy'),
        blockPressed: frame.pressed.includes('block'),
        blockHeld: frame.held.block,
        blockReleased: frame.released.includes('block'),
        dashPressed: frame.pressed.includes('dash'),
        castPressed: frame.pressed.includes('cast'),
        cycleLeftPressed: frame.pressed.includes('cycle-ability-left'),
        cycleRightPressed: frame.pressed.includes('cycle-ability-right')
      },
      {
        machine: this.state.machine,
        grounded: this.state.grounded,
        facing: this.state.facing,
        locomotionState,
        nowMs: timeMs
      },
      deltaMs / 1000
    );
    const movementInput = applyCombatMovementLocks(rawMovementInput, combat);
    const composedMovementInput: MovementInput = {
      ...movementInput,
      locomotionLocked: combat.movementLocked,
      ...(combat.movementLocked && combat.machine.value !== 'hurt'
        ? { forcedVelocityX: combat.dashVelocityX }
        : {})
    };
    const step = advanceMovementFrame(
      { ...this.state, machine: combat.machine },
      composedMovementInput,
      this.options.platforms,
      this.options.tuning,
      deltaMs / 1000
    );
    this.state = step.state;
    this.combatState = combat.state;
    this.combatStep = combat;
    this.combatDirectives.push(...combat.directives);
    this.options.view.apply(step, timeMs, this.combatState);
    this.pendingRespawn = false;
    this.pendingKnockback = undefined;
  }

  public respawn(): void {
    this.pendingRespawn = true;
  }

  public applyKnockback(impulse: Vector2): void {
    this.pendingKnockback = impulse;
  }

  public drainCombatDirectives(): readonly PlayerCombatDirective[] {
    const directives = this.combatDirectives.splice(0);
    return directives;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.options.view.dispose();
  }
}
