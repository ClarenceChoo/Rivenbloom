import { immutableClone } from '../data/immutability';
import { validateSaveV1 } from '../saves/SaveSchema';
import type { SaveSlotId, SaveV1 } from '../saves/SaveSchema';

export type RuntimeAutosaveState = 'idle' | 'queued' | 'saving' | 'failed' | 'session-only';

export interface RuntimeAutosavePort {
  getSaveState?(slotId: SaveSlotId): RuntimeAutosaveState;
  queueAutosave(slotId: SaveSlotId, save: SaveV1): void;
  saveNow?(slotId: SaveSlotId, save: SaveV1): Promise<void>;
}

export type RuntimeSaveStamp = Readonly<{
  snapshotAtEpochMs: number;
  playTimeMs: number;
}>;

export type RuntimeVitals = Readonly<{
  currentHealth: number;
  currentMana: number;
}>;

export type RuntimeSaveOperation<Event = unknown, Reason = unknown> =
  | Readonly<{ kind: 'accepted'; save: SaveV1; events: readonly Event[] }>
  | Readonly<{ kind: 'unchanged'; save: SaveV1; events: readonly Event[] }>
  | Readonly<{ kind: 'rejected'; reason: Reason; save: SaveV1; events: readonly Event[] }>;

export type RuntimeSaveResult<Event = unknown, Reason = unknown> =
  | Readonly<{
      kind: 'installed';
      save: SaveV1;
      revision: number;
      events: readonly Event[];
    }>
  | Readonly<{
      kind: 'unchanged';
      save: SaveV1;
      revision: number;
      events: readonly Event[];
    }>
  | Readonly<{
      kind: 'rejected';
      reason: Reason | 'invalid-candidate';
      save: SaveV1;
      revision: number;
      events: readonly Event[];
    }>
  | Readonly<{
      kind: 'failed';
      save: SaveV1;
      revision: number;
      events: readonly Event[];
    }>
  | Readonly<{
      kind: 'blocked';
      save: SaveV1;
      revision: number;
      events: readonly Event[];
    }>;

export type RuntimeImmediatePreparation =
  | Readonly<{ kind: 'prepared'; token: number; save: SaveV1 }>
  | Readonly<{ kind: 'blocked' | 'invalid-candidate' | 'unavailable'; save: SaveV1 }>;

export type RuntimeImmediateCommit =
  | Readonly<{ kind: 'installed'; token: number; save: SaveV1; revision: number }>
  | Readonly<{
      kind: 'failed' | 'in-flight' | 'invalid-token';
      token: number;
      save: SaveV1;
      revision: number;
    }>;

const EMPTY_EVENTS = Object.freeze([]) as readonly never[];

export class RuntimeSaveCoordinator {
  private current: SaveV1;
  private currentRevision = 0;
  private saveState: RuntimeAutosaveState = 'idle';
  private immediate: { token: number; save: SaveV1; inFlight: boolean } | null = null;
  private nextImmediateToken = 1;

  public constructor(
    private readonly slotId: SaveSlotId,
    initial: SaveV1,
    private readonly autosaves: RuntimeAutosavePort,
  ) {
    const validated = validateSaveV1(initial);
    if (validated.kind === 'invalid') throw new RangeError('Runtime save must be valid.');
    this.current = immutableClone(validated.value);
  }

  public get snapshot(): SaveV1 {
    return this.current;
  }

  public get revision(): number {
    return this.currentRevision;
  }

  public get autosaveState(): RuntimeAutosaveState {
    return this.immediate === null
      ? (this.autosaves.getSaveState?.(this.slotId) ?? this.saveState)
      : this.saveState;
  }

  public get pendingImmediate(): Readonly<{ token: number; save: SaveV1 }> | null {
    return this.immediate === null
      ? null
      : Object.freeze({ token: this.immediate.token, save: this.immediate.save });
  }

  public transact<Event, Reason>(
    operation: (latest: SaveV1) => RuntimeSaveOperation<Event, Reason>,
    stamp: RuntimeSaveStamp,
    liveVitals?: RuntimeVitals,
  ): RuntimeSaveResult<Event, Reason> {
    const outcome = operation(this.current);
    if (outcome.kind === 'rejected') {
      return Object.freeze({
        kind: 'rejected',
        reason: outcome.reason,
        save: this.current,
        revision: this.currentRevision,
        events: Object.freeze([...outcome.events]),
      });
    }
    if (outcome.kind === 'unchanged') {
      return Object.freeze({
        kind: 'unchanged',
        save: this.current,
        revision: this.currentRevision,
        events: Object.freeze([...outcome.events]),
      });
    }
    return this.installInternal(outcome.save, stamp, liveVitals, outcome.events);
  }

  public patchVitals(
    vitals: RuntimeVitals,
    stamp: RuntimeSaveStamp,
  ): RuntimeSaveResult<never, never> {
    if (
      vitals.currentHealth === this.current.player.currentHealth &&
      vitals.currentMana === this.current.player.currentMana
    ) {
      return Object.freeze({
        kind: 'unchanged',
        save: this.current,
        revision: this.currentRevision,
        events: EMPTY_EVENTS,
      });
    }
    return this.installInternal(this.current, stamp, vitals, EMPTY_EVENTS);
  }

  public install(
    candidate: SaveV1,
    stamp: RuntimeSaveStamp,
    liveVitals?: RuntimeVitals,
  ): RuntimeSaveResult<never, never> {
    return this.installInternal(candidate, stamp, liveVitals, EMPTY_EVENTS);
  }

  public prepare(
    candidate: SaveV1,
    stamp: RuntimeSaveStamp,
    liveVitals?: RuntimeVitals,
  ): SaveV1 | null {
    return composeCandidate(this.current, candidate, stamp, liveVitals);
  }

  public prepareImmediate(
    candidate: SaveV1,
    stamp: RuntimeSaveStamp,
    liveVitals?: RuntimeVitals,
  ): RuntimeImmediatePreparation {
    if (this.immediate !== null) {
      return Object.freeze({ kind: 'blocked', save: this.current });
    }
    if (this.autosaves.saveNow === undefined) {
      return Object.freeze({ kind: 'unavailable', save: this.current });
    }
    const composed = composeCandidate(this.current, candidate, stamp, liveVitals);
    if (composed === null) {
      return Object.freeze({ kind: 'invalid-candidate', save: this.current });
    }
    const token = this.nextImmediateToken;
    this.nextImmediateToken += 1;
    if (!Number.isSafeInteger(this.nextImmediateToken)) {
      throw new RangeError('Runtime immediate-save token exceeded its safe range.');
    }
    this.immediate = { token, save: composed, inFlight: false };
    this.saveState = 'queued';
    return Object.freeze({ kind: 'prepared', token, save: composed });
  }

  public async commitImmediate(token: number): Promise<RuntimeImmediateCommit> {
    const pending = this.immediate;
    if (pending === null || pending.token !== token) {
      return Object.freeze({
        kind: 'invalid-token',
        token,
        save: this.current,
        revision: this.currentRevision,
      });
    }
    if (pending.inFlight) {
      return Object.freeze({
        kind: 'in-flight',
        token,
        save: pending.save,
        revision: this.currentRevision,
      });
    }
    const saveNow = this.autosaves.saveNow;
    if (saveNow === undefined) {
      this.saveState = 'failed';
      return Object.freeze({
        kind: 'failed',
        token,
        save: pending.save,
        revision: this.currentRevision,
      });
    }
    pending.inFlight = true;
    try {
      await saveNow.call(this.autosaves, this.slotId, pending.save);
    } catch {
      pending.inFlight = false;
      this.saveState = 'failed';
      return Object.freeze({
        kind: 'failed',
        token,
        save: pending.save,
        revision: this.currentRevision,
      });
    }
    this.current = pending.save;
    this.currentRevision += 1;
    this.immediate = null;
    this.saveState = 'idle';
    return Object.freeze({
      kind: 'installed',
      token,
      save: this.current,
      revision: this.currentRevision,
    });
  }

  public markIdle(): void {
    this.saveState = 'idle';
  }

  public markFailed(): void {
    this.saveState = 'failed';
  }

  private installInternal<Event, Reason>(
    candidate: SaveV1,
    stamp: RuntimeSaveStamp,
    liveVitals: RuntimeVitals | undefined,
    events: readonly Event[],
  ): RuntimeSaveResult<Event, Reason> {
    if (this.immediate !== null) {
      return Object.freeze({
        kind: 'blocked',
        save: this.current,
        revision: this.currentRevision,
        events: Object.freeze([...events]),
      });
    }
    const installed = composeCandidate(this.current, candidate, stamp, liveVitals);
    if (installed === null) {
      return Object.freeze({
        kind: 'rejected',
        reason: 'invalid-candidate',
        save: this.current,
        revision: this.currentRevision,
        events: Object.freeze([...events]),
      });
    }
    try {
      this.autosaves.queueAutosave(this.slotId, installed);
    } catch {
      this.saveState = 'failed';
      return Object.freeze({
        kind: 'failed',
        save: this.current,
        revision: this.currentRevision,
        events: Object.freeze([...events]),
      });
    }
    this.current = installed;
    this.currentRevision += 1;
    this.saveState = 'queued';
    return Object.freeze({
      kind: 'installed',
      save: this.current,
      revision: this.currentRevision,
      events: Object.freeze([...events]),
    });
  }
}

function composeCandidate(
  current: SaveV1,
  candidate: SaveV1,
  stamp: RuntimeSaveStamp,
  liveVitals: RuntimeVitals | undefined,
): SaveV1 | null {
  if (!validStamp(stamp, current)) return null;
  const composed: SaveV1 = {
    ...candidate,
    metadata: {
      ...candidate.metadata,
      snapshotAtEpochMs: Math.max(
        current.metadata.snapshotAtEpochMs,
        candidate.metadata.snapshotAtEpochMs,
        stamp.snapshotAtEpochMs,
      ),
      playTimeMs: Math.max(
        current.metadata.playTimeMs,
        candidate.metadata.playTimeMs,
        stamp.playTimeMs,
      ),
    },
    player:
      liveVitals === undefined
        ? candidate.player
        : {
            ...candidate.player,
            currentHealth:
              candidate.player.currentHealth === current.player.currentHealth
                ? liveVitals.currentHealth
                : candidate.player.currentHealth,
            currentMana:
              candidate.player.currentMana === current.player.currentMana
                ? liveVitals.currentMana
                : candidate.player.currentMana,
          },
  };
  const validated = validateSaveV1(composed);
  return validated.kind === 'valid' ? immutableClone(validated.value) : null;
}

function validStamp(stamp: RuntimeSaveStamp, current: SaveV1): boolean {
  return (
    Number.isSafeInteger(stamp.snapshotAtEpochMs) &&
    stamp.snapshotAtEpochMs >= current.metadata.snapshotAtEpochMs &&
    Number.isSafeInteger(stamp.playTimeMs) &&
    stamp.playTimeMs >= current.metadata.playTimeMs
  );
}
