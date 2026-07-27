import Phaser from 'phaser';
import { SceneScope } from '../core/SceneScope';
import { getAreaDefinition } from '../data/areas';
import type { SaveSlotId, SaveV1 } from '../saves/SaveSchema';
import { createTransitionShell } from '../ui/dom/menuShell';
import { SceneKeys } from './SceneKeys';

export type TransitionPayload = {
  readonly destinationId: string;
  readonly destinationName: string;
  readonly slotId?: SaveSlotId;
  readonly save?: SaveV1;
  readonly spawnId?: string;
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
    const destinationAreaId = getAreaDefinition(this.payload.destinationId)?.id;
    if (destinationAreaId === undefined) return;
    const handoff = this.time.delayedCall(TRANSITION_HOLD_MS, () => {
      this.scene.start(SceneKeys.World, {
        areaId: destinationAreaId,
        ...(this.payload.spawnId === undefined ? {} : { spawnId: this.payload.spawnId }),
        ...(this.payload.slotId === undefined ? {} : { slotId: this.payload.slotId }),
        ...(this.payload.save === undefined ? {} : { save: this.payload.save })
      });
    });
    this.scope.add(() => handoff.remove(false));
  }

  private shutdown(): void {
    this.scope.dispose();
  }
}
