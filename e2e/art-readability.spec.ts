import { expect, test } from '@playwright/test';
import { CONTENT_REGISTRY } from '../src/game/data/areas';
import { createSaveEnvelopeJson } from '../src/game/saves/SaveEnvelope';
import { createNewSave } from '../src/game/saves/SaveSchema';

for (const area of CONTENT_REGISTRY.areas) {
  test(`readability artwork loads and renders in ${area.areaId}`, async ({ page }, testInfo) => {
    test.setTimeout(30_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('requestfailed', (request) => {
      if (request.url().includes('/assets/art/')) errors.push(request.url());
    });
    const content = CONTENT_REGISTRY.newGame;
    const checkpoint = area.checkpoints[0]!;
    const save = createNewSave({
      nowEpochMs: Date.now(),
      location: {
        regionId: area.regionId,
        areaId: area.areaId,
        checkpointId: checkpoint.checkpointId,
        safePosition: checkpoint.canonicalPosition,
      },
      baseStats: content.baseStats,
      initialQuests: content.initialQuests,
      startingAbilities: content.startingAbilities,
    });
    await page.goto('/');
    await page.getByLabel('Import save for Journey 1').setInputFiles({
      name: 'art-review.json',
      mimeType: 'application/json',
      buffer: Buffer.from(await createSaveEnvelopeJson(save, Date.now())),
    });
    await page.getByRole('button', { name: 'Import save', exact: true }).click();
    await page.getByRole('button', { name: 'Continue Journey 1' }).click();
    await page.getByRole('button', { name: /^Enter / }).click();
    await expect
      .poll(() => page.evaluate(() => window.__RIVENBLOOM_TEST__?.read().world?.areaId))
      .toBe(area.areaId);
    await expect(page.getByLabel('Gameplay status')).toBeVisible();
    const icons = await page.locator('.hud-vitals .hud-icon').evaluateAll((elements) =>
      elements.map((element) => ({
        width: element.getBoundingClientRect().width,
        image: getComputedStyle(element).backgroundImage,
      })),
    );
    expect(icons).toHaveLength(2);
    expect(icons.every((icon) => icon.width >= 28 && icon.image.endsWith('.svg")'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Wayfinder Ledger' })).toBeVisible();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath(`${area.areaId}.png`) });
    expect(errors).toEqual([]);
  });
}
