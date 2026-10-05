import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { computedContrastRatio } from './contrast';

test('fresh production route reaches the Sentinel after the Dash Trial', async ({
  page,
}, testInfo) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin journey for Journey 1' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Begin journey', exact: true })
    .click();
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  const restPrompt = page.getByText('E · Rest at Village Seed-Lantern');
  await expect(restPrompt).toBeVisible();
  await page.keyboard.down('ArrowRight');
  try {
    await expect(restPrompt).toBeHidden({ timeout: 5_000 });
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  const selaPrompt = page.getByText('E · Speak with Sela');
  for (const direction of ['ArrowRight', 'ArrowLeft'] as const) {
    for (let step = 0; step < 25 && !(await selaPrompt.isVisible()); step += 1) {
      await page.keyboard.press(direction, { delay: 100 });
    }
  }
  await expect(selaPrompt).toBeVisible();
  await page.keyboard.press('KeyE');
  const dialogue = page.getByRole('dialog', { name: 'Sela Quill' });
  await expect(dialogue).toBeVisible();
  await dialogue.getByRole('button', { name: 'I will listen.' }).click();
  await expect(page.getByText('Trace the root-song beneath Brackenreach.')).toBeVisible();
  await expect(page.getByText('Save: Saved', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  await expect(page.getByText('Trace the root-song beneath Brackenreach.')).toBeVisible();
  await page.keyboard.press('Escape');
  const menu = page.getByRole('dialog', { name: 'Wayfinder Ledger' });
  await expect(menu).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('production-map.png') });
  expect(
    await computedContrastRatio(menu.locator('.room-map .map-node[data-current="true"]')),
  ).toBeGreaterThanOrEqual(4.5);
  expect(
    await menu
      .locator('.room-map .map-node[data-current="true"] small')
      .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
  ).toBeGreaterThanOrEqual(12);
  expect(await page.evaluate(() => '__RIVENBLOOM_TEST__' in window)).toBe(false);
  await menu.getByRole('button', { name: 'Resume' }).click();
  await page.keyboard.down('ArrowRight');
  try {
    await expect(page.getByText('Brackenreach · Brackenreach Trail')).toBeVisible({
      timeout: 20_000,
    });
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  await expect(page.getByText('Trace the root-song beneath Brackenreach.')).toBeVisible();
  await expect(page.getByText('E · Rest at Trailhead Seed-Lantern')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('production-brackenreach.png') });
  await page.keyboard.press('KeyE');
  const cachePrompt = page.getByText('E · Open Wayfarer Cache');
  let direction: 'ArrowRight' | 'ArrowLeft' = 'ArrowRight';
  for (let step = 0; step < 65 && !(await cachePrompt.isVisible()); step += 1) {
    if (await page.getByText('E · Light memorial lantern').isVisible()) direction = 'ArrowLeft';
    await page.keyboard.press(direction, { delay: 150 });
  }
  await expect(cachePrompt).toBeVisible();
  const resinReward = page.getByText('Resin: 20', { exact: true });
  for (let attempt = 0; attempt < 6 && !(await resinReward.isVisible()); attempt += 1) {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(400);
  }
  await expect(resinReward).toBeVisible();
  await expect(page.getByText('Save: Saved', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: /^Enter / }).click();
  await expect(page.getByText('Resin: 20', { exact: true })).toBeVisible();
  const trailheadPrompt = page.getByText('E · Rest at Trailhead Seed-Lantern');
  await expect(trailheadPrompt).toBeVisible();
  await page.keyboard.down('ArrowRight');
  try {
    await expect(trailheadPrompt).toBeHidden({ timeout: 5_000 });
    await page.waitForTimeout(1_600);
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  await page.screenshot({ path: testInfo.outputPath('production-briar-approach.png') });
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1_400);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1_200);
  await page.keyboard.up('ArrowRight');
  await page.screenshot({ path: testInfo.outputPath('production-briar-engage.png') });
  const healthMeter = page.getByRole('progressbar', { name: /Health:/ });
  expect(await healthMeter.evaluate((meter) => (meter as HTMLProgressElement).value)).toBeLessThan(
    100,
  );
  for (let combo = 0; combo < 3; combo += 1) {
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(100);
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(110);
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(400);
  }
  const manaMeter = page.getByRole('progressbar', { name: /Mana:/ });
  for (
    let attempt = 0;
    attempt < 6 &&
    (await manaMeter.evaluate((meter) => (meter as HTMLProgressElement).value)) === 40;
    attempt += 1
  ) {
    await page.keyboard.press('KeyQ');
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: testInfo.outputPath('production-briar-combat.png') });
  expect(await manaMeter.evaluate((meter) => (meter as HTMLProgressElement).value)).toBeLessThan(
    40,
  );
  expect(
    await healthMeter.evaluate((meter) => (meter as HTMLProgressElement).value),
  ).toBeGreaterThan(0);
  const listeningArchLabel = page.getByText('Brackenreach · Listening Arch');
  await page.keyboard.down('ArrowRight');
  try {
    for (let leap = 0; leap < 22 && !(await listeningArchLabel.isVisible()); leap += 1) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(400);
    }
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  await expect(listeningArchLabel).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('production-listening-arch.png') });
  const archLantern = page.getByText('E · Rest at Listening Arch Seed-Lantern');
  for (let step = 0; step < 25 && !(await archLantern.isVisible()); step += 1) {
    await page.keyboard.press('ArrowRight', { delay: 100 });
  }
  await expect(archLantern).toBeVisible();
  for (
    let attempt = 0;
    attempt < 4 &&
    (await healthMeter.evaluate((meter) => (meter as HTMLProgressElement).value)) < 100;
    attempt += 1
  ) {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(200);
  }
  expect(await healthMeter.evaluate((meter) => (meter as HTMLProgressElement).value)).toBe(100);
  const memoryObjective = page.getByText('Recover the root-memory in the Singing Hollows.');
  await page.keyboard.down('ArrowRight');
  try {
    await expect(memoryObjective).toBeVisible({ timeout: 5_000 });
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  await expect(page.getByText('Save: Saved', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: /^Enter / }).click();
  await expect(listeningArchLabel).toBeVisible();
  await expect(memoryObjective).toBeVisible();
  await page.keyboard.press('Escape');
  const restoredMenu = page.getByRole('dialog', { name: 'Wayfinder Ledger' });
  const villageMapNode = restoredMenu.locator('.room-map .map-node', {
    hasText: "Wren's Rest Square",
  });
  await expect(villageMapNode).toHaveCount(1);
  await expect(villageMapNode).not.toContainText('Quest');
  await restoredMenu.getByRole('button', { name: 'Resume' }).click();
  const hollowsLabel = page.getByText('Singing Hollows · Hollows Mouth');
  await page.keyboard.down('ArrowRight');
  try {
    for (let leap = 0; leap < 25 && !(await hollowsLabel.isVisible()); leap += 1) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(400);
    }
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  await expect(hollowsLabel).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('production-hollows-mouth.png') });
  const hollowsLantern = page.getByText('E · Rest at Hollows Mouth Seed-Lantern');
  await expect(hollowsLantern).toBeVisible();
  for (
    let attempt = 0;
    attempt < 4 &&
    (await healthMeter.evaluate((meter) => (meter as HTMLProgressElement).value)) < 100;
    attempt += 1
  ) {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(200);
  }
  expect(await healthMeter.evaluate((meter) => (meter as HTMLProgressElement).value)).toBe(100);
  await expect(page.getByText('Save: Saved', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: /^Enter / }).click();
  await expect(hollowsLabel).toBeVisible();
  await expect(memoryObjective).toBeVisible();
  const echoPoolLabel = page.getByText('Singing Hollows · Echo Pool');
  await page.keyboard.down('ArrowRight');
  try {
    for (let leap = 0; leap < 25 && !(await echoPoolLabel.isVisible()); leap += 1) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(400);
    }
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  await expect(echoPoolLabel).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('production-echo-pool.png') });
  const memoryChamberLabel = page.getByText('Singing Hollows · Root-Memory Chamber');
  await page.keyboard.down('ArrowRight');
  try {
    for (let leap = 0; leap < 25 && !(await memoryChamberLabel.isVisible()); leap += 1) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(400);
    }
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  await expect(memoryChamberLabel).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('production-root-memory-chamber.png') });
  const memoryLantern = page.getByText('E · Rest at Root-Memory Seed-Lantern');
  for (let step = 0; step < 25 && !(await memoryLantern.isVisible()); step += 1) {
    await page.keyboard.press('ArrowRight', { delay: 100 });
  }
  await expect(memoryLantern).toBeVisible();
  for (
    let attempt = 0;
    attempt < 4 &&
    (await healthMeter.evaluate((meter) => (meter as HTMLProgressElement).value)) < 100;
    attempt += 1
  ) {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(200);
  }
  expect(await healthMeter.evaluate((meter) => (meter as HTMLProgressElement).value)).toBe(100);
  const recoverPrompt = page.getByText('E · Recover the root memory');
  for (let step = 0; step < 35 && !(await recoverPrompt.isVisible()); step += 1) {
    await page.keyboard.press('ArrowRight', { delay: 100 });
  }
  await expect(recoverPrompt).toBeVisible();
  const deliveryObjective = page.getByText('Bring the recovered root-memory to Piri.');
  for (let attempt = 0; attempt < 5 && !(await deliveryObjective.isVisible()); attempt += 1) {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(200);
  }
  await expect(deliveryObjective).toBeVisible();
  await expect(page.getByText('Save: Saved', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: /^Enter / }).click();
  await expect(memoryChamberLabel).toBeVisible();
  await expect(deliveryObjective).toBeVisible();
  await page.keyboard.press('Escape');
  const memoryMenu = page.getByRole('dialog', { name: 'Wayfinder Ledger' });
  await expect(
    memoryMenu.locator('.room-map .map-node', { hasText: "Wren's Rest Square" }),
  ).toContainText('Quest');
  await memoryMenu.getByRole('button', { name: 'Resume' }).click();
  for (const roomLabel of [echoPoolLabel, hollowsLabel, listeningArchLabel]) {
    await page.keyboard.down('ArrowLeft');
    try {
      for (let leap = 0; leap < 25 && !(await roomLabel.isVisible()); leap += 1) {
        await page.keyboard.press('Space');
        await page.waitForTimeout(400);
      }
    } finally {
      await page.keyboard.up('ArrowLeft');
    }
    await expect(roomLabel).toBeVisible();
  }
  const shortcutPrompt = page.getByText('E · Open shortcut');
  for (let step = 0; step < 35 && !(await shortcutPrompt.isVisible()); step += 1) {
    await page.keyboard.press('ArrowRight', { delay: 100 });
  }
  await expect(shortcutPrompt).toBeVisible();
  await page.keyboard.press('KeyE');
  const villageLabel = page.getByText("Wren's Rest · Wren's Rest Square");
  for (let step = 0; step < 35 && !(await villageLabel.isVisible()); step += 1) {
    await page.keyboard.press('ArrowRight', { delay: 100 });
    await page.keyboard.press('KeyE');
  }
  await expect(villageLabel).toBeVisible();
  await expect(deliveryObjective).toBeVisible();
  const piriPrompt = page.getByText('E · Speak with Piri');
  for (let step = 0; step < 90 && !(await piriPrompt.isVisible()); step += 1) {
    await page.keyboard.press('ArrowRight', { delay: 100 });
  }
  await expect(piriPrompt).toBeVisible();
  await page.keyboard.press('KeyE');
  const piriDialogue = page.getByRole('dialog', { name: 'Piri Moss' });
  await expect(piriDialogue).toBeVisible();
  await piriDialogue.getByRole('button', { name: 'Let its memory teach me.' }).click();
  const dashObjective = page.getByText(
    'Learn Wayfinder Dash in the trial beneath the Root-Memory Chamber.',
  );
  await expect(dashObjective).toBeVisible();
  await piriDialogue.getByRole('button', { name: 'Leave shop' }).click();
  await expect(page.getByText('Save: Saved', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: /^Enter / }).click();
  await expect(villageLabel).toBeVisible();
  await expect(dashObjective).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('production-root-memory-delivered.png') });
  for (let step = 0; step < 90 && !(await piriPrompt.isVisible()); step += 1) {
    await page.keyboard.press('ArrowRight', { delay: 100 });
  }
  await expect(piriPrompt).toBeVisible();
  for (let step = 0; step < 12 && (await piriPrompt.isVisible()); step += 1) {
    await page.keyboard.press('ArrowRight', { delay: 100 });
  }
  const returnTravelPrompt = page.getByText('E · Travel to Listening Arch');
  for (let step = 0; step < 55 && !(await returnTravelPrompt.isVisible()); step += 1) {
    await page.keyboard.press('ArrowRight', { delay: 100 });
  }
  await expect(returnTravelPrompt).toBeVisible();
  await page.keyboard.press('KeyE');
  await expect(listeningArchLabel).toBeVisible();
  for (const roomLabel of [hollowsLabel, echoPoolLabel, memoryChamberLabel]) {
    await page.keyboard.down('ArrowRight');
    try {
      for (let leap = 0; leap < 25 && !(await roomLabel.isVisible()); leap += 1) {
        await page.keyboard.press('Space');
        await page.waitForTimeout(400);
      }
    } finally {
      await page.keyboard.up('ArrowRight');
    }
    await expect(roomLabel).toBeVisible();
  }
  const dashTrialPrompt = page.getByText('E · Enter passage');
  for (let step = 0; step < 75 && !(await dashTrialPrompt.isVisible()); step += 1) {
    await page.keyboard.press('ArrowRight', { delay: 100 });
  }
  await expect(dashTrialPrompt).toBeVisible();
  await page.keyboard.press('KeyE');
  await expect(page.getByText('Singing Hollows · Wayfinder Dash Trial')).toBeVisible();
  await page.keyboard.press('Escape');
  const trialMenu = page.getByRole('dialog', { name: 'Wayfinder Ledger' });
  await expect(
    trialMenu.locator('.room-map .map-node', { hasText: 'Wayfinder Dash Trial' }),
  ).toContainText('Quest');
  await trialMenu.getByRole('button', { name: 'Resume' }).click();
  await page.screenshot({ path: testInfo.outputPath('production-dash-trial.png') });
  const climbPrompt = page.getByText('Up · Climb');
  for (let step = 0; step < 20 && !(await climbPrompt.isVisible()); step += 1) {
    await page.keyboard.press('ArrowRight', { delay: 100 });
  }
  await expect(climbPrompt).toBeVisible();
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1_800);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(2_200);
  await page.keyboard.up('ArrowLeft');
  const sentinelObjective = page.getByText(
    'Claim a briar core from the Thorn Sentinel east of the Root-Memory Chamber.',
  );
  await page.keyboard.down('ArrowRight');
  try {
    await expect(sentinelObjective).toBeVisible({ timeout: 6_000 });
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  await page.screenshot({ path: testInfo.outputPath('production-dash-trial-solved.png') });
  const trialExitPrompt = page.getByText('E · Enter passage');
  for (let step = 0; step < 55 && !(await trialExitPrompt.isVisible()); step += 1) {
    await page.keyboard.press('ArrowLeft', { delay: 100 });
  }
  await expect(trialExitPrompt).toBeVisible();
  await page.keyboard.press('KeyE');
  await expect(memoryChamberLabel).toBeVisible();
  for (let step = 0; step < 55 && !(await memoryLantern.isVisible()); step += 1) {
    await page.keyboard.press('ArrowLeft', { delay: 100 });
  }
  await expect(memoryLantern).toBeVisible();
  for (
    let attempt = 0;
    attempt < 4 &&
    (await healthMeter.evaluate((meter) => (meter as HTMLProgressElement).value)) < 100;
    attempt += 1
  ) {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(200);
  }
  expect(await healthMeter.evaluate((meter) => (meter as HTMLProgressElement).value)).toBe(100);
  const vergeLabel = page.getByText('Brackenreach · Reliquary Verge');
  await page.keyboard.down('ArrowRight');
  try {
    for (let leap = 0; leap < 40 && !(await vergeLabel.isVisible()); leap += 1) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(400);
    }
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  await expect(vergeLabel).toBeVisible();
  const vergeLantern = page.getByText('E · Rest at Reliquary Verge Seed-Lantern');
  await expect(vergeLantern).toBeVisible();
  await page.keyboard.press('KeyE');
  await expect(page.getByText('Save: Saved', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  const vergeMenu = page.getByRole('dialog', { name: 'Wayfinder Ledger' });
  await expect(
    vergeMenu.locator('.room-map .map-node', { hasText: 'Reliquary Verge' }),
  ).toContainText('Quest');
  await vergeMenu.getByRole('button', { name: 'Resume' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: /^Enter / }).click();
  await expect(vergeLabel).toBeVisible();
  await expect(sentinelObjective).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('production-reliquary-verge.png') });
  await page.keyboard.down('ArrowRight');
  try {
    await expect
      .poll(() => healthMeter.evaluate((meter) => (meter as HTMLProgressElement).value), {
        timeout: 20_000,
      })
      .toBeLessThan(100);
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  await expect(vergeLabel).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('production-sentinel-contact.png') });
  expect(errors).toEqual([]);
});

test('production shell stays offline, preserves unrelated caches, and safely accepts a new build', async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    void caches.open('unrelated-application');
    void caches.open('rivenbloom-shell-obsolete');
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin journey for Journey 1' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Begin journey', exact: true })
    .click();
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  await expect(page.getByText('Save: Saved', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => '__RIVENBLOOM_TEST__' in window)).toBe(false);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const keys = await page.evaluate(() => caches.keys());
  expect(keys).toContain('unrelated-application');
  expect(keys).not.toContain('rivenbloom-shell-obsolete');
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  await expect(page.getByLabel('Gameplay status')).toBeVisible();
  await context.setOffline(false);
  const workerPath = 'dist/sw.js';
  const original = await readFile(workerPath, 'utf8');
  try {
    await writeFile(
      workerPath,
      original.replace(/const BUILD_ID = '([^']+)'/, "const BUILD_ID = '$1-update-test'"),
    );
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())?.update();
    });
    const update = page.getByRole('button', { name: 'Update ready · Reload' });
    await expect(update).toBeVisible();
    await page.keyboard.press('Escape');
    const menu = page.getByRole('dialog', { name: 'Wayfinder Ledger' });
    await menu.getByRole('button', { name: 'Settings', exact: true }).click();
    await menu.getByLabel('Difficulty').selectOption('story');
    await menu.getByRole('button', { name: 'Apply settings' }).click();
    await menu.getByRole('button', { name: 'Resume', exact: true }).click();
    await update.click();
    await page.getByRole('button', { name: 'Continue Journey 1' }).click();
    await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
    await expect(page.getByLabel('Gameplay status')).toBeVisible();
    await page.keyboard.press('Escape');
    await menu.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(menu.getByLabel('Difficulty')).toHaveValue('story');
    expect(await page.evaluate(() => '__RIVENBLOOM_TEST__' in window)).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await writeFile(workerPath, original);
  }
});
