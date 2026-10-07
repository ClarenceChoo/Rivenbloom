import Phaser from 'phaser';

import { appServices } from '../core/AppServices';
import { SceneScope } from '../core/SceneScope';
import { gamepadUiActions } from '../input/GamepadUiNavigation';
import { recordDevDeathReload, updateDevBridge } from '../testing/devBridge';
import { createTransitionActions } from '../title/TransitionActions';
import type { TitleTransitionPayload } from '../title/TitleController';
import { AreaTravelTransition } from '../world/AreaTravelTransition';
import type { AreaTravelPayload } from '../world/AreaTravelTransition';
import { EndingTransition } from '../world/EndingTransition';
import type { EndingPayload } from '../world/EndingTransition';
import { PlayerDeathTransition } from '../world/PlayerDeathTransition';
import type { PlayerDeathPayload } from '../world/PlayerDeathTransition';
import { SceneKeys } from './SceneKeys';

export class TransitionScene extends Phaser.Scene {
  private enterButton: HTMLButtonElement | null = null;
  private returnButton: HTMLButtonElement | null = null;

  public constructor() {
    super(SceneKeys.Transition);
  }

  public create(payload: TransitionPayload): void {
    if (payload.kind === 'ending') {
      this.createEnding(payload.ending);
      return;
    }
    if (payload.kind === 'area-transition') {
      this.createAreaTravel(payload.travel);
      return;
    }
    if (payload.kind === 'player-death') {
      this.createDeath(payload.death);
      return;
    }
    this.createWorldEntry(payload.entry);
  }

  private createEnding(payload: EndingPayload): void {
    const scope = new SceneScope();
    const shutdown = () => scope.dispose();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, shutdown);
    scope.add(() => this.events.off(Phaser.Scenes.Events.SHUTDOWN, shutdown));
    const parent = this.game.canvas.parentElement;
    if (parent === null) throw new Error('The game stage is unavailable.');
    const root = document.createElement('section');
    root.className = 'scene-overlay transition-screen ending-screen';
    root.setAttribute('aria-labelledby', 'ending-title');
    root.dataset.reducedMotion = String(payload.settings.reducedMotion);
    root.dataset.highContrastPrompts = String(payload.settings.highContrastPrompts);
    root.style.setProperty('--user-text-scale', String(payload.settings.textScale));
    const panel = document.createElement('div');
    panel.className = 'transition-panel ending-panel seed-panel';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'THE SILENT BLOOM';
    const heading = document.createElement('h1');
    heading.id = 'ending-title';
    heading.textContent = 'The song returns';
    const status = document.createElement('p');
    status.className = 'transition-message';
    status.setAttribute('role', 'status');
    status.textContent = 'Binding the final thread…';
    const story = document.createElement('div');
    story.className = 'ending-copy';
    story.hidden = true;
    const first = document.createElement('p');
    first.textContent =
      "At dawn, Wren's Rest wakes to a sound it had almost forgotten: rootglass chimes answering the wind.";
    const second = document.createElement('p');
    second.textContent =
      'Mara plants the recovered bloom beside the village seed-lantern. Its first new petal opens toward every road still waiting to be heard.';
    const credits = document.createElement('section');
    credits.className = 'ending-credits';
    const creditsHeading = document.createElement('h2');
    creditsHeading.textContent = 'Credits';
    const creditsCopy = document.createElement('p');
    creditsCopy.textContent =
      'Rivenbloom is an original world, story, visual identity, and soundtrack created for this project. Built with Phaser 3 and TypeScript.';
    credits.append(creditsHeading, creditsCopy);
    story.append(first, second, credits);
    const actions = document.createElement('div');
    actions.className = 'transition-actions';
    actions.hidden = true;
    const continueButton = document.createElement('button');
    continueButton.type = 'button';
    continueButton.className = 'button--primary';
    continueButton.textContent = 'Continue exploring';
    const titleButton = document.createElement('button');
    titleButton.type = 'button';
    titleButton.textContent = 'Return to title';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Retry final save';
    retry.hidden = true;
    actions.append(continueButton, titleButton, retry);
    panel.append(eyebrow, heading, status, story, actions);
    root.append(panel);
    parent.append(root);
    this.enterButton = continueButton;
    this.returnButton = titleButton;

    let focusFrame: number | null = null;
    const focus = (control: HTMLButtonElement) => {
      if (focusFrame !== null) cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => {
        focusFrame = null;
        control.focus({ preventScroll: true });
      });
    };
    const transition = new EndingTransition(appServices(this).get('saveService'), (snapshot) => {
      if (snapshot.status === 'flushing') {
        status.textContent = 'Binding the final thread…';
        retry.hidden = true;
        actions.hidden = true;
      } else if (snapshot.status === 'failed') {
        status.textContent = 'The ending is ready, but its final save could not be confirmed.';
        actions.hidden = false;
        continueButton.hidden = true;
        titleButton.hidden = true;
        retry.hidden = false;
        focus(retry);
      } else if (snapshot.status === 'complete') {
        status.textContent = 'Journey complete';
        story.hidden = false;
        actions.hidden = false;
        continueButton.hidden = false;
        titleButton.hidden = false;
        retry.hidden = true;
        focus(continueButton);
      }
    });
    const continueJourney = () =>
      this.scene.start(SceneKeys.World, {
        mode: 'load',
        slotId: payload.slotId,
        settings: payload.settings,
      } satisfies TitleTransitionPayload);
    const returnToTitle = () => this.scene.start(SceneKeys.Title);
    const retrySave = () => void transition.retry();
    continueButton.addEventListener('click', continueJourney);
    titleButton.addEventListener('click', returnToTitle);
    retry.addEventListener('click', retrySave);
    scope.add(() => continueButton.removeEventListener('click', continueJourney));
    scope.add(() => titleButton.removeEventListener('click', returnToTitle));
    scope.add(() => retry.removeEventListener('click', retrySave));
    scope.add(() => {
      if (focusFrame !== null) cancelAnimationFrame(focusFrame);
      transition.dispose();
      root.remove();
      this.enterButton = null;
      this.returnButton = null;
    });
    void transition.start(payload);
  }

  private createWorldEntry(payload: TitleTransitionPayload): void {
    const scope = new SceneScope();
    const shutdown = () => scope.dispose();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, shutdown);
    scope.add(() => this.events.off(Phaser.Scenes.Events.SHUTDOWN, shutdown));
    const parent = this.game.canvas.parentElement;
    if (parent === null) throw new Error('The game stage is unavailable.');
    const root = document.createElement('section');
    root.className = 'scene-overlay transition-screen';
    root.setAttribute('aria-labelledby', 'transition-title');
    root.dataset.reducedMotion = String(payload.settings.reducedMotion);
    root.dataset.highContrastPrompts = String(payload.settings.highContrastPrompts);
    root.style.setProperty('--user-text-scale', String(payload.settings.textScale));
    const atmosphere = document.createElement('div');
    atmosphere.className = 'scene-overlay__atmosphere';
    atmosphere.setAttribute('aria-hidden', 'true');
    const rain = document.createElement('div');
    rain.className = 'scene-overlay__rain';
    const roots = document.createElement('div');
    roots.className = 'scene-overlay__roots';
    const glow = document.createElement('div');
    glow.className = 'scene-overlay__glow';
    atmosphere.append(rain, roots, glow);
    const panel = document.createElement('div');
    panel.className = 'transition-panel seed-panel';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = payload.mode === 'new' ? 'A NEW THREAD' : 'THE THREAD RESUMES';
    const heading = document.createElement('h1');
    heading.id = 'transition-title';
    heading.textContent = "Wren's Rest";
    const message = document.createElement('p');
    message.className = 'transition-message';
    message.textContent = 'The listening chimes have fallen silent.';
    const note = document.createElement('p');
    note.className = 'transition-note';
    note.textContent = 'Enter only when you are ready. Returning leaves this journey untouched.';
    const actionsRoot = document.createElement('div');
    actionsRoot.className = 'transition-actions';
    const enterButton = document.createElement('button');
    enterButton.type = 'button';
    enterButton.className = 'button--primary';
    enterButton.textContent = "Enter Wren's Rest";
    const returnButton = document.createElement('button');
    returnButton.type = 'button';
    returnButton.textContent = 'Return to title';
    actionsRoot.append(enterButton, returnButton);
    this.enterButton = enterButton;
    this.returnButton = returnButton;
    panel.append(eyebrow, heading, message, note, actionsRoot);
    root.append(atmosphere, panel);
    parent.append(root);
    const disableActions = () => {
      enterButton.disabled = true;
      returnButton.disabled = true;
    };
    const actions = createTransitionActions(payload, {
      onEnter: (unchangedPayload) => {
        disableActions();
        this.scene.start(SceneKeys.World, unchangedPayload);
      },
      onReturn: () => {
        disableActions();
        this.scene.start(SceneKeys.Title);
      },
    });
    const enterWorld = () => actions.enter();
    const returnToTitle = () => actions.returnToTitle();
    enterButton.addEventListener('click', enterWorld);
    returnButton.addEventListener('click', returnToTitle);
    const focusFrame = requestAnimationFrame(() => enterButton.focus());
    scope.add(() => cancelAnimationFrame(focusFrame));
    scope.add(() => enterButton.removeEventListener('click', enterWorld));
    scope.add(() => returnButton.removeEventListener('click', returnToTitle));
    scope.add(() => {
      if (this.enterButton === enterButton) this.enterButton = null;
      if (this.returnButton === returnButton) this.returnButton = null;
    });
    scope.add(() => root.remove());
    if (import.meta.env.DEV) {
      updateDevBridge({
        activeScene: SceneKeys.Transition,
        transition: { mode: payload.mode, slotId: payload.slotId },
        world: null,
        player: null,
        camera: null,
      });
    }
  }

  private createDeath(payload: PlayerDeathPayload): void {
    const scope = new SceneScope();
    const shutdown = () => scope.dispose();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, shutdown);
    scope.add(() => this.events.off(Phaser.Scenes.Events.SHUTDOWN, shutdown));
    const parent = this.game.canvas.parentElement;
    if (parent === null) throw new Error('The game stage is unavailable.');
    const root = document.createElement('section');
    root.className = 'scene-overlay transition-screen death-transition-screen';
    root.setAttribute('aria-labelledby', 'transition-title');
    root.dataset.reducedMotion = String(payload.settings.reducedMotion);
    root.dataset.highContrastPrompts = String(payload.settings.highContrastPrompts);
    root.style.setProperty('--user-text-scale', String(payload.settings.textScale));
    const panel = document.createElement('div');
    panel.className = 'transition-panel seed-panel';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'THE THREAD REWINDS';
    const heading = document.createElement('h1');
    heading.id = 'transition-title';
    heading.textContent = 'Mara returns to the light';
    const message = document.createElement('p');
    message.className = 'transition-message';
    message.setAttribute('aria-live', 'polite');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'button--primary';
    retry.textContent = 'Retry return';
    retry.hidden = true;
    panel.append(eyebrow, heading, message, retry);
    root.append(panel);
    parent.append(root);
    this.enterButton = retry;
    this.returnButton = null;
    let focusFrame: number | null = null;
    const cancelFocusFrame = () => {
      if (focusFrame !== null) cancelAnimationFrame(focusFrame);
      focusFrame = null;
    };
    const transition = new PlayerDeathTransition(
      appServices(this).get('saveService'),
      (entry) => {
        if (import.meta.env.DEV) recordDevDeathReload(entry.slotId);
        this.scene.start(SceneKeys.World, entry);
      },
      (snapshot) => {
        if (snapshot.status === 'flushing') {
          cancelFocusFrame();
          message.textContent = `Gathering the last safe thread at ${payload.checkpointLabel}…`;
          retry.hidden = true;
        } else if (snapshot.status === 'failed') {
          cancelFocusFrame();
          message.textContent =
            'The restored journey could not be confirmed. Your return is ready to retry.';
          retry.hidden = false;
          focusFrame = requestAnimationFrame(() => {
            focusFrame = null;
            retry.focus();
          });
        } else if (snapshot.status === 'complete') {
          cancelFocusFrame();
          message.textContent = 'The seed-lantern answers.';
          retry.hidden = true;
        }
      },
    );
    const retryFlush = () => void transition.retry();
    retry.addEventListener('click', retryFlush);
    scope.add(() => retry.removeEventListener('click', retryFlush));
    scope.add(cancelFocusFrame);
    scope.add(() => transition.dispose());
    scope.add(() => {
      if (this.enterButton === retry) this.enterButton = null;
      root.remove();
    });
    if (import.meta.env.DEV) {
      updateDevBridge({
        activeScene: SceneKeys.Transition,
        transition: { mode: 'load', slotId: payload.slotId },
        world: null,
        player: null,
        camera: null,
      });
    }
    void transition.start(payload);
  }

  private createAreaTravel(payload: AreaTravelPayload): void {
    const scope = new SceneScope();
    const shutdown = () => scope.dispose();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, shutdown);
    scope.add(() => this.events.off(Phaser.Scenes.Events.SHUTDOWN, shutdown));
    const parent = this.game.canvas.parentElement;
    if (parent === null) throw new Error('The game stage is unavailable.');
    const root = document.createElement('section');
    root.className = 'scene-overlay transition-screen area-transition-screen';
    root.setAttribute('aria-labelledby', 'area-transition-title');
    root.dataset.reducedMotion = String(payload.settings.reducedMotion);
    root.dataset.highContrastPrompts = String(payload.settings.highContrastPrompts);
    root.style.setProperty('--user-text-scale', String(payload.settings.textScale));
    const panel = document.createElement('div');
    panel.className = 'transition-panel seed-panel';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'THE PATH UNFURLS';
    const heading = document.createElement('h1');
    heading.id = 'area-transition-title';
    heading.textContent = payload.targetLabel;
    const message = document.createElement('p');
    message.className = 'transition-message';
    message.setAttribute('aria-live', 'polite');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'button--primary';
    retry.textContent = 'Retry crossing';
    retry.hidden = true;
    panel.append(eyebrow, heading, message, retry);
    root.append(panel);
    parent.append(root);
    this.enterButton = retry;
    this.returnButton = null;
    let focusFrame: number | null = null;
    const cancelFocusFrame = () => {
      if (focusFrame !== null) cancelAnimationFrame(focusFrame);
      focusFrame = null;
    };
    const transition = new AreaTravelTransition(
      appServices(this).get('saveService'),
      (entry) => this.scene.start(SceneKeys.World, entry),
      (snapshot) => {
        if (snapshot.status === 'flushing') {
          cancelFocusFrame();
          message.textContent = `Carrying the latest thread from ${payload.sourceLabel}…`;
          retry.hidden = true;
        } else if (snapshot.status === 'failed') {
          cancelFocusFrame();
          message.textContent =
            'The crossing could not be confirmed. Your journey is ready to retry.';
          retry.hidden = false;
          focusFrame = requestAnimationFrame(() => {
            focusFrame = null;
            retry.focus();
          });
        } else if (snapshot.status === 'complete') {
          cancelFocusFrame();
          message.textContent = `${payload.targetLabel} answers.`;
          retry.hidden = true;
        }
      },
    );
    const retryFlush = () => void transition.retry();
    retry.addEventListener('click', retryFlush);
    scope.add(() => retry.removeEventListener('click', retryFlush));
    scope.add(cancelFocusFrame);
    scope.add(() => transition.dispose());
    scope.add(() => {
      if (this.enterButton === retry) this.enterButton = null;
      root.remove();
    });
    if (import.meta.env.DEV) {
      updateDevBridge({
        activeScene: SceneKeys.Transition,
        transition: { mode: 'load', slotId: payload.slotId },
        world: null,
        player: null,
        camera: null,
      });
    }
    void transition.start(payload);
  }

  public update(): void {
    const enterButton = this.enterButton;
    const returnButton = this.returnButton;
    if (enterButton === null) return;
    const frame = appServices(this).get('inputService').sample(performance.now());
    for (const action of gamepadUiActions(frame)) {
      if (action === 'cancel') {
        returnButton?.click();
      } else if (action === 'confirm') {
        const active = document.activeElement;
        (returnButton !== null && active === returnButton ? returnButton : enterButton).click();
      } else if (
        action === 'next' ||
        action === 'previous' ||
        action === 'increase' ||
        action === 'decrease'
      ) {
        (document.activeElement === enterButton && returnButton !== null
          ? returnButton
          : enterButton
        ).focus();
      }
    }
  }
}

export type TransitionPayload =
  | Readonly<{ kind: 'world-entry'; entry: TitleTransitionPayload }>
  | Readonly<{ kind: 'player-death'; death: PlayerDeathPayload }>
  | Readonly<{ kind: 'area-transition'; travel: AreaTravelPayload }>
  | Readonly<{ kind: 'ending'; ending: EndingPayload }>;
