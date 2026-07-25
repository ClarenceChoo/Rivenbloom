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
  expect(pageErrors).toEqual([]);
});
