import { expect, test } from '@playwright/test';

test('IndexedDB saves rotate a backup and keep slot records isolated', async ({ page }) => {
  await page.goto('/tests/saves/browser/indexeddb-harness.html');
  await page.waitForFunction(
    () =>
      typeof (window as Window & { runIndexedDbSaveRepositoryTest?: unknown })
        .runIndexedDbSaveRepositoryTest === 'function'
  );

  const result = await page.evaluate(async () => {
    const runner = (window as Window & { runIndexedDbSaveRepositoryTest?: () => Promise<unknown> })
      .runIndexedDbSaveRepositoryTest;
    if (runner === undefined) throw new Error('IndexedDB save harness did not load.');
    return runner();
  });

  expect(result).toEqual({
    slotIsolation: true,
    recoveredCreatedAt: 1,
    wrongSlotRecordsAreCorrupt: true
  });
});
