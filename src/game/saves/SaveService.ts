import { createSaveEnvelopeJson, decodeSaveEnvelope } from './SaveEnvelope';
import { MemorySaveRepository } from './MemorySaveRepository';
import type { CorruptSaveCopy, SaveReadResult, SaveRepository } from './SaveRepository';
import { SaveStorageError, SaveValidationError } from './SaveRepository';
import { SAVE_SLOT_IDS, validateSaveV1 } from './SaveSchema';
import type { SaveNotice, SaveSlotId, SaveV1, SaveValidationIssue } from './SaveSchema';

export interface SaveScheduler {
  schedule(delayMs: number, callback: () => void): unknown;
  cancel(handle: unknown): void;
}

export interface SaveCommitScheduler {
  waitForCommitTurn(): Promise<void>;
}

export type SaveServiceNotice =
  | Readonly<{
      code: 'storage-fallback';
      persistent: true;
      message: string;
    }>
  | Readonly<{
      code: 'autosave-failed';
      slotId: SaveSlotId;
      persistent: false;
      message: string;
    }>
  | Readonly<{
      code: 'recovered-from-backup' | 'corrupt-save';
      slotId: SaveSlotId;
      revision: number | null;
      persistent: false;
      message: string;
    }>;

export type ImportCandidateId = object;

export type ImportPreview =
  | Readonly<{
      kind: 'ready';
      candidateId: ImportCandidateId;
      preview: Readonly<{
        regionId: SaveV1['location']['regionId'];
        areaId: SaveV1['location']['areaId'];
        playTimeMs: number;
        snapshotAtEpochMs: number;
        healthUpgrades: number;
        manaUpgrades: number;
      }>;
      notices: readonly SaveNotice[];
    }>
  | Readonly<{
      kind: 'invalid';
      errors: readonly SaveValidationIssue[];
    }>;

export type SaveServiceOptions = Readonly<{
  debounceMs?: number;
  scheduler?: SaveScheduler;
  commitScheduler?: SaveCommitScheduler;
  fallback?: SaveRepository;
}>;

export type SaveWriteState = 'idle' | 'queued' | 'saving' | 'failed' | 'session-only';

type SlotState = {
  status: SaveWriteState;
  pending: PendingSnapshot | null;
  timer: unknown | null;
  tail: Promise<void>;
  latestOperation: Promise<void>;
  latestGeneration: number;
};

type PendingSnapshot = Readonly<{
  save: SaveV1;
  generation: number;
}>;

export class SaveImportError extends Error {
  public readonly name = 'SaveImportError';

  public constructor(message: string) {
    super(message);
  }
}

export class SaveExportError extends Error {
  public readonly name = 'SaveExportError';

  public constructor(
    public readonly reason: 'empty' | 'corrupt' | 'corrupt-copy-missing',
    message: string,
  ) {
    super(message);
  }
}

export class SaveService {
  private readonly statusListeners = new Set<(slot: SaveSlotId, state: SaveWriteState) => void>();
  private readonly fallback: SaveRepository | null;
  private readonly debounceMs: number;
  private readonly scheduler: SaveScheduler;
  private readonly commitScheduler: SaveCommitScheduler;
  private readonly slotStates = new Map<SaveSlotId, SlotState>();
  private readonly lastKnown = new Map<SaveSlotId, SaveV1>();
  private readonly importCandidates = new Map<ImportCandidateId, SaveV1>();
  private readonly notices: SaveServiceNotice[] = [];
  private readonly noticeKeys = new Set<string>();
  private fallbackSwitch: Promise<void> | null = null;
  private cutoverEpoch = 0;

  public constructor(
    private readonly primaryRepository: SaveRepository,
    options: SaveServiceOptions = {},
  ) {
    this.fallback = options.fallback ?? new MemorySaveRepository();
    this.debounceMs = options.debounceMs ?? 500;
    if (!Number.isSafeInteger(this.debounceMs) || this.debounceMs < 0) {
      throw new RangeError('Save debounce must be a non-negative safe integer.');
    }
    this.scheduler = options.scheduler ?? defaultScheduler;
    this.commitScheduler = options.commitScheduler ?? defaultCommitScheduler;
  }

  public getSaveState(slot: SaveSlotId): SaveWriteState {
    const status = this.stateFor(slot).status;
    return status === 'idle' && this.fallbackSwitch !== null ? 'session-only' : status;
  }

  public onSaveState(listener: (slot: SaveSlotId, state: SaveWriteState) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private publishSaveState(slot: SaveSlotId, generation: number, status: SaveWriteState): void {
    const state = this.stateFor(slot);
    if (state.latestGeneration !== generation) return;
    state.status = status;
    for (const listener of this.statusListeners) listener(slot, status);
  }

  public queueAutosave(slot: SaveSlotId, save: SaveV1): void {
    const snapshot = normalizeSnapshot(save);
    const state = this.stateFor(slot);
    state.pending = this.nextSnapshot(state, snapshot);
    this.publishSaveState(slot, state.pending.generation, 'queued');
    if (state.timer !== null) this.scheduler.cancel(state.timer);
    state.timer = this.scheduler.schedule(this.debounceMs, () => {
      state.timer = null;
      void this.commitPending(slot).catch(() => undefined);
    });
  }

  public async flush(slot?: SaveSlotId): Promise<void> {
    const slots = slot === undefined ? SAVE_SLOT_IDS : [slot];
    const knownWrites = slots.map((target) => {
      const state = this.stateFor(target);
      if (state.timer !== null) {
        this.scheduler.cancel(state.timer);
        state.timer = null;
      }
      return state.pending === null ? state.latestOperation : this.commitPending(target);
    });
    await Promise.all(knownWrites);
  }

  public async saveNow(slot: SaveSlotId, save: SaveV1): Promise<void> {
    const snapshot = normalizeSnapshot(save);
    const state = this.cancelStaleWork(slot);
    await this.enqueueWrite(slot, this.nextSnapshot(state, snapshot));
  }

  public async read(slot: SaveSlotId): Promise<SaveReadResult> {
    const result = await this.readWithFallback(slot);
    this.observeRead(slot, result);
    return result;
  }

  public async delete(slot: SaveSlotId): Promise<void> {
    this.cancelStaleWork(slot);
    await this.enqueueMutation(slot, async () => {
      await this.mutateWithFallback(
        (repository) => repository.delete(slot),
        () => this.lastKnown.delete(slot),
      );
    });
  }

  public async import(candidateJson: string): Promise<ImportPreview> {
    const decoded = await decodeSaveEnvelope(candidateJson);
    if (decoded.kind === 'invalid') return decoded;
    const normalized = normalizeSnapshot(decoded.value);
    const candidateId = Object.freeze({});
    this.importCandidates.set(candidateId, normalized);
    return {
      kind: 'ready',
      candidateId,
      preview: {
        regionId: normalized.location.regionId,
        areaId: normalized.location.areaId,
        playTimeMs: normalized.metadata.playTimeMs,
        snapshotAtEpochMs: normalized.metadata.snapshotAtEpochMs,
        healthUpgrades: normalized.player.healthUpgrades,
        manaUpgrades: normalized.player.manaUpgrades,
      },
      notices: decoded.notices,
    };
  }

  public async confirmImport(candidateId: ImportCandidateId, slot: SaveSlotId): Promise<void> {
    const candidate = this.importCandidates.get(candidateId);
    if (candidate === undefined)
      throw new SaveImportError('Import candidate is missing, cancelled, or already used.');
    this.importCandidates.delete(candidateId);
    const snapshot = normalizeSnapshot(candidate);
    const state = this.cancelStaleWork(slot);
    await this.enqueueWrite(slot, this.nextSnapshot(state, snapshot));
  }

  public cancelImport(candidateId: ImportCandidateId): boolean {
    return this.importCandidates.delete(candidateId);
  }

  public async export(slot: SaveSlotId): Promise<string> {
    await this.flush(slot);
    const result = await this.read(slot);
    if (result.kind === 'empty') throw new SaveExportError('empty', `${slot} is empty.`);
    if (result.kind === 'corrupt')
      throw new SaveExportError('corrupt', `${slot} has no valid revision.`);
    return createSaveEnvelopeJson(result.save, result.writtenAtEpochMs);
  }

  public async exportCorrupt(slot: SaveSlotId, index: number): Promise<string> {
    const result = await this.read(slot);
    const copies: readonly CorruptSaveCopy[] = result.kind === 'empty' ? [] : result.corruptCopies;
    const copy = copies[index];
    if (copy === undefined) {
      throw new SaveExportError(
        'corrupt-copy-missing',
        `Corrupt copy ${index} is unavailable for ${slot}.`,
      );
    }
    return copy.rawJson;
  }

  public getNotices(): readonly SaveServiceNotice[] {
    return [...this.notices];
  }

  public hasDirtySave(slot: SaveSlotId): boolean {
    return this.stateFor(slot).pending !== null;
  }

  private async commitPending(slot: SaveSlotId): Promise<void> {
    const state = this.stateFor(slot);
    const snapshot = state.pending;
    if (snapshot === null) return state.latestOperation;
    state.pending = null;
    return this.enqueueWrite(slot, snapshot);
  }

  private enqueueWrite(slot: SaveSlotId, pending: PendingSnapshot): Promise<void> {
    return this.enqueueMutation(slot, async () => {
      this.publishSaveState(slot, pending.generation, 'saving');
      try {
        await this.mutateWithFallback(
          (repository) => repository.write(slot, pending.save),
          () => this.lastKnown.set(slot, pending.save),
        );
        this.publishSaveState(slot, pending.generation, 'idle');
      } catch (error) {
        const state = this.stateFor(slot);
        if (state.latestGeneration === pending.generation && state.pending === null) {
          state.pending = pending;
        }
        this.publishSaveState(slot, pending.generation, 'failed');
        this.addNotice(`autosave-failed:${slot}`, {
          code: 'autosave-failed',
          slotId: slot,
          persistent: false,
          message: 'Save failed; progress remains queued for retry.',
        });
        throw error;
      }
    });
  }

  private enqueueMutation(slot: SaveSlotId, mutation: () => Promise<void>): Promise<void> {
    const state = this.stateFor(slot);
    const operation = state.tail.then(mutation, mutation);
    state.tail = operation.then(
      () => undefined,
      () => undefined,
    );
    state.latestOperation = operation;
    return operation;
  }

  private cancelStaleWork(slot: SaveSlotId): SlotState {
    const state = this.stateFor(slot);
    state.latestGeneration += 1;
    state.pending = null;
    if (state.timer !== null) {
      this.scheduler.cancel(state.timer);
      state.timer = null;
    }
    return state;
  }

  private stateFor(slot: SaveSlotId): SlotState {
    const existing = this.slotStates.get(slot);
    if (existing !== undefined) return existing;
    const created: SlotState = {
      status: 'idle',
      pending: null,
      timer: null,
      tail: Promise.resolve(),
      latestOperation: Promise.resolve(),
      latestGeneration: 0,
    };
    this.slotStates.set(slot, created);
    return created;
  }

  private async mutateWithFallback(
    mutation: (repository: SaveRepository) => Promise<void>,
    commit: () => void,
  ): Promise<void> {
    const switchAtStart = this.fallbackSwitch;
    if (switchAtStart !== null) {
      await switchAtStart;
      await mutation(this.requireFallback());
      await this.commitScheduler.waitForCommitTurn();
      commit();
      return;
    }

    const attemptedEpoch = this.cutoverEpoch;
    try {
      await mutation(this.primaryRepository);
    } catch (error) {
      if (!(error instanceof SaveStorageError)) throw error;
      await this.switchToFallback();
      await mutation(this.requireFallback());
      await this.commitScheduler.waitForCommitTurn();
      commit();
      return;
    }

    await this.commitScheduler.waitForCommitTurn();
    if (this.cutoverEpoch !== attemptedEpoch || this.fallbackSwitch !== null) {
      await this.switchToFallback();
      await mutation(this.requireFallback());
    }
    commit();
  }

  private async readWithFallback(slot: SaveSlotId): Promise<SaveReadResult> {
    const switchAtStart = this.fallbackSwitch;
    if (switchAtStart !== null) {
      await switchAtStart;
      return this.requireFallback().read(slot);
    }

    const attemptedEpoch = this.cutoverEpoch;
    try {
      const result = await this.primaryRepository.read(slot);
      if (this.cutoverEpoch === attemptedEpoch && this.fallbackSwitch === null) return result;
    } catch (error) {
      if (!(error instanceof SaveStorageError)) throw error;
    }
    await this.switchToFallback();
    return this.requireFallback().read(slot);
  }

  private async switchToFallback(): Promise<void> {
    if (this.fallbackSwitch !== null) {
      await this.fallbackSwitch;
      return;
    }
    const fallback = this.requireFallback();
    const seed = [...this.lastKnown.entries()];

    this.cutoverEpoch += 1;
    this.addNotice('storage-fallback', {
      code: 'storage-fallback',
      persistent: true,
      message: 'Persistent save storage failed; this session is using memory storage.',
    });
    this.fallbackSwitch = (async () => {
      for (const [slot, save] of seed) await fallback.write(slot, save);
    })();
    await this.fallbackSwitch;
  }

  private requireFallback(): SaveRepository {
    if (this.fallback === null) {
      throw new SaveStorageError('write', 'No fallback save repository is available.');
    }
    return this.fallback;
  }

  private nextSnapshot(state: SlotState, save: SaveV1): PendingSnapshot {
    state.latestGeneration += 1;
    return { save, generation: state.latestGeneration };
  }

  private observeRead(slot: SaveSlotId, result: SaveReadResult): void {
    if (result.kind === 'loaded') {
      this.lastKnown.set(slot, normalizeSnapshot(result.save));
      if (result.source === 'backup') {
        this.addNotice(`recovered:${slot}:${result.writtenAtEpochMs}`, {
          code: 'recovered-from-backup',
          slotId: slot,
          revision: result.writtenAtEpochMs,
          persistent: false,
          message: `${slot} recovered from its previous valid revision.`,
        });
      }
      if (result.corruptCopies.length > 0) {
        this.addNotice(`corrupt:${slot}:${result.writtenAtEpochMs}`, {
          code: 'corrupt-save',
          slotId: slot,
          revision: result.writtenAtEpochMs,
          persistent: false,
          message: `${slot} contains a corrupt revision available for export.`,
        });
      }
      return;
    }
    if (result.kind === 'corrupt') {
      this.addNotice(`corrupt:${slot}:none`, {
        code: 'corrupt-save',
        slotId: slot,
        revision: null,
        persistent: false,
        message: `${slot} contains no valid save revision.`,
      });
    }
  }

  private addNotice(key: string, notice: SaveServiceNotice): void {
    if (this.noticeKeys.has(key)) return;
    this.noticeKeys.add(key);
    this.notices.push(notice);
  }
}

function normalizeSnapshot(save: SaveV1): SaveV1 {
  const result = validateSaveV1(save);
  if (result.kind === 'invalid') throw new SaveValidationError(result.errors);
  return result.value;
}

const defaultScheduler: SaveScheduler = {
  schedule(delayMs, callback) {
    const handle = globalThis.setTimeout(callback, delayMs);
    return () => globalThis.clearTimeout(handle);
  },
  cancel(handle) {
    if (typeof handle === 'function') handle();
  },
};

const defaultCommitScheduler: SaveCommitScheduler = {
  waitForCommitTurn: () => Promise.resolve(),
};
