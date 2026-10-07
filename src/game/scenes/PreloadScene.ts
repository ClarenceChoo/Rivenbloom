import Phaser from 'phaser';

import { appServices } from '../core/AppServices';
import { SceneScope } from '../core/SceneScope';
import { gamepadUiActions } from '../input/GamepadUiNavigation';
import {
  createPreloadState,
  preloadProgress,
  preparePreloadRetry,
  recordPreloadOutcome,
  restartPreloadState,
  selectPendingAssets,
} from '../loading/PreloadState';
import type { PreloadManifest, PreloadManifestEntry, PreloadState } from '../loading/PreloadState';
import { updateDevBridge } from '../testing/devBridge';
import { AREA_BACKGROUND_KEYS } from '../data/artFrames';
import { SceneKeys } from './SceneKeys';

export const PRELOAD_MANIFEST = Object.freeze([
  {
    key: 'terrain-thorns',
    group: 'readable hazards',
    kind: 'image',
    url: '/assets/art/terrain/thorns.svg',
  },
  ...['wren-rest', 'brackenreach', 'singing-hollows', 'rootglass-reliquary', 'hollow-choir'].map(
    (area) => ({
      key: `terrain-${area}`,
      group: 'area terrain',
      kind: 'image' as const,
      url: `/assets/art/terrain/${area}.svg`,
    }),
  ),
  {
    key: 'rivenbloom-npc-sprites',
    group: 'village portraits',
    kind: 'image',
    url: '/assets/art/rivenbloom-npc-sprites-v2.png',
  },
  {
    key: 'rivenbloom-enemy-poses',
    group: 'enemy animation',
    kind: 'image',
    url: '/assets/art/rivenbloom-enemy-poses-v2.png',
  },
  ...['distant-roots', 'hanging-vines', 'foreground-boughs'].map((key) => ({
    key,
    group: 'botanical layers',
    kind: 'image' as const,
    url: `/assets/art/${key}.svg`,
  })),
  ...AREA_BACKGROUND_KEYS.map((key) => ({
    key,
    group: 'area paintings',
    kind: 'image' as const,
    url: `/assets/art/${key}.png`,
  })),
  ...['bolt', 'sigil', 'slash', 'impact'].map((kind) => ({
    key: `effect-${kind}`,
    group: 'combat illustration',
    kind: 'image' as const,
    url: `/assets/art/effect-${kind}.svg`,
  })),
  {
    key: 'rivenbloom-world-panorama',
    group: 'painted world',
    kind: 'image',
    url: '/assets/art/rivenbloom-world-panorama.png',
  },
  {
    key: 'rivenbloom-character-lineup',
    group: 'painted characters',
    kind: 'image',
    url: '/assets/art/rivenbloom-character-lineup.png',
  },
  {
    key: 'rivenbloom-mara-animation-sheet',
    group: 'Mara animation',
    kind: 'image',
    url: '/assets/art/rivenbloom-mara-animation-sheet.png',
  },
  {
    key: 'rivenbloom-mara-locomotion',
    group: 'Mara animation',
    kind: 'image',
    url: '/assets/art/rivenbloom-mara-locomotion.png',
  },
  {
    key: 'rivenbloom-terrain-strips',
    group: 'world terrain',
    kind: 'image',
    url: '/assets/art/rivenbloom-terrain-strips.png',
  },
  {
    key: 'rivenbloom-terrain-fill',
    group: 'world terrain',
    kind: 'image',
    url: '/assets/art/rivenbloom-terrain-fill.png',
  },
  {
    key: 'rivenbloom-world-atlas',
    group: 'world props and effects',
    kind: 'image',
    url: '/assets/art/rivenbloom-world-atlas.png',
  },
  {
    key: 'rivenbloom-ui-atlas',
    group: 'portraits and interface icons',
    kind: 'image',
    url: '/assets/art/rivenbloom-ui-atlas.png',
  },
]) satisfies PreloadManifest;

export class PreloadScene extends Phaser.Scene {
  private scope: SceneScope | null = null;
  private root: HTMLElement | null = null;
  private state: PreloadState = createPreloadState(PRELOAD_MANIFEST);
  private created = false;
  private focusFrame: number | null = null;

  public constructor() {
    super(SceneKeys.Preload);
  }

  public preload(): void {
    this.scope?.dispose();
    this.state = restartPreloadState(PRELOAD_MANIFEST);
    this.created = false;
    this.scope = this.createScope();
    const root = this.createOverlay();
    this.root = root;
    this.scope.add(() => {
      root.remove();
      if (this.root === root) this.root = null;
    });
    this.scope.add(() => {
      if (this.focusFrame !== null) cancelAnimationFrame(this.focusFrame);
      this.focusFrame = null;
    });

    const onFileComplete = (key: string) => this.record(key, 'loaded');
    const onFileError = (file: Phaser.Loader.File) => this.record(file.key, 'failed');
    const onComplete = () => {
      if (this.created) this.finishOrRenderFailure();
    };
    const onClick = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLButtonElement && target.dataset.action === 'retry-loading') {
        this.retry();
      }
    };
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, onFileComplete);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);
    this.load.on(Phaser.Loader.Events.COMPLETE, onComplete);
    root.addEventListener('click', onClick);
    this.scope.add(() => this.load.off(Phaser.Loader.Events.FILE_COMPLETE, onFileComplete));
    this.scope.add(() => this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError));
    this.scope.add(() => this.load.off(Phaser.Loader.Events.COMPLETE, onComplete));
    this.scope.add(() => root.removeEventListener('click', onClick));

    if (import.meta.env.DEV) updateDevBridge({ activeScene: SceneKeys.Preload });
    this.render();
    this.queue(selectPendingAssets(PRELOAD_MANIFEST, this.state));
  }

  public create(): void {
    this.created = true;
    this.finishOrRenderFailure();
  }

  public update(): void {
    if (this.root === null) return;
    const frame = appServices(this).get('inputService').sample(performance.now());
    if (!gamepadUiActions(frame).includes('confirm')) return;
    this.root.querySelector<HTMLButtonElement>('[data-action="retry-loading"]')?.click();
  }

  private createScope(): SceneScope {
    const scope = new SceneScope();
    const shutdown = () => scope.dispose();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, shutdown);
    scope.add(() => this.events.off(Phaser.Scenes.Events.SHUTDOWN, shutdown));
    return scope;
  }

  private createOverlay(): HTMLElement {
    const parent = this.game.canvas.parentElement;
    if (parent === null) throw new Error('The game stage is unavailable.');
    const root = document.createElement('section');
    root.className = 'scene-overlay preload-screen';
    root.setAttribute('aria-labelledby', 'preload-title');
    parent.append(root);
    return root;
  }

  private record(key: string, outcome: 'loaded' | 'failed'): void {
    this.state = recordPreloadOutcome(this.state, key, outcome);
    this.render();
  }

  private queue(entries: PreloadManifest): void {
    for (const entry of entries) this.queueEntry(entry);
  }

  private queueEntry(entry: PreloadManifestEntry): void {
    switch (entry.kind) {
      case 'image':
        this.load.image(entry.key, entry.url);
        return;
      case 'audio':
        this.load.audio(entry.key, entry.url);
        return;
      case 'json':
        this.load.json(entry.key, entry.url);
        return;
      default:
        assertNever(entry.kind);
    }
  }

  private retry(): void {
    this.state = preparePreloadRetry(this.state);
    const pending = selectPendingAssets(PRELOAD_MANIFEST, this.state);
    this.render();
    this.queue(pending);
    if (pending.length === 0) {
      this.finishOrRenderFailure();
      return;
    }
    this.load.start();
  }

  private finishOrRenderFailure(): void {
    const progress = preloadProgress(this.state);
    if (!progress.complete) {
      this.render();
      return;
    }
    if (!progress.successful) {
      this.render(true);
      if (this.focusFrame !== null) cancelAnimationFrame(this.focusFrame);
      this.focusFrame = requestAnimationFrame(() => {
        this.focusFrame = null;
        this.root?.querySelector<HTMLButtonElement>('[data-action="retry-loading"]')?.focus();
      });
      return;
    }
    this.scene.start(SceneKeys.Title);
  }

  private render(failure = false): void {
    if (this.root === null) return;
    const progress = preloadProgress(this.state);
    const panel = document.createElement('div');
    panel.className = 'preload-panel';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'FOLLOWING THE CHIMES';
    const heading = document.createElement('h1');
    heading.id = 'preload-title';
    heading.textContent = failure ? 'The path is obscured' : 'Opening the way';
    const status = document.createElement('p');
    status.className = failure ? 'preload-status preload-status--error' : 'preload-status';
    if (failure) status.setAttribute('role', 'alert');
    status.textContent = failure
      ? `Required ${progress.failedGroups.join(' and ')} assets did not load.`
      : progress.currentGroup === null
        ? 'The way is clear.'
        : `Preparing ${progress.currentGroup}.`;
    const meter = document.createElement('progress');
    meter.max = Math.max(progress.total, 1);
    meter.value = progress.total === 0 ? 1 : progress.completed;
    meter.setAttribute('aria-label', 'Loading progress');
    const count = document.createElement('p');
    count.className = 'preload-count';
    count.textContent = `${progress.completed}/${progress.total} · ${progress.percentage}%`;
    panel.append(eyebrow, heading, status, meter, count);
    if (failure) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'Asset details';
      const keys = document.createElement('p');
      keys.textContent = progress.failedKeys.join(', ');
      details.append(summary, keys);
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.dataset.action = 'retry-loading';
      retry.textContent = 'Retry loading';
      panel.append(details, retry);
    }
    this.root.replaceChildren(panel);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported preload asset type: ${String(value)}`);
}
