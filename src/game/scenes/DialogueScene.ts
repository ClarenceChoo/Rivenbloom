import Phaser from 'phaser';

import { appServices } from '../core/AppServices';
import { SceneScope } from '../core/SceneScope';
import { gamepadUiActions } from '../input/GamepadUiNavigation';
import type { SaveSettings } from '../saves/SaveSchema';
import type { WorldModalCommand, WorldModalState } from '../world/WorldModalController';
import { SceneKeys } from './SceneKeys';

export type DialogueScenePayload = Readonly<{
  state: WorldModalState;
  settings: SaveSettings;
}>;

type DialogueSemanticCommand =
  | Readonly<{
      kind: 'choose';
      choiceId: Extract<WorldModalCommand, { kind: 'choose' }>['choiceId'];
    }>
  | Readonly<{
      kind: 'purchase';
      offerId: Extract<WorldModalCommand, { kind: 'purchase' }>['offerId'];
    }>
  | Readonly<{ kind: 'close' }>;

export class DialogueScene extends Phaser.Scene {
  private state: WorldModalState | null = null;
  private root: HTMLElement | null = null;
  private controls: readonly HTMLButtonElement[] = Object.freeze([]);
  private renderCleanup: (() => void) | null = null;

  public constructor() {
    super(SceneKeys.Dialogue);
  }

  public create(payload: DialogueScenePayload): void {
    const scope = new SceneScope();
    const shutdown = () => scope.dispose();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, shutdown);
    scope.add(() => this.events.off(Phaser.Scenes.Events.SHUTDOWN, shutdown));
    const parent = this.game.canvas.parentElement;
    if (parent === null) throw new Error('The game stage is unavailable.');
    const root = document.createElement('section');
    root.className = 'world-modal-shell';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'world-modal-speaker');
    root.dataset.reducedMotion = String(payload.settings.reducedMotion);
    root.dataset.highContrastPrompts = String(payload.settings.highContrastPrompts);
    root.style.setProperty('--user-text-scale', String(payload.settings.textScale));
    parent.append(root);
    this.root = root;
    this.render(payload.state);

    const events = appServices(this).get('events');
    scope.add(
      events.on('world-modal-state', (state) => {
        if (state === null) {
          this.scene.stop();
          return;
        }
        this.render(state);
      }),
    );
    const keydown = (event: KeyboardEvent) => this.handleKeydown(event);
    root.addEventListener('keydown', keydown);
    scope.add(() => root.removeEventListener('keydown', keydown));
    scope.add(() => {
      this.renderCleanup?.();
      this.renderCleanup = null;
      this.controls = Object.freeze([]);
      this.state = null;
      this.root = null;
      root.remove();
    });
  }

  public update(): void {
    const controls = this.controls;
    if (controls.length === 0) return;
    const frame = appServices(this).get('inputService').sample(performance.now());
    for (const action of gamepadUiActions(frame)) {
      if (action === 'cancel') {
        this.dispatch({ kind: 'close' });
      } else if (action === 'confirm') {
        const active = document.activeElement;
        (active instanceof HTMLButtonElement && controls.includes(active)
          ? active
          : controls[0]
        )?.click();
      } else if (action === 'next' || action === 'increase') {
        this.moveFocus(1);
      } else if (action === 'previous' || action === 'decrease') {
        this.moveFocus(-1);
      }
    }
  }

  private render(state: WorldModalState): void {
    const root = this.root;
    if (root === null) return;
    this.renderCleanup?.();
    const abort = new AbortController();
    let focusFrame: number | null = null;
    this.renderCleanup = () => {
      abort.abort();
      if (focusFrame !== null) cancelAnimationFrame(focusFrame);
      focusFrame = null;
    };
    this.state = state;
    root.dataset.mode = state.mode;
    root.replaceChildren();
    const panel = document.createElement('article');
    panel.className = 'world-modal-panel seed-panel';
    const speaker = document.createElement('h2');
    speaker.id = 'world-modal-speaker';
    speaker.textContent = state.speaker;
    const copy = document.createElement('p');
    copy.className = 'world-modal-copy';
    copy.textContent = state.copy;
    panel.append(speaker, copy);
    if (state.error !== null) {
      const error = document.createElement('p');
      error.className = 'world-modal-error';
      error.setAttribute('role', 'alert');
      error.textContent = state.error;
      panel.append(error);
    }
    const actions = document.createElement('div');
    actions.className = 'world-modal-actions';
    const controls: HTMLButtonElement[] = [];
    for (const choice of state.choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = choice.text;
      button.addEventListener(
        'click',
        () => this.dispatch({ kind: 'choose', choiceId: choice.choiceId }),
        { signal: abort.signal },
      );
      actions.append(button);
      controls.push(button);
    }
    for (const offer of state.offers) {
      const offerRoot = document.createElement('article');
      offerRoot.className = 'world-modal-offer';
      const heading = document.createElement('h3');
      heading.textContent = offer.displayName;
      const description = document.createElement('p');
      description.textContent = offer.description;
      const price = document.createElement('p');
      price.className = 'world-modal-price';
      price.textContent = `${offer.price} Resin`;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = offer.available ? 'Purchase' : 'Try purchase';
      if (offer.reason !== null) button.setAttribute('aria-description', offer.reason);
      button.addEventListener(
        'click',
        () => this.dispatch({ kind: 'purchase', offerId: offer.offerId }),
        { signal: abort.signal },
      );
      offerRoot.append(heading, description, price, button);
      actions.append(offerRoot);
      controls.push(button);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = state.mode === 'shop' ? 'Leave shop' : 'Close';
    close.addEventListener('click', () => this.dispatch({ kind: 'close' }), {
      signal: abort.signal,
    });
    actions.append(close);
    controls.push(close);
    panel.append(actions);
    root.append(panel);
    this.controls = Object.freeze(controls);
    focusFrame = requestAnimationFrame(() => {
      focusFrame = null;
      controls[0]?.focus();
    });
  }

  private dispatch(command: DialogueSemanticCommand): void {
    const state = this.state;
    if (state === null) return;
    for (const control of this.controls) control.disabled = true;
    appServices(this)
      .get('events')
      .emit('world-modal-command', {
        ...command,
        sessionId: state.sessionId,
        revision: state.revision,
      } as WorldModalCommand);
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.dispatch({ kind: 'close' });
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.moveFocus(1);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.moveFocus(-1);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      this.moveFocus(event.shiftKey ? -1 : 1);
    }
  }

  private moveFocus(direction: -1 | 1): void {
    const enabled = this.controls.filter(({ disabled }) => !disabled);
    if (enabled.length === 0) return;
    const current = document.activeElement;
    const index = current instanceof HTMLButtonElement ? enabled.indexOf(current) : -1;
    enabled[(index + direction + enabled.length) % enabled.length]?.focus();
  }
}
