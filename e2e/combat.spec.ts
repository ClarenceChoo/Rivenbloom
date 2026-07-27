import { expect, type Locator, type Page, test } from '@playwright/test';

const AWAKE_ENEMY_STATES = ['suspect', 'chase', 'telegraph', 'attack', 'recover', 'retreat'];

async function startNewGame(page: Page): Promise<Locator> {
  await page.goto('/');
  await page.getByRole('button', { name: 'NEW GAME' }).click();
  const drawer = page.getByRole('region', { name: 'New game save slots' });
  await drawer.getByRole('button', { name: /EMPTY SLOT 1/ }).click();
  await page
    .getByRole('dialog', { name: 'NEW GAME' })
    .getByRole('button', { name: 'NEW GAME' })
    .click();
  await expect(page.locator('[data-destination="wrens-rest"]')).toBeVisible();
  const canvas = page.locator('canvas[data-area-id="wrens-rest"]');
  await expect(canvas).toBeVisible();
  return canvas;
}

async function walkEastToTrail(page: Page): Promise<Locator> {
  await page.keyboard.down('d');
  const canvas = page.locator('canvas[data-area-id="brackenreach-trail"]');
  await expect(canvas).toBeVisible({ timeout: 25_000 });
  await page.keyboard.up('d');
  return canvas;
}

async function numericAttribute(canvas: Locator, name: string): Promise<number> {
  const value = await canvas.getAttribute(name);
  if (value === null) throw new Error(`Missing semantic canvas attribute "${name}".`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid semantic value "${name}=${value}".`);
  return parsed;
}

test('wakes the live Briar Scrapper, lands authored attacks, and banks the XP award', async ({
  page
}) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await startNewGame(page);
  const canvas = await walkEastToTrail(page);

  await page.keyboard.down('d');
  await expect
    .poll(() => numericAttribute(canvas, 'data-player-x'), { timeout: 12_000 })
    .toBeGreaterThan(1_350);
  await page.keyboard.up('d');

  await expect
    .poll(
      async () =>
        AWAKE_ENEMY_STATES.includes(String(await canvas.getAttribute('data-combat-target-state'))),
      { timeout: 10_000 }
    )
    .toBe(true);

  let sawAirSlash = false;
  let sawChargedStrike = false;
  for (let round = 0; round < 150; round += 1) {
    const targetState = await canvas.getAttribute('data-combat-target-state');
    if (targetState === 'dead') break;
    const areaId = await canvas.getAttribute('data-area-id');
    if (areaId !== 'brackenreach-trail') {
      throw new Error('Player was knocked out of the encounter area.');
    }
    const targetX = await numericAttribute(canvas, 'data-combat-target-x');
    const playerX = await numericAttribute(canvas, 'data-player-x');
    const gap = targetX - playerX;
    if (Math.abs(gap) > 130) {
      const approach = gap > 0 ? 'd' : 'a';
      await page.keyboard.down(approach);
      await page.waitForTimeout(130);
      await page.keyboard.up(approach);
      continue;
    }
    if ((await canvas.getAttribute('data-player-state')) === 'hurt') {
      await page.waitForTimeout(140);
      continue;
    }
    const facing = await canvas.getAttribute('data-player-facing');
    const wanted = gap >= 0 ? 'right' : 'left';
    if (facing !== wanted) {
      await page.keyboard.down(wanted === 'right' ? 'd' : 'a');
      await page.waitForTimeout(50);
      await page.keyboard.up(wanted === 'right' ? 'd' : 'a');
    }
    if (targetState === 'telegraph' || targetState === 'attack') {
      // Soak the incoming swing behind the guard: blocked hits do not
      // hurt-lock the player, so the counterattack window stays open.
      await page.keyboard.down('f');
      await page.waitForTimeout(240);
      await page.keyboard.up('f');
      continue;
    }
    if (!sawChargedStrike) {
      await page.keyboard.down('c');
      await page.waitForTimeout(360);
      await page.keyboard.up('c');
      await page.waitForTimeout(120);
      sawChargedStrike =
        (await canvas.getAttribute('data-player-last-attack')) === 'mara-charged-strike';
      continue;
    }
    if (!sawAirSlash) {
      await page.keyboard.down('Space');
      await page.waitForTimeout(90);
      await page.keyboard.press('x');
      await page.keyboard.up('Space');
      await page.waitForTimeout(160);
      sawAirSlash = (await canvas.getAttribute('data-player-last-attack')) === 'mara-air-slash';
      continue;
    }
    await page.keyboard.press('x');
    await page.waitForTimeout(80);
    await page.keyboard.press('x');
    await page.waitForTimeout(80);
    await page.keyboard.press('x');
    await page.waitForTimeout(80);
    await page.keyboard.press('x');
  }

  await expect(canvas).toHaveAttribute('data-combat-target-state', 'dead');
  expect(await numericAttribute(canvas, 'data-combat-target-health')).toBe(0);
  expect(sawChargedStrike).toBe(true);
  expect(sawAirSlash).toBe(true);
  await expect.poll(() => numericAttribute(canvas, 'data-player-xp')).toBeGreaterThanOrEqual(14);
  expect(pageErrors).toEqual([]);
});

test('observes parry, block, and bounded invulnerable dash displacement', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const canvas = await startNewGame(page);

  await page.keyboard.down('f');
  await expect(canvas).toHaveAttribute('data-player-guard', 'parry');
  await expect(canvas).toHaveAttribute('data-player-guard', 'block');
  await page.keyboard.up('f');
  await expect(canvas).toHaveAttribute('data-player-guard', 'none');

  const unlocked = await page.evaluate(
    () => window.__RIVENBLOOM_TEST__?.unlockAbility('wayfinder-dash') ?? false
  );
  expect(unlocked).toBe(true);
  const startX = await numericAttribute(canvas, 'data-player-x');
  await page.keyboard.press('ShiftLeft');
  await expect(canvas).toHaveAttribute('data-player-state', 'dash');
  await expect(canvas).toHaveAttribute('data-player-invulnerable', 'true');
  await expect.poll(() => numericAttribute(canvas, 'data-player-x')).toBeGreaterThan(startX + 80);
  await expect(canvas).toHaveAttribute('data-player-invulnerable', 'false');
  expect(pageErrors).toEqual([]);
});

test('casts a pooled Lumen Bolt with exact mana and cooldown observability', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const canvas = await startNewGame(page);

  await page.keyboard.press('v');

  await expect(canvas).toHaveAttribute('data-player-state', 'cast');
  await expect(canvas).toHaveAttribute('data-player-mana', '48');
  await expect(canvas).toHaveAttribute('data-player-last-ability', 'lumen-bolt');
  await expect
    .poll(() => numericAttribute(canvas, 'data-lumen-projectile-count'))
    .toBeGreaterThan(0);
  await expect
    .poll(() => numericAttribute(canvas, 'data-lumen-cooldown-ready-at'))
    .toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);
});
