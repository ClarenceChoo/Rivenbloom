import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type WorldSnapshot = Readonly<{
  activeScene: string;
  titleReady: boolean;
  slotStates: readonly string[];
  transition: Readonly<{ mode: 'new' | 'load'; slotId: string }> | null;
  world: Readonly<{
    slotId: string;
    mode: 'new' | 'load';
    areaId: string;
    roomId: string;
    checkpointId: string;
    position: Readonly<{ x: number; y: number }>;
  }> | null;
}>;

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function snapshot(page: Page): Promise<WorldSnapshot> {
  return page.evaluate(() =>
    (
      window as Window & {
        __RIVENBLOOM_TEST__: { read(): WorldSnapshot };
      }
    ).__RIVENBLOOM_TEST__.read(),
  );
}

async function waitForTitle(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (
        window as Window & {
          __RIVENBLOOM_TEST__?: { read(): WorldSnapshot };
        }
      ).__RIVENBLOOM_TEST__?.read().titleReady === true,
  );
}

async function beginJourney(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Begin journey for Journey 1' }).click();
  await page
    .getByRole('dialog', { name: 'Begin a new journey in Journey 1?' })
    .getByRole('button', { name: 'Begin journey' })
    .click();
  await expect(page.getByRole('button', { name: "Enter Wren's Rest" })).toBeFocused();
}

test('Return leaves the selected journey empty before and after reload', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await waitForTitle(page);
  await beginJourney(page);
  await page.getByRole('button', { name: 'Return to title' }).click();
  await waitForTitle(page);

  await expect(page.getByText('No journey yet')).toHaveCount(3);
  expect((await snapshot(page)).slotStates).toEqual(['empty', 'empty', 'empty']);
  await page.reload();
  await waitForTitle(page);
  await expect(page.getByText('No journey yet')).toHaveCount(3);
  expect((await snapshot(page)).slotStates).toEqual(['empty', 'empty', 'empty']);
  expect(errors).toEqual([]);
});

test('Enter saves, reloads, and re-enters the same journey in load mode', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await waitForTitle(page);
  await beginJourney(page);
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  await page.waitForFunction(
    () =>
      (
        window as Window & {
          __RIVENBLOOM_TEST__?: { read(): WorldSnapshot };
        }
      ).__RIVENBLOOM_TEST__?.read().world?.mode === 'new',
  );
  expect((await snapshot(page)).world).toEqual({
    slotId: 'slot-1',
    mode: 'new',
    areaId: 'wren-rest',
    roomId: 'wren-rest-square',
    checkpointId: 'village-well',
    position: { x: 256, y: 608 },
  });

  await page.reload();
  await waitForTitle(page);
  await expect(page.getByRole('button', { name: 'Continue Journey 1' })).toBeEnabled();
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await expect(page.getByRole('button', { name: "Enter Wren's Rest" })).toBeFocused();
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  await page.waitForFunction(
    () =>
      (
        window as Window & {
          __RIVENBLOOM_TEST__?: { read(): WorldSnapshot };
        }
      ).__RIVENBLOOM_TEST__?.read().world?.mode === 'load',
  );
  expect((await snapshot(page)).world).toEqual({
    slotId: 'slot-1',
    mode: 'load',
    areaId: 'wren-rest',
    roomId: 'wren-rest-square',
    checkpointId: 'village-well',
    position: { x: 256, y: 608 },
  });
  expect(errors).toEqual([]);
});
