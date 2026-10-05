import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type OptionalSnapshot = Readonly<{
  titleReady: boolean;
  world: Readonly<{ roomId: string; checkpointId: string }> | null;
  player: Readonly<{
    position: Readonly<{ x: number; y: number }>;
    velocity: Readonly<{ x: number; y: number }>;
  }> | null;
  worldUi: Readonly<{
    checkpoint: Readonly<{ checkpointId: string }>;
    player: Readonly<{ currentHealth: number; currentMana: number }>;
  }> | null;
}>;

async function snapshot(page: Page): Promise<OptionalSnapshot> {
  return page.evaluate(() =>
    (
      window as Window & {
        __RIVENBLOOM_TEST__: { read(): OptionalSnapshot };
      }
    ).__RIVENBLOOM_TEST__.read(),
  );
}

async function beginJourney(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () =>
      (
        window as Window & {
          __RIVENBLOOM_TEST__?: { read(): OptionalSnapshot };
        }
      ).__RIVENBLOOM_TEST__?.read().titleReady === true,
  );
  await page.getByRole('button', { name: 'Begin journey for Journey 1' }).click();
  await page
    .getByRole('dialog', { name: 'Begin a new journey in Journey 1?' })
    .getByRole('button', { name: 'Begin journey' })
    .click();
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  await expect.poll(async () => (await snapshot(page)).world?.roomId).toBe('wren-rest-square');
}

async function moveToX(page: Page, target: number): Promise<void> {
  await page.waitForTimeout(100);
  const start = (await snapshot(page)).player?.position.x;
  if (start === undefined) throw new Error('Player disappeared before optional-room movement.');
  const right = start < target;
  const key = right ? 'ArrowRight' : 'ArrowLeft';
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(
      ({ x, movingRight }) => {
        const player = (
          window as Window & {
            __RIVENBLOOM_TEST__: { read(): OptionalSnapshot };
          }
        ).__RIVENBLOOM_TEST__.read().player;
        return player !== null && (movingRight ? player.position.x >= x : player.position.x <= x);
      },
      { x: target, movingRight: right },
      { polling: 'raf', timeout: 12_000 },
    );
  } finally {
    await page.keyboard.up(key);
  }
  await expect.poll(async () => (await snapshot(page)).player?.velocity.x).toBe(0);
}

async function enterInteractRoom(page: Page, x: number, roomId: string): Promise<void> {
  await moveToX(page, x);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.keyboard.press('e');
    const entered = await expect
      .poll(async () => (await snapshot(page)).world?.roomId, { timeout: 1_500 })
      .toBe(roomId)
      .then(() => true)
      .catch(() => false);
    if (entered) return;
    await moveToX(page, x + (attempt % 2 === 0 ? -24 : 24));
  }
  throw new Error(`Optional room ${roomId} did not open.`);
}

test('optional Wren rooms enter and return without changing checkpoint or resources', async ({
  page,
}) => {
  test.setTimeout(45_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await beginJourney(page);
  const initial = (await snapshot(page)).worldUi!;

  await enterInteractRoom(page, 2050, 'wren-herb-loft');
  expect((await snapshot(page)).worldUi).toMatchObject({
    checkpoint: { checkpointId: 'village-well' },
    player: initial.player,
  });
  await moveToX(page, 2700);
  await moveToX(page, 2600);
  await expect.poll(async () => (await snapshot(page)).world?.roomId).toBe('wren-rest-square');

  await enterInteractRoom(page, 1500, 'wren-forge-cellar');
  expect((await snapshot(page)).worldUi).toMatchObject({
    checkpoint: { checkpointId: 'village-well' },
    player: initial.player,
  });
  await moveToX(page, 3660);
  await moveToX(page, 3560);
  await expect.poll(async () => (await snapshot(page)).world?.roomId).toBe('wren-rest-square');
  expect(errors).toEqual([]);
});
