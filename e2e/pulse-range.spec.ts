import { expect, test } from '@playwright/test';
import { abilityId, stableId } from '../src/game/core/StableId';
import { CONTENT_REGISTRY } from '../src/game/data/areas';
import { createNewSave } from '../src/game/saves/SaveSchema';
import { createSaveEnvelopeJson } from '../src/game/saves/SaveEnvelope';

test('Resonant Pulse activates both gallery lenses from outside body overlap', async ({ page }) => {
  test.setTimeout(60_000);
  const content = CONTENT_REGISTRY.newGame;
  const base = createNewSave({
    nowEpochMs: Date.now(),
    location: {
      regionId: content.initialRegionId,
      areaId: stableId<'area'>('rootglass-reliquary'),
      checkpointId: stableId<'checkpoint'>('resonance-gallery-lantern'),
      safePosition: { x: 7296, y: 900 },
    },
    baseStats: content.baseStats,
    initialQuests: content.initialQuests,
    startingAbilities: content.startingAbilities,
  });
  const save = {
    ...base,
    player: {
      ...base.player,
      unlockedAbilities: [...base.player.unlockedAbilities, abilityId('resonant-pulse')],
    },
    quests: {
      ...base.quests,
      flags: [...base.quests.flags, stableId<'quest-flag'>('resonant-pulse-awakened')],
    },
  };
  await page.goto('/');
  await page.getByLabel('Import save for Journey 1').setInputFiles({
    name: 'pulse-range.json',
    mimeType: 'application/json',
    buffer: Buffer.from(await createSaveEnvelopeJson(save, Date.now())),
  });
  await page.getByRole('button', { name: 'Import save', exact: true }).click();
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  await expect(page.getByLabel('Gameplay status')).toBeVisible();
  await page.evaluate(() =>
    window.__RIVENBLOOM_TEST__!.act({
      kind: 'defeat-enemies',
      combatantIds: ['gallery-guard-barkbound', 'gallery-guard-rootlurker'],
    }),
  );
  await expect
    .poll(() => page.evaluate(() => window.__RIVENBLOOM_TEST__!.read().player?.position.x))
    .toBe(7296);
  for (let attempt = 0; attempt < 4; attempt++) {
    if (
      await page.evaluate(
        () => window.__RIVENBLOOM_TEST__!.read().combat?.selectedAbilityId === 'resonant-pulse',
      )
    )
      break;
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(150);
  }
  await page.keyboard.press('KeyQ');
  const lenses = () =>
    page.evaluate(
      () =>
        window
          .__RIVENBLOOM_TEST__!.read()
          .worldUi?.world.objects.puzzles.find((p) => p.puzzleId === 'gallery-choir-seal')
          ?.activatedMechanismIds,
    );
  await expect.poll(lenses).toContain('gallery-memory-lens');
  const firstPulse = await page.evaluate(
    () => window.__RIVENBLOOM_TEST__!.read().encounter!.simulationTimeMs,
  );
  await page.keyboard.down('ArrowRight');
  try {
    await page.waitForFunction(
      () => (window.__RIVENBLOOM_TEST__!.read().player?.position.x ?? 0) >= 7960,
    );
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  await page.waitForFunction(() => window.__RIVENBLOOM_TEST__!.read().player?.velocity.x === 0);
  const x = await page.evaluate(() => window.__RIVENBLOOM_TEST__!.read().player!.position.x);
  expect(x).toBeGreaterThan(7954);
  expect(x).toBeLessThan(8096);
  await page.waitForFunction(
    (time) => window.__RIVENBLOOM_TEST__!.read().encounter!.simulationTimeMs >= time + 3600,
    firstPulse,
  );
  await page.keyboard.press('KeyQ');
  await expect
    .poll(lenses)
    .toEqual(expect.arrayContaining(['gallery-memory-lens', 'gallery-breath-lens']));
});
