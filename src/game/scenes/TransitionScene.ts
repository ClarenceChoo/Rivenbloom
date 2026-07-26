import Phaser from 'phaser';
import { SceneScope } from '../core/SceneScope';
import { getAreaDefinition, INITIAL_WORLD_AREA_ID } from '../data/areas';
import { createTransitionShell } from '../ui/dom/menuShell';
import { SceneKeys } from './SceneKeys';

export type TransitionPayload = {
  readonly destinationId: string;
  readonly destinationName: string;
  readonly unlockedAbilityIds?: readonly string[];
  readonly reducedMotion?: boolean;
};

const TRANSITION_HOLD_MS = 300;

export class TransitionScene extends Phaser.Scene {
  private scope = new SceneScope();
  private payload: TransitionPayload = {
    destinationId: 'wrens-rest',
    destinationName: "WREN'S REST"
  };

  public constructor() {
    super(SceneKeys.Transition);
  }

  public init(payload: TransitionPayload): void {
    this.scope = new SceneScope();
    this.payload = payload;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.scope.add(() => this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this));
  }

  public create(): void {
    const shell = createTransitionShell(
      this.payload.destinationName,
      this.payload.destinationId,
      this.payload.reducedMotion === true
    );
    this.scope.add(() => shell.dispose());
    const destinationAreaId =
      getAreaDefinition(this.payload.destinationId)?.id ??
      (this.payload.destinationId === 'wrens-rest' ? INITIAL_WORLD_AREA_ID : undefined);
    if (destinationAreaId === undefined) return;
    const handoff = this.time.delayedCall(TRANSITION_HOLD_MS, () => {
      this.scene.start(SceneKeys.World, {
        areaId: destinationAreaId,
        unlockedAbilityIds: this.payload.unlockedAbilityIds ?? ['lumen-bolt']
      });
    });
    this.scope.add(() => handoff.remove(false));
  }

  private shutdown(): void {
    this.scope.dispose();
  }
}
