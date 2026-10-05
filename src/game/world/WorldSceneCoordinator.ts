import type { AreaLoadedEvent } from '../core/AppServices';
import type { WorldEntryPayload, WorldStartResult } from './WorldStart';
import { WorldStart } from './WorldStart';

export type WorldScenePublicationPort = Readonly<{
  areaLoaded(event: AreaLoadedEvent): void;
  worldSnapshot(event: AreaLoadedEvent): void;
  failed(result: Extract<WorldStartResult, { kind: 'failed' }>): void;
}>;

export class WorldSceneCoordinator {
  private generation = 0;

  public constructor(
    private readonly worldStart: WorldStart,
    private readonly publications: WorldScenePublicationPort,
  ) {}

  public async begin(payload: WorldEntryPayload): Promise<WorldStartResult> {
    const generation = ++this.generation;
    const result = await this.worldStart.start(payload);
    if (generation !== this.generation || result.kind === 'stopped') return result;
    if (result.kind === 'failed') {
      this.publications.failed(result);
      return result;
    }

    const event: AreaLoadedEvent = Object.freeze({
      slotId: result.slotId,
      mode: result.mode,
      areaId: result.area.definition.areaId,
      roomId: result.room.roomId,
      checkpointId: result.checkpoint.checkpointId,
      position: Object.freeze({ ...result.position }),
    });
    this.publications.areaLoaded(event);
    if (generation !== this.generation) return result;
    this.publications.worldSnapshot(event);
    return result;
  }

  public stop(): void {
    this.generation += 1;
    this.worldStart.stop();
  }
}
