import { expect, test } from '@playwright/test';
import { CONTENT_REGISTRY } from '../src/game/data/areas';
import { stableId } from '../src/game/core/StableId';
import { createSaveEnvelopeJson } from '../src/game/saves/SaveEnvelope';
import { createNewSave } from '../src/game/saves/SaveSchema';
import type { Page } from '@playwright/test';

async function neutralSteps(page: Page): Promise<void> {
  const step = await page.evaluate(() => window.__RIVENBLOOM_TEST__!.read().encounter!.stepIndex);
  await page.waitForFunction(
    (previousStep) => window.__RIVENBLOOM_TEST__!.read().encounter!.stepIndex >= previousStep + 2,
    step,
    { polling: 'raf' },
  );
}

test('the Dash Trial catches an overshot ladder and labels its Up interaction', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const content = CONTENT_REGISTRY.newGame;
  const source = createNewSave({
    nowEpochMs: Date.now(),
    location: {
      regionId: content.initialRegionId,
      areaId: content.initialAreaId,
      checkpointId: content.initialCheckpointId,
      safePosition: { x: 256, y: 608 },
    },
    baseStats: content.baseStats,
    initialQuests: content.initialQuests,
    startingAbilities: content.startingAbilities,
  });
  const prepared = {
    ...source,
    location: {
      regionId: stableId<'region'>('brackenreach'),
      areaId: stableId<'area'>('singing-hollows'),
      checkpointId: stableId<'checkpoint'>('root-memory-lantern'),
      safePosition: { x: 3776, y: 788 },
    },
    quests: {
      ...source.quests,
      flags: [stableId<'quest-flag'>('root-memory-recovered')],
    },
  };
  await page.goto('/');
  await page.getByLabel('Import save for Journey 1').setInputFiles({
    name: 'dash-trial.json',
    mimeType: 'application/json',
    buffer: Buffer.from(await createSaveEnvelopeJson(prepared, Date.now())),
  });
  await page.getByRole('button', { name: 'Import save', exact: true }).click();
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: /^Enter / }).click();
  await expect
    .poll(() => page.evaluate(() => window.__RIVENBLOOM_TEST__?.read().world?.roomId))
    .toBe('root-memory-chamber');
  await neutralSteps(page);

  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(
    () => (window.__RIVENBLOOM_TEST__?.read().player?.position.x ?? 0) >= 4480,
  );
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('KeyE');
  await expect
    .poll(() => page.evaluate(() => window.__RIVENBLOOM_TEST__?.read().world?.roomId))
    .toBe('dash-trial');
  await neutralSteps(page);

  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(
    () => (window.__RIVENBLOOM_TEST__?.read().player?.position.x ?? 0) >= 4640,
  );
  await page.keyboard.up('ArrowRight');
  for (let correction = 0; correction < 24; correction += 1) {
    await page.waitForFunction(
      () => Math.abs(window.__RIVENBLOOM_TEST__!.read().player!.velocity.x) < 0.01,
    );
    const x = await page.evaluate(() => window.__RIVENBLOOM_TEST__!.read().player!.position.x);
    if (Math.abs(x - 4640) <= 30) break;
    await page.keyboard.press(x < 4640 ? 'ArrowRight' : 'ArrowLeft', {
      delay: Math.min(100, Math.max(10, (Math.abs(x - 4640) / 280) * 1000)),
    });
  }
  const overshotX = await page.evaluate(
    () => window.__RIVENBLOOM_TEST__!.read().player!.position.x,
  );
  expect(overshotX).toBeGreaterThan(4608);
  expect(overshotX).toBeLessThanOrEqual(4670);
  await expect(page.getByText('Up · Climb')).toBeVisible();
  const guidance = page.locator('[data-hud="guidance"]');
  await expect(guidance).toContainText('0/3 plates · 9 seconds.');
  await page.keyboard.press('Escape');
  const menu = page.getByRole('dialog', { name: 'Wayfinder Ledger' });
  await menu.getByRole('button', { name: 'Settings', exact: true }).click();
  await menu.getByLabel('Text scale').press('End');
  await menu.getByRole('button', { name: 'Apply settings' }).click();
  await menu.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('.game-hud')).toHaveCSS('--user-text-scale', '2');
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(guidance).toBeVisible();
    await expect(page.locator('.hud-vitals .numbers').nth(0)).toBeVisible();
    await expect(page.locator('.hud-vitals .numbers').nth(1)).toBeVisible();
    await expect(page.locator('[data-hud="save"]')).toBeVisible();
    if (viewport.width === 390) {
      await expect(guidance.locator('.hud-guidance-compact')).toBeVisible();
      await expect(guidance.locator('.hud-guidance-full')).toBeHidden();
      await expect(guidance.locator('.hud-guidance-compact')).toContainText(
        'Wake 0/3 plates · 9s.',
      );
      const healthTextRight = await page
        .locator('.hud-vitals .numbers')
        .first()
        .evaluate((value) => {
          const text = document.createRange();
          text.selectNodeContents(value);
          return text.getBoundingClientRect().right;
        });
      const manaIcon = (await page.locator('.hud-vitals .hud-icon').nth(1).boundingBox())!;
      expect(healthTextRight).toBeLessThanOrEqual(manaIcon.x);
    }
    await page.screenshot({ path: testInfo.outputPath(`trial-guidance-${viewport.width}.png`) });
    const hint = (await guidance.boundingBox())!;
    const prompt = (await page.getByText('Up · Climb').boundingBox())!;
    const vitals = (await page.locator('.hud-vitals').boundingBox())!;
    const stage = (await page.locator('.game-stage').boundingBox())!;
    expect(hint.x).toBeGreaterThanOrEqual(stage.x);
    expect(hint.x + hint.width).toBeLessThanOrEqual(stage.x + stage.width);
    expect(hint.y + hint.height).toBeLessThanOrEqual(stage.y + stage.height);
    expect(prompt.y + prompt.height).toBeLessThanOrEqual(hint.y);
    expect(vitals.y + vitals.height).toBeLessThanOrEqual(prompt.y);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await neutralSteps(page);
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(
    () => (window.__RIVENBLOOM_TEST__?.read().player?.position.y ?? 1688) <= 1440,
  );
  await page.keyboard.up('ArrowUp');
  expect(
    await page.evaluate(() => window.__RIVENBLOOM_TEST__?.read().player?.position.x),
  ).toBeCloseTo(4576, -1);
});
