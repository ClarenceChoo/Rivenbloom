import { afterEach, expect, test, vi } from 'vitest';
import type Phaser from 'phaser';
import { CombatPresentationView } from '../../src/game/effects/CombatPresentationView';
import { THREAT_CAPACITY } from '../../src/game/effects/CombatPresentation';
import { DEFAULT_SAVE_SETTINGS } from '../../src/game/saves/SaveSchema';

class Drawable {
  visible = false;
  destroyed = false;
  alpha = 1;
  node = { textContent: '' };
  setDepth() {
    return this;
  }
  setVisible(value: boolean) {
    this.visible = value;
    return this;
  }
  setTexture() {
    return this;
  }
  setPosition() {
    return this;
  }
  setDisplaySize() {
    return this;
  }
  setTint() {
    return this;
  }
  setAlpha(value: number) {
    this.alpha = value;
    return this;
  }
  destroy() {
    this.destroyed = true;
  }
}
afterEach(() => vi.unstubAllGlobals());
test('saturation preserves threats; clear/rebind and destruction release every rendered lease', () => {
  vi.stubGlobal('document', { createElement: () => ({ className: '' }) });
  const objects: Drawable[] = [];
  const create = () => {
    const object = new Drawable();
    objects.push(object);
    return object;
  };
  const shake = vi.fn();
  const scene = {
    add: { image: create, dom: create },
    time: { now: 0 },
    cameras: { main: { shake } },
  };
  const view = new CombatPresentationView(scene as unknown as Phaser.Scene);
  const visuals = Array.from({ length: THREAT_CAPACITY }, (_, i) => ({
    key: `bolt:${i}`,
    kind: 'bolt' as const,
    x: 10,
    y: 20,
    width: 32,
    height: 32,
    phase: 'active' as const,
    friendly: false,
  }));
  const accessible = {
    ...DEFAULT_SAVE_SETTINGS,
    reducedMotion: true,
    flashIntensity: 0,
    shakeIntensity: 0,
    damageNumbers: false,
  };
  view.sync(visuals, 0, accessible);
  expect(objects.filter((object) => object.visible)).toHaveLength(THREAT_CAPACITY);
  for (let i = 0; i < 200; i++) view.impact({ x: 10, y: 20 }, 5, accessible);
  expect(shake).not.toHaveBeenCalled();
  expect(objects.length).toBeLessThanOrEqual(THREAT_CAPACITY + 32 + 64);
  view.clear();
  expect(objects.every((object) => !object.visible)).toBe(true);
  view.sync(visuals, 0, accessible);
  expect(objects.filter((object) => object.visible)).toHaveLength(THREAT_CAPACITY);
  scene.time.now = 1000;
  view.sync([], 1000, accessible);
  expect(objects.every((object) => !object.visible)).toBe(true);
  view.destroy();
  expect(objects.every((object) => object.destroyed)).toBe(true);
});
