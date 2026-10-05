import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type EndingSnapshot = Readonly<{
  titleReady: boolean;
  world: Readonly<{ roomId: string }> | null;
  player: Readonly<{ position: Readonly<{ x: number; y: number }> }> | null;
  worldUi: Readonly<{
    prompt: string | null;
    quests: readonly Readonly<{ questId: string; stageId: string }>[];
    inventory: readonly Readonly<{ itemId: string; quantity: number }>[];
  }> | null;
}>;

function read(page: Page): Promise<EndingSnapshot> {
  return page.evaluate(() => window.__RIVENBLOOM_TEST__!.read() as unknown as EndingSnapshot);
}

async function enterEndingJourney(page: Page): Promise<void> {
  await page.goto('/?debug-ending=silent-bloom');
  await page.waitForFunction(() => window.__RIVENBLOOM_TEST__?.read().titleReady === true);
  await page.getByRole('button', { name: 'Begin journey for Journey 1' }).click();
  await page
    .getByRole('dialog', { name: 'Begin a new journey in Journey 1?' })
    .getByRole('button', { name: 'Begin journey' })
    .click();
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  await expect.poll(async () => (await read(page)).world?.roomId).toBe('wren-rest-square');
}

async function moveToSela(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await read(page)).worldUi?.prompt === 'Speak with Sela') return;
    await page.keyboard.down('ArrowRight');
    try {
      await page
        .waitForFunction(
          () => window.__RIVENBLOOM_TEST__?.read().worldUi?.prompt === 'Speak with Sela',
          undefined,
          { polling: 'raf', timeout: 2_000 },
        )
        .catch(() => undefined);
    } finally {
      await page.keyboard.up('ArrowRight');
    }
  }
  expect((await read(page)).worldUi?.prompt).toBe('Speak with Sela');
}

test('the composed real-input path closes at durable credits and does not replay its reward', async ({
  page,
}) => {
  test.setTimeout(30_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await enterEndingJourney(page);
  await moveToSela(page);
  await page.keyboard.press('KeyE');
  const sela = page.getByRole('dialog', { name: 'Sela Quill' });
  await expect(sela).toBeVisible();
  await sela.getByRole('button', { name: 'Mark the song returned.' }).click();

  await expect(page.getByRole('heading', { name: 'The song returns' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Credits' })).toBeVisible();
  await expect(page.getByText('Journey complete')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue exploring' })).toBeFocused();
  const endingBounds = await page.locator('.ending-panel').evaluate((panel) => {
    const bounds = panel.getBoundingClientRect();
    const heading = panel.querySelector('h1')!.getBoundingClientRect();
    const actions = panel.querySelector('.transition-actions')!.getBoundingClientRect();
    return {
      top: bounds.top,
      bottom: bounds.bottom,
      headingTop: heading.top,
      actionsBottom: actions.bottom,
    };
  });
  expect(endingBounds.headingTop).toBeGreaterThanOrEqual(endingBounds.top);
  expect(endingBounds.actionsBottom).toBeLessThanOrEqual(endingBounds.bottom);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.keyboard.press('Tab');
  const returnToTitle = page.getByRole('button', { name: 'Return to title' });
  await expect(returnToTitle).toBeFocused();
  const shortScreenBounds = await returnToTitle.evaluate((button) => {
    const panel = button.closest('.ending-panel')!.getBoundingClientRect();
    const bounds = button.getBoundingClientRect();
    return {
      top: panel.top,
      bottom: panel.bottom,
      buttonTop: bounds.top,
      buttonBottom: bounds.bottom,
    };
  });
  expect(shortScreenBounds.buttonTop).toBeGreaterThanOrEqual(shortScreenBounds.top);
  expect(shortScreenBounds.buttonBottom).toBeLessThanOrEqual(shortScreenBounds.bottom);
  await page.getByRole('button', { name: 'Return to title' }).click();
  await page.waitForFunction(() => window.__RIVENBLOOM_TEST__?.read().titleReady === true);

  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  await expect
    .poll(
      async () =>
        (await read(page)).worldUi?.quests.find(({ questId }) => questId === 'the-silent-bloom')
          ?.stageId,
    )
    .toBe('complete');
  expect(
    (await read(page)).worldUi?.inventory.filter(({ itemId }) => itemId === 'cantor-sigil'),
  ).toEqual([expect.objectContaining({ quantity: 1 })]);
  await moveToSela(page);
  await page.keyboard.press('KeyE');
  await expect(
    page
      .getByRole('dialog', { name: 'Sela Quill' })
      .getByText(
        'The bloom is open again. Even the oldest roads have begun to remember their names.',
      ),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The song returns' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
