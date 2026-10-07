import { controlsHelp } from '../ui/InputHelp';
import { equipmentSlotId, itemId } from '../core/StableId';
import type { PlayerItemCommand } from '../world/PlayerItemActions';
import { applyGameSettings } from '../ui/dom/applyGameSettings';
import { GamepadFormNavigation } from '../ui/dom/GamepadFormNavigation';
import Phaser from 'phaser';

import { appServices } from '../core/AppServices';
import { SceneScope } from '../core/SceneScope';
import { gamepadUiActions } from '../input/GamepadUiNavigation';
import type { InputAction } from '../input/InputActions';
import type { SaveSettings } from '../saves/SaveSchema';
import type { UiSessionProjection } from '../world/WorldUiProjection';
import { SceneKeys } from './SceneKeys';

export type MenuCommand =
  | PlayerItemCommand
  | Readonly<{ kind: 'return-title' }>
  | Readonly<{ kind: 'close' }>
  | Readonly<{ kind: 'update-settings'; settings: SaveSettings }>
  | Readonly<{ kind: 'rebind-key'; action: InputAction; code: string }>;

export type MenuBindingResult = Readonly<{
  kind: 'applied' | 'conflict' | 'failed';
  action: InputAction;
  copy: string;
}>;

export type MenuScenePayload = Readonly<{
  projection: UiSessionProjection;
  settings: SaveSettings;
}>;

type MenuTab = 'map' | 'inventory' | 'equipment' | 'journal' | 'settings';

export class MenuScene extends Phaser.Scene {
  private readonly formNavigation = new GamepadFormNavigation();
  private root: HTMLElement | null = null;
  private payload: MenuScenePayload | null = null;
  private tab: MenuTab = 'map';
  private actionMessage = '';
  private bindingMessage: string | null = null;
  private cancelBindingCapture: (() => void) | null = null;

  public constructor() {
    super(SceneKeys.Menu);
  }

  public create(payload: MenuScenePayload): void {
    this.payload = payload;
    this.tab = 'map';
    const scope = new SceneScope();
    const shutdown = () => scope.dispose();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, shutdown);
    scope.add(() => this.events.off(Phaser.Scenes.Events.SHUTDOWN, shutdown));
    const parent = this.game.canvas.parentElement;
    if (parent === null) throw new Error('The game stage is unavailable.');
    const root = document.createElement('section');
    root.className = 'pause-menu scene-overlay';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'pause-menu-title');
    parent.append(root);
    this.root = root;
    applyGameSettings(root, payload.settings);
    scope.add(() => {
      root.remove();
      if (this.root === root) this.root = null;
    });
    const onClick = (event: Event) => {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button');
      const action = button?.dataset.action;
      if (action === 'close-menu') this.close();
      if (action === 'return-title') {
        root.inert = true;
        appServices(this).get('events').emit('menu-command', { kind: 'return-title' });
      }
      if (action?.startsWith('use:') && this.payload !== null)
        appServices(this)
          .get('events')
          .emit('menu-command', {
            kind: 'use-item',
            itemId: itemId(action.slice(4)),
            revision: this.payload.projection.revision,
          });
      if (action?.startsWith('equip:') && this.payload !== null) {
        const [, id, slot] = action.split(':');
        if (id && slot)
          appServices(this)
            .get('events')
            .emit('menu-command', {
              kind: 'equip-item',
              itemId: itemId(id),
              slot: equipmentSlotId(slot),
              revision: this.payload.projection.revision,
            });
      }
      if (action?.startsWith('unequip:') && this.payload !== null)
        appServices(this)
          .get('events')
          .emit('menu-command', {
            kind: 'unequip-item',
            slot: equipmentSlotId(action.slice(8)),
            revision: this.payload.projection.revision,
          });
      if (action?.startsWith('tab:')) {
        this.tab = action.slice(4) as MenuTab;
        this.render();
      }
      if (action?.startsWith('rebind:')) {
        this.beginBindingCapture(action.slice(7) as InputAction);
      }
    };
    root.addEventListener('click', onClick);
    scope.add(() => root.removeEventListener('click', onClick));
    scope.add(
      appServices(this)
        .get('events')
        .on('menu-binding-result', (result) => {
          this.bindingMessage = result.copy;
          this.render();
        }),
    );
    scope.add(
      appServices(this)
        .get('events')
        .on('world-ui', (projection) => {
          if (this.payload === null) return;
          this.payload = {
            ...this.payload,
            projection,
            settings: projection.settings ?? this.payload.settings,
          };
          applyGameSettings(root, this.payload.settings);
          if (this.tab === 'inventory' || this.tab === 'equipment') this.render();
        }),
    );
    scope.add(
      appServices(this)
        .get('events')
        .on('menu-action-result', (copy) => {
          root.inert = false;
          this.actionMessage = copy;
          this.render();
        }),
    );
    scope.add(() => this.cancelBindingCapture?.());
    this.render();
    requestAnimationFrame(() =>
      root.querySelector<HTMLButtonElement>('[data-action="close-menu"]')?.focus(),
    );
  }

  public update(): void {
    const root = this.root;
    if (root === null || root.inert) return;
    const frame = appServices(this).get('inputService').sample(performance.now());
    const actions = gamepadUiActions(frame);
    if (frame.actions.pause.pressed || actions.includes('cancel')) {
      this.close();
      return;
    }
    this.formNavigation.update(root, frame);
  }

  private close(): void {
    if (this.root?.inert) return;
    this.cancelBindingCapture?.();
    appServices(this).get('events').emit('menu-command', { kind: 'close' });
    this.scene.stop();
  }

  private render(): void {
    const root = this.root;
    const payload = this.payload;
    if (root === null || payload === null) return;
    const focused = root.contains(document.activeElement)
      ? (document.activeElement as HTMLElement).dataset.action
      : undefined;
    const shell = document.createElement('div');
    shell.className = 'pause-menu__shell seed-panel';
    const header = document.createElement('header');
    const title = document.createElement('h1');
    title.id = 'pause-menu-title';
    title.textContent = 'Wayfinder Ledger';
    const close = button('Resume', 'close-menu');
    header.append(title, close, button('Return to title', 'return-title'));
    const tabs = document.createElement('nav');
    tabs.className = 'pause-menu__tabs';
    tabs.setAttribute('aria-label', 'Pause menu sections');
    for (const tab of ['map', 'inventory', 'equipment', 'journal', 'settings'] as const) {
      const control = button(capitalize(tab), `tab:${tab}`);
      control.setAttribute('aria-pressed', String(tab === this.tab));
      tabs.append(control);
    }
    const panel = document.createElement('div');
    panel.className = 'pause-menu__panel';
    panel.append(this.panelFor(payload));
    if (this.actionMessage) {
      const message = document.createElement('p');
      message.setAttribute('role', 'status');
      message.textContent = this.actionMessage;
      panel.prepend(message);
    }
    shell.append(header, tabs, panel);
    root.replaceChildren(shell);
    if (focused !== undefined) {
      const controls = [...root.querySelectorAll<HTMLButtonElement>('button')];
      (controls.find((control) => control.dataset.action === focused) ?? controls[0])?.focus();
    }
  }

  private panelFor(payload: MenuScenePayload): HTMLElement {
    if (this.tab === 'map') return mapPanel(payload.projection);
    if (this.tab === 'inventory') return inventoryPanel(payload.projection);
    if (this.tab === 'equipment') return equipmentPanel(payload.projection);
    if (this.tab === 'journal') return journalPanel(payload.projection);
    return this.settingsPanel(payload.settings);
  }

  private settingsPanel(settings: SaveSettings): HTMLElement {
    const form = document.createElement('form');
    form.className = 'settings-grid';
    form.append(
      selectField('Difficulty', 'difficulty', settings.difficulty, [
        'story',
        'standard',
        'challenging',
      ]),
      checkboxField('Reduced motion', 'reducedMotion', settings.reducedMotion),
      rangeField('Shake intensity', 'shakeIntensity', settings.shakeIntensity, 0, 1, 0.05),
      rangeField('Flash intensity', 'flashIntensity', settings.flashIntensity, 0, 1, 0.05),
      checkboxField('Subtitles', 'subtitles', settings.subtitles),
      rangeField('Text scale', 'textScale', settings.textScale, 0.75, 2, 0.05),
      checkboxField('High-contrast prompts', 'highContrastPrompts', settings.highContrastPrompts),
      checkboxField('Damage numbers', 'damageNumbers', settings.damageNumbers),
      selectField('Sustained actions', 'sustainedAction', settings.sustainedAction, [
        'hold',
        'toggle',
      ]),
      rangeField('Master volume', 'masterVolume', settings.masterVolume, 0, 1, 0.05),
      rangeField('Music volume', 'musicVolume', settings.musicVolume, 0, 1, 0.05),
      rangeField('SFX volume', 'sfxVolume', settings.sfxVolume, 0, 1, 0.05),
      rangeField('Ambience volume', 'ambienceVolume', settings.ambienceVolume, 0, 1, 0.05),
      checkboxField('Mute while unfocused', 'muteWhenUnfocused', settings.muteWhenUnfocused),
    );
    const controls = document.createElement('p');
    controls.className = 'settings-controls-note';
    controls.textContent = controlsHelp(appServices(this).get('inputService'));
    const bindings = this.bindingPanel();
    const apply = button('Apply settings', 'apply-settings');
    apply.addEventListener('click', () => {
      const data = new FormData(form);
      const next: SaveSettings = Object.freeze({
        difficulty: value(data, 'difficulty') as SaveSettings['difficulty'],
        reducedMotion: data.has('reducedMotion'),
        shakeIntensity: numberValue(data, 'shakeIntensity'),
        flashIntensity: numberValue(data, 'flashIntensity'),
        subtitles: data.has('subtitles'),
        textScale: numberValue(data, 'textScale'),
        highContrastPrompts: data.has('highContrastPrompts'),
        damageNumbers: data.has('damageNumbers'),
        sustainedAction: value(data, 'sustainedAction') as SaveSettings['sustainedAction'],
        masterVolume: numberValue(data, 'masterVolume'),
        musicVolume: numberValue(data, 'musicVolume'),
        sfxVolume: numberValue(data, 'sfxVolume'),
        ambienceVolume: numberValue(data, 'ambienceVolume'),
        muteWhenUnfocused: data.has('muteWhenUnfocused'),
      });
      appServices(this)
        .get('events')
        .emit('menu-command', { kind: 'update-settings', settings: next });
    });
    const difficulty = document.createElement('p');
    difficulty.textContent =
      'Incoming damage: Story 75% · Standard 100% · Challenging 125%. Rewards and puzzles stay the same.';
    form.append(difficulty, bindings, controls, apply);
    return form;
  }

  private bindingPanel(): HTMLElement {
    const panel = document.createElement('section');
    panel.className = 'binding-panel';
    const heading = document.createElement('h3');
    heading.textContent = 'Keyboard bindings';
    const list = document.createElement('div');
    list.className = 'binding-list';
    const input = appServices(this).get('inputService');
    for (const action of REBINDABLE_ACTIONS) {
      const row = document.createElement('div');
      const label = document.createElement('span');
      label.textContent = capitalize(action.replaceAll('-', ' '));
      const key = input.getBindings(action).find((binding) => binding.kind === 'keyboard')?.code;
      const control = button(key === undefined ? 'Unbound' : readableKey(key), `rebind:${action}`);
      control.setAttribute(
        'aria-label',
        `Rebind ${label.textContent}; current key ${control.textContent}`,
      );
      row.append(label, control);
      list.append(row);
    }
    panel.append(heading, list);
    if (this.bindingMessage !== null) {
      const message = document.createElement('p');
      message.className = 'binding-message';
      message.setAttribute('role', 'status');
      message.textContent = this.bindingMessage;
      panel.append(message);
    }
    return panel;
  }

  private beginBindingCapture(action: InputAction): void {
    this.cancelBindingCapture?.();
    this.bindingMessage = `Press a new key for ${action.replaceAll('-', ' ')}. Escape cancels.`;
    this.render();
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.code === 'Escape') {
        finish();
        this.bindingMessage = 'Rebinding cancelled.';
        this.render();
        return;
      }
      if (
        ['AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight'].includes(
          event.code,
        )
      ) {
        return;
      }
      finish();
      appServices(this).get('events').emit('menu-command', {
        kind: 'rebind-key',
        action,
        code: event.code,
      });
    };
    const finish = () => {
      globalThis.removeEventListener('keydown', onKey, true);
      if (this.cancelBindingCapture === finish) this.cancelBindingCapture = null;
    };
    this.cancelBindingCapture = finish;
    globalThis.addEventListener('keydown', onKey, true);
  }
}

const REBINDABLE_ACTIONS = Object.freeze([
  'move-left',
  'move-right',
  'move-up',
  'move-down',
  'jump',
  'attack-light',
  'attack-heavy',
  'block',
  'dash',
  'cast',
  'cycle-ability',
  'interact',
  'pause',
] satisfies readonly InputAction[]);

function mapPanel(projection: UiSessionProjection): HTMLElement {
  const panel = document.createElement('section');
  const heading = document.createElement('h2');
  heading.textContent = 'Discovered paths';
  const graph = document.createElement('div');
  graph.className = 'room-map';
  const nodes = projection.map?.nodes ?? [];
  const edges = projection.map?.edges ?? [];
  const width = Math.max(220, ...nodes.map((node) => node.x + 110));
  const height = Math.max(90, ...nodes.map((node) => node.y + 45));
  graph.style.width = `${width}px`;
  graph.style.height = `${height}px`;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('aria-hidden', 'true');
  for (const edge of edges) {
    const from = nodes.find((node) => node.id === edge.from);
    const to = nodes.find((node) => node.id === edge.to);
    if (!from || !to) continue;
    const line = document.createElementNS(svg.namespaceURI, 'line');
    for (const [key, value] of Object.entries({ x1: from.x, y1: from.y, x2: to.x, y2: to.y }))
      line.setAttribute(key, String(value));
    line.setAttribute('stroke', edge.locked ? '#d78c72' : '#a3b794');
    if (edge.locked) line.setAttribute('stroke-dasharray', '6 5');
    svg.append(line);
  }
  graph.append(svg);
  for (const entry of nodes) {
    const node = document.createElement('p');
    node.className = 'map-node';
    node.dataset.current = String(entry.current);
    node.style.left = `${entry.x}px`;
    node.style.top = `${entry.y}px`;
    const label = document.createElement('strong');
    label.textContent = entry.label;
    const detail = document.createElement('small');
    detail.textContent = `${entry.current ? 'You are here' : ''}${entry.checkpoint ? ' · Seed-Lantern' : ''}${entry.objective ? ' · Quest' : ''}`;
    node.append(label, detail);
    graph.append(node);
  }
  const scroll = document.createElement('div');
  scroll.className = 'room-map-scroll';
  scroll.tabIndex = 0;
  scroll.setAttribute('aria-label', 'Discovered room connections');
  scroll.append(graph);
  const legend = document.createElement('p');
  legend.textContent =
    'Solid paths are open; dashed paths are locked. Unexplored rooms appear as you discover them.';
  const exits = document.createElement('ul');
  for (const exit of projection.map?.unexploredExits ?? []) {
    const item = document.createElement('li');
    item.textContent = `${nodes.find((node) => node.id === exit.from)?.label ?? 'Known room'} → Unexplored exit at ${exit.position}`;
    exits.append(item);
  }
  panel.append(heading, scroll, legend, exits);
  return panel;
}

function inventoryPanel(projection: UiSessionProjection): HTMLElement {
  const panel = document.createElement('section');
  const heading = document.createElement('h2');
  heading.textContent = `Inventory · ${projection.player.currency} resin`;
  const list = document.createElement('ul');
  list.className = 'ledger-list';
  for (const item of projection.inventory) {
    const row = document.createElement('li');
    row.innerHTML = `<strong>${escapeText(item.displayName)}</strong><span>×${item.quantity}</span><p>${escapeText(item.description)}</p>`;
    if (item.category === 'recovery')
      row.append(button(`Use ${item.displayName}`, `use:${item.itemId}`));
    list.append(row);
  }
  if (projection.inventory.length === 0) list.append(emptyItem('The satchel is empty.'));
  panel.append(heading, list);
  return panel;
}

function journalPanel(projection: UiSessionProjection): HTMLElement {
  const panel = document.createElement('section');
  const heading = document.createElement('h2');
  heading.textContent = 'Quest journal';
  const list = document.createElement('ul');
  list.className = 'ledger-list';
  for (const quest of projection.quests) {
    const row = document.createElement('li');
    row.innerHTML = `<strong>${escapeText(quest.displayName)}</strong><span>${escapeText(quest.title)}</span><p>${escapeText(quest.objective)}</p>`;
    list.append(row);
  }
  panel.append(heading, list);
  return panel;
}

function equipmentPanel(projection: UiSessionProjection): HTMLElement {
  const panel = document.createElement('section');
  const heading = document.createElement('h2');
  heading.textContent = 'Equipped gear';
  const list = document.createElement('ul');
  list.className = 'ledger-list';
  for (const item of projection.inventory.filter((item) => item.category === 'charm')) {
    const row = document.createElement('li');
    const name = document.createElement('strong');
    name.textContent = item.displayName;
    const description = document.createElement('p');
    description.textContent = item.description;
    row.append(name, description);
    if (item.equippedSlots.length > 0) {
      for (const slot of item.equippedSlots)
        row.append(button(`Unequip ${item.displayName}`, `unequip:${slot}`));
    } else {
      for (const slot of ['charm-one', 'charm-two', 'charm-three']) {
        const occupied = projection.inventory.find((item) => item.equippedSlots.includes(slot));
        row.append(
          button(
            occupied
              ? `Replace ${occupied.displayName} with ${item.displayName}`
              : `Equip ${item.displayName} in ${slot.replace('charm-', 'slot ')}`,
            `equip:${item.itemId}:${slot}`,
          ),
        );
      }
    }
    list.append(row);
  }
  if (list.childElementCount === 0) list.append(emptyItem('No gear is equipped.'));
  panel.append(heading, list);
  return panel;
}

function button(copy: string, action: string): HTMLButtonElement {
  const control = document.createElement('button');
  control.type = 'button';
  control.dataset.action = action;
  control.textContent = copy;
  return control;
}

function checkboxField(label: string, name: string, checked: boolean): HTMLLabelElement {
  const field = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = name;
  input.checked = checked;
  field.append(input, document.createTextNode(label));
  return field;
}

function rangeField(
  label: string,
  name: string,
  current: number,
  min: number,
  max: number,
  step: number,
): HTMLLabelElement {
  const field = document.createElement('label');
  field.textContent = label;
  const input = document.createElement('input');
  input.type = 'range';
  input.name = name;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(current);
  field.append(input);
  return field;
}

function selectField(
  label: string,
  name: string,
  current: string,
  options: readonly string[],
): HTMLLabelElement {
  const field = document.createElement('label');
  field.textContent = label;
  const select = document.createElement('select');
  select.name = name;
  for (const option of options) {
    const element = document.createElement('option');
    element.value = option;
    element.textContent = capitalize(option);
    element.selected = option === current;
    select.append(element);
  }
  field.append(select);
  return field;
}

function value(data: FormData, name: string): string {
  return String(data.get(name) ?? '');
}

function numberValue(data: FormData, name: string): number {
  return Number(value(data, name));
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function readableKey(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return code.slice(5);
  return code.replace('Left', '').replace('Right', '') || code;
}

function emptyItem(copy: string): HTMLLIElement {
  const item = document.createElement('li');
  item.textContent = copy;
  return item;
}

function escapeText(value: string): string {
  const span = document.createElement('span');
  span.textContent = value;
  return span.innerHTML;
}
