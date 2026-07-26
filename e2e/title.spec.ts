import { expect, test } from '@playwright/test';

test('renders the accessible title and starts a new game in Wren’s Rest', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');

  const title = page.getByRole('heading', { name: 'RIVENBLOOM', level: 1 });
  await expect(title).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main menu' })).toBeVisible();

  const titleSurface = page.getByTestId('title-surface');
  await expect(titleSurface).toHaveCSS('background-image', /title-wrens-rest-background\.png/);
  await expect(titleSurface).not.toHaveCSS('background-image', /rivenbloom-title-concept/);

  const continueButton = page.getByRole('button', { name: 'CONTINUE' });
  const newGameButton = page.getByRole('button', { name: 'NEW GAME' });
  await expect(continueButton).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(newGameButton).toBeFocused();
  await page.keyboard.press('Enter');

  const drawer = page.getByRole('region', { name: 'New game save slots' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: /EMPTY SLOT/ })).toHaveCount(3);

  await drawer
    .getByRole('button', { name: /EMPTY SLOT/ })
    .first()
    .click();
  const confirmation = page.getByRole('dialog', { name: 'NEW GAME' });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'NEW GAME' }).click();

  const destination = page.getByRole('heading', { name: "WREN'S REST", level: 1 });
  await expect(destination).toBeVisible();
  await expect(page.locator('[data-destination="wrens-rest"]')).toBeVisible();
  await expect(page.locator('canvas[data-area-id="brackenreach-trail"]')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('keeps confirmation input modal and restores persisted accessibility settings', async ({
  page
}) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'NEW GAME' }).click();
  await page
    .getByRole('region', { name: 'New game save slots' })
    .getByRole('button', { name: /EMPTY SLOT 1/ })
    .click();
  await page
    .getByRole('dialog', { name: 'NEW GAME' })
    .getByRole('button', { name: 'NEW GAME' })
    .click();
  await expect(page.locator('[data-destination="wrens-rest"]')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'RIVENBLOOM', level: 1 })).toBeVisible();
  const settingsButton = page.getByRole('button', { name: 'SETTINGS' });
  await settingsButton.click();
  const settingsDialog = page.getByRole('dialog', { name: 'SETTINGS' });
  const settingsBack = settingsDialog.getByRole('button', { name: 'Back' });
  await expect(settingsBack).toBeFocused();

  await page.keyboard.press('Tab');
  await expect
    .poll(() => settingsDialog.evaluate((dialog) => dialog.contains(document.activeElement)))
    .toBe(true);

  await settingsBack.click();
  await expect(settingsButton).toBeFocused();

  await settingsButton.click();
  await settingsDialog.getByRole('checkbox', { name: 'Reduced motion' }).check();
  await settingsDialog.getByRole('combobox', { name: 'Text scale' }).selectOption('1.3');
  await settingsDialog.getByRole('button', { name: 'Back' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<{ readonly reducedMotion: boolean; readonly textScale: number }>(
            (resolve, reject) => {
              const open = indexedDB.open('rivenbloom-saves');
              open.onerror = () => reject(open.error);
              open.onsuccess = () => {
                const request = open.result
                  .transaction('save-slots', 'readonly')
                  .objectStore('save-slots')
                  .get('slot-1');
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                  const record = request.result as {
                    readonly current?: {
                      readonly save?: {
                        readonly settings?: {
                          readonly reducedMotion?: boolean;
                          readonly textScale?: number;
                        };
                      };
                    };
                  };
                  resolve({
                    reducedMotion: record.current?.save?.settings?.reducedMotion === true,
                    textScale: record.current?.save?.settings?.textScale ?? 0
                  });
                  open.result.close();
                };
              };
            }
          )
      )
    )
    .toEqual({ reducedMotion: true, textScale: 1.3 });
  await page.reload();

  await expect(page.getByRole('heading', { name: 'RIVENBLOOM', level: 1 })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  await expect(page.locator('html')).toHaveCSS('--text-scale', '1.3');
  await page.getByRole('button', { name: 'SETTINGS' }).click();
  await expect(
    page.getByRole('dialog', { name: 'SETTINGS' }).getByRole('checkbox', {
      name: 'Reduced motion'
    })
  ).toBeChecked();
  await expect(
    page.getByRole('dialog', { name: 'SETTINGS' }).getByRole('combobox', {
      name: 'Text scale'
    })
  ).toHaveValue('1.3');
  await page
    .getByRole('dialog', { name: 'SETTINGS' })
    .getByRole('button', { name: 'Back' })
    .click();

  await page.getByRole('button', { name: 'NEW GAME' }).click();
  const occupiedSlot = page
    .getByRole('region', { name: 'New game save slots' })
    .getByRole('button', { name: /WREN'S REST/ })
    .first();
  await expect(occupiedSlot).toBeFocused();
  await page.keyboard.down('Enter');
  const confirmation = page.getByRole('dialog', { name: 'NEW GAME' });
  await expect(confirmation).toBeVisible();
  for (let repeat = 0; repeat < 3; repeat += 1) {
    await page.evaluate(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          repeat: true,
          bubbles: true
        })
      );
    });
    await page.waitForTimeout(40);
  }
  await expect(confirmation).toBeVisible();
  await expect(page.locator('[data-destination="wrens-rest"]')).toHaveCount(0);
  await page.keyboard.up('Enter');
  await page.keyboard.press('Enter');
  await expect(page.locator('.transition-surface.reduced-motion')).toBeVisible();
});
