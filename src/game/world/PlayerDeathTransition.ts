import { deepFreeze, immutableClone } from '../data/immutability';
import type { SaveSettings, SaveSlotId } from '../saves/SaveSchema';
import type { SaveV1 } from '../saves/SaveSchema';
import type { TitleTransitionPayload } from '../title/TitleController';

export type PlayerDeathPayload = Readonly<{
  slotId: SaveSlotId;
  settings: SaveSettings;
  checkpointLabel: string;
  save: SaveV1;
}>;

export type PlayerDeathTransitionSnapshot = Readonly<{
  status: 'idle' | 'flushing' | 'failed' | 'complete';
  retryable: boolean;
  checkpointLabel: string | null;
}>;

export interface PlayerDeathFlushPort {
  queueAutosave(slotId: SaveSlotId, save: SaveV1): void;
  flush(slotId: SaveSlotId): Promise<void>;
}

export class PlayerDeathTransition {
  private generation = 0;
  private payload: PlayerDeathPayload | null = null;
  private state: PlayerDeathTransitionSnapshot = deepFreeze({
    status: 'idle',
    retryable: false,
    checkpointLabel: null,
  });

  public constructor(
    private readonly saves: PlayerDeathFlushPort,
    private readonly reload: (payload: TitleTransitionPayload) => void,
    private readonly publish: (snapshot: PlayerDeathTransitionSnapshot) => void = () => undefined,
  ) {}

  public get snapshot(): PlayerDeathTransitionSnapshot {
    return this.state;
  }

  public start(payload: PlayerDeathPayload): Promise<void> {
    this.payload = immutableClone(payload);
    return this.flush(this.payload);
  }

  public retry(): Promise<void> {
    if (this.state.status !== 'failed' || this.payload === null) return Promise.resolve();
    return this.flush(this.payload);
  }

  public dispose(): boolean {
    if (this.payload === null && this.state.status === 'idle') return false;
    this.generation += 1;
    this.payload = null;
    return true;
  }

  private async flush(payload: PlayerDeathPayload): Promise<void> {
    const generation = ++this.generation;
    this.setState({
      status: 'flushing',
      retryable: false,
      checkpointLabel: payload.checkpointLabel,
    });
    try {
      this.saves.queueAutosave(payload.slotId, payload.save);
      await this.saves.flush(payload.slotId);
    } catch {
      if (generation !== this.generation) return;
      this.setState({
        status: 'failed',
        retryable: true,
        checkpointLabel: payload.checkpointLabel,
      });
      return;
    }
    if (generation !== this.generation) return;
    this.setState({
      status: 'complete',
      retryable: false,
      checkpointLabel: payload.checkpointLabel,
    });
    this.reload({ mode: 'load', slotId: payload.slotId, settings: payload.settings });
  }

  private setState(snapshot: PlayerDeathTransitionSnapshot): void {
    this.state = deepFreeze(snapshot);
    this.publish(this.state);
  }
}
