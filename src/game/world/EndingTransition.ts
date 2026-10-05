import { deepFreeze, immutableClone } from '../data/immutability';
import type { SaveSettings, SaveSlotId, SaveV1 } from '../saves/SaveSchema';

export type EndingPayload = Readonly<{
  slotId: SaveSlotId;
  settings: SaveSettings;
  save: SaveV1;
}>;

export type EndingTransitionSnapshot = Readonly<{
  status: 'idle' | 'flushing' | 'failed' | 'complete';
  retryable: boolean;
}>;

export interface EndingFlushPort {
  queueAutosave(slotId: SaveSlotId, save: SaveV1): void;
  flush(slotId: SaveSlotId): Promise<void>;
}

export class EndingTransition {
  private generation = 0;
  private payload: EndingPayload | null = null;
  private state: EndingTransitionSnapshot = deepFreeze({ status: 'idle', retryable: false });

  public constructor(
    private readonly saves: EndingFlushPort,
    private readonly publish: (snapshot: EndingTransitionSnapshot) => void = () => undefined,
  ) {}

  public get snapshot(): EndingTransitionSnapshot {
    return this.state;
  }

  public start(payload: EndingPayload): Promise<void> {
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

  private async flush(payload: EndingPayload): Promise<void> {
    const generation = ++this.generation;
    this.setState({ status: 'flushing', retryable: false });
    try {
      this.saves.queueAutosave(payload.slotId, payload.save);
      await this.saves.flush(payload.slotId);
    } catch {
      if (generation !== this.generation) return;
      this.setState({ status: 'failed', retryable: true });
      return;
    }
    if (generation !== this.generation) return;
    this.setState({ status: 'complete', retryable: false });
  }

  private setState(snapshot: EndingTransitionSnapshot): void {
    this.state = deepFreeze(snapshot);
    this.publish(this.state);
  }
}
