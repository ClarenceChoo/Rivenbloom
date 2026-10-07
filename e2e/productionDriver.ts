import { expect, type Page } from '@playwright/test';
import { renderedWorld, savedJourney } from './productionObservation';

export class ProductionDriver {
  constructor(readonly page: Page) {}
  async frame(count = 1) {
    await this.page.evaluate(async (n) => {
      for (let i = 0; i < n; i++)
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }, count);
  }
  async state() {
    let state = await renderedWorld(this.page);
    if (!state) {
      await expect
        .poll(async () => {
          state = await renderedWorld(this.page);
          return state !== null;
        })
        .toBe(true);
    }
    if (!state) throw new Error('No rendered world');
    return state;
  }
  async health() {
    return this.page
      .getByRole('progressbar', { name: /^Health:/ })
      .evaluate((el) => (el as HTMLProgressElement).value);
  }
  async mana() {
    return this.page
      .getByRole('progressbar', { name: /^Mana:/ })
      .evaluate((el) => (el as HTMLProgressElement).value);
  }
  async idle() {
    await expect
      .poll(async () => [0, 1, 2, 5].includes((await this.state()).player.pose), { timeout: 8000 })
      .toBe(true);
  }
  async move(target: number, tolerance = 18) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const start = (await this.state()).player.x;
      if (Math.abs(start - target) <= tolerance) {
        await this.idle();
        return;
      }
      const right = start < target,
        key = right ? 'ArrowRight' : 'ArrowLeft';
      await this.page.keyboard.down(key);
      try {
        if (Math.abs(start - target) < 80) {
          // A single paint can fall between fixed simulation updates.
          await this.frame(2);
        } else {
          await expect
            .poll(
              async () => {
                const x = (await this.state()).player.x;
                return right ? x >= target - 45 : x <= target + 45;
              },
              { timeout: 18000, intervals: [30] },
            )
            .toBe(true);
        }
      } finally {
        await this.page.keyboard.up(key);
      }
      await this.frame(8);
    }
    expect(Math.abs((await this.state()).player.x - target)).toBeLessThanOrEqual(tolerance);
  }
  async cross(direction: 'ArrowLeft' | 'ArrowRight', room: string) {
    const end = Date.now() + 45000;
    await this.page.keyboard.down(direction);
    try {
      while (Date.now() < end) {
        const s = await renderedWorld(this.page);
        if (s?.room === room) break;
        if (s && [0, 1, 2, 5].includes(s.player.pose)) await this.page.keyboard.press('Space');
        await this.frame(12);
      }
    } finally {
      await this.page.keyboard.up(direction);
    }
    // Room handoff intentionally clears held input. Let its new frame settle
    // before a following route segment presses the next direction.
    await this.frame(20);
    expect((await this.state()).room).toBe(room);
  }
  async interact(x: number, prompt: string) {
    await this.move(x);
    await expect(this.page.getByText(`E · ${prompt}`, { exact: true })).toBeVisible();
    await this.page.keyboard.press('KeyE');
    await this.frame(6);
  }
  async passage(x: number, room: string, prompt = 'Enter passage') {
    await this.interact(x, prompt);
    await expect.poll(async () => (await renderedWorld(this.page))?.room).toBe(room);
    await this.frame(20);
  }
  async rest(x: number, name: string) {
    await this.interact(x, `Rest at ${name}`);
    await expect
      .poll(async () =>
        this.page.getByRole('progressbar', { name: /^Health:/ }).evaluate((el) => {
          const meter = el as HTMLProgressElement;
          return meter.value === meter.max;
        }),
      )
      .toBe(true);
  }
  async choose(npc: string, option: string) {
    const dialog = this.page.getByRole('dialog', { name: npc });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: option, exact: true }).click();
    await this.frame(4);
  }
  async leave() {
    const button = this.page.getByRole('button', { name: 'Leave shop', exact: true });
    if (await button.isVisible()) await button.click();
    else {
      const close = this.page.getByRole('button', { name: 'Close', exact: true });
      if (await close.isVisible()) await close.click();
    }
  }
  async face(right: boolean) {
    await this.page.keyboard.down(right ? 'ArrowRight' : 'ArrowLeft');
    await this.frame(2);
    await this.page.keyboard.up(right ? 'ArrowRight' : 'ArrowLeft');
    await this.frame(6);
  }
  async combo() {
    await this.idle();
    for (let hit = 0; hit < 3; hit++) {
      await this.page.keyboard.press('KeyJ');
      await this.frame(hit === 2 ? 25 : 7);
    }
    await this.idle();
  }
  async heavy() {
    await this.idle();
    await this.page.keyboard.down('KeyK');
    await this.frame(28);
    await this.page.keyboard.up('KeyK');
    await expect
      .poll(async () => (await this.state()).player.pose, { intervals: [16] })
      .toBeGreaterThanOrEqual(10);
    await this.idle();
  }
  async heal() {
    await this.page.keyboard.press('Escape');
    const menu = this.page.getByRole('dialog', { name: 'Wayfinder Ledger' });
    await expect(menu).toBeVisible();
    await menu.getByRole('button', { name: 'Inventory', exact: true }).click();
    const use = menu.getByRole('button', { name: 'Use Sunmoss Draught', exact: true });
    while ((await use.isVisible()) && (await this.health()) < 100) await use.click();
    await menu.getByRole('button', { name: 'Resume', exact: true }).click();
  }
  async fight(kind: string, max = 45) {
    for (let turn = 0; turn < max; turn++) {
      const s = await this.state();
      const enemy = s.enemies
        .filter((e) => e.actor === kind && e.pose !== 5 && e.alpha > 0.5)
        .sort((a, b) => Math.abs(a.x - s.player.x) - Math.abs(b.x - s.player.x))[0];
      if (!enemy) return;
      if ((await this.health()) < 35) await this.heal();
      if (Math.abs(enemy.x - s.player.x) > 72)
        await this.move(enemy.x + (enemy.x > s.player.x ? -65 : 65), 35);
      await this.face(enemy.x >= (await this.state()).player.x);
      await this.combo();
    }
    throw new Error(`Enemy ${kind} survived ${max} real-input combos`);
  }
  async saved() {
    await expect(this.page.getByText('Save: Saved', { exact: true })).toBeVisible();
    return savedJourney(this.page);
  }
  async reload(room: string) {
    await this.saved();
    await this.page.reload();
    await this.page.getByRole('button', { name: 'Continue Journey 1' }).click();
    await this.page.getByRole('button', { name: /^Enter / }).click();
    await expect.poll(async () => (await renderedWorld(this.page))?.room).toBe(room);
  }
}
