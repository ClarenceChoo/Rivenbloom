import { expect, type Locator, type Page, test } from '@playwright/test';

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
  const canvas = page.locator('canvas[data-area-id="brackenreach-trail"]');
  await expect(canvas).toBeVisible();
  return canvas;
}

async function numericAttribute(canvas: Locator, name: string): Promise<number> {
  const value = await canvas.getAttribute(name);
  if (value === null) throw new Error(`Missing semantic canvas attribute "${name}".`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid semantic value "${name}=${value}".`);
  return parsed;
}

async function holdKeyUntilAttribute(
  page: Page,
  canvas: Locator,
  key: string,
  name: string,
  value: string
): Promise<void> {
  await page.keyboard.down(key);
  try {
    await expect(canvas).toHaveAttribute(name, value);
  } finally {
    await page.keyboard.up(key);
  }
}

async function approachDormantTarget(page: Page, canvas: Locator): Promise<void> {
  await page.keyboard.down('d');
  await expect
    .poll(() => numericAttribute(canvas, 'data-player-x'), { timeout: 12_000 })
    .toBeGreaterThan(1_550);
  await page.keyboard.up('d');
  await page.waitForTimeout(180);
  const targetX = await numericAttribute(canvas, 'data-combat-target-x');
  for (let correction = 0; correction < 8; correction += 1) {
    const playerX = await numericAttribute(canvas, 'data-player-x');
    const distance = targetX - 80 - playerX;
    if (Math.abs(distance) <= 16) break;
    const key = distance > 0 ? 'd' : 'a';
    const duration = Math.min(250, Math.max(55, (Math.abs(distance) / 240) * 700));
    await page.keyboard.down(key);
    await page.waitForTimeout(duration);
    await page.keyboard.up(key);
    await page.waitForTimeout(150);
  }
  const settledX = await numericAttribute(canvas, 'data-player-x');
  expect(Math.abs(targetX - 80 - settledX)).toBeLessThanOrEqual(24);
  if ((await canvas.getAttribute('data-player-facing')) !== 'right') {
    await page.keyboard.down('d');
    await page.waitForTimeout(55);
    await page.keyboard.up('d');
    await page.waitForTimeout(100);
  }
  await expect(canvas).toHaveAttribute('data-combat-target-state', 'sleep');
}

test('runs the light combo against the dormant authored Briar Scrapper', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const canvas = await startNewGame(page);
  await approachDormantTarget(page, canvas);

  await holdKeyUntilAttribute(page, canvas, 'x', 'data-player-state', 'attackLight');
  await expect
    .poll(() => numericAttribute(canvas, 'data-player-action-frame'))
    .toBeGreaterThanOrEqual(3);
  await holdKeyUntilAttribute(page, canvas, 'x', 'data-player-combo-stage', '2');
  await expect
    .poll(() => numericAttribute(canvas, 'data-player-action-frame'))
    .toBeGreaterThanOrEqual(4);
  await holdKeyUntilAttribute(page, canvas, 'x', 'data-player-combo-stage', '3');

  await expect.poll(() => numericAttribute(canvas, 'data-combat-target-health')).toBeLessThan(100);
  await expect.poll(() => numericAttribute(canvas, 'data-player-combo-max-stage')).toBe(3);
  expect(pageErrors).toEqual([]);
});

test('exposes charged and airborne authored attacks through real semantic input', async ({
  page
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const canvas = await startNewGame(page);
  await approachDormantTarget(page, canvas);

  await page.keyboard.down('c');
  await page.waitForTimeout(320);
  await page.keyboard.up('c');
  await expect(canvas).toHaveAttribute('data-player-last-attack', 'mara-charged-strike');
  await expect
    .poll(() => numericAttribute(canvas, 'data-combat-target-health'))
    .toBeLessThanOrEqual(69);
  await expect(canvas).toHaveAttribute('data-player-state', 'idle');

  await page.keyboard.down('Space');
  await expect(canvas).toHaveAttribute('data-player-grounded', 'false');
  await page.keyboard.press('x');
  await page.keyboard.up('Space');
  await expect(canvas).toHaveAttribute('data-player-last-attack', 'mara-air-slash');
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
