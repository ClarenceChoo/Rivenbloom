import { itemId, questFlagId, stableId } from '../core/StableId';
import type {
  BossDefeatedEvent,
  BossHealthEvent,
  BossIntroEvent,
  BossPhaseEvent,
  PallidCantorEvent,
} from '../entities/bosses/BossEvents';
import { prepareBossDefeat } from '../saves/BossPersistence';
import type { SaveV1 } from '../saves/SaveSchema';
import type { ProgressionEvent } from './WorldProgression';
import type {
  RuntimeSaveCoordinator,
  RuntimeSaveStamp,
  RuntimeVitals,
} from './RuntimeSaveCoordinator';
import type { WorldCombatJournalEvent } from './WorldCombatRuntime';

export type BossEncounterEventName = 'boss-intro' | 'boss-phase' | 'boss-health' | 'boss-defeated';
export type BossEncounterEvent =
  BossIntroEvent | BossPhaseEvent | BossHealthEvent | BossDefeatedEvent;

export type BossEncounterCoordinatorOptions = Readonly<{
  saves: RuntimeSaveCoordinator;
  confirmDefeatSaved(token: number, savedAtEpochMs: number): boolean;
  updateSave(save: SaveV1): void;
  publishProgressionEvents(events: readonly ProgressionEvent[]): void;
  emit(name: BossEncounterEventName, event: BossEncounterEvent): void;
  reportSaveFailure(): void;
  isCurrentGeneration(): boolean;
}>;

export class BossEncounterCoordinator {
  private bossSaveToken: number | null = null;
  private immediateToken: number | null = null;
  private preparedEvents: readonly ProgressionEvent[] = Object.freeze([]);
  private inFlight: Promise<void> | null = null;
  private durable = false;
  private settled = false;
  private completionPublished = false;
  private savedAtEpochMs: number | null = null;
  private lastBossSequence = 0;
  private lastHealth: BossHealthEvent | null = null;

  public constructor(private readonly options: BossEncounterCoordinatorOptions) {}

  public observe(
    event: WorldCombatJournalEvent,
    vitals: RuntimeVitals,
    stamp: RuntimeSaveStamp,
  ): void {
    if (event.kind === 'boss-event') {
      this.publishBossEvent(event.event);
      return;
    }
    if (event.kind !== 'boss-command') return;
    if (event.command.kind === 'arena-lock' && !event.command.locked) {
      this.settled = true;
      this.publishCompletionIfReady();
      return;
    }
    if (event.command.kind !== 'request-defeat-save' || this.bossSaveToken !== null) return;

    const prepared = prepareBossDefeat(this.options.saves.snapshot, { vitals, stamp });
    if (prepared.kind !== 'prepared') {
      if (prepared.kind === 'rejected') this.options.reportSaveFailure();
      return;
    }
    const immediate = this.options.saves.prepareImmediate(prepared.save, stamp);
    if (immediate.kind !== 'prepared') {
      this.options.reportSaveFailure();
      return;
    }
    this.bossSaveToken = event.command.token;
    this.immediateToken = immediate.token;
    this.preparedEvents = prepared.events;
    this.startCommit();
  }

  public async retry(): Promise<boolean> {
    if (this.inFlight !== null || this.immediateToken === null || this.durable) return false;
    this.startCommit();
    await this.whenIdle();
    return this.durable;
  }

  public whenIdle(): Promise<void> {
    return this.inFlight ?? Promise.resolve();
  }

  private startCommit(): void {
    const immediateToken = this.immediateToken;
    const bossSaveToken = this.bossSaveToken;
    if (immediateToken === null || bossSaveToken === null || this.inFlight !== null) return;
    const operation = this.options.saves.commitImmediate(immediateToken).then((result) => {
      if (result.kind !== 'installed') {
        if (result.kind === 'failed' && this.options.isCurrentGeneration()) {
          this.options.reportSaveFailure();
        }
        return;
      }
      this.durable = true;
      this.savedAtEpochMs = result.save.metadata.snapshotAtEpochMs;
      if (!this.options.isCurrentGeneration()) return;
      this.options.updateSave(result.save);
      this.options.publishProgressionEvents(this.preparedEvents);
      this.options.confirmDefeatSaved(bossSaveToken, this.savedAtEpochMs);
      this.publishCompletionIfReady();
    });
    this.inFlight = operation.finally(() => {
      this.inFlight = null;
    });
  }

  private publishBossEvent(event: PallidCantorEvent): void {
    this.lastBossSequence = Math.max(this.lastBossSequence, event.sequence);
    if ('healthBarVisible' in event) {
      this.options.emit('boss-intro', event);
      return;
    }
    if ('previousState' in event) {
      this.options.emit('boss-phase', event);
      return;
    }
    this.lastHealth = event;
    this.options.emit('boss-health', event);
  }

  private publishCompletionIfReady(): void {
    if (
      !this.durable ||
      !this.settled ||
      this.completionPublished ||
      this.savedAtEpochMs === null ||
      !this.options.isCurrentGeneration()
    ) {
      return;
    }
    this.completionPublished = true;
    const defeatedSequence = this.lastBossSequence + 1;
    const defeated: BossDefeatedEvent = Object.freeze({
      sequence: defeatedSequence,
      bossId: stableId<'boss'>('pallid-cantor'),
      displayName: 'The Pallid Cantor',
      rewardItemId: itemId('cantor-sigil'),
      questFactId: questFlagId('pallid-cantor-defeated'),
      savedAtEpochMs: this.savedAtEpochMs,
      currentHealth: 0,
      maxHealth: 420,
      visible: false,
    });
    const hidden: BossHealthEvent = Object.freeze({
      sequence: defeatedSequence + 1,
      bossId: defeated.bossId,
      displayName: defeated.displayName,
      currentHealth: 0,
      maxHealth: 420,
      ratio: 0,
      currentPoise: this.lastHealth?.currentPoise ?? 0,
      maxPoise: 84,
      heartExposed: this.lastHealth?.heartExposed ?? true,
      visible: false,
      delta: 0,
    });
    this.lastBossSequence = hidden.sequence;
    this.options.emit('boss-defeated', defeated);
    this.options.emit('boss-health', hidden);
  }
}
