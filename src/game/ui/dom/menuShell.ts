import type { SaveSettings, SaveSlotId } from '../../saves/SaveSchema';
import type { TitleCommand } from '../../title/TitleCommands';
import type { TitleDialogState, TitleState } from '../../title/TitleController';
import { createFocusModel, moveFocus } from '../../title/TitleFocusModel';
import type { FocusDirection, FocusTarget } from '../../title/TitleFocusModel';
import type { TitleSlotState } from '../../title/TitleSlotModel';

export type TitleMenuIntent =
  | Readonly<{ type: 'command'; command: TitleCommand }>
  | Readonly<{ type: 'select-slot'; slotId: SaveSlotId }>
  | Readonly<{ type: 'open-manage'; slotId: SaveSlotId }>
  | Readonly<{ type: 'preview-import'; slotId: SaveSlotId; contents: string }>
  | Readonly<{ type: 'export-slot'; slotId: SaveSlotId }>
  | Readonly<{ type: 'export-corrupt'; slotId: SaveSlotId }>
  | Readonly<{ type: 'update-settings'; settings: SaveSettings }>
  | Readonly<{ type: 'confirm-dialog' }>
  | Readonly<{ type: 'close-dialog' }>
  | Readonly<{ type: 'retry-slots' }>;

export type MenuFocusAction =
  'initial' | FocusDirection | 'increase' | 'decrease' | 'confirm' | 'cancel';

export type MenuShellHandle = Readonly<{
  root: HTMLElement;
  render(state: TitleState): void;
  focus(action: MenuFocusAction): void;
  destroy(): void;
}>;

export function createMenuShell(
  stage: HTMLElement,
  onIntent: (intent: TitleMenuIntent) => void,
): MenuShellHandle {
  const root = document.createElement('section');
  root.className = 'scene-overlay title-screen';
  root.setAttribute('aria-labelledby', 'rivenbloom-title');
  stage.append(root);

  let currentState: TitleState | null = null;
  let destroyed = false;
  let focusedControlId: string | null = null;
  let dialogInvokerFocusId: string | null = null;
  let openDialog: HTMLDialogElement | null = null;
  let importGeneration = 0;
  let lastDownloadId = 0;
  const objectUrls = new Set<string>();
  const revokeTimers = new Map<string, number>();
  const focusFrames = new Set<number>();

  const clickListener = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest<HTMLElement>('[data-action], [data-command]');
    if (control === null) return;
    if (openDialog === null) {
      focusedControlId = control.dataset.focusId ?? focusedControlId;
    }
    const slotId = readSlotId(control.dataset.slotId);
    const command = control.dataset.command;
    if (command !== undefined) {
      const titleCommand = readCommand(command, slotId);
      if (titleCommand !== null) onIntent({ type: 'command', command: titleCommand });
      return;
    }
    switch (control.dataset.action) {
      case 'open-manage':
        if (slotId !== null) onIntent({ type: 'open-manage', slotId });
        return;
      case 'export-slot':
        if (slotId !== null) onIntent({ type: 'export-slot', slotId });
        return;
      case 'export-corrupt':
        if (slotId !== null) onIntent({ type: 'export-corrupt', slotId });
        return;
      case 'confirm-dialog':
        onIntent({ type: 'confirm-dialog' });
        return;
      case 'close-dialog':
        onIntent({ type: 'close-dialog' });
        return;
      case 'retry-slots':
        onIntent({ type: 'retry-slots' });
        return;
    }
  };

  const focusListener = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest<HTMLElement>('[data-focus-id]');
    if (control !== null && openDialog === null) {
      for (const frame of focusFrames) cancelAnimationFrame(frame);
      focusFrames.clear();
      focusedControlId = control.dataset.focusId ?? focusedControlId;
    }
    const card = target.closest<HTMLElement>('[data-slot-card]');
    const slotId = readSlotId(card?.dataset.slotId);
    if (slotId !== null) onIntent({ type: 'select-slot', slotId });
  };

  const changeListener = (event: Event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.type === 'file') {
      const slotId = readSlotId(target.dataset.slotId);
      const file = target.files?.[0];
      target.value = '';
      if (slotId === null || file === undefined) return;
      const generation = ++importGeneration;
      void file
        .text()
        .then((contents) => {
          if (!destroyed && generation === importGeneration) {
            onIntent({ type: 'preview-import', slotId, contents });
          }
        })
        .catch(() => {
          if (!destroyed && generation === importGeneration) {
            onIntent({ type: 'preview-import', slotId, contents: '' });
          }
        });
      return;
    }
    if (currentState?.dialog?.kind !== 'settings') return;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    const next = { ...currentState.dialog.settings };
    if (target.dataset.setting === 'reducedMotion' && target instanceof HTMLInputElement) {
      next.reducedMotion = target.checked;
    } else if (
      target.dataset.setting === 'highContrastPrompts' &&
      target instanceof HTMLInputElement
    ) {
      next.highContrastPrompts = target.checked;
    } else if (target.dataset.setting === 'subtitles' && target instanceof HTMLInputElement) {
      next.subtitles = target.checked;
    } else if (target.dataset.setting === 'damageNumbers' && target instanceof HTMLInputElement) {
      next.damageNumbers = target.checked;
    } else if (
      target.dataset.setting === 'muteWhenUnfocused' &&
      target instanceof HTMLInputElement
    ) {
      next.muteWhenUnfocused = target.checked;
    } else if (target.dataset.setting === 'textScale' && target instanceof HTMLSelectElement) {
      next.textScale = Number(target.value);
    } else if (target.dataset.setting === 'difficulty' && target instanceof HTMLSelectElement) {
      next.difficulty = target.value as SaveSettings['difficulty'];
    } else if (
      target.dataset.setting === 'sustainedAction' &&
      target instanceof HTMLSelectElement
    ) {
      next.sustainedAction = target.value as SaveSettings['sustainedAction'];
    } else if (target.dataset.setting === 'shakeIntensity' && target instanceof HTMLInputElement) {
      next.shakeIntensity = Number(target.value);
    } else if (target.dataset.setting === 'flashIntensity' && target instanceof HTMLInputElement) {
      next.flashIntensity = Number(target.value);
    } else if (target.dataset.setting === 'masterVolume' && target instanceof HTMLInputElement) {
      next.masterVolume = Number(target.value);
    } else if (target.dataset.setting === 'musicVolume' && target instanceof HTMLInputElement) {
      next.musicVolume = Number(target.value);
    } else if (target.dataset.setting === 'sfxVolume' && target instanceof HTMLInputElement) {
      next.sfxVolume = Number(target.value);
    } else if (target.dataset.setting === 'ambienceVolume' && target instanceof HTMLInputElement) {
      next.ambienceVolume = Number(target.value);
    } else {
      return;
    }
    target.focus();
    const settings = Object.freeze(next);
    currentState = Object.freeze({
      ...currentState,
      settings,
      dialog: Object.freeze({ ...currentState.dialog, settings }),
    });
    applySettings(root, settings);
    onIntent({ type: 'update-settings', settings });
  };

  const cancelListener = (event: Event) => {
    if (!(event.target instanceof HTMLDialogElement)) return;
    event.preventDefault();
    onIntent({ type: 'close-dialog' });
  };

  const keyboardFocusListener = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
    if (openDialog === null) {
      const controls = [...root.querySelectorAll<HTMLElement>('[data-focus-id]')].filter(
        (control) => !isUnavailable(control),
      );
      const edge = event.shiftKey ? controls[0] : controls.at(-1);
      if (document.activeElement === edge) return;
    }
    event.preventDefault();
    focus(event.shiftKey ? 'previous' : 'next');
  };

  root.addEventListener('click', clickListener);
  root.addEventListener('focusin', focusListener);
  root.addEventListener('change', changeListener);
  root.addEventListener('cancel', cancelListener, true);
  root.addEventListener('keydown', keyboardFocusListener);

  const render = (state: TitleState) => {
    if (destroyed) return;
    currentState = state;
    applySettings(root, state.settings);
    const hadDialog = openDialog !== null;
    const activeBeforeRender = document.activeElement;
    const previousDialogFocusId =
      hadDialog &&
      activeBeforeRender instanceof HTMLElement &&
      openDialog?.contains(activeBeforeRender)
        ? (activeBeforeRender.dataset.focusId ?? null)
        : null;
    if (!hadDialog && state.dialog !== null) dialogInvokerFocusId = focusedControlId;
    if (openDialog?.open) openDialog.close();
    openDialog = null;

    const atmosphere = element('div', 'scene-overlay__atmosphere');
    atmosphere.setAttribute('aria-hidden', 'true');
    atmosphere.append(
      element('div', 'scene-overlay__rain'),
      element('div', 'scene-overlay__roots'),
    );
    const glow = element('div', 'scene-overlay__glow');
    glow.setAttribute('aria-hidden', 'true');
    atmosphere.append(glow);

    const layout = element('div', 'title-layout');
    layout.append(createTitleRail(), createJourneys(state));
    root.replaceChildren(atmosphere, layout);

    if (state.dialog !== null) {
      for (const frame of focusFrames) cancelAnimationFrame(frame);
      focusFrames.clear();
      openDialog = createDialog(state.dialog, state.submitting, state.dialogError);
      root.append(openDialog);
      openDialog.showModal();
      const dialogFocus =
        previousDialogFocusId === null
          ? null
          : openDialog.querySelector<HTMLElement>(`[data-focus-id="${previousDialogFocusId}"]`);
      const initialFocus =
        state.dialog.kind === 'settings'
          ? openDialog.querySelector<HTMLElement>('[data-focus-id="setting-reducedMotion"]')
          : openDialog.querySelector<HTMLButtonElement>('[data-dialog-cancel]');
      (dialogFocus ?? initialFocus)?.focus();
    } else if (hadDialog && dialogInvokerFocusId !== null) {
      const id = dialogInvokerFocusId;
      dialogInvokerFocusId = null;
      const frame = requestAnimationFrame(() => {
        focusFrames.delete(frame);
        if (!destroyed) root.querySelector<HTMLElement>(`[data-focus-id="${id}"]`)?.focus();
      });
      focusFrames.add(frame);
    }

    if (state.download !== null && state.download.id !== lastDownloadId) {
      lastDownloadId = state.download.id;
      download(state.download.filename, state.download.contents);
    }
  };

  const focus = (action: MenuFocusAction) => {
    if (destroyed) return;
    if (action === 'cancel') {
      if (openDialog !== null) onIntent({ type: 'close-dialog' });
      return;
    }
    const active = document.activeElement;
    if (action === 'confirm') {
      if (active instanceof HTMLButtonElement || active instanceof HTMLInputElement) active.click();
      return;
    }
    if (action === 'increase' || action === 'decrease') {
      if (active instanceof HTMLSelectElement) {
        const delta = action === 'increase' ? 1 : -1;
        const nextIndex = Math.max(
          0,
          Math.min(active.options.length - 1, active.selectedIndex + delta),
        );
        if (nextIndex !== active.selectedIndex) {
          active.selectedIndex = nextIndex;
          active.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }
      if (active instanceof HTMLInputElement && active.type === 'checkbox') {
        const checked = action === 'increase';
        if (active.checked !== checked) {
          active.checked = checked;
          active.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }
      action = action === 'increase' ? 'next' : 'previous';
    }
    const container: ParentNode = openDialog ?? root;
    const controls = [...container.querySelectorAll<HTMLElement>('[data-focus-id]')].filter(
      (control) => !isUnavailable(control),
    );
    const targets: FocusTarget[] = controls.map((control) => ({
      id: control.dataset.focusId ?? '',
      available: true,
    }));
    const activeId =
      active instanceof HTMLElement && container.contains(active)
        ? active.dataset.focusId
        : undefined;
    let model = createFocusModel(targets, activeId);
    if (action === 'initial') {
      const readySlot = currentState?.slots.find(({ kind }) => kind === 'ready');
      const preferred =
        readySlot === undefined
          ? controls.find((control) => control.closest('[data-slot-id="slot-1"]'))?.dataset.focusId
          : `${readySlot.slotId}-primary`;
      model = createFocusModel(targets, preferred);
    } else {
      model = moveFocus(model, action);
    }
    const next = controls.find((control) => control.dataset.focusId === model.activeId);
    next?.focus();
  };

  const download = (filename: string, contents: string) => {
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    objectUrls.add(url);
    const anchor = document.createElement('a');
    anchor.hidden = true;
    anchor.href = url;
    anchor.download = filename;
    root.append(anchor);
    anchor.click();
    anchor.remove();
    const timer = window.setTimeout(() => revokeUrl(url), 0);
    revokeTimers.set(url, timer);
  };

  const revokeUrl = (url: string) => {
    const timer = revokeTimers.get(url);
    if (timer !== undefined) window.clearTimeout(timer);
    revokeTimers.delete(url);
    if (!objectUrls.delete(url)) return;
    URL.revokeObjectURL(url);
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    importGeneration += 1;
    root.removeEventListener('click', clickListener);
    root.removeEventListener('focusin', focusListener);
    root.removeEventListener('change', changeListener);
    root.removeEventListener('cancel', cancelListener, true);
    root.removeEventListener('keydown', keyboardFocusListener);
    if (openDialog?.open) openDialog.close();
    openDialog = null;
    for (const url of [...objectUrls]) revokeUrl(url);
    for (const frame of focusFrames) cancelAnimationFrame(frame);
    focusFrames.clear();
    root.remove();
  };

  return Object.freeze({ root, render, focus, destroy });
}

function createTitleRail(): HTMLElement {
  const rail = element('header', 'title-rail seed-panel');
  const mark = element('div', 'title-mark');
  mark.setAttribute('aria-hidden', 'true');
  const eyebrow = element('p', 'eyebrow', "A WAYFINDER'S TALE");
  const title = element('h1', 'game-title', 'Rivenbloom');
  title.id = 'rivenbloom-title';
  const tagline = element('p', 'title-tagline', 'Follow the silent chimes home.');
  const line = element('div', 'copper-line');
  line.setAttribute('aria-hidden', 'true');
  const note = element(
    'p',
    'title-rail__note',
    'Three paths wait beneath the rain. Choose the thread that still remembers you.',
  );
  rail.append(mark, eyebrow, title, tagline, line, note);
  return rail;
}

function createJourneys(state: TitleState): HTMLElement {
  const section = element('section', 'journeys-panel');
  section.setAttribute('aria-labelledby', 'journeys-heading');
  const header = element('header', 'journeys-header');
  const titleGroup = element('div');
  const eyebrow = element('p', 'eyebrow', 'THE THREADBOOK');
  const heading = element('h2', 'journeys-heading', 'Journeys');
  heading.id = 'journeys-heading';
  titleGroup.append(eyebrow, heading);
  const count = element('p', 'journeys-count', 'Three keepsakes');
  header.append(titleGroup, count);
  section.append(header);

  for (const notice of state.persistentNotices) {
    const warning = element('p', 'title-notice title-notice--warning', notice);
    warning.setAttribute('role', 'status');
    section.append(warning);
  }
  if (state.globalError !== null) {
    const error = element('div', 'title-notice title-notice--error');
    error.setAttribute('role', 'alert');
    error.append(element('p', undefined, state.globalError));
    const retry = button('Retry journeys', 'retry-slots', 'retry-slots');
    retry.disabled = !state.titleReady || state.submitting;
    error.append(retry);
    section.append(error);
  }
  if (state.transientError !== null) {
    const error = element('div', 'title-notice title-notice--error');
    error.setAttribute('role', 'alert');
    error.append(element('p', undefined, state.transientError));
    section.append(error);
  }

  const stack = element('div', 'journey-stack');
  state.slots.forEach((slot, index) => stack.append(createJourneyCard(slot, index)));
  section.append(stack);

  const footer = element('footer', 'title-footer');
  const settings = commandButton('Settings', { type: 'open-settings' }, 'settings');
  const credits = commandButton('Credits', { type: 'open-credits' }, 'credits');
  settings.disabled = !state.titleReady || state.submitting;
  credits.disabled = !state.titleReady || state.submitting;
  footer.append(settings, credits);
  section.append(footer);
  return section;
}

function createJourneyCard(slot: TitleSlotState, index: number): HTMLElement {
  const card = element('article', `journey-card journey-card--${slot.kind} seed-panel`);
  card.dataset.slotCard = '';
  card.dataset.slotId = slot.slotId;
  card.style.setProperty('--card-index', String(index));
  const titleId = `${slot.slotId}-title`;
  card.setAttribute('aria-labelledby', titleId);
  const number = element('p', 'journey-card__number', String(index + 1).padStart(2, '0'));
  number.setAttribute('aria-hidden', 'true');
  const body = element('div', 'journey-card__body');
  const heading = element('h3', 'journey-card__title', slot.label);
  heading.id = titleId;
  body.append(heading);
  const actions = element('div', 'journey-card__actions');

  switch (slot.kind) {
    case 'loading':
      body.append(element('p', 'journey-card__status', 'Reading journey…'));
      break;
    case 'empty':
      body.append(
        element('p', 'journey-card__status', 'No journey yet'),
        element('p', 'journey-card__detail', "Begin at Wren's Rest"),
      );
      actions.append(
        commandButton(
          'Begin journey',
          { type: 'new-game', slotId: slot.slotId },
          `${slot.slotId}-primary`,
          `Begin journey for ${slot.label}`,
        ),
        importInput(slot.slotId, slot.label, `${slot.slotId}-import`),
      );
      break;
    case 'ready': {
      const metadata = element('div', 'journey-card__metadata');
      metadata.append(
        element('p', 'journey-card__status', slot.areaLabel),
        element('p', 'journey-card__detail numbers', `Play time ${slot.playTime}`),
        element('p', 'journey-card__detail', slot.upgrades),
      );
      const played = element('time', 'journey-card__time', slot.lastPlayed.label);
      played.dateTime = slot.lastPlayed.dateTime;
      metadata.append(played);
      if (slot.recoveryState === 'recovered') {
        metadata.append(
          badge('Recovered journey', 'badge--mint'),
          element('p', 'journey-card__recovery', 'Previous valid save restored.'),
        );
      } else if (slot.recoveryState === 'has-corrupt-copy') {
        metadata.append(badge('Damaged copy retained', 'badge--orchid'));
      }
      if (!slot.canLoad) {
        const unavailable = element(
          'p',
          'journey-card__error',
          'This area is unavailable in this build. Import another save or keep it for later.',
        );
        unavailable.setAttribute('role', 'alert');
        metadata.append(unavailable);
      }
      body.append(metadata);
      const continueButton = commandButton(
        'Continue',
        { type: 'load-slot', slotId: slot.slotId },
        `${slot.slotId}-primary`,
        `Continue ${slot.label}`,
      );
      continueButton.disabled = !slot.canLoad;
      const manage = button('Manage', 'open-manage', `${slot.slotId}-manage`);
      manage.dataset.slotId = slot.slotId;
      actions.append(continueButton, manage);
      break;
    }
    case 'corrupt': {
      body.append(
        element('p', 'journey-card__status journey-card__status--error', 'Save needs attention'),
        element('p', 'journey-card__detail', 'No valid journey remains.'),
      );
      const exportDamaged = button(
        'Export damaged save',
        'export-corrupt',
        `${slot.slotId}-corrupt-export`,
      );
      exportDamaged.dataset.slotId = slot.slotId;
      const remove = commandButton(
        'Delete',
        { type: 'delete-slot', slotId: slot.slotId },
        `${slot.slotId}-delete`,
        `Delete ${slot.label}`,
      );
      actions.append(
        exportDamaged,
        importInput(slot.slotId, slot.label, `${slot.slotId}-import`, 'Import replacement'),
        remove,
      );
      break;
    }
    case 'error':
      body.append(
        element('p', 'journey-card__status journey-card__status--error', 'Journey unavailable'),
        element('p', 'journey-card__detail', slot.message),
      );
      break;
    default:
      assertNever(slot);
  }

  card.append(number, body, actions);
  return card;
}

function createDialog(
  dialogState: TitleDialogState,
  submitting: boolean,
  dialogError: string | null,
): HTMLDialogElement {
  const dialog = document.createElement('dialog');
  dialog.className = 'menu-dialog seed-panel';
  const heading = element('h2', 'menu-dialog__title');
  const headingId = 'menu-dialog-title';
  heading.id = headingId;
  dialog.setAttribute('aria-labelledby', headingId);
  const body = element('div', 'menu-dialog__body');
  const actions = element('div', 'menu-dialog__actions');

  const cancel = button('Cancel', 'close-dialog', 'dialog-cancel');
  cancel.dataset.dialogCancel = '';
  cancel.disabled = submitting;

  switch (dialogState.kind) {
    case 'new-game': {
      heading.textContent = `Begin a new journey in ${dialogState.label}?`;
      body.append(
        element(
          'p',
          undefined,
          "Mara's path will open at Wren's Rest. No save is written until the world establishes a safe place to stand.",
        ),
      );
      const confirm = button(
        'Begin journey',
        'confirm-dialog',
        'dialog-confirm',
        'button--primary',
      );
      confirm.disabled = submitting;
      actions.append(cancel, confirm);
      break;
    }
    case 'delete': {
      heading.textContent = `Delete ${dialogState.label}?`;
      body.append(
        element('p', undefined, 'This removes the journey and its retained recovery copies.'),
        element('p', 'menu-dialog__warning', 'This cannot be undone.'),
      );
      const confirm = button(
        'Delete journey',
        'confirm-dialog',
        'dialog-confirm',
        'button--danger',
      );
      confirm.disabled = submitting;
      actions.append(cancel, confirm);
      break;
    }
    case 'manage': {
      heading.textContent = `Manage ${dialogState.label}`;
      body.append(element('p', undefined, 'Keep a portable copy or remove this journey.'));
      const exportSave = button('Export save', 'export-slot', 'dialog-export');
      exportSave.dataset.slotId = dialogState.slotId;
      actions.append(cancel, exportSave);
      if (dialogState.hasCorruptCopy) {
        const damaged = button('Export damaged copy', 'export-corrupt', 'dialog-corrupt-export');
        damaged.dataset.slotId = dialogState.slotId;
        actions.append(damaged);
      }
      const remove = commandButton(
        'Delete',
        { type: 'delete-slot', slotId: dialogState.slotId },
        'dialog-delete',
        `Delete ${dialogState.label}`,
      );
      remove.classList.add('button--danger');
      actions.append(remove);
      break;
    }
    case 'settings': {
      heading.textContent = 'Settings';
      const persistence = element(
        'p',
        'menu-dialog__note',
        dialogState.slotId === null
          ? 'These choices are carried into the next new journey in this session.'
          : `These choices will be saved to Journey ${slotNumber(dialogState.slotId)}.`,
      );
      body.append(
        settingCheckbox(
          'Reduced Motion',
          'Removes drift, rise, stagger, and continuous glow.',
          'reducedMotion',
          dialogState.settings.reducedMotion,
        ),
        textScaleField(dialogState.settings.textScale),
        settingCheckbox(
          'High-Contrast Prompts',
          'Adds a cream edge to interactive focus and prompts.',
          'highContrastPrompts',
          dialogState.settings.highContrastPrompts,
        ),
        settingSelect(
          'Difficulty',
          'Incoming health damage: Story 75%, Standard 100%, Challenging 125%.',
          'difficulty',
          dialogState.settings.difficulty,
          ['story', 'standard', 'challenging'],
        ),
        settingRange(
          'Shake Intensity',
          'Controls camera movement feedback.',
          'shakeIntensity',
          dialogState.settings.shakeIntensity,
          0,
          1,
        ),
        settingRange(
          'Flash Intensity',
          'Controls bright combat feedback.',
          'flashIntensity',
          dialogState.settings.flashIntensity,
          0,
          1,
        ),
        settingCheckbox(
          'Subtitles',
          'Shows important sound and music captions.',
          'subtitles',
          dialogState.settings.subtitles,
        ),
        settingCheckbox(
          'Damage Numbers',
          'Shows numeric combat damage feedback.',
          'damageNumbers',
          dialogState.settings.damageNumbers,
        ),
        settingSelect(
          'Sustained Actions',
          'Choose hold or toggle behavior for sustained controls.',
          'sustainedAction',
          dialogState.settings.sustainedAction,
          ['hold', 'toggle'],
        ),
        settingRange(
          'Master Volume',
          'Controls the complete mix.',
          'masterVolume',
          dialogState.settings.masterVolume,
          0,
          1,
        ),
        settingRange(
          'Music Volume',
          'Controls melodic and boss layers.',
          'musicVolume',
          dialogState.settings.musicVolume,
          0,
          1,
        ),
        settingRange(
          'SFX Volume',
          'Controls combat and interface cues.',
          'sfxVolume',
          dialogState.settings.sfxVolume,
          0,
          1,
        ),
        settingRange(
          'Ambience Volume',
          'Controls environmental sound beds.',
          'ambienceVolume',
          dialogState.settings.ambienceVolume,
          0,
          1,
        ),
        settingCheckbox(
          'Mute While Unfocused',
          'Silences audio when the game is in the background.',
          'muteWhenUnfocused',
          dialogState.settings.muteWhenUnfocused,
        ),
        persistence,
      );
      const apply = button('Apply settings', 'confirm-dialog', 'dialog-confirm', 'button--primary');
      apply.disabled = submitting;
      actions.append(cancel, apply);
      break;
    }
    case 'credits':
      heading.textContent = 'Credits';
      body.append(
        element(
          'p',
          undefined,
          'Rivenbloom world and interface are original work created for this project.',
        ),
        element('p', undefined, 'Built with Phaser 3, provided under the MIT License.'),
        element('p', undefined, 'Typography uses system typefaces.'),
        element(
          'p',
          undefined,
          'Original art was directed for Rivenbloom with OpenAI image generation; music, ambience, and effects are synthesized at runtime.',
        ),
      );
      actions.append(cancel);
      break;
    case 'import-preview': {
      heading.textContent = `Import into ${dialogState.label}?`;
      const list = element('dl', 'import-preview');
      definition(list, 'Area', dialogState.areaLabel);
      definition(list, 'Play time', dialogState.playTime);
      definition(list, 'Growth', dialogState.upgrades);
      const dateTerm = element('dt', undefined, 'Snapshot');
      const dateValue = element('dd');
      const time = element('time', undefined, dialogState.snapshot.label);
      time.dateTime = dialogState.snapshot.dateTime;
      dateValue.append(time);
      list.append(dateTerm, dateValue);
      body.append(list, element('p', 'menu-dialog__note', 'Review this preview before importing.'));
      const confirm = button('Import save', 'confirm-dialog', 'dialog-confirm', 'button--primary');
      confirm.disabled = submitting;
      actions.append(cancel, confirm);
      break;
    }
    case 'import-error':
      heading.textContent = `Could not import into ${dialogState.label}`;
      body.append(element('p', 'menu-dialog__warning', dialogState.message));
      actions.append(cancel);
      break;
    default:
      assertNever(dialogState);
  }

  if (submitting) {
    const status = element('p', 'menu-dialog__busy', 'Working…');
    status.setAttribute('role', 'status');
    body.append(status);
  }
  if (dialogError !== null) {
    const error = element('p', 'menu-dialog__warning', dialogError);
    error.setAttribute('role', 'alert');
    body.append(error);
  }
  dialog.append(heading, body, actions);
  return dialog;
}

function settingCheckbox(
  label: string,
  description: string,
  setting:
    'reducedMotion' | 'subtitles' | 'highContrastPrompts' | 'damageNumbers' | 'muteWhenUnfocused',
  checked: boolean,
): HTMLElement {
  const field = element('label', 'setting-field setting-field--toggle');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.dataset.setting = setting;
  input.dataset.focusId = `setting-${setting}`;
  const copy = element('span', 'setting-field__copy');
  copy.append(element('strong', undefined, label), element('small', undefined, description));
  field.append(input, copy);
  return field;
}

function textScaleField(value: number): HTMLElement {
  const field = element('label', 'setting-field');
  const label = element('span', 'setting-field__copy');
  label.append(
    element('strong', undefined, 'Text Scale'),
    element('small', undefined, 'Changes interface text immediately.'),
  );
  const select = document.createElement('select');
  select.dataset.setting = 'textScale';
  select.dataset.focusId = 'setting-text-scale';
  const options = [
    [0.75, '75%'],
    [0.9, '90%'],
    [1, '100%'],
    [1.15, '115%'],
    [1.25, '125%'],
    [1.3, '130%'],
    [1.5, '150%'],
    [2, '200%'],
  ] as const;
  for (const [scale, text] of options) {
    const option = document.createElement('option');
    option.value = String(scale);
    option.textContent = text;
    option.selected = scale === value;
    select.append(option);
  }
  field.append(label, select);
  return field;
}

function settingRange(
  labelCopy: string,
  description: string,
  setting:
    | 'shakeIntensity'
    | 'flashIntensity'
    | 'masterVolume'
    | 'musicVolume'
    | 'sfxVolume'
    | 'ambienceVolume',
  value: number,
  min: number,
  max: number,
): HTMLElement {
  const field = element('label', 'setting-field');
  const label = element('span', 'setting-field__copy');
  label.append(element('strong', undefined, labelCopy), element('small', undefined, description));
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = '0.05';
  input.value = String(value);
  input.dataset.setting = setting;
  input.dataset.focusId = `setting-${setting}`;
  field.append(label, input);
  return field;
}

function settingSelect(
  labelCopy: string,
  description: string,
  setting: 'difficulty' | 'sustainedAction',
  value: string,
  options: readonly string[],
): HTMLElement {
  const field = element('label', 'setting-field');
  const label = element('span', 'setting-field__copy');
  label.append(element('strong', undefined, labelCopy), element('small', undefined, description));
  const select = document.createElement('select');
  select.dataset.setting = setting;
  select.dataset.focusId = `setting-${setting}`;
  for (const option of options) {
    const control = document.createElement('option');
    control.value = option;
    control.textContent = `${option.charAt(0).toUpperCase()}${option.slice(1)}`;
    control.selected = option === value;
    select.append(control);
  }
  field.append(label, select);
  return field;
}

function definition(list: HTMLDListElement, term: string, value: string): void {
  list.append(element('dt', undefined, term), element('dd', undefined, value));
}

function badge(text: string, modifier: string): HTMLElement {
  return element('span', `badge ${modifier}`, text);
}

function importInput(
  slotId: SaveSlotId,
  slotLabel: string,
  focusId: string,
  label = 'Import save',
): HTMLElement {
  const wrapper = element('label', 'file-action');
  wrapper.append(element('span', undefined, label));
  const input = document.createElement('input');
  input.className = 'file-input';
  input.type = 'file';
  input.accept = '.json,application/json';
  input.dataset.slotId = slotId;
  input.dataset.focusId = focusId;
  input.setAttribute('aria-label', `${label} for ${slotLabel}`);
  wrapper.append(input);
  return wrapper;
}

function commandButton(
  label: string,
  command: TitleCommand,
  focusId: string,
  accessibleLabel?: string,
): HTMLButtonElement {
  const control = button(
    label,
    undefined,
    focusId,
    command.type === 'new-game' ? 'button--primary' : '',
  );
  control.dataset.command = command.type;
  if ('slotId' in command) control.dataset.slotId = command.slotId;
  if (accessibleLabel !== undefined) control.setAttribute('aria-label', accessibleLabel);
  return control;
}

function button(
  label: string,
  action: string | undefined,
  focusId: string,
  className = '',
): HTMLButtonElement {
  const control = document.createElement('button');
  control.type = 'button';
  control.className = className;
  control.textContent = label;
  control.dataset.focusId = focusId;
  if (action !== undefined) control.dataset.action = action;
  return control;
}

function readCommand(command: string, slotId: SaveSlotId | null): TitleCommand | null {
  switch (command) {
    case 'new-game':
    case 'load-slot':
    case 'delete-slot':
      return slotId === null ? null : { type: command, slotId };
    case 'open-settings':
    case 'open-credits':
      return { type: command };
    default:
      return null;
  }
}

function readSlotId(value: string | undefined): SaveSlotId | null {
  return value === 'slot-1' || value === 'slot-2' || value === 'slot-3' ? value : null;
}

function applySettings(root: HTMLElement, settings: SaveSettings): void {
  root.dataset.reducedMotion = String(settings.reducedMotion);
  root.dataset.highContrastPrompts = String(settings.highContrastPrompts);
  root.dataset.textScale = String(settings.textScale);
  root.style.setProperty('--user-text-scale', String(settings.textScale));
}

function isUnavailable(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return true;
  return (
    (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) &&
    element.disabled
  );
}

function slotNumber(slotId: SaveSlotId): number {
  return Number(slotId.at(-1));
}

function element<Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[Tag] {
  const created = document.createElement(tag);
  if (className !== undefined) created.className = className;
  if (text !== undefined) created.textContent = text;
  return created;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled menu state: ${String(value)}`);
}
