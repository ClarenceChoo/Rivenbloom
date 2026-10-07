import { expect, test } from '@playwright/test';
import { ProductionDriver } from './productionDriver';
import { observeProductionCanvas } from './productionObservation';

test('fresh production journey uses real controls and durable checkpoints', async ({
  page,
}, info) => {
  test.skip(
    process.env.RIVENBLOOM_TEST_RENDERER !== 'canvas',
    'Read-only paint observation requires the supported Canvas renderer.',
  );
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await observeProductionCanvas(page);
  const play = new ProductionDriver(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin journey for Journey 1' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Begin journey', exact: true })
    .click();
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  expect(await page.evaluate(() => '__RIVENBLOOM_TEST__' in window)).toBe(false);
  await play.interact(672, 'Speak with Sela');
  await play.choose('Sela Quill', 'I will listen.');
  await play.cross('ArrowRight', 'brackenreach-trail');
  await play.rest(256, 'Trailhead Seed-Lantern');
  await play.interact(896, 'Open Wayfarer Cache');
  await play.fight('briar-scrapper');
  await play.move(1900);
  await play.face(true);
  await play.heavy();
  await play.interact(2240, 'Light memorial lantern');
  await play.passage(2080, 'split-cedar-sanctum');
  await play.interact(3056, 'Open Resin Cache');
  await play.cross('ArrowLeft', 'brackenreach-trail');
  await play.cross('ArrowRight', 'listening-arch');
  await play.rest(4096, 'Listening Arch Seed-Lantern');
  await play.interact(4448, 'Open shortcut');
  await play.interact(5872, 'Open Survey Cache');
  await play.cross('ArrowRight', 'hollows-mouth');
  await play.rest(256, 'Hollows Mouth Seed-Lantern');
  await play.cross('ArrowRight', 'echo-pool');
  await play.interact(2144, 'Light memorial lantern');
  await play.interact(3296, 'Examine Heart Petal');
  await play.cross('ArrowRight', 'root-memory-chamber');
  await play.rest(3776, 'Root-Memory Seed-Lantern');
  await play.interact(4176, 'Recover the root memory');
  await play.reload('root-memory-chamber');
  await play.passage(4480, 'dash-trial');
  await play.move(4570);
  await page.keyboard.down('ArrowUp');
  try {
    await expect
      .poll(async () => (await play.state()).player.y, { timeout: 10000 })
      .toBeLessThanOrEqual(1440);
  } finally {
    await page.keyboard.up('ArrowUp');
  }
  await play.move(4480);
  await play.move(3904);
  await play.move(4992);
  await expect
    .poll(async () => (await play.saved()).player.unlockedAbilities)
    .toContain('wayfinder-dash');
  await play.passage(4400, 'root-memory-chamber');
  await play.cross('ArrowRight', 'reliquary-verge');
  await play.rest(6656, 'Reliquary Verge Seed-Lantern');
  await play.reload('reliquary-verge');
  await page.screenshot({ path: info.outputPath('fresh-production-verge.png') });
  expect(errors).toEqual([]);
});
