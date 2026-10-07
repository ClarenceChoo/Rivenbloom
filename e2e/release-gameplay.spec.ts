import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CONTENT_REGISTRY } from '../src/game/data/areas';
import { createNewSave } from '../src/game/saves/SaveSchema';
import { createSaveEnvelopeJson } from '../src/game/saves/SaveEnvelope';
import { itemId } from '../src/game/core/StableId';

async function importJourney(page: Page) {
  const content = CONTENT_REGISTRY.newGame;
  const save = createNewSave({
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
  const candidate = {
    ...save,
    player: { ...save.player, currentHealth: 86, currentMana: 10 },
    inventory: [
      { itemId: itemId('quiet-step'), quantity: 1 },
      { itemId: itemId('sunmoss-draught'), quantity: 1 },
    ],
  };
  await page.goto('/');
  await page.getByLabel('Import save for Journey 1').setInputFiles({
    name: 'candidate.json',
    mimeType: 'application/json',
    buffer: Buffer.from(await createSaveEnvelopeJson(candidate, Date.now())),
  });
  await page.getByRole('button', { name: 'Import save', exact: true }).click();
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  await expect(page.getByLabel('Gameplay status')).toBeVisible();
}

test('seeded integration: use and equip persist after a flushed return to title', async ({
  page,
}) => {
  await importJourney(page);
  await page.keyboard.press('Escape');
  const menu = page.getByRole('dialog', { name: 'Wayfinder Ledger' });
  await menu.getByRole('button', { name: 'Inventory', exact: true }).click();
  await menu.getByRole('button', { name: 'Use Sunmoss Draught' }).click();
  await expect(menu.getByText('Sunmoss Draught: restored 14 health.')).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Use Sunmoss Draught' })).toHaveCount(0);
  await menu.getByRole('button', { name: 'Equipment', exact: true }).click();
  await menu.getByRole('button', { name: 'Equip Quiet Step in slot one' }).click();
  await expect(menu.getByRole('button', { name: 'Unequip Quiet Step' })).toBeVisible();
  await menu.getByRole('button', { name: 'Return to title' }).click();
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  await expect(page.getByRole('progressbar', { name: 'Health: 100 of 100' })).toBeVisible();
  await page.keyboard.press('Escape');
  await menu.getByRole('button', { name: 'Equipment', exact: true }).click();
  await expect(menu.getByRole('button', { name: 'Unequip Quiet Step' })).toBeVisible();
});

test('simulated controller adjusts range, select, checkbox and clears toggle guard on pause', async ({
  page,
}) => {
  test.setTimeout(30_000);
  await page.addInitScript(() => {
    const buttons = Array<number>(18).fill(0);
    Object.assign(window, { __RIVENBLOOM_PAD__: buttons });
    Object.defineProperty(navigator, 'getGamepads', {
      value: () => [
        {
          axes: [0, 0, 0, 0],
          buttons: buttons.map((value) => ({ value, pressed: value > 0.5, touched: false })),
          connected: true,
          id: 'Integration standard pad',
          index: 0,
          mapping: 'standard',
          timestamp: performance.now(),
        },
      ],
    });
  });
  const press = async (index: number) => {
    await page.evaluate(async (buttonIndex) => {
      const buttons = (window as unknown as { __RIVENBLOOM_PAD__: number[] }).__RIVENBLOOM_PAD__;
      buttons[buttonIndex] = 1;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      buttons[buttonIndex] = 0;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }, index);
  };
  await importJourney(page);
  await page.keyboard.press('Escape');
  const menu = page.getByRole('dialog', { name: 'Wayfinder Ledger' });
  await menu.getByRole('button', { name: 'Settings', exact: true }).click();
  await menu.getByLabel('Text scale').focus();
  await press(15);
  await expect(menu.getByLabel('Text scale')).toHaveValue('1.05');
  await menu.getByLabel('Difficulty').focus();
  await press(15);
  await expect(menu.getByLabel('Difficulty')).toHaveValue('challenging');
  await menu.getByLabel('Reduced motion').focus();
  await press(0);
  await expect(menu.getByLabel('Reduced motion')).toBeChecked();
  await menu.getByLabel('Sustained actions').focus();
  await press(15);
  await expect(menu.getByLabel('Sustained actions')).toHaveValue('toggle');
  await menu.getByRole('button', { name: 'Apply settings' }).focus();
  await press(0);
  await menu.getByRole('button', { name: 'Resume', exact: true }).click();
  const step = await page.evaluate(() => window.__RIVENBLOOM_TEST__!.read().encounter!.stepIndex);
  await page.waitForFunction(
    (previousStep) => window.__RIVENBLOOM_TEST__!.read().encounter!.stepIndex >= previousStep + 2,
    step,
    { polling: 'raf' },
  );
  await page.keyboard.press('KeyL');
  await expect
    .poll(() => page.evaluate(() => window.__RIVENBLOOM_TEST__?.read().combat?.guarding))
    .toBe(true);
  await page.keyboard.press('Escape');
  await menu.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.__RIVENBLOOM_TEST__?.read().combat?.guarding))
    .toBe(false);
});

test('failed return-to-title flush keeps the live journey and supports a durable retry', async ({
  page,
}) => {
  await importJourney(page);
  await page.keyboard.press('Escape');
  const menu = page.getByRole('dialog', { name: 'Wayfinder Ledger' });
  await page.evaluate(async () => {
    const fault = { enabled: true };
    Object.assign(window, { __RIVENBLOOM_WRITE_FAULT__: fault });
    const path = '/src/game/saves/SaveService.ts';
    const { SaveService } = (await import(path)) as typeof import('../src/game/saves/SaveService');
    const original = SaveService.prototype.flush;
    SaveService.prototype.flush = function (slot) {
      if (fault.enabled) return Promise.reject(new Error('Injected flush failure'));
      return original.call(this, slot);
    };
  });
  await menu.getByRole('button', { name: 'Inventory', exact: true }).click();
  await menu.getByRole('button', { name: 'Use Sunmoss Draught' }).click();
  await menu.getByRole('button', { name: 'Return to title' }).click();
  await expect(
    menu.getByText('Save failed. Stay here and try Return to title again.'),
  ).toBeVisible();
  await expect(menu).not.toHaveAttribute('inert', '');
  await page.evaluate(() => {
    (
      window as unknown as { __RIVENBLOOM_WRITE_FAULT__: { enabled: boolean } }
    ).__RIVENBLOOM_WRITE_FAULT__.enabled = false;
  });
  await menu.getByRole('button', { name: 'Return to title' }).click();
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  await expect(page.getByRole('progressbar', { name: 'Health: 100 of 100' })).toBeVisible();
});
