import Phaser from 'phaser';
import {
  type AccessibilitySettings,
  type AccessibilitySettingsState
} from '../config/accessibility';
import {
  AccessibilitySettingsToken,
  GAME_SERVICES_REGISTRY_KEY,
  InputServiceToken,
  SAVE_WARNING_REGISTRY_KEY,
  SaveRepositoryToken,
  SaveServiceToken
} from '../core/GameServices';
import { SceneScope } from '../core/SceneScope';
import type { ServiceRegistry } from '../core/ServiceRegistry';
import type { InputService } from '../input/InputService';
import type { SaveRepository } from '../saves/SaveRepository';
import { createDefaultSave, type SaveSlotId } from '../saves/SaveSchema';
import type { ImportPreview, SaveService } from '../saves/SaveService';
import {
  applyTitleAccessibility,
  createTitleShell,
  type TitleImportConfirmation,
  type TitleShell
} from '../ui/dom/menuShell';
import { formatAreaName, formatPlaytime, type TitleCommand } from '../ui/title/TitleMenuModel';
import { SceneKeys } from './SceneKeys';

export class TitleScene extends Phaser.Scene {
  private scope = new SceneScope();
  private inputService: InputService | undefined;
  private saves: SaveService | undefined;
  private repository: SaveRepository | undefined;
  private shell: TitleShell | undefined;
  private settingsState: AccessibilitySettingsState | undefined;
  private active = false;

  public constructor() {
    super(SceneKeys.Title);
  }

  public init(): void {
    this.scope = new SceneScope();
    this.active = true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.scope.add(() => this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this));
  }

  public create(): void {
    const services = this.registry.get(GAME_SERVICES_REGISTRY_KEY) as ServiceRegistry;
    this.inputService = services.get(InputServiceToken);
    this.saves = services.get(SaveServiceToken);
    this.repository = services.get(SaveRepositoryToken);
    this.settingsState = services.get(AccessibilitySettingsToken);
    this.inputService.clearTransient();
    applyTitleAccessibility(this.settingsState.current);
    void this.render();
  }

  public update(time: number): void {
    if (this.inputService === undefined || this.shell === undefined) return;
    const frame = this.inputService.sample(time);
    if (frame.pressed.includes('move-up')) this.shell.navigate(-1);
    if (frame.pressed.includes('move-down')) this.shell.navigate(1);
    if (frame.pressed.includes('confirm')) this.shell.activateFocused();
    if (frame.pressed.includes('back') || frame.pressed.includes('menu')) this.shell.back();
  }

  private async render(): Promise<void> {
    if (this.repository === undefined || this.settingsState === undefined) return;
    const slots = await this.repository.list();
    if (!this.active) return;
    const warning = this.registry.get(SAVE_WARNING_REGISTRY_KEY) as string | undefined;
    this.shell = createTitleShell({
      slots,
      settings: this.settingsState.current,
      ...(warning === undefined ? {} : { warning }),
      onCommand: (command) => this.execute(command),
      onSettingsChange: (update) => {
        if (this.settingsState === undefined) return;
        const settings = this.settingsState.update(update);
        this.shell?.updateSettings(settings);
        const sourceSlotId = this.settingsState.sourceSlotId;
        if (sourceSlotId !== undefined) void this.persistSettings(sourceSlotId, settings);
      },
      onExport: (slotId) => this.exportSave(slotId),
      onImport: (slotId, json) => this.previewImport(slotId, json)
    });
    this.scope.add(() => this.shell?.dispose());
  }

  private async execute(command: TitleCommand): Promise<void> {
    if (this.saves === undefined) return;
    switch (command.type) {
      case 'open-settings':
      case 'open-credits':
        return;
      case 'delete-slot':
        await this.saves.delete(command.slotId);
        await this.refreshSlots();
        return;
      case 'load-slot': {
        const loaded = await this.saves.load(command.slotId);
        if (loaded.kind !== 'loaded') {
          await this.refreshSlots();
          return;
        }
        this.settingsState?.replace(loaded.save.settings, command.slotId);
        this.scene.start(SceneKeys.Transition, {
          destinationId: loaded.save.metadata.areaId,
          destinationName: formatAreaName(loaded.save.metadata.areaId),
          unlockedAbilityIds: loaded.save.unlockedAbilities,
          reducedMotion:
            this.settingsState?.current.reducedMotion ?? loaded.save.settings.reducedMotion
        });
        return;
      }
      case 'new-game': {
        const save = createDefaultSave(command.slotId);
        const withSettings = {
          ...save,
          settings: this.settingsState?.current ?? save.settings
        };
        this.saves.scheduleAutosave(command.slotId, withSettings);
        await this.saves.flushAutosaves();
        this.settingsState?.replace(withSettings.settings, command.slotId);
        this.scene.start(SceneKeys.Transition, {
          destinationId: 'wrens-rest',
          destinationName: "WREN'S REST",
          unlockedAbilityIds: withSettings.unlockedAbilities,
          reducedMotion: withSettings.settings.reducedMotion
        });
      }
    }
  }

  private async refreshSlots(): Promise<void> {
    const slots = await this.repository?.list();
    if (slots !== undefined && this.active) this.shell?.updateSlots(slots);
  }

  private async persistSettings(
    slotId: SaveSlotId,
    settings: AccessibilitySettings
  ): Promise<void> {
    try {
      await this.saves?.updateSettings(slotId, settings);
    } catch {
      this.registry.set(
        SAVE_WARNING_REGISTRY_KEY,
        'Settings could not be saved. Gameplay can continue.'
      );
    }
  }

  private async exportSave(slotId: SaveSlotId): Promise<void> {
    if (this.saves === undefined) return;
    const serialized = await this.saves.export(slotId);
    const blobUrl = URL.createObjectURL(new Blob([serialized], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `rivenbloom-${slotId}.json`;
    link.click();
    URL.revokeObjectURL(blobUrl);
  }

  private async previewImport(
    slotId: SaveSlotId,
    json: string
  ): Promise<TitleImportConfirmation | string> {
    if (this.saves === undefined) return 'Save service unavailable.';
    const preview = await this.saves.import(json);
    if (preview.kind === 'invalid') return preview.reason;
    return {
      areaName: formatAreaName(preview.preview.areaId),
      playtime: formatPlaytime(preview.preview.playtimeSeconds),
      confirm: async () => {
        await this.confirmImport(preview, slotId);
      }
    };
  }

  private async confirmImport(preview: ImportPreview, slotId: SaveSlotId): Promise<void> {
    if (this.saves === undefined) return;
    await this.saves.confirmImport(preview, slotId);
    await this.refreshSlots();
  }

  private shutdown(): void {
    this.active = false;
    this.inputService?.clearTransient();
    this.scope.dispose();
    this.shell = undefined;
  }
}
