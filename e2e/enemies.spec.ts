import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type EnemySnapshot = Readonly<{
  combatantId: string;
  actorId: string;
  state: string;
  position: Readonly<{ x: number; y: number }>;
  health: number;
  maxHealth: number;
  activeAttackId: string | null;
  attackPhase: string | null;
  hidden: boolean;
  targetable: boolean;
}>;

type EncounterSnapshot = Readonly<{
  stepIndex: number;
  enemies: readonly EnemySnapshot[];
  directors: readonly Readonly<{ encounterKey: string; pressure: number }>[];
  activeOrdnance: number;
  counters: Readonly<{
    playerContacts: number;
    enemyContacts: number;
    feedback: number;
    defeats: number;
  }>;
  playerVitality: Readonly<{ currentHealth: number; maxHealth: number }> | null;
  lastResolution: Readonly<{
    source: 'player' | 'enemy' | 'ordnance';
    kind: string;
    guard: string | null;
    defeated: boolean;
  }> | null;
}>;

type EnemyBridgeSnapshot = Readonly<{
  titleReady: boolean;
  player: Readonly<{ state: string; position: Readonly<{ x: number; y: number }> }> | null;
  combat: Readonly<{
    actionSequence: number;
    lastAcceptedAction: string | null;
    currentMana: number;
    projectileCount: number;
    confirmedHitCount: number;
    guarding: boolean;
  }> | null;
  encounter: EncounterSnapshot | null;
}>;

type EnemyBridge = Readonly<{ read(): EnemyBridgeSnapshot }>;

function snapshot(page: Page): Promise<EnemyBridgeSnapshot> {
  return page.evaluate(() =>
    (
      window as Window & {
        __RIVENBLOOM_TEST__: EnemyBridge;
      }
    ).__RIVENBLOOM_TEST__.read(),
  );
}

async function enterFixture(page: Page, fixture: 'briar' | 'mixed' | 'sentinel'): Promise<void> {
  await page.goto(`/?debug-encounter=${fixture}`);
  await page.waitForFunction(
    () =>
      (
        window as Window & {
          __RIVENBLOOM_TEST__?: EnemyBridge;
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
          __RIVENBLOOM_TEST__?: EnemyBridge;
        }
      ).__RIVENBLOOM_TEST__?.read().encounter?.enemies.length,
  );
}

async function continueFixture(page: Page): Promise<void> {
  await page.reload();
  await page.waitForFunction(
    () =>
      (
        window as Window & {
          __RIVENBLOOM_TEST__?: EnemyBridge;
        }
      ).__RIVENBLOOM_TEST__?.read().titleReady === true,
  );
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  await page.waitForFunction(
    () =>
      (
        window as Window & {
          __RIVENBLOOM_TEST__?: EnemyBridge;
        }
      ).__RIVENBLOOM_TEST__?.read().encounter?.enemies.length,
  );
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function waitForPlayerIdle(page: Page): Promise<void> {
  await expect.poll(async () => (await snapshot(page)).player?.state).toBe('idle');
}

async function holdGuardThroughNeutralGate(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await waitForPlayerIdle(page);
    const beforeStep = (await snapshot(page)).encounter?.stepIndex ?? 0;
    await page.keyboard.down('l');
    await page.waitForFunction(
      (step) => {
        const state = (
          window as Window & { __RIVENBLOOM_TEST__: EnemyBridge }
        ).__RIVENBLOOM_TEST__.read();
        return state.combat?.guarding === true || (state.encounter?.stepIndex ?? step) >= step + 3;
      },
      beforeStep,
      { polling: 'raf', timeout: 1_000 },
    );
    const acquired = (await snapshot(page)).combat?.guarding === true;
    if (acquired) return;
    await page.keyboard.up('l');
    const releaseStep = (await snapshot(page)).encounter?.stepIndex ?? beforeStep;
    await page.waitForFunction(
      (step) => {
        const state = (
          window as Window & { __RIVENBLOOM_TEST__: EnemyBridge }
        ).__RIVENBLOOM_TEST__.read();
        return (
          state.encounter !== null && state.encounter.stepIndex > step && !state.combat?.guarding
        );
      },
      releaseStep,
      { polling: 'raf', timeout: 1_000 },
    );
  }
  throw new Error('Guard input did not acquire after neutral fixed steps.');
}

async function pressCastThroughNeutralGate(page: Page, initialMana: number): Promise<void> {
  const initialSequence = (await snapshot(page)).combat?.actionSequence ?? 0;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const before = await snapshot(page);
    const beforeStep = before.encounter?.stepIndex ?? 0;
    await page.keyboard.press('q');
    await page.waitForFunction(
      ({ sequence, step }) => {
        const state = (
          window as Window & { __RIVENBLOOM_TEST__: EnemyBridge }
        ).__RIVENBLOOM_TEST__.read();
        return (
          (state.combat?.actionSequence ?? sequence) > sequence ||
          (state.encounter?.stepIndex ?? step) >= step + 6
        );
      },
      { sequence: initialSequence, step: beforeStep },
      { polling: 'raf', timeout: 1_000 },
    );
    const state = await snapshot(page);
    const accepted =
      state.combat !== null &&
      state.combat.actionSequence > initialSequence &&
      state.combat.lastAcceptedAction === 'cast' &&
      state.combat.currentMana < initialMana;
    if (accepted) return;
    const releaseStep = state.encounter?.stepIndex ?? beforeStep;
    await page.waitForFunction(
      (step) =>
        ((window as Window & { __RIVENBLOOM_TEST__: EnemyBridge }).__RIVENBLOOM_TEST__.read()
          .encounter?.stepIndex ?? step) > step,
      releaseStep,
      { polling: 'raf', timeout: 1_000 },
    );
  }
  const failed = await snapshot(page);
  if (
    failed.combat !== null &&
    failed.combat.actionSequence > initialSequence &&
    failed.combat.lastAcceptedAction === 'cast' &&
    failed.combat.currentMana < initialMana
  )
    return;
  throw new Error(
    `Cast input did not acquire after neutral fixed steps: ${JSON.stringify({
      player: failed.player,
      combat: failed.combat,
      enemy: failed.encounter?.enemies[0],
    })}`,
  );
}

async function castConfirmedBolt(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.waitForFunction(
      () => {
        const enemy = (
          window as Window & { __RIVENBLOOM_TEST__: EnemyBridge }
        ).__RIVENBLOOM_TEST__.read().encounter?.enemies[0];
        return (
          enemy !== undefined &&
          enemy.targetable &&
          enemy.state !== 'hurt' &&
          enemy.state !== 'stagger' &&
          enemy.state !== 'dead'
        );
      },
      undefined,
      { polling: 'raf', timeout: 4_000 },
    );
    await waitForPlayerIdle(page);
    const before = await snapshot(page);
    if (before.combat === null) throw new Error('Combat projection disappeared before cast.');
    const enemy = before.encounter?.enemies[0];
    if (enemy === undefined || before.player === null)
      throw new Error('Encounter combatants disappeared before cast.');
    if (before.combat.currentMana < 8) break;
    const direction = enemy.position.x >= before.player.position.x ? 'ArrowRight' : 'ArrowLeft';
    await page.keyboard.down(direction);
    try {
      await pressCastThroughNeutralGate(page, before.combat.currentMana);
    } finally {
      await page.keyboard.up(direction);
    }
    const accepted = await snapshot(page);
    expect(accepted.combat).toMatchObject({
      actionSequence: before.combat.actionSequence + 1,
      lastAcceptedAction: 'cast',
      currentMana: before.combat.currentMana - 8,
    });
    const confirmed = await expect
      .poll(async () => (await snapshot(page)).combat?.confirmedHitCount, { timeout: 1_500 })
      .toBeGreaterThan(before.combat.confirmedHitCount)
      .then(() => true)
      .catch(() => false);
    if (confirmed) return;
  }
  const failed = await snapshot(page);
  throw new Error(
    `No accepted Lumen Bolt contacted the Briar: ${JSON.stringify({
      player: failed.player,
      combat: failed.combat,
      enemy: failed.encounter?.enemies[0],
    })}`,
  );
}

test('real encounter guards, lands a Lumen bolt, and reloads composed vitality', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  await enterFixture(page, 'briar');

  await waitForPlayerIdle(page);
  const contactsBeforeGuard = (await snapshot(page)).encounter!.counters.enemyContacts;
  await holdGuardThroughNeutralGate(page);
  await expect
    .poll(async () => (await snapshot(page)).encounter?.counters.enemyContacts, { timeout: 10_000 })
    .toBeGreaterThan(contactsBeforeGuard);
  const guarded = await snapshot(page);
  expect(guarded.encounter?.lastResolution?.source).toBe('enemy');
  expect(['block', 'parry']).toContain(guarded.encounter?.lastResolution?.guard);
  const contactsBeforeDamage = guarded.encounter!.counters.enemyContacts;
  const healthBeforeDamage = guarded.encounter!.playerVitality!.currentHealth;
  await page.keyboard.up('l');
  await expect.poll(async () => (await snapshot(page)).combat?.guarding).toBe(false);
  await expect
    .poll(async () => (await snapshot(page)).encounter?.counters.enemyContacts, {
      timeout: 8_000,
    })
    .toBeGreaterThan(contactsBeforeDamage);
  await expect
    .poll(async () => (await snapshot(page)).encounter?.playerVitality?.currentHealth)
    .toBeLessThan(healthBeforeDamage);

  await castConfirmedBolt(page);
  const engaged = await snapshot(page);
  expect(engaged.encounter!.counters.playerContacts).toBe(engaged.combat!.confirmedHitCount);
  expect(engaged.combat!.confirmedHitCount).toBeGreaterThan(0);
  const ledger = page.getByRole('dialog', { name: 'Wayfinder Ledger' });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await waitForPlayerIdle(page);
    await page.keyboard.press('Escape');
    const opened = await ledger
      .waitFor({ state: 'visible', timeout: 1_000 })
      .then(() => true)
      .catch(() => false);
    if (opened) break;
  }
  await expect(ledger).toBeVisible();
  await page.waitForTimeout(700);
  const paused = await snapshot(page);
  const savedHealth = paused.encounter?.playerVitality?.currentHealth;
  const savedMana = paused.combat?.currentMana;
  expect(savedHealth).toBeLessThan(100);
  expect(savedMana).toBeLessThan(40);
  expect(savedMana).toBeGreaterThanOrEqual(0);
  await continueFixture(page);

  const reloaded = await snapshot(page);
  expect(reloaded.encounter?.playerVitality?.currentHealth).toBe(savedHealth);
  expect(reloaded.combat).toMatchObject({
    currentMana: savedMana,
    projectileCount: 0,
    confirmedHitCount: 0,
  });
  expect(reloaded.encounter).toMatchObject({ activeOrdnance: 0 });
  expect(reloaded.encounter?.enemies[0]).toMatchObject({ health: 42, maxHealth: 42 });
  expect(errors).toEqual([]);
});

test('mixed close and ranged pressure stays fair while the offscreen member sleeps', async ({
  page,
}) => {
  test.setTimeout(25_000);
  const errors = collectErrors(page);
  await enterFixture(page, 'mixed');

  await expect
    .poll(
      async () =>
        (await snapshot(page)).encounter?.directors.find(
          ({ encounterKey }) => encounterKey === 'dev-mixed-encounter',
        )?.pressure,
      { timeout: 6_000 },
    )
    .toBe(2);
  for (let sample = 0; sample < 20; sample += 1) {
    const encounter = (await snapshot(page)).encounter!;
    expect(Math.max(...encounter.directors.map(({ pressure }) => pressure))).toBeLessThanOrEqual(2);
    await page.waitForTimeout(30);
  }
  const encounter = (await snapshot(page)).encounter!;
  expect(
    encounter.enemies.find(({ combatantId }) => combatantId === 'dev-mixed-offscreen'),
  ).toMatchObject({
    state: 'sleep',
    hidden: true,
  });
  const ranged = encounter.enemies.find(({ combatantId }) => combatantId === 'dev-mixed-scribe')!;
  expect(ranged.position.x).toBeGreaterThanOrEqual(96);
  expect(ranged.position.x).toBeLessThanOrEqual(1_184);
  expect(
    await page.evaluate(() => {
      const value = (
        window as Window & { __RIVENBLOOM_TEST__: EnemyBridge }
      ).__RIVENBLOOM_TEST__.read().encounter!;
      return (
        Object.isFrozen(value) &&
        Object.isFrozen(value.enemies) &&
        Object.isFrozen(value.enemies[0]) &&
        Object.isFrozen(value.counters)
      );
    }),
  ).toBe(true);
  expect(errors).toEqual([]);
});
