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

test('moves through Brackenreach with real keyboard input inside room and camera bounds', async ({
  page
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const canvas = await startNewGame(page);
  const startX = await numericAttribute(canvas, 'data-player-x');

  await page.keyboard.down('d');
  await expect(canvas).toHaveAttribute('data-player-state', 'run');
  await expect
    .poll(() => numericAttribute(canvas, 'data-player-x'), { timeout: 12_000 })
    .toBeGreaterThan(startX + 700);
  await page.keyboard.up('d');

  await expect(canvas).toHaveAttribute('data-room-id', 'listening-arch');
  const cameraX = await numericAttribute(canvas, 'data-camera-x');
  const cameraMin = await numericAttribute(canvas, 'data-camera-min-x');
  const cameraMax = await numericAttribute(canvas, 'data-camera-max-x');
  expect(cameraX).toBeGreaterThanOrEqual(cameraMin);
  expect(cameraX).toBeLessThanOrEqual(cameraMax);
  expect(pageErrors).toEqual([]);
});

test('exposes jump, fall, land, and focus-loss recovery without mutation hooks', async ({
  page
}) => {
  const canvas = await startNewGame(page);

  await page.keyboard.down('Space');
  await expect(canvas).toHaveAttribute('data-player-state', 'jump');
  await page.waitForTimeout(100);
  await page.keyboard.up('Space');
  await expect(canvas).toHaveAttribute('data-player-state', 'fall');
  await expect(canvas).toHaveAttribute('data-player-landing-count', '1');
  await expect(canvas).toHaveAttribute('data-player-state', 'idle');
  await expect(canvas).toHaveAttribute('data-player-y', '566.00');
  await expect(canvas).toHaveAttribute('data-camera-y', '0.00');

  await page.keyboard.down('d');
  await expect(canvas).toHaveAttribute('data-player-state', 'run');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(500);
  const settledX = await numericAttribute(canvas, 'data-player-x');
  await page.waitForTimeout(250);
  const laterX = await numericAttribute(canvas, 'data-player-x');

  expect(Math.abs(laterX - settledX)).toBeLessThan(1);
  await expect(canvas).toHaveAttribute('data-player-state', 'idle');
});
