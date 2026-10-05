import { expect, test } from '@playwright/test';
import { CONTENT_REGISTRY } from '../src/game/data/areas';
import { stableId } from '../src/game/core/StableId';
import { createSaveEnvelopeJson } from '../src/game/saves/SaveEnvelope';
import { createNewSave } from '../src/game/saves/SaveSchema';

test('the Dash Trial catches an overshot ladder and labels its Up interaction', async ({
  page,
}) => {
  test.setTimeout(30_000);
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

  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(
    () => (window.__RIVENBLOOM_TEST__?.read().player?.position.x ?? 0) >= 4480,
  );
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('KeyE');
  await expect
    .poll(() => page.evaluate(() => window.__RIVENBLOOM_TEST__?.read().world?.roomId))
    .toBe('dash-trial');

  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(
    () => (window.__RIVENBLOOM_TEST__?.read().player?.position.x ?? 0) >= 4640,
  );
  await page.keyboard.up('ArrowRight');
  await expect(page.getByText('Up · Climb')).toBeVisible();
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(
    () => (window.__RIVENBLOOM_TEST__?.read().player?.position.y ?? 1688) <= 1440,
  );
  await page.keyboard.up('ArrowUp');
  expect(
    await page.evaluate(() => window.__RIVENBLOOM_TEST__?.read().player?.position.x),
  ).toBeCloseTo(4576, -1);
});
