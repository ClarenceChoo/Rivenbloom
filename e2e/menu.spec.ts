import { expect, test } from '@playwright/test';
import { computedContrastRatio } from './contrast';

async function beginJourney(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => window.__RIVENBLOOM_TEST__?.read().titleReady === true);
  await page.getByRole('button', { name: 'Begin journey for Journey 1' }).click();
  await page
    .getByRole('dialog', { name: 'Begin a new journey in Journey 1?' })
    .getByRole('button', { name: 'Begin journey' })
    .click();
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  await expect.poll(() => page.getByLabel('Gameplay status').count()).toBe(1);
}

test('HUD and pause ledger expose map, inventory, journal, settings, and persisted preferences', async ({
  page,
}) => {
  test.setTimeout(30_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await beginJourney(page);

  const hud = page.getByLabel('Gameplay status');
  await expect(hud.getByText('Health')).toBeVisible();
  await expect(hud.getByText('Mana')).toBeVisible();
  await expect(hud.getByText(/Wren's Rest/)).toBeVisible();
  await expect(hud.getByText(/Save:/)).toBeVisible();

  await page.keyboard.press('Escape');
  const menu = page.getByRole('dialog', { name: 'Wayfinder Ledger' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('heading', { name: 'Discovered paths' })).toBeVisible();
  await expect(menu.getByText("Wren's Rest Square", { exact: true })).toBeVisible();
  await expect(menu.getByText(/Unexplored exit at east edge/)).toBeVisible();
  await expect(menu.getByText(/Unexplored exit at centre/)).toBeVisible();
  const currentRoomContrast = await computedContrastRatio(
    menu.locator('.room-map .map-node[data-current="true"]'),
  );
  expect(currentRoomContrast).toBeGreaterThanOrEqual(4.5);
  const currentRoomDetailsSize = await menu
    .locator('.room-map .map-node[data-current="true"] small')
    .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  expect(currentRoomDetailsSize).toBeGreaterThanOrEqual(12);

  await menu.getByRole('button', { name: 'Inventory' }).click();
  await expect(menu.getByRole('heading', { name: /Inventory/ })).toBeVisible();
  await menu.getByRole('button', { name: 'Journal' }).click();
  await expect(menu.getByText('The Silent Bloom')).toBeVisible();
  await menu.getByRole('button', { name: 'Settings' }).click();
  await menu.getByLabel('Reduced motion').check();
  await menu.getByLabel('Text scale').evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = '1.25';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await menu.getByRole('button', { name: 'Apply settings' }).click();
  await menu.getByRole('button', { name: /Rebind Jump; current key Space/ }).click();
  await page.keyboard.press('KeyZ');
  await expect(menu.getByRole('button', { name: /Rebind Jump; current key Z/ })).toBeVisible();
  await expect(menu.getByText('jump now uses KeyZ.')).toBeVisible();
  await menu.getByRole('button', { name: /Rebind Move left; current key Left/ }).click();
  await page.keyboard.press('KeyH');
  await expect(menu.getByRole('button', { name: /Rebind Move left; current key H/ })).toBeVisible();
  await menu.getByRole('button', { name: 'Resume' }).click();
  await expect(menu).toBeHidden();

  await page.keyboard.down('KeyZ');
  await page.waitForFunction(() => window.__RIVENBLOOM_TEST__?.read().player?.state === 'jump');
  await page.keyboard.up('KeyZ');

  await page.keyboard.press('Escape');
  await menu.getByRole('button', { name: 'Settings' }).click();
  await expect(menu.getByLabel('Reduced motion')).toBeChecked();
  await expect(menu.getByLabel('Text scale')).toHaveValue('1.25');
  await expect(menu.getByRole('button', { name: /Rebind Jump; current key Z/ })).toBeVisible();
  await expect(menu.getByRole('button', { name: /Rebind Move left; current key H/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('opening Pause focuses Resume and Enter keeps the journey open', async ({ page }) => {
  await beginJourney(page);
  await page.keyboard.press('Escape');
  const menu = page.getByRole('dialog', { name: 'Wayfinder Ledger' });
  await expect(menu.getByRole('button', { name: 'Resume', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  await expect(page.getByLabel('Gameplay status')).toBeVisible();
});
