import { expect, test } from '@playwright/test';

test('manifest assets and service worker provide an offline application-shell reload', async ({
  context,
  page,
}) => {
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  expect(await manifest.json()).toMatchObject({
    name: 'Rivenbloom',
    display: 'standalone',
    orientation: 'landscape',
  });
  expect((await page.request.get('/icons/rivenbloom-icon.svg')).ok()).toBe(true);
  expect((await page.request.get('/sw.js')).ok()).toBe(true);

  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => window.__RIVENBLOOM_TEST__?.read().titleReady === true);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.__RIVENBLOOM_TEST__?.read().titleReady === true);
  await expect(page.getByRole('heading', { name: 'Rivenbloom' })).toBeVisible();
});
