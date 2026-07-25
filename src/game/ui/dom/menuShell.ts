import type {
  AccessibilitySettings,
  AccessibilitySettingsUpdate
} from '../../config/accessibility';
import type { SaveSlotPreview } from '../../saves/SaveRepository';
import type { SaveSlotId } from '../../saves/SaveSchema';
import {
  advanceSelection,
  formatAreaName,
  formatPlaytime,
  resolveSlotCommand,
  type TitleCommand,
  type TitleSlotMode
} from '../title/TitleMenuModel';

type LoadingShell = {
  readonly element: HTMLElement;
  setProgress(progress: number): void;
  showError(group: string, retry: () => void): void;
  dispose(): void;
};

export type TitleImportConfirmation = {
  readonly areaName: string;
  readonly playtime: string;
  confirm(): Promise<void>;
};

export type TitleShellOptions = {
  readonly slots: readonly SaveSlotPreview[];
  readonly settings: AccessibilitySettings;
  readonly warning?: string;
  readonly onCommand: (command: TitleCommand) => void | Promise<void>;
  readonly onSettingsChange: (update: AccessibilitySettingsUpdate) => void;
  readonly onExport: (slotId: SaveSlotId) => Promise<void>;
  readonly onImport: (
    slotId: SaveSlotId,
    json: string
  ) => Promise<TitleImportConfirmation | string>;
};

export type TitleShell = {
  readonly element: HTMLElement;
  updateSlots(slots: readonly SaveSlotPreview[]): void;
  updateSettings(settings: AccessibilitySettings): void;
  navigate(direction: -1 | 1): void;
  activateFocused(): void;
  back(): void;
  dispose(): void;
};

const append = <T extends HTMLElement>(parent: HTMLElement, child: T): T => {
  parent.append(child);
  return child;
};

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const button = (className: string, label: string, onClick: () => void): HTMLButtonElement => {
  const control = element('button', className, label);
  control.type = 'button';
  control.addEventListener('click', onClick);
  return control;
};

const installShell = (shell: HTMLElement): (() => void) => {
  const app = document.querySelector<HTMLElement>('#app');
  if (app === null) throw new Error('The Rivenbloom application root is unavailable.');
  app.append(shell);
  return () => shell.remove();
};

export const createLoadingShell = (): LoadingShell => {
  const shell = element('section', 'game-surface loading-surface');
  shell.setAttribute('aria-label', 'Loading Rivenbloom');
  shell.setAttribute('aria-live', 'polite');
  const mark = append(shell, element('div', 'loading-seed'));
  mark.setAttribute('aria-hidden', 'true');
  const title = append(shell, element('p', 'loading-title', 'RIVENBLOOM'));
  const status = append(shell, element('p', 'loading-status', 'Loading 0%'));
  const track = append(shell, element('div', 'loading-track'));
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-label', 'Asset loading progress');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  const fill = append(track, element('span', 'loading-fill'));
  const remove = installShell(shell);

  return {
    element: shell,
    setProgress(progress) {
      const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
      status.textContent = `Loading ${percent}%`;
      track.setAttribute('aria-valuenow', percent.toString());
      fill.style.setProperty('--load-progress', `${percent}%`);
      title.hidden = false;
    },
    showError(group, retry) {
      status.textContent = `Unable to load ${group}.`;
      track.removeAttribute('role');
      const retryButton = button('loading-retry', 'Retry', retry);
      shell.append(retryButton);
      retryButton.focus();
    },
    dispose: remove
  };
};

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const applyTitleAccessibility = (settings: AccessibilitySettings): void => {
  document.documentElement.style.setProperty('--text-scale', settings.textScale.toString());
  document.documentElement.dataset.reducedMotion = settings.reducedMotion ? 'true' : 'false';
  document.documentElement.dataset.highContrastPrompts = settings.highContrastPrompts
    ? 'true'
    : 'false';
};

export const createTitleShell = (options: TitleShellOptions): TitleShell => {
  let slots = options.slots;
  let settings = options.settings;
  let mode: TitleSlotMode = 'continue';
  let overlay: HTMLElement | undefined;
  let overlayOpener: HTMLElement | undefined;

  const shell = element('main', 'game-surface title-surface');
  shell.dataset.testid = 'title-surface';
  shell.setAttribute('aria-label', 'Rivenbloom title');

  const edgeFade = append(shell, element('div', 'title-edge-fade'));
  edgeFade.setAttribute('aria-hidden', 'true');
  const layout = append(shell, element('div', 'title-layout'));
  const left = append(layout, element('section', 'title-left'));
  const identity = append(left, element('header', 'title-identity'));
  const seedMark = append(identity, element('div', 'title-seed-mark'));
  seedMark.setAttribute('aria-hidden', 'true');
  seedMark.append(element('span', 'seed-half seed-half-left'));
  seedMark.append(element('span', 'seed-core'));
  seedMark.append(element('span', 'seed-half seed-half-right'));
  append(identity, element('h1', 'title-wordmark', 'RIVENBLOOM'));

  const navigation = append(left, element('nav', 'title-navigation'));
  navigation.setAttribute('aria-label', 'Main menu');
  const mainButtons: HTMLButtonElement[] = [];
  const drawer = append(layout, element('section', 'save-drawer'));
  drawer.setAttribute('aria-label', 'Continue save slots');
  drawer.setAttribute('role', 'region');

  const footer = append(shell, element('footer', 'title-footer'));
  const selectPrompt = append(footer, element('span', 'footer-prompt', 'Select'));
  selectPrompt.dataset.prompt = 'select';
  const backPrompt = append(footer, element('span', 'footer-prompt', 'Back'));
  backPrompt.dataset.prompt = 'back';

  if (options.warning !== undefined) {
    const warning = append(shell, element('p', 'title-warning', options.warning));
    warning.setAttribute('role', 'status');
  }

  const closeOverlay = (): void => {
    overlay?.remove();
    overlay = undefined;
    shell.removeAttribute('data-overlay-open');
    const opener = overlayOpener;
    overlayOpener = undefined;
    if (opener?.isConnected === true) opener.focus();
  };

  const openOverlay = (dialog: HTMLElement): void => {
    closeOverlay();
    overlayOpener =
      document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    overlay = dialog;
    shell.dataset.overlayOpen = 'true';
    shell.append(dialog);
    queueMicrotask(() => dialog.querySelector<HTMLButtonElement>('button')?.focus());
  };

  const dialog = (name: string): HTMLElement => {
    const backdrop = element('div', 'title-dialog-backdrop');
    const panel = append(backdrop, element('section', 'title-dialog'));
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', name);
    append(panel, element('h2', 'title-dialog-heading', name));
    return backdrop;
  };

  const openNewGameConfirmation = (slot: SaveSlotPreview): void => {
    const backdrop = dialog('NEW GAME');
    const panel = backdrop.firstElementChild as HTMLElement;
    append(panel, element('p', 'title-dialog-copy', "WREN'S REST"));
    if (slot.status !== 'empty') {
      append(panel, element('p', 'title-dialog-note', 'This slot already contains save data.'));
    }
    const actions = append(panel, element('div', 'title-dialog-actions'));
    actions.append(
      button('pod-button pod-button-primary', 'NEW GAME', () => {
        closeOverlay();
        void options.onCommand({ type: 'new-game', slotId: slot.slotId });
      }),
      button('pod-button', 'Back', closeOverlay)
    );
    openOverlay(backdrop);
  };

  const openDeleteConfirmation = (slotId: SaveSlotId): void => {
    const backdrop = dialog('DELETE SLOT');
    const panel = backdrop.firstElementChild as HTMLElement;
    append(panel, element('p', 'title-dialog-note', 'Delete this save permanently?'));
    const actions = append(panel, element('div', 'title-dialog-actions'));
    actions.append(
      button('pod-button pod-button-danger', 'DELETE SLOT', () => {
        closeOverlay();
        void options.onCommand({ type: 'delete-slot', slotId });
      }),
      button('pod-button', 'Back', closeOverlay)
    );
    openOverlay(backdrop);
  };

  const openImportConfirmation = (
    slotId: SaveSlotId,
    confirmation: TitleImportConfirmation
  ): void => {
    const backdrop = dialog('IMPORT SAVE');
    const panel = backdrop.firstElementChild as HTMLElement;
    append(
      panel,
      element('p', 'title-dialog-copy', `${confirmation.areaName} · ${confirmation.playtime}`)
    );
    append(panel, element('p', 'title-dialog-note', 'Replace this slot with the imported save?'));
    const actions = append(panel, element('div', 'title-dialog-actions'));
    actions.append(
      button('pod-button pod-button-primary', 'IMPORT SAVE', () => {
        void confirmation.confirm().then(closeOverlay);
      }),
      button('pod-button', 'Back', closeOverlay)
    );
    openOverlay(backdrop);
  };

  const chooseImport = (slotId: SaveSlotId): void => {
    const input = element('input', 'visually-hidden');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener(
      'change',
      () => {
        const file = input.files?.[0];
        input.remove();
        if (file === undefined) return;
        void file.text().then(async (json) => {
          const result = await options.onImport(slotId, json);
          if (typeof result === 'string') {
            const errorDialog = dialog('IMPORT SAVE');
            const panel = errorDialog.firstElementChild as HTMLElement;
            append(panel, element('p', 'title-dialog-note', result));
            append(panel, button('pod-button', 'Back', closeOverlay));
            openOverlay(errorDialog);
            return;
          }
          openImportConfirmation(slotId, result);
        });
      },
      { once: true }
    );
    shell.append(input);
    input.click();
  };

  const openSlotTools = (slot: SaveSlotPreview): void => {
    const backdrop = dialog(
      slot.status === 'empty' ? 'EMPTY SLOT' : formatAreaName(slot.areaId ?? '')
    );
    const panel = backdrop.firstElementChild as HTMLElement;
    const actions = append(
      panel,
      element('div', 'title-dialog-actions title-dialog-actions-stack')
    );
    if (slot.status === 'available' || slot.status === 'recoverable') {
      actions.append(
        button('pod-button', 'CONTINUE', () => {
          closeOverlay();
          void options.onCommand({ type: 'load-slot', slotId: slot.slotId });
        }),
        button('pod-button', 'EXPORT SAVE', () => {
          void options.onExport(slot.slotId);
        }),
        button('pod-button pod-button-danger', 'DELETE SLOT', () =>
          openDeleteConfirmation(slot.slotId)
        )
      );
    }
    actions.append(
      button('pod-button', 'IMPORT SAVE', () => chooseImport(slot.slotId)),
      button('pod-button', 'Back', closeOverlay)
    );
    openOverlay(backdrop);
  };

  const renderDrawer = (): void => {
    drawer.replaceChildren();
    drawer.setAttribute(
      'aria-label',
      mode === 'continue' ? 'Continue save slots' : 'New game save slots'
    );
    const frame = append(drawer, element('div', 'save-drawer-frame'));
    const rows = append(frame, element('div', 'save-slot-list'));
    slots.forEach((slot, index) => {
      const row = append(rows, element('div', 'save-slot-row'));
      const primary = button('save-slot-primary', '', () => {
        const command = resolveSlotCommand(mode, slot);
        if (command?.type === 'new-game') {
          openNewGameConfirmation(slot);
          return;
        }
        if (command !== null) void options.onCommand(command);
      });
      primary.dataset.focusGroup = 'drawer';
      primary.dataset.focusIndex = index.toString();
      if (mode === 'continue' && resolveSlotCommand(mode, slot) === null) {
        primary.setAttribute('aria-disabled', 'true');
      }
      if (slot.status === 'empty') {
        primary.setAttribute('aria-label', `EMPTY SLOT ${index + 1}`);
        primary.append(element('strong', 'slot-name', 'EMPTY SLOT'));
      } else {
        const areaName = formatAreaName(slot.areaId ?? 'wrens-rest');
        const playtime = formatPlaytime(slot.playtimeSeconds ?? 0);
        primary.setAttribute('aria-label', `${areaName} ${playtime}`);
        primary.append(element('strong', 'slot-name', areaName));
        const metadata = append(primary, element('span', 'slot-metadata'));
        metadata.append(element('span', undefined, playtime));
        if (slot.updatedAt !== undefined) {
          metadata.append(element('span', undefined, formatDate(slot.updatedAt)));
        }
        const sprout = append(primary, element('span', 'completion-sprout'));
        sprout.setAttribute('aria-hidden', 'true');
      }
      row.append(primary);
      const tools = button('save-slot-tools', '', () => openSlotTools(slot));
      tools.dataset.focusGroup = 'drawer';
      tools.setAttribute('aria-label', `Save tools for slot ${index + 1}`);
      tools.append(element('span', 'visually-hidden', `Save tools for slot ${index + 1}`));
      const dots = append(tools, element('span', 'tool-seed-dots'));
      dots.setAttribute('aria-hidden', 'true');
      row.append(tools);
    });
  };

  const openSettings = (): void => {
    void options.onCommand({ type: 'open-settings' });
    const backdrop = dialog('SETTINGS');
    const panel = backdrop.firstElementChild as HTMLElement;
    const form = append(panel, element('div', 'settings-form'));
    const motionLabel = append(form, element('label', 'settings-row'));
    motionLabel.append(element('span', undefined, 'Reduced motion'));
    const motion = append(motionLabel, element('input'));
    motion.type = 'checkbox';
    motion.checked = settings.reducedMotion;
    motion.addEventListener('change', () =>
      options.onSettingsChange({ reducedMotion: motion.checked })
    );
    const scaleLabel = append(form, element('label', 'settings-row'));
    scaleLabel.append(element('span', undefined, 'Text scale'));
    const scale = append(scaleLabel, element('select'));
    [
      ['1', '100%'],
      ['1.15', '115%'],
      ['1.3', '130%']
    ].forEach(([value, label]) => {
      const option = append(scale, element('option', undefined, label));
      option.value = value ?? '1';
    });
    scale.value = settings.textScale.toString();
    scale.addEventListener('change', () =>
      options.onSettingsChange({ textScale: Number(scale.value) })
    );
    append(panel, button('pod-button', 'Back', closeOverlay));
    openOverlay(backdrop);
  };

  const openCredits = (): void => {
    void options.onCommand({ type: 'open-credits' });
    const backdrop = dialog('CREDITS');
    const panel = backdrop.firstElementChild as HTMLElement;
    append(panel, element('p', 'credits-copy', 'An original Rivenbloom production.'));
    append(
      panel,
      element('p', 'credits-copy', 'Design, art, and engineering by the Rivenbloom team.')
    );
    append(panel, button('pod-button', 'Back', closeOverlay));
    openOverlay(backdrop);
  };

  const selectMode = (nextMode: TitleSlotMode, focusSlot = true): void => {
    mode = nextMode;
    mainButtons.forEach((control) => control.removeAttribute('aria-current'));
    mainButtons[nextMode === 'continue' ? 0 : 1]?.setAttribute('aria-current', 'page');
    renderDrawer();
    if (focusSlot) {
      queueMicrotask(() => drawer.querySelector<HTMLButtonElement>('.save-slot-primary')?.focus());
    }
  };

  const menuDefinitions: readonly [string, () => void][] = [
    ['CONTINUE', () => selectMode('continue')],
    ['NEW GAME', () => selectMode('new-game')],
    ['SETTINGS', openSettings],
    ['CREDITS', openCredits]
  ];
  menuDefinitions.forEach(([label, action], index) => {
    const control = button('title-menu-button', label, action);
    control.dataset.focusGroup = 'main';
    control.dataset.focusIndex = index.toString();
    mainButtons.push(control);
    navigation.append(control);
  });
  mainButtons[0]?.setAttribute('aria-current', 'page');
  renderDrawer();

  const preventNativeSemanticActivation = (event: KeyboardEvent): void => {
    if (event.key === 'Tab' && overlay !== undefined) {
      const controls = Array.from(
        overlay.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled])'
        )
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (
        controls.length === 0 ||
        (!event.shiftKey && document.activeElement === last) ||
        (event.shiftKey && document.activeElement === first) ||
        !overlay.contains(document.activeElement)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
      return;
    }
    if (
      event.code === 'Enter' ||
      event.code === 'ArrowUp' ||
      event.code === 'ArrowDown' ||
      event.code === 'Backspace'
    ) {
      event.preventDefault();
    }
  };
  shell.addEventListener('keydown', preventNativeSemanticActivation);
  applyTitleAccessibility(settings);
  const remove = installShell(shell);
  queueMicrotask(() => mainButtons[0]?.focus());

  const focusableControls = (): HTMLElement[] => {
    if (overlay !== undefined) {
      return Array.from(
        overlay.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled])'
        )
      );
    }
    const focusedGroup =
      document.activeElement instanceof HTMLElement
        ? document.activeElement.dataset.focusGroup
        : undefined;
    if (focusedGroup === 'drawer') {
      return Array.from(
        drawer.querySelectorAll<HTMLElement>('.save-slot-primary, .save-slot-tools')
      );
    }
    return mainButtons;
  };

  return {
    element: shell,
    updateSlots(nextSlots) {
      slots = nextSlots;
      renderDrawer();
    },
    updateSettings(nextSettings) {
      settings = nextSettings;
      applyTitleAccessibility(settings);
    },
    navigate(direction) {
      const controls = focusableControls();
      if (controls.length === 0) return;
      const current = Math.max(0, controls.indexOf(document.activeElement as HTMLElement));
      controls[advanceSelection(current, direction, controls.length)]?.focus();
    },
    activateFocused() {
      const focused = document.activeElement;
      if (focused instanceof HTMLButtonElement || focused instanceof HTMLInputElement) {
        focused.click();
        return;
      }
      if (focused instanceof HTMLSelectElement && focused.options.length > 0) {
        focused.selectedIndex = (focused.selectedIndex + 1) % focused.options.length;
        focused.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    back() {
      if (overlay !== undefined) {
        closeOverlay();
        return;
      }
      mainButtons[mode === 'continue' ? 0 : 1]?.focus();
    },
    dispose() {
      shell.removeEventListener('keydown', preventNativeSemanticActivation);
      remove();
    }
  };
};

export const createTransitionShell = (
  destinationName: string,
  destinationId: string,
  reducedMotion: boolean
): { readonly element: HTMLElement; dispose(): void } => {
  const shell = element(
    'main',
    `game-surface transition-surface${reducedMotion ? ' reduced-motion' : ''}`
  );
  shell.dataset.destination = destinationId;
  const card = append(shell, element('section', 'destination-card'));
  append(card, element('span', 'destination-seed')).setAttribute('aria-hidden', 'true');
  append(card, element('h1', 'destination-name', destinationName));
  const remove = installShell(shell);
  return { element: shell, dispose: remove };
};
