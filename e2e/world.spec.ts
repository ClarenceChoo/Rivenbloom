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
  const canvas = page.locator('canvas[data-area-id="wrens-rest"]');
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

async function walkRightUntil(
  page: Page,
  canvas: Locator,
  predicate: () => Promise<boolean>,
  timeoutMs = 20_000
): Promise<void> {
  await page.keyboard.down('d');
  try {
    await expect.poll(predicate, { timeout: timeoutMs }).toBe(true);
  } finally {
    await page.keyboard.up('d');
  }
}

test('advances The Silent Bloom through Sela and restores the run after reload', async ({
  page
}) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const canvas = await startNewGame(page);
  await expect(canvas).toHaveAttribute('data-silent-bloom-stage', 'unstarted');
  await expect(canvas).toHaveAttribute('data-save-slot', 'slot-1');

  await walkRightUntil(page, canvas, async () => {
    const x = await numericAttribute(canvas, 'data-player-x');
    return x >= 430;
  });
  for (let correction = 0; correction < 10; correction += 1) {
    await page.waitForTimeout(180);
    const playerX = await numericAttribute(canvas, 'data-player-x');
    const distance = 520 - playerX;
    if (Math.abs(distance) <= 70) break;
    const nudge = distance > 0 ? 'd' : 'a';
    await page.keyboard.down(nudge);
    await page.waitForTimeout(Math.min(240, Math.max(60, (Math.abs(distance) / 240) * 800)));
    await page.keyboard.up(nudge);
  }
  await page.waitForTimeout(200);
  await page.keyboard.press('e');

  const conversation = page.locator('[aria-label="Conversation"]');
  await expect(conversation).toBeVisible();
  await expect(canvas).toHaveAttribute('data-dialogue-open', 'true');
  for (let turn = 0; turn < 12; turn += 1) {
    const control = conversation.locator('button').first();
    if ((await conversation.count()) === 0 || !(await conversation.isVisible())) break;
    await control.click();
    await page.waitForTimeout(120);
    if (!(await conversation.isVisible().catch(() => false))) break;
  }
  await expect(conversation).toHaveCount(0);
  await expect(canvas).toHaveAttribute('data-dialogue-open', 'false');
  await expect(canvas).toHaveAttribute('data-silent-bloom-stage', 'speak-with-sela');

  const trailCanvas = page.locator('canvas[data-area-id="brackenreach-trail"]');
  await page.keyboard.down('d');
  await expect(trailCanvas).toBeVisible({ timeout: 25_000 });
  await page.keyboard.up('d');
  await expect(trailCanvas).toHaveAttribute('data-silent-bloom-stage', 'speak-with-sela');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'RIVENBLOOM', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  const continueDrawer = page.getByRole('region', { name: 'Continue save slots' });
  await expect(continueDrawer).toBeVisible();
  await continueDrawer.locator('.save-slot-primary:not([aria-disabled])').first().click();
  const restored = page.locator('canvas[data-area-id="brackenreach-trail"]');
  await expect(restored).toBeVisible({ timeout: 25_000 });
  await expect(restored).toHaveAttribute('data-silent-bloom-stage', 'speak-with-sela');
  await expect(restored).toHaveAttribute('data-save-slot', 'slot-1');
  expect(pageErrors).toEqual([]);
});
