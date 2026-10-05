import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
async function journey(page: Page, url = '/') {
  await page.goto(url);
  await page.getByRole('button', { name: 'Begin journey for Journey 1' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Begin journey', exact: true })
    .click();
  await page.getByRole('button', { name: /^Enter / }).click();
  await expect(page.getByLabel('Gameplay status')).toBeVisible();
}
test('HUD retains nodes, exposes readable art names, and settles autosave', async ({
  page,
}, testInfo) => {
  test.setTimeout(30_000);
  await journey(page);
  await expect(page.getByText('Art: Lumen Bolt', { exact: true })).toBeVisible();
  const sizes = await page.locator('.game-hud').evaluate((hud) => ({
    meter: parseFloat(getComputedStyle(hud.querySelector('.hud-meter')!).fontSize),
    details: parseFloat(getComputedStyle(hud.querySelector('.hud-details')!).fontSize),
    guidance: parseFloat(getComputedStyle(hud.querySelector('.hud-guidance')!).fontSize),
    guidanceHeight: hud.querySelector('.hud-guidance')!.getBoundingClientRect().height,
  }));
  expect(sizes.meter).toBeGreaterThanOrEqual(14);
  expect(sizes.details).toBeGreaterThanOrEqual(14);
  expect(sizes.guidance).toBeGreaterThanOrEqual(14);
  expect(sizes.guidanceHeight).toBeGreaterThan(25);
  await page.screenshot({ path: testInfo.outputPath('opening-room.png') });
  const mutations = await page.locator('.game-hud').evaluate(async (root) => {
    let count = 0;
    const observer = new MutationObserver((records) => {
      count += records.filter((record) => record.target === root).length;
    });
    observer.observe(root, { childList: true });
    await new Promise<void>((resolve) => {
      let frames = 0;
      const step = () => (++frames === 120 ? resolve() : requestAnimationFrame(step));
      requestAnimationFrame(step);
    });
    observer.disconnect();
    return count;
  });
  expect(mutations).toBe(0);
  await expect(page.getByText('Save: Saved', { exact: true })).toBeVisible();
});
test('text scale actually enlarges active settings and HUD', async ({ page }) => {
  await journey(page);
  await page.keyboard.press('Escape');
  const menu = page.getByRole('dialog', { name: 'Wayfinder Ledger' });
  await menu.getByRole('button', { name: 'Settings', exact: true }).click();
  const before = await menu.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  await menu.getByLabel('Text scale').press('End');
  await menu.getByRole('button', { name: 'Apply settings' }).click();
  const after = await menu.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(after / before).toBeCloseTo(1.5, 2);
});
test('portrait Resume remains inside the contained stage', async ({ page }) => {
  await journey(page);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  const button = page.getByRole('button', { name: 'Resume', exact: true });
  const stage = await page.locator('.game-stage').boundingBox();
  const bounds = await button.boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(stage!.x + stage!.width);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(stage!.y + stage!.height);
  await button.click();
  await expect(page.getByRole('dialog', { name: 'Wayfinder Ledger' })).toBeHidden();
});
test('boss meter stays within the stage', async ({ page }, testInfo) => {
  test.setTimeout(30_000);
  await journey(page, '/?debug-boss=pallid-cantor');
  await expect(page.locator('.hud-boss')).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: testInfo.outputPath('boss-room.png') });
  const stage = await page.locator('.game-stage').boundingBox();
  const bounds = await page.locator('.hud-boss').boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(stage!.x + stage!.width);
});

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 844, height: 390 },
]) {
  test(`maximum text scale keeps pause controls reachable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await journey(page);
    await page.keyboard.press('Escape');
    const menu = page.getByRole('dialog', { name: 'Wayfinder Ledger' });
    await menu.getByRole('button', { name: 'Settings', exact: true }).click();
    await menu.getByLabel('Text scale').press('End');
    await menu.getByRole('button', { name: 'Apply settings' }).click();
    const resume = menu.getByRole('button', { name: 'Resume', exact: true });
    await resume.scrollIntoViewIfNeeded();
    const button = await resume.boundingBox();
    const stage = await page.locator('.game-stage').boundingBox();
    expect(button!.x).toBeGreaterThanOrEqual(stage!.x);
    expect(button!.y).toBeGreaterThanOrEqual(stage!.y);
    expect(button!.x + button!.width).toBeLessThanOrEqual(stage!.x + stage!.width);
    expect(button!.y + button!.height).toBeLessThanOrEqual(stage!.y + stage!.height);
    await resume.click();
    await expect(menu).toBeHidden();
  });
}
