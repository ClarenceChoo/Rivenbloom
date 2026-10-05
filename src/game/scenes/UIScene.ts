import { controlsHelp, inputLabel } from '../ui/InputHelp';
import { applyGameSettings } from '../ui/dom/applyGameSettings';
import Phaser from 'phaser';

import { appServices } from '../core/AppServices';
import { SceneScope } from '../core/SceneScope';
import type { BossHealthEvent } from '../entities/bosses/BossEvents';
import type { WorldUiProjection } from '../world/WorldUiProjection';
import { SceneKeys } from './SceneKeys';

export class UIScene extends Phaser.Scene {
  private built = false;
  private root: HTMLElement | null = null;
  private projection: WorldUiProjection | null = null;
  private boss: BossHealthEvent | null = null;
  private caption: string | null = null;
  private captionTimer: Phaser.Time.TimerEvent | null = null;

  public constructor() {
    super(SceneKeys.UI);
  }

  public create(): void {
    const scope = new SceneScope();
    const shutdown = () => scope.dispose();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, shutdown);
    scope.add(() => this.events.off(Phaser.Scenes.Events.SHUTDOWN, shutdown));
    const parent = this.game.canvas.parentElement;
    if (parent === null) throw new Error('The game stage is unavailable.');
    const root = document.createElement('section');
    root.className = 'game-hud';
    root.setAttribute('aria-label', 'Gameplay status');
    parent.append(root);
    this.root = root;
    this.built = false;
    this.projection = null;
    this.boss = null;
    scope.add(() => {
      root.remove();
      if (this.root === root) this.root = null;
    });
    const events = appServices(this).get('events');
    scope.add(
      events.on('world-ui', (projection) => {
        this.projection = projection;
        this.boss = projection.boss;
        this.render();
      }),
    );
    scope.add(
      events.on('boss-health', (boss) => {
        this.boss = boss;
        this.render();
      }),
    );
    scope.add(
      events.on('audio-caption', ({ copy }) => {
        this.caption = copy;
        this.captionTimer?.remove(false);
        this.captionTimer = this.time.delayedCall(2_400, () => {
          this.caption = null;
          this.captionTimer = null;
          this.render();
        });
        this.render();
      }),
    );
    scope.add(() => this.captionTimer?.remove(false));
    this.render();
  }

  private render(): void {
    const root = this.root;
    const projection = this.projection;
    if (root === null) return;
    if (projection === null) {
      root.replaceChildren();
      return;
    }
    if (projection.settings !== undefined) applyGameSettings(root, projection.settings);
    if (!this.built) {
      const status = document.createElement('div');
      status.className = 'hud-vitals seed-panel';
      status.append(meter('Health', 0, 1, 'health', 6), meter('Mana', 0, 1, 'mana', 7));
      const details = document.createElement('div');
      details.className = 'hud-details';
      for (const key of ['art', 'resin', 'save']) {
        const value = document.createElement('span');
        value.dataset.hud = key;
        details.append(value);
      }
      const boss = document.createElement('div');
      boss.className = 'hud-boss seed-panel';
      const bossCue = document.createElement('p');
      bossCue.className = 'hud-boss-cue';
      boss.append(meter('The Pallid Cantor', 0, 420, 'boss', 4), bossCue);
      root.append(status, details);
      for (const key of ['location', 'prompt', 'objective', 'caption', 'guidance']) {
        const text = document.createElement('p');
        text.className = `hud-${key}`;
        text.dataset.hud = key;
        if (key === 'caption') text.setAttribute('role', 'status');
        root.append(text);
      }
      root.append(boss);
      this.built = true;
    }
    const text = (key: string, copy: string) => {
      const node = root.querySelector<HTMLElement>(`[data-hud="${key}"]`)!;
      if (node.textContent !== copy) node.textContent = copy;
      node.hidden = copy === '';
    };
    const updateMeter = (kind: string, label: string, current: number, max: number) => {
      const row = root.querySelector<HTMLElement>(`.hud-meter--${kind}`)!;
      const value = row.querySelector<HTMLElement>('.numbers')!;
      const copy = `${current}/${max}`;
      if (value.textContent !== copy) value.textContent = copy;
      const progress = row.querySelector('progress')!;
      if (progress.max !== max) progress.max = max;
      if (progress.value !== current) progress.value = current;
      const aria = `${label}: ${current} of ${max}`;
      if (progress.getAttribute('aria-label') !== aria) progress.setAttribute('aria-label', aria);
    };
    updateMeter('health', 'Health', projection.player.currentHealth, projection.player.maxHealth);
    updateMeter('mana', 'Mana', projection.player.currentMana, projection.player.maxMana);
    text('art', `Art: ${readable(projection.player.selectedAbilityId ?? 'lumen-bolt')}`);
    text('resin', `Resin: ${projection.player.currency}`);
    text(
      'save',
      `Save: ${projection.autosave === 'idle' ? 'Saved' : projection.autosave === 'session-only' ? 'Session only — export a backup' : readable(projection.autosave)}`,
    );
    text('location', `${projection.area.label} · ${projection.room.label}`);
    const input = appServices(this).get('inputService');
    text(
      'prompt',
      projection.prompt === null
        ? ''
        : `${inputLabel(input, projection.prompt === 'Climb' ? 'move-up' : 'interact')} · ${projection.prompt}`,
    );
    text('guidance', projection.room.roomId === 'wren-rest-square' ? controlsHelp(input) : '');
    text(
      'objective',
      (
        projection.quests.find((q) => q.questId === 'the-silent-bloom' && q.status === 'active') ??
        projection.quests.find((q) => q.status === 'active')
      )?.objective ?? 'The song has returned.',
    );
    text('caption', this.caption ?? '');
    const bossPanel = root.querySelector<HTMLElement>('.hud-boss')!;
    bossPanel.hidden = this.boss === null || !this.boss.visible;
    if (this.boss !== null)
      updateMeter('boss', this.boss.displayName, this.boss.currentHealth, this.boss.maxHealth);
    const bossCue = root.querySelector<HTMLElement>('.hud-boss-cue')!;
    bossCue.textContent =
      this.boss?.heartExposed === true
        ? 'Heart exposed · strike close with the Surveyor’s Edge'
        : this.boss !== null && this.boss.currentHealth <= 210
          ? 'Shell sealed · awaken both lenses with Resonant Pulse'
          : '';
  }
}

function meter(
  label: string,
  current: number,
  maximum: number,
  kind: string,
  iconIndex: number,
): HTMLElement {
  const row = document.createElement('div');
  row.className = `hud-meter hud-meter--${kind}`;
  const heading = document.createElement('span');
  heading.textContent = label;
  const value = document.createElement('span');
  value.className = 'numbers';
  value.textContent = `${current}/${maximum}`;
  const progress = document.createElement('progress');
  progress.max = maximum;
  progress.value = current;
  progress.setAttribute('aria-label', `${label}: ${current} of ${maximum}`);
  row.append(icon(iconIndex), heading, value, progress);
  return row;
}

function readable(value: string): string {
  return value
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function icon(index: number): HTMLElement {
  const item = document.createElement('span');
  item.className = 'ui-atlas-icon';
  item.setAttribute('aria-hidden', 'true');
  const column = index % 6;
  const row = Math.floor(index / 6);
  item.style.setProperty('--atlas-x', `${column * 20}%`);
  item.style.setProperty('--atlas-y', `${row * 50}%`);
  return item;
}
