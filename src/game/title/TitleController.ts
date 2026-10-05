import { patchSaveSettings } from '../config/accessibility';
import type { SaveServiceNotice } from '../saves/SaveService';
import type { ImportCandidateId, ImportPreview } from '../saves/SaveService';
import type { SaveReadResult } from '../saves/SaveRepository';
import { DEFAULT_SAVE_SETTINGS, SAVE_SLOT_IDS } from '../saves/SaveSchema';
import type { SaveSettings, SaveSlotId, SaveV1 } from '../saves/SaveSchema';
import type { TitleCommand } from './TitleCommands';
import {
  formatPlayTime,
  formatSnapshotTime,
  formatUpgrades,
  loadingSlot,
  mapAreaLabel,
  mapSlotError,
  mapSlotResult,
} from './TitleSlotModel';
import type { TitleSlotState } from './TitleSlotModel';

export interface TitleSavePort {
  read(slot: SaveSlotId): Promise<SaveReadResult>;
  delete(slot: SaveSlotId): Promise<void>;
  import(candidateJson: string): Promise<ImportPreview>;
  confirmImport(candidateId: ImportCandidateId, slot: SaveSlotId): Promise<void>;
  cancelImport(candidateId: ImportCandidateId): boolean;
  export(slot: SaveSlotId): Promise<string>;
  exportCorrupt(slot: SaveSlotId, index: number): Promise<string>;
  saveNow(slot: SaveSlotId, save: SaveV1): Promise<void>;
  getNotices(): readonly SaveServiceNotice[];
}

export type TitleTransitionPayload = Readonly<{
  mode: 'new' | 'load';
  slotId: SaveSlotId;
  settings: SaveSettings;
}>;

export type TitleDialogState =
  | Readonly<{ kind: 'new-game'; slotId: SaveSlotId; label: string }>
  | Readonly<{ kind: 'delete'; slotId: SaveSlotId; label: string }>
  | Readonly<{ kind: 'manage'; slotId: SaveSlotId; label: string; hasCorruptCopy: boolean }>
  | Readonly<{ kind: 'settings'; slotId: SaveSlotId | null; settings: SaveSettings }>
  | Readonly<{ kind: 'credits' }>
  | Readonly<{
      kind: 'import-preview';
      slotId: SaveSlotId;
      label: string;
      candidateId: ImportCandidateId;
      areaLabel: string;
      playTime: string;
      upgrades: string;
      snapshot: Readonly<{ dateTime: string; label: string }>;
    }>
  | Readonly<{ kind: 'import-error'; slotId: SaveSlotId; label: string; message: string }>;

export type TitleDownload = Readonly<{
  id: number;
  filename: string;
  contents: string;
}>;

export type TitleState = Readonly<{
  titleReady: boolean;
  slots: readonly TitleSlotState[];
  globalError: string | null;
  transientError: string | null;
  persistentNotices: readonly string[];
  selectedSlot: SaveSlotId;
  dialog: TitleDialogState | null;
  dialogError: string | null;
  submitting: boolean;
  settings: SaveSettings;
  download: TitleDownload | null;
}>;

export type TitleIssueResult = 'handled' | 'refused';

export type TitleControllerOptions = Readonly<{
  onState?: (state: TitleState) => void;
  onTransition?: (payload: TitleTransitionPayload) => void;
}>;

export class TitleController {
  private state: TitleState = freezeState({
    titleReady: false,
    slots: SAVE_SLOT_IDS.map(loadingSlot),
    globalError: null,
    transientError: null,
    persistentNotices: [],
    selectedSlot: 'slot-1',
    dialog: null,
    dialogError: null,
    submitting: false,
    settings: DEFAULT_SAVE_SETTINGS,
    download: null,
  });
  private readonly saves = new Map<SaveSlotId, SaveV1>();
  private refreshGeneration = 0;
  private lifecycleGeneration = 0;
  private active = false;
  private importCandidate: ImportCandidateId | null = null;
  private pendingSettings: SaveSettings = DEFAULT_SAVE_SETTINGS;
  private settingsBeforeDialog: SaveSettings | null = null;
  private nextDownloadId = 1;

  public constructor(
    private readonly savePort: TitleSavePort,
    private readonly options: TitleControllerOptions = {},
  ) {}

  public get snapshot(): TitleState {
    return this.state;
  }

  public async start(): Promise<void> {
    this.lifecycleGeneration += 1;
    this.active = true;
    await this.refresh();
  }

  public stop(): void {
    if (!this.active) return;
    this.active = false;
    this.lifecycleGeneration += 1;
    this.refreshGeneration += 1;
    this.cancelCandidate();
  }

  public async refresh(): Promise<boolean> {
    if (!this.active || this.state.submitting) return false;
    return this.readSlots(false);
  }

  private async readSlots(preserveSubmitting: boolean): Promise<boolean> {
    const generation = ++this.refreshGeneration;
    this.setState({
      titleReady: false,
      slots: SAVE_SLOT_IDS.map(loadingSlot),
      transientError: null,
      dialog: null,
      dialogError: null,
      ...(preserveSubmitting ? {} : { submitting: false }),
    });
    const results = await Promise.all(
      SAVE_SLOT_IDS.map(async (slotId) => {
        try {
          return { slotId, result: await this.savePort.read(slotId) } as const;
        } catch {
          return { slotId, result: null } as const;
        }
      }),
    );
    if (!this.active || generation !== this.refreshGeneration) return false;

    this.saves.clear();
    const slots = results.map(({ slotId, result }) => {
      if (result === null) return mapSlotError(slotId);
      if (result.kind === 'loaded') this.saves.set(slotId, result.save);
      return mapSlotResult(slotId, result);
    });
    const firstReady = slots.find(({ kind }) => kind === 'ready');
    const selectedSlot = firstReady?.slotId ?? this.state.selectedSlot;
    const selectedSave = this.saves.get(selectedSlot);
    const persistentNotices = this.savePort
      .getNotices()
      .filter((notice) => notice.code === 'storage-fallback')
      .map(({ message }) => message);
    this.setState({
      titleReady: true,
      slots,
      selectedSlot,
      settings: selectedSave?.settings ?? this.pendingSettings,
      persistentNotices,
      globalError: results.some(({ result }) => result === null)
        ? 'Some journeys could not be read. Retry journeys.'
        : null,
    });
    return true;
  }

  public async issue(command: TitleCommand): Promise<TitleIssueResult> {
    if (!this.active || this.state.submitting || !this.state.titleReady) return 'refused';
    switch (command.type) {
      case 'new-game': {
        const slot = this.slot(command.slotId);
        if (slot?.kind !== 'empty') return this.refuse('Only an empty journey can be begun.');
        this.selectSlot(command.slotId);
        this.setState({
          dialog: { kind: 'new-game', slotId: slot.slotId, label: slot.label },
          dialogError: null,
        });
        return 'handled';
      }
      case 'load-slot': {
        const slot = this.slot(command.slotId);
        const save = this.saves.get(command.slotId);
        if (slot?.kind !== 'ready' || save === undefined) {
          return this.refuse(`${this.slotLabel(command.slotId)} is not ready to continue.`);
        }
        if (!slot.canLoad) {
          return this.refuse(
            `${this.slotLabel(command.slotId)} points to an area unavailable in this build.`,
          );
        }
        this.selectSlot(command.slotId);
        this.options.onTransition?.({
          mode: 'load',
          slotId: command.slotId,
          settings: save.settings,
        });
        return 'handled';
      }
      case 'delete-slot': {
        const slot = this.slot(command.slotId);
        if (slot === undefined || slot.kind === 'empty' || slot.kind === 'loading') {
          return this.refuse(`${this.slotLabel(command.slotId)} has no journey to delete.`);
        }
        this.selectSlot(command.slotId);
        this.setState({
          dialog: { kind: 'delete', slotId: command.slotId, label: slot.label },
          dialogError: null,
        });
        return 'handled';
      }
      case 'open-settings': {
        const save = this.saves.get(this.state.selectedSlot);
        const settings = save?.settings ?? this.pendingSettings;
        this.settingsBeforeDialog = this.state.settings;
        this.setState({
          settings,
          dialog: {
            kind: 'settings',
            slotId: save === undefined ? null : this.state.selectedSlot,
            settings,
          },
          dialogError: null,
        });
        return 'handled';
      }
      case 'open-credits':
        this.setState({ dialog: { kind: 'credits' }, dialogError: null });
        return 'handled';
      default:
        return assertNever(command);
    }
  }

  public selectSlot(slotId: SaveSlotId): void {
    if (!this.active || this.state.submitting) return;
    const save = this.saves.get(slotId);
    this.state = freezeState({
      ...this.state,
      selectedSlot: slotId,
      settings: save?.settings ?? this.pendingSettings,
    });
  }

  public openManage(slotId: SaveSlotId): void {
    if (!this.active || this.state.submitting) return;
    const slot = this.slot(slotId);
    if (slot?.kind !== 'ready') return;
    this.selectSlot(slotId);
    this.setState({
      dialog: {
        kind: 'manage',
        slotId,
        label: slot.label,
        hasCorruptCopy: slot.corruptCopyCount > 0,
      },
      dialogError: null,
    });
  }

  public updateSettings(settings: SaveSettings): void {
    if (!this.active || this.state.submitting) return;
    const next = Object.freeze({ ...settings });
    this.state = freezeState({
      ...this.state,
      settings: next,
      dialog:
        this.state.dialog?.kind === 'settings'
          ? { ...this.state.dialog, settings: next }
          : this.state.dialog,
    });
  }

  public async previewImport(slotId: SaveSlotId, contents: string): Promise<void> {
    if (!this.active || this.state.submitting) return;
    this.cancelCandidate();
    const generation = this.lifecycleGeneration;
    this.setState({ submitting: true, transientError: null, dialogError: null });
    let preview: ImportPreview;
    try {
      preview = await this.savePort.import(contents);
    } catch {
      if (this.isOperationCurrent(generation)) {
        this.setState({
          submitting: false,
          dialogError: null,
          dialog: {
            kind: 'import-error',
            slotId,
            label: this.slotLabel(slotId),
            message: 'This file could not be inspected. Choose a Rivenbloom save file.',
          },
        });
      }
      return;
    }
    if (!this.isOperationCurrent(generation)) {
      if (preview.kind === 'ready') this.savePort.cancelImport(preview.candidateId);
      return;
    }
    if (preview.kind === 'invalid') {
      this.setState({
        submitting: false,
        dialogError: null,
        dialog: {
          kind: 'import-error',
          slotId,
          label: this.slotLabel(slotId),
          message: 'This file is not a valid Rivenbloom save.',
        },
      });
      return;
    }
    this.importCandidate = preview.candidateId;
    const area = mapAreaLabel(preview.preview.areaId);
    this.setState({
      submitting: false,
      dialogError: null,
      dialog: {
        kind: 'import-preview',
        slotId,
        label: this.slotLabel(slotId),
        candidateId: preview.candidateId,
        areaLabel: area.label,
        playTime: formatPlayTime(preview.preview.playTimeMs),
        upgrades: formatUpgrades(preview.preview.healthUpgrades, preview.preview.manaUpgrades),
        snapshot: formatSnapshotTime(preview.preview.snapshotAtEpochMs),
      },
    });
  }

  public async exportSlot(slotId: SaveSlotId): Promise<void> {
    await this.createDownload(slotId, false);
  }

  public async exportCorrupt(slotId: SaveSlotId): Promise<void> {
    await this.createDownload(slotId, true);
  }

  public closeDialog(): void {
    if (!this.active || this.state.submitting) return;
    if (this.state.dialog?.kind === 'import-preview') this.cancelCandidate();
    const settings =
      this.state.dialog?.kind === 'settings' && this.settingsBeforeDialog !== null
        ? this.settingsBeforeDialog
        : this.state.settings;
    this.settingsBeforeDialog = null;
    this.setState({
      dialog: null,
      dialogError: null,
      transientError: null,
      settings,
    });
  }

  public async confirmDialog(): Promise<void> {
    if (!this.active || this.state.submitting) return;
    const dialog = this.state.dialog;
    if (dialog === null) return;
    switch (dialog.kind) {
      case 'new-game':
        this.setState({ dialog: null, dialogError: null });
        this.options.onTransition?.({
          mode: 'new',
          slotId: dialog.slotId,
          settings: this.pendingSettings,
        });
        return;
      case 'delete':
        await this.runLocked(async (generation) => {
          await this.savePort.delete(dialog.slotId);
          if (!this.isOperationCurrent(generation)) return;
          this.saves.delete(dialog.slotId);
          this.setState({ dialog: null, dialogError: null });
          await this.readSlots(true);
        });
        return;
      case 'settings':
        await this.runLocked(async (generation) => {
          if (dialog.slotId === null) {
            this.pendingSettings = dialog.settings;
          } else {
            const save = this.saves.get(dialog.slotId);
            if (save !== undefined) {
              const patched = patchSaveSettings(save, dialog.settings);
              await this.savePort.saveNow(dialog.slotId, patched);
              if (!this.isOperationCurrent(generation)) return;
              this.saves.set(dialog.slotId, patched);
            }
          }
          if (!this.isOperationCurrent(generation)) return;
          this.settingsBeforeDialog = null;
          this.setState({ dialog: null, dialogError: null, settings: dialog.settings });
        });
        return;
      case 'import-preview':
        await this.runLocked(async (generation) => {
          await this.savePort.confirmImport(dialog.candidateId, dialog.slotId);
          if (!this.isOperationCurrent(generation)) return;
          if (this.importCandidate === dialog.candidateId) this.importCandidate = null;
          this.setState({ dialog: null, dialogError: null });
          await this.readSlots(true);
        });
        return;
      case 'manage':
      case 'credits':
      case 'import-error':
        this.closeDialog();
        return;
      default:
        assertNever(dialog);
    }
  }

  private async runLocked(operation: (generation: number) => Promise<void>): Promise<void> {
    if (!this.active || this.state.submitting) return;
    const generation = this.lifecycleGeneration;
    this.setState({ submitting: true, transientError: null, dialogError: null });
    try {
      await operation(generation);
    } catch {
      if (this.isOperationCurrent(generation)) {
        const message = 'That save operation did not finish. Your existing journey is unchanged.';
        if (this.state.dialog === null) {
          this.setState({ transientError: message, dialogError: null });
        } else {
          this.setState({ transientError: null, dialogError: message });
        }
      }
    } finally {
      if (this.isOperationCurrent(generation) && this.state.submitting) {
        this.setState({ submitting: false });
      }
    }
  }

  private async createDownload(slotId: SaveSlotId, corrupt: boolean): Promise<void> {
    if (!this.active || this.state.submitting) return;
    await this.runLocked(async (generation) => {
      const contents = corrupt
        ? await this.savePort.exportCorrupt(slotId, 0)
        : await this.savePort.export(slotId);
      if (!this.isOperationCurrent(generation)) return;
      this.setState({
        download: {
          id: this.nextDownloadId,
          filename: `rivenbloom-journey-${SAVE_SLOT_IDS.indexOf(slotId) + 1}${corrupt ? '-damaged' : ''}.json`,
          contents,
        },
      });
      this.nextDownloadId += 1;
    });
  }

  private refuse(message: string): 'refused' {
    this.setState({ transientError: message });
    return 'refused';
  }

  private isOperationCurrent(generation: number): boolean {
    return this.active && generation === this.lifecycleGeneration;
  }

  private cancelCandidate(): void {
    if (this.importCandidate === null) return;
    this.savePort.cancelImport(this.importCandidate);
    this.importCandidate = null;
  }

  private slot(slotId: SaveSlotId): TitleSlotState | undefined {
    return this.state.slots.find((slot) => slot.slotId === slotId);
  }

  private slotLabel(slotId: SaveSlotId): string {
    return this.slot(slotId)?.label ?? `Journey ${SAVE_SLOT_IDS.indexOf(slotId) + 1}`;
  }

  private setState(patch: Partial<TitleState>): void {
    this.state = freezeState({ ...this.state, ...patch });
    this.options.onState?.(this.state);
  }
}

function freezeState(state: TitleState): TitleState {
  return Object.freeze({
    ...state,
    slots: Object.freeze([...state.slots]),
    persistentNotices: Object.freeze([...state.persistentNotices]),
    settings: Object.freeze({ ...state.settings }),
  });
}

function assertNever(value: never): never {
  throw new Error(`Unhandled title state: ${String(value)}`);
}
