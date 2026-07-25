import Phaser from 'phaser';
import { SceneScope } from '../core/SceneScope';
import { createTransitionShell } from '../ui/dom/menuShell';
import { SceneKeys } from './SceneKeys';

type TransitionPayload = {
  readonly destinationId: string;
  readonly destinationName: string;
  readonly reducedMotion?: boolean;
};

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
  }

  private shutdown(): void {
    this.scope.dispose();
  }
}
