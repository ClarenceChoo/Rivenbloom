import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type CombatSnapshot = Readonly<{
  actionSequence: number;
  lastAcceptedAction: string | null;
  activeAttackId: string | null;
  attackFrame: number | null;
  attackPhase: string | null;
  currentMana: number;
  selectedAbilityId: string;
  projectileCount: number;
  confirmedHitCount: number;
}>;

type CombatBridge = Readonly<{
  read(): Readonly<{
    titleReady: boolean;
    player: Readonly<{ state: string }> | null;
    combat: CombatSnapshot | null;
  }>;
}>;

function snapshot(page: Page): Promise<ReturnType<CombatBridge['read']>> {
  return page.evaluate(() =>
    (
      window as Window & {
        __RIVENBLOOM_TEST__: CombatBridge;
      }
    ).__RIVENBLOOM_TEST__.read(),
  );
}

async function enterNewJourney(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () =>
      (
        window as Window & {
          __RIVENBLOOM_TEST__?: CombatBridge;
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
          __RIVENBLOOM_TEST__?: CombatBridge;
        }
      ).__RIVENBLOOM_TEST__?.read().combat !== null,
  );
}

test('real combat input attacks once, casts atomically, autosaves mana, and reloads it', async ({
  page,
}) => {
  test.setTimeout(30_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await enterNewJourney(page);

  expect((await snapshot(page)).combat).toMatchObject({
    actionSequence: 0,
    currentMana: 40,
    projectileCount: 0,
    confirmedHitCount: 0,
  });

  await page.keyboard.down('j');
  await expect.poll(async () => (await snapshot(page)).combat?.actionSequence).toBe(1);
  expect((await snapshot(page)).combat?.activeAttackId).toBe('mara-light-one');
  await expect.poll(async () => (await snapshot(page)).combat?.activeAttackId).toBeNull();
  await page.waitForTimeout(200);
  expect((await snapshot(page)).combat?.actionSequence).toBe(1);
  expect((await snapshot(page)).player?.state).toBe('idle');
  await page.keyboard.up('j');
  await page.waitForTimeout(50);
  await page.keyboard.press('j');
  await expect.poll(async () => (await snapshot(page)).combat?.actionSequence).toBe(2);
  await expect.poll(async () => (await snapshot(page)).combat?.activeAttackId).toBeNull();

  await page.keyboard.press('q');
  await expect.poll(async () => (await snapshot(page)).combat?.actionSequence).toBe(3);
  expect((await snapshot(page)).combat).toMatchObject({
    lastAcceptedAction: 'cast',
    currentMana: 32,
    projectileCount: 1,
    confirmedHitCount: 0,
  });
  await expect.poll(async () => (await snapshot(page)).combat?.projectileCount).toBe(0);
  expect((await snapshot(page)).combat?.confirmedHitCount).toBe(0);

  await page.waitForTimeout(650);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue Journey 1' })).toBeEnabled();
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  await expect.poll(async () => (await snapshot(page)).combat?.currentMana).toBe(32);
  expect((await snapshot(page)).combat).toMatchObject({ projectileCount: 0, confirmedHitCount: 0 });
  expect(errors).toEqual([]);
});
