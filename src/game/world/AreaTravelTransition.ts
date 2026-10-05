import { deepFreeze, immutableClone } from '../data/immutability';
import type { SaveSettings, SaveSlotId, SaveV1 } from '../saves/SaveSchema';
import type { TitleTransitionPayload } from '../title/TitleController';

export type AreaTravelPayload = Readonly<{
  slotId: SaveSlotId;
  settings: SaveSettings;
  save: SaveV1;
  sourceLabel: string;
  targetLabel: string;
  revision: number;
}>;

export type AreaTravelTransitionSnapshot = Readonly<{
  status: 'idle' | 'flushing' | 'failed' | 'complete';
  retryable: boolean;
  sourceLabel: string | null;
  targetLabel: string | null;
  revision: number | null;
}>;

export interface AreaTravelFlushPort {
  queueAutosave(slotId: SaveSlotId, save: SaveV1): void;
  flush(slotId: SaveSlotId): Promise<void>;
}

export class AreaTravelTransition {
  private generation = 0;
  private payload: AreaTravelPayload | null = null;
  private state: AreaTravelTransitionSnapshot = deepFreeze({
    status: 'idle',
    retryable: false,
    sourceLabel: null,
    targetLabel: null,
    revision: null,
  });

  public constructor(
    private readonly saves: AreaTravelFlushPort,
    private readonly load: (payload: TitleTransitionPayload) => void,
    private readonly publish: (snapshot: AreaTravelTransitionSnapshot) => void = () => undefined,
  ) {}

  public get snapshot(): AreaTravelTransitionSnapshot {
    return this.state;
  }

  public start(payload: AreaTravelPayload): Promise<void> {
    if (!Number.isSafeInteger(payload.revision) || payload.revision < 1) {
      throw new RangeError('Area travel revision must be a positive safe integer.');
    }
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

  private async flush(payload: AreaTravelPayload): Promise<void> {
    const generation = ++this.generation;
    this.setState({
      status: 'flushing',
      retryable: false,
      sourceLabel: payload.sourceLabel,
      targetLabel: payload.targetLabel,
      revision: payload.revision,
    });
    try {
      this.saves.queueAutosave(payload.slotId, payload.save);
      await this.saves.flush(payload.slotId);
    } catch {
      if (generation !== this.generation) return;
      this.setState({
        status: 'failed',
        retryable: true,
        sourceLabel: payload.sourceLabel,
        targetLabel: payload.targetLabel,
        revision: payload.revision,
      });
      return;
    }
    if (generation !== this.generation) return;
    this.setState({
      status: 'complete',
      retryable: false,
      sourceLabel: payload.sourceLabel,
      targetLabel: payload.targetLabel,
      revision: payload.revision,
    });
    this.load({ mode: 'load', slotId: payload.slotId, settings: payload.settings });
  }

  private setState(snapshot: AreaTravelTransitionSnapshot): void {
    this.state = deepFreeze(snapshot);
    this.publish(this.state);
  }
}
