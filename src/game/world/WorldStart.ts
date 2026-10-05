import { patchSaveSettings } from '../config/accessibility';
import type { CheckpointDefinition, ContentRegistry, RoomDefinition, Vec2 } from '../data/types';
import { rectContainsPoint } from '../data/types';
import type { SaveReadResult } from '../saves/SaveRepository';
import { createNewSave } from '../saves/SaveSchema';
import type { SaveSettings, SaveSlotId, SaveV1 } from '../saves/SaveSchema';
import type { TitleTransitionPayload } from '../title/TitleController';
import { AreaLoader } from './AreaLoader';
import type { LoadedArea } from './AreaLoader';

export type WorldEntryPayload = TitleTransitionPayload;

export interface WorldStartSavePort {
  read(slot: SaveSlotId): Promise<SaveReadResult>;
  saveNow(slot: SaveSlotId, save: SaveV1): Promise<void>;
  hasDirtySave(slot: SaveSlotId): boolean;
}

export type WorldReady = Readonly<{
  kind: 'ready';
  slotId: SaveSlotId;
  mode: 'new' | 'load';
  save: SaveV1;
  area: LoadedArea;
  room: RoomDefinition;
  checkpoint: CheckpointDefinition;
  position: Vec2;
  positionSource: 'saved' | 'checkpoint-canonical';
  settings: SaveSettings;
}>;

export type WorldStartResult =
  | WorldReady
  | Readonly<{ kind: 'stopped' }>
  | Readonly<{
      kind: 'failed';
      reason: 'slot-not-empty' | 'slot-unavailable' | 'content-invalid' | 'save-failed';
      saveState: 'none' | 'queued-for-retry' | 'not-confirmed';
      message: string;
    }>;

type ResolvedLocation = Readonly<{
  area: LoadedArea;
  checkpoint: CheckpointDefinition;
  room: RoomDefinition;
}>;

const STOPPED = Object.freeze({ kind: 'stopped' as const });

export class WorldStart {
  private generation = 0;

  public constructor(
    private readonly savePort: WorldStartSavePort,
    private readonly areaLoader: AreaLoader,
    private readonly registry: ContentRegistry,
    private readonly nowEpochMs: () => number,
  ) {}

  public async start(payload: WorldEntryPayload): Promise<WorldStartResult> {
    const generation = ++this.generation;
    let readResult: SaveReadResult;
    try {
      readResult = await this.savePort.read(payload.slotId);
    } catch {
      if (!this.isCurrent(generation)) return STOPPED;
      return failed(
        'slot-unavailable',
        'This journey could not be read. Return to the title and try again.',
      );
    }
    if (!this.isCurrent(generation)) return STOPPED;

    if (payload.mode === 'new') {
      return this.startNew(payload, readResult, generation);
    }
    return this.startLoaded(payload, readResult, generation);
  }

  public stop(): void {
    this.generation += 1;
  }

  private async startNew(
    payload: WorldEntryPayload,
    readResult: SaveReadResult,
    generation: number,
  ): Promise<WorldStartResult> {
    // This protects only this coordinator instance. Cross-tab create-if-empty
    // requires a future atomic repository operation.
    if (readResult.kind !== 'empty') {
      return failed('slot-not-empty', 'That journey is no longer empty. Nothing was overwritten.');
    }

    const newGame = this.registry.newGame;
    let resolved = this.resolveLocation(
      newGame.initialRegionId,
      newGame.initialAreaId,
      newGame.initialCheckpointId,
    );
    if (resolved === null) {
      return failed('content-invalid', 'The opening area could not be prepared.');
    }

    let save: SaveV1;
    try {
      save = patchSaveSettings(
        createNewSave({
          nowEpochMs: this.nowEpochMs(),
          location: {
            regionId: newGame.initialRegionId,
            areaId: newGame.initialAreaId,
            checkpointId: newGame.initialCheckpointId,
            safePosition: resolved.checkpoint.canonicalPosition,
          },
          baseStats: newGame.baseStats,
          initialQuests: newGame.initialQuests,
          startingAbilities: newGame.startingAbilities,
        }),
        payload.settings,
      );
    } catch {
      return failed('content-invalid', 'The opening journey definition is invalid.');
    }

    if (import.meta.env.DEV) {
      const search = new URLSearchParams(globalThis.location?.search ?? '');
      const debugBoss = search.get('debug-boss') === 'pallid-cantor';
      const debugEnding = search.get('debug-ending') === 'silent-bloom';
      const debugSentinel = search.get('debug-encounter') === 'sentinel';
      if (debugBoss || debugEnding || debugSentinel) {
        if (debugSentinel) {
          const { debugSentinelSave } = await import('../testing/debugEncounters');
          save = debugSentinelSave(save);
        } else {
          const { debugPallidCantorSave, debugSilentBloomEndingSave } =
            await import('../testing/debugBossEncounter');
          save = debugEnding ? debugSilentBloomEndingSave(save) : debugPallidCantorSave(save);
        }
        const debugLocation = this.resolveLocation(
          save.location.regionId,
          save.location.areaId,
          save.location.checkpointId,
        );
        if (debugLocation === null) {
          return failed('content-invalid', 'The requested development fixture is unavailable.');
        }
        resolved = debugLocation;
      }
    }

    try {
      await this.savePort.saveNow(payload.slotId, save);
    } catch {
      if (!this.isCurrent(generation)) return STOPPED;
      let queued: boolean;
      try {
        queued = this.savePort.hasDirtySave(payload.slotId);
      } catch {
        queued = false;
      }
      return failed(
        'save-failed',
        queued
          ? 'The journey could not be confirmed in storage; its snapshot remains queued in this session.'
          : 'The journey could not be confirmed in storage.',
        queued ? 'queued-for-retry' : 'not-confirmed',
      );
    }
    if (!this.isCurrent(generation)) return STOPPED;

    return ready({
      slotId: payload.slotId,
      mode: 'new',
      save,
      ...resolved,
      position: resolved.checkpoint.canonicalPosition,
      positionSource: 'checkpoint-canonical',
      settings: save.settings,
    });
  }

  private startLoaded(
    payload: WorldEntryPayload,
    readResult: SaveReadResult,
    generation: number,
  ): WorldStartResult {
    if (!this.isCurrent(generation)) return STOPPED;
    if (readResult.kind !== 'loaded') {
      return failed('slot-unavailable', 'That journey is not available to continue.');
    }

    const authoritative = readResult.save;
    const resolved = this.resolveLocation(
      authoritative.location.regionId,
      authoritative.location.areaId,
      authoritative.location.checkpointId,
    );
    if (resolved === null) {
      return failed('content-invalid', 'This journey points to content unavailable in this build.');
    }

    const savedPosition = authoritative.location.safePosition;
    const useSavedPosition = rectContainsPoint(resolved.checkpoint.safeZone, savedPosition);
    const position = useSavedPosition ? savedPosition : resolved.checkpoint.canonicalPosition;
    const save = useSavedPosition
      ? authoritative
      : Object.freeze({
          ...authoritative,
          location: Object.freeze({
            ...authoritative.location,
            safePosition: Object.freeze({ ...resolved.checkpoint.canonicalPosition }),
          }),
        });

    return ready({
      slotId: payload.slotId,
      mode: 'load',
      save,
      ...resolved,
      position,
      positionSource: useSavedPosition ? 'saved' : 'checkpoint-canonical',
      settings: authoritative.settings,
    });
  }

  private resolveLocation(
    regionId: SaveV1['location']['regionId'],
    areaId: SaveV1['location']['areaId'],
    checkpointId: SaveV1['location']['checkpointId'],
  ): ResolvedLocation | null {
    const definition = this.registry.areas.find((area) => area.areaId === areaId);
    if (definition === undefined || definition.regionId !== regionId) return null;
    try {
      const area = this.areaLoader.load(definition);
      const checkpoint = area.checkpoint(checkpointId);
      if (checkpoint === null) return null;
      const room = area.room(checkpoint.roomId);
      if (room === null) return null;
      return Object.freeze({ area, checkpoint, room });
    } catch {
      return null;
    }
  }

  private isCurrent(generation: number): boolean {
    return generation === this.generation;
  }
}

function ready(value: Omit<WorldReady, 'kind'>): WorldReady {
  return Object.freeze({
    kind: 'ready',
    ...value,
    position: Object.freeze({ ...value.position }),
  });
}

function failed(
  reason: Extract<WorldStartResult, { kind: 'failed' }>['reason'],
  message: string,
  saveState: Extract<WorldStartResult, { kind: 'failed' }>['saveState'] = 'none',
): Extract<WorldStartResult, { kind: 'failed' }> {
  return Object.freeze({ kind: 'failed', reason, saveState, message });
}
