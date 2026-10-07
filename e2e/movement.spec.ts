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

test('reversing direction eases camera look-ahead without a frame jump', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await enterWrenRest(page);
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await bridge(page)).player?.position.x).toBeGreaterThan(1_200);
  await page.keyboard.up('ArrowRight');
  await expect.poll(async () => (await bridge(page)).player?.velocity.x).toBe(0);

  for (const direction of ['ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight']) {
    const before = (await bridge(page)).camera!.scrollX;
    const [samples] = await Promise.all([
      page.evaluate(
        () =>
          new Promise<readonly Readonly<{ time: number; x: number }>[]>((resolve) => {
            const samples: { time: number; x: number }[] = [];
            const record = (): void => {
              const time = performance.now();
              const snapshot = (
                window as Window & { __RIVENBLOOM_TEST__: MovementBridge }
              ).__RIVENBLOOM_TEST__.read();
              samples.push({ time, x: snapshot.camera!.scrollX });
              if (time - samples[0]!.time >= 350) resolve(samples);
              else requestAnimationFrame(record);
            };
            record();
          }),
      ),
      page.keyboard.press(direction, { delay: 180 }),
    ]);
    expect(samples.length).toBeGreaterThan(2);
    for (let index = 1; index < samples.length; index += 1) {
      const previous = samples[index - 1]!;
      const current = samples[index]!;
      // Phaser smooths its delta; rapid browser callbacks can still advance a full game frame.
      const elapsed = Math.max(1_000 / 60, current.time - previous.time);
      expect(
        Math.abs(current.x - previous.x) / (elapsed / 1_000),
        JSON.stringify({ previous, current }),
      ).toBeLessThan(2_500);
    }
    const after = (await bridge(page)).camera!.scrollX;
    if (direction === 'ArrowLeft') expect(after).toBeLessThan(before);
    else expect(after).toBeGreaterThan(before);
  }
  expect(errors).toEqual([]);
});
