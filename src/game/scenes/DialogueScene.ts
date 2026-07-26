import Phaser from 'phaser';
import { GAME_SERVICES_REGISTRY_KEY, GameEventsToken } from '../core/GameServices';
import { SceneScope } from '../core/SceneScope';
import type { ServiceRegistry } from '../core/ServiceRegistry';
import {
  DialogueController,
  type DialogueContext,
  type DialoguePage,
  type DialogueQuestSignal
} from '../dialogue/DialogueController';
import { createDialogueShell, type DialogueShell } from '../ui/dom/dialogueShell';
import { SceneKeys } from './SceneKeys';

export type DialoguePayload = {
  readonly dialogueId: string;
  readonly questStages?: Readonly<Record<string, string>>;
  readonly questFlags?: readonly string[];
};

export class DialogueScene extends Phaser.Scene {
  private scope = new SceneScope();
  private payload: DialoguePayload = { dialogueId: '' };
  private controller = new DialogueController();
  private shell: DialogueShell | undefined;
  private page: DialoguePage | undefined;
  private readonly questSignals: DialogueQuestSignal[] = [];

  public constructor() {
    super(SceneKeys.Dialogue);
  }

  public init(payload: DialoguePayload): void {
    this.scope = new SceneScope();
    this.payload = payload;
    this.controller = new DialogueController();
    this.shell = undefined;
    this.page = undefined;
    this.questSignals.length = 0;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.scope.add(() => this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this));
  }

  public create(): void {
    const services = this.registry.get(GAME_SERVICES_REGISTRY_KEY) as ServiceRegistry;
    const events = services.get(GameEventsToken);
    this.shell = createDialogueShell({
      onAdvance: () => this.turnPage(undefined),
      onChoice: (choiceId) => this.turnPage(choiceId)
    });
    this.scope.add(() => this.shell?.dispose());
    const opening = this.controller.start(this.payload.dialogueId, this.context());
    this.presentPage(opening);
    events.emit('dialogue:started', {
      dialogueId: this.payload.dialogueId,
      speakerActorId: opening.speakerActorId
    });
  }

  private context(): DialogueContext {
    return {
      questStages: this.payload.questStages ?? {},
      questFlags: this.payload.questFlags ?? []
    };
  }

  private presentPage(page: DialoguePage): void {
    this.page = page;
    if (page.questSignal !== undefined) {
      const duplicate = this.questSignals.some(
        (signal) =>
          signal.questId === page.questSignal?.questId &&
          signal.questStageId === page.questSignal?.questStageId
      );
      if (!duplicate) this.questSignals.push(page.questSignal);
    }
    this.shell?.setPage(page);
  }

  private turnPage(choiceId: string | undefined): void {
    if (this.page === undefined) return;
    const next = this.controller.advance(this.page, this.context(), choiceId);
    if (next !== undefined) {
      this.presentPage(next);
      return;
    }
    const services = this.registry.get(GAME_SERVICES_REGISTRY_KEY) as ServiceRegistry;
    services.get(GameEventsToken).emit('dialogue:completed', {
      dialogueId: this.payload.dialogueId,
      questSignals: [...this.questSignals]
    });
    this.scene.stop(SceneKeys.Dialogue);
  }

  private shutdown(): void {
    this.scope.dispose();
  }
}
