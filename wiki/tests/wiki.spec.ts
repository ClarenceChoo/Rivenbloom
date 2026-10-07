import { expect, test } from '@playwright/test';
import { ARTICLES } from '../content';

test('storybook loads its art and supports navigation, history, and search', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Welcome · Rivenbloom Wiki');
  await expect(page.locator('.hero-art')).toBeVisible();
  expect(
    await page.locator('.hero-art').evaluate((image) => (image as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  await page.getByRole('link', { name: 'Begin your journey' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Getting started');
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Every great journey');
  await page.getByRole('button', { name: 'Explore the wiki' }).click();
  await page.getByRole('searchbox').fill('50 resin');
  await page.getByRole('link', { name: /IV. Heart of the Briar/ }).click();
  await expect(page).toHaveURL(/#walkthrough\/reforge$/);
  const step = page.locator('#section-reforge details');
  await expect(step).not.toHaveAttribute('open');
  await step.locator('summary').click();
  await expect(step).toContainText('1 Briar Core and 50 Resin');
  await expect(step).toHaveAttribute('open', '');
  expect(errors).toEqual([]);
});

test('deep links reload, unknown routes recover, and searches handle empty results', async ({
  page,
}) => {
  await page.goto('/#dungeon/choir-seal');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rootglass Reliquary');
  await expect(page.locator('#section-choir-seal summary')).toBeInViewport();
  await page.goto('/#not-a-chapter');
  await expect(page).toHaveURL(/#welcome$/);
  await page.keyboard.press('/');
  await expect(page.getByRole('searchbox')).toBeFocused();
  await page.getByRole('searchbox').fill('<script>no-results</script>');
  await expect(page.getByText('No page found in these notes.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('discovery notes survive reload and can be unchecked', async ({ page }) => {
  await page.goto('/#secrets');
  const discovery = page.getByRole('checkbox', { name: /Explore the Herb Loft/ });
  await discovery.check();
  await expect(page.getByRole('status').filter({ hasText: '1 of 9' })).toBeVisible();
  await page.reload();
  await expect(discovery).toBeChecked();
  await discovery.uncheck();
  await expect(page.getByRole('status').filter({ hasText: '0 of 9' })).toBeVisible();
});

test('mobile contents, reading, and search have no page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Contents' }).click();
  await page
    .getByRole('navigation', { name: 'Wiki chapters' })
    .getByRole('link', { name: /Items & equipment/ })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Items & equipment');
  await expect(page.getByRole('button', { name: 'Contents' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Explore the wiki' }).click();
  await page.getByRole('searchbox').fill('Aegis');
  await expect(page.locator('.search-result').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('blocked browser storage keeps the checklist usable and tells the reader', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Storage blocked');
      },
    });
  });
  await page.goto('/#secrets');
  await page.getByRole('checkbox', { name: /Explore the Herb Loft/ }).check();
  await expect(page.locator('#checklist-status')).toContainText(
    '1 of 9 discoveries marked. Browser storage unavailable',
  );
});

test('production assets and refreshed chapters work under a GitHub Pages subdirectory', async ({
  page,
}) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  // Emulate mounting the built directory at a project URL on a static file host.
  await page.route('**/Rivenbloom/**', async (route) => {
    const response = await route.fetch({ url: route.request().url().replace('/Rivenbloom/', '/') });
    await route.fulfill({ response });
  });
  await page.goto('/Rivenbloom/');
  await expect(page.locator('.hero-art')).toBeVisible();
  expect(
    await page.locator('.hero-art').evaluate((image) => (image as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  for (const article of ARTICLES.filter((entry) => entry.id !== 'welcome')) {
    await page.goto(`/Rivenbloom/#${article.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(article.title);
  }
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Pallid Cantor');
  expect(failures).toEqual([]);
});
