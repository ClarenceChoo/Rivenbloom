import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type PlayerSnapshot = Readonly<{
  position: Readonly<{ x: number; y: number }>;
  velocity: Readonly<{ x: number; y: number }>;
  state: string;
  grounded: boolean;
  animationIntent: string;
}>;

type MovementBridge = Readonly<{
  read(): Readonly<{
    titleReady: boolean;
    player: PlayerSnapshot | null;
    camera: Readonly<{ scrollX: number; scrollY: number; zoom: number }> | null;
  }>;
  act(action: Readonly<{ kind: 'respawn' }>): void;
}>;

function bridge(
  page: Page,
): Promise<MovementBridge['read'] extends () => infer Result ? Result : never> {
  return page.evaluate(() =>
    (
      window as Window & {
        __RIVENBLOOM_TEST__: MovementBridge;
      }
    ).__RIVENBLOOM_TEST__.read(),
  );
}

async function enterWrenRest(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () =>
      (
        window as Window & {
          __RIVENBLOOM_TEST__?: MovementBridge;
        }
      ).__RIVENBLOOM_TEST__?.read().titleReady === true,
  );
  await page.getByRole('button', { name: 'Begin journey for Journey 1' }).click();
  await page
    .getByRole('dialog', { name: 'Begin a new journey in Journey 1?' })
    .getByRole('button', { name: 'Begin journey' })
    .click();
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  await page.waitForFunction(
    () =>
      (
        window as Window & {
          __RIVENBLOOM_TEST__?: MovementBridge;
        }
      ).__RIVENBLOOM_TEST__?.read().player?.position !== undefined,
  );
}

test('semantic input moves, jumps, lands, scrolls the camera, and respawns at authored feet', async ({
  page,
}) => {
  test.setTimeout(25_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await enterWrenRest(page);

  expect((await bridge(page)).player?.position).toEqual({ x: 256, y: 608 });
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(
    () =>
      (
        window as Window & {
          __RIVENBLOOM_TEST__: MovementBridge;
        }
      ).__RIVENBLOOM_TEST__.read().player?.position.x !== undefined &&
      (
        window as Window & {
          __RIVENBLOOM_TEST__: MovementBridge;
        }
      ).__RIVENBLOOM_TEST__.read().player!.position.x >= 1_800,
  );
  await page.keyboard.up('ArrowRight');
  await expect.poll(async () => (await bridge(page)).player?.velocity.x).toBe(0);
  const afterRun = await bridge(page);
  expect(afterRun.player?.position.x).toBeGreaterThanOrEqual(1_800);
  expect(afterRun.player?.position.x).toBeLessThan(2_400);
  expect(afterRun.player).toMatchObject({ position: { y: 608 }, grounded: true });
  expect(afterRun.camera?.scrollX).toBeGreaterThan(0);

  await page.keyboard.down('Space');
  await page.waitForFunction(() => {
    const player = (
      window as Window & {
        __RIVENBLOOM_TEST__: MovementBridge;
      }
    ).__RIVENBLOOM_TEST__.read().player;
    return player !== null && player.position.y < 570 && ['jump', 'fall'].includes(player.state);
  });
  await page.keyboard.up('Space');
  await page.waitForFunction(
    () =>
      (
        window as Window & {
          __RIVENBLOOM_TEST__: MovementBridge;
        }
      ).__RIVENBLOOM_TEST__.read().player!.grounded,
  );
  expect((await bridge(page)).player?.position.y).toBe(608);

  await page.evaluate(() =>
    (
      window as Window & {
        __RIVENBLOOM_TEST__: MovementBridge;
      }
    ).__RIVENBLOOM_TEST__.act({ kind: 'respawn' }),
  );
  await expect
    .poll(async () => (await bridge(page)).player)
    .toMatchObject({ position: { x: 256, y: 608 }, state: 'idle' });
  expect(errors).toEqual([]);
});
