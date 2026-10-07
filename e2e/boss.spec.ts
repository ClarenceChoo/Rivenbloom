import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CONTENT_REGISTRY } from '../src/game/data/areas';
import { PALLID_CANTOR_ENCOUNTER } from '../src/game/data/bosses/pallidCantor';
import { ATTACKS } from '../src/game/data/attacks';
import { createNewSave } from '../src/game/saves/SaveSchema';
import { createSaveEnvelopeJson } from '../src/game/saves/SaveEnvelope';
import { debugPallidCantorSave } from '../src/game/testing/debugBossEncounter';
import { itemId } from '../src/game/core/StableId';

type BossSnapshot = Readonly<{
  state: string;
  position: Readonly<{ x: number; y: number }>;
  vitality: Readonly<{ currentHealth: number; maxHealth: number }>;
  lenses: readonly Readonly<{ mechanismId: string; state: string }>[];
  heartExposed: boolean;
  arenaLocked: boolean;
  defeatSave: string;
}>;

type Snapshot = Readonly<{
  titleReady: boolean;
  world: Readonly<{ areaId: string; roomId: string; mode: string }> | null;
  player: Readonly<{
    position: Readonly<{ x: number; y: number }>;
    state: string;
  }> | null;
  combat: Readonly<{
    selectedAbilityId: string;
    currentMana: number;
    activeAttackId: string | null;
    attackFrame: number | null;
  }> | null;
  encounter: Readonly<{
    stepIndex: number;
    simulationTimeMs: number;
    boss: BossSnapshot | null;
  }> | null;
  worldUi: Readonly<{
    player: Readonly<{ currentHealth: number }>;
    quests: readonly Readonly<{ questId: string; stageId: string }>[];
    inventory: readonly Readonly<{ itemId: string; quantity: number }>[];
  }> | null;
  deathReload: Readonly<{ count: number }> | null;
}>;

function read(page: Page): Promise<Snapshot> {
  return page.evaluate(() => window.__RIVENBLOOM_TEST__!.read() as unknown as Snapshot);
}

async function waitForSimulation(page: Page, durationMs: number): Promise<void> {
  const initial = await read(page);
  if ((initial.deathReload?.count ?? 0) > 0 || initial.encounter === null) {
    throw new Error('The player died while the scripted combat action was running.');
  }
  const startedAt = initial.encounter.simulationTimeMs;
  await page.waitForFunction(
    ({ startedAt, durationMs }) => {
      const state = window.__RIVENBLOOM_TEST__?.read();
      return (
        (state?.deathReload?.count ?? 0) > 0 ||
        (state?.encounter?.simulationTimeMs ?? 0) >= startedAt + durationMs
      );
    },
    { startedAt, durationMs },
    { polling: 'raf', timeout: 5_000 },
  );
}

async function lightCombo(page: Page): Promise<void> {
  for (const attackId of ['mara-light-one', 'mara-light-two', 'mara-light-three']) {
    const before = await read(page);
    const step = before.encounter!.stepIndex;
    await page.keyboard.press('KeyJ');
    await page.waitForFunction(
      ({ attackId, step }) => {
        const state = window.__RIVENBLOOM_TEST__!.read();
        return (
          state.combat?.activeAttackId === attackId ||
          (state.deathReload?.count ?? 0) > 0 ||
          (state.encounter?.stepIndex ?? step) >= step + 8
        );
      },
      { attackId, step },
      { polling: 'raf' },
    );
    if ((await read(page)).combat?.activeAttackId !== attackId) return;
    const cancelWindow = ATTACKS.find((attack) => attack.attackId === attackId)!.cancelWindows[0];
    await page.waitForFunction(
      ({ attackId, bufferFrame }) => {
        const combat = window.__RIVENBLOOM_TEST__!.read().combat;
        return (
          combat?.activeAttackId !== attackId ||
          (bufferFrame !== null && (combat.attackFrame ?? 0) >= bufferFrame)
        );
      },
      {
        attackId,
        bufferFrame: cancelWindow === undefined ? null : Math.max(0, cancelWindow.fromFrame - 2),
      },
      { polling: 'raf' },
    );
    if (cancelWindow !== undefined && (await read(page)).combat?.activeAttackId !== attackId)
      return;
  }
}

async function beginBossJourney(page: Page): Promise<void> {
  await page.goto('/?debug-boss=pallid-cantor');
  await page.waitForFunction(() => window.__RIVENBLOOM_TEST__?.read().titleReady === true);
  await page.getByRole('button', { name: 'Begin journey for Journey 1' }).click();
  await page
    .getByRole('dialog', { name: 'Begin a new journey in Journey 1?' })
    .getByRole('button', { name: 'Begin journey' })
    .click();
  await page.getByRole('button', { name: /^Enter / }).click();
  await expect.poll(async () => (await read(page)).world?.roomId).toBe('hollow-choir-arena');
}

async function beginNormalStatBossJourney(page: Page): Promise<void> {
  const content = CONTENT_REGISTRY.newGame;
  const source = createNewSave({
    nowEpochMs: Date.now(),
    location: {
      regionId: content.initialRegionId,
      areaId: content.initialAreaId,
      checkpointId: content.initialCheckpointId,
      safePosition: { x: 256, y: 608 },
    },
    baseStats: content.baseStats,
    initialQuests: content.initialQuests,
    startingAbilities: content.startingAbilities,
  });
  const prepared = debugPallidCantorSave(source);
  const normal = {
    ...prepared,
    inventory: [{ itemId: itemId('sunmoss-draught'), quantity: 5 }],
    player: {
      ...prepared.player,
      baseStats: { ...source.player.baseStats, maxHealth: 120, maxMana: 48 },
      currentHealth: 120,
      currentMana: 48,
      weaponLevel: 2,
    },
  };
  await page.goto('/');
  await page.getByLabel('Import save for Journey 1').setInputFiles({
    name: 'normal-cantor.json',
    mimeType: 'application/json',
    buffer: Buffer.from(await createSaveEnvelopeJson(normal, Date.now())),
  });
  await page.getByRole('button', { name: 'Import save', exact: true }).click();
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: /^Enter / }).click();
  await expect.poll(async () => (await read(page)).world?.roomId).toBe('hollow-choir-arena');
}

async function recoverWithSunmoss(page: Page): Promise<void> {
  await page.bringToFront();
  expect(await page.evaluate(() => document.hasFocus())).toBe(true);
  await waitForSimulation(page, 35);
  await page.keyboard.press('Escape');
  const menu = page.getByRole('dialog', { name: 'Wayfinder Ledger' });
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: 'Inventory' }).click();
  for (let used = 0; used < 5; used += 1) {
    const state = await read(page);
    if (state.worldUi!.player.currentHealth >= 100) break;
    if (
      !state.worldUi!.inventory.some(
        ({ itemId, quantity }) => itemId === 'sunmoss-draught' && quantity > 0,
      )
    )
      break;
    await menu.getByRole('button', { name: 'Use Sunmoss Draught' }).click();
  }
  await menu.getByRole('button', { name: 'Resume' }).click();
}

async function moveTo(page: Page, targetX: number): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const x = (await read(page)).player?.position.x ?? targetX;
    if (Math.abs(x - targetX) < 24) return;
    const key = x < targetX ? 'ArrowRight' : 'ArrowLeft';
    await page.keyboard.down(key);
    try {
      await page
        .waitForFunction(
          ({ target }) => {
            const x = window.__RIVENBLOOM_TEST__?.read().player?.position.x;
            return x !== undefined && Math.abs(x - target) < 24;
          },
          { target: targetX },
          { polling: 'raf', timeout: 5_000 },
        )
        .catch(() => undefined);
    } finally {
      await page.keyboard.up(key);
    }
  }
  expect((await read(page)).player?.position.x).toBeCloseTo(targetX, -2);
}

async function awakenLens(page: Page, index: number, targetX: number): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await moveTo(page, targetX);
    const before = await read(page);
    if ((before.deathReload?.count ?? 0) > 0 || before.encounter?.boss?.state !== 'phaseTwo') {
      throw new Error(`The boss encounter reset before lens ${index + 1} could awaken.`);
    }
    await expect
      .poll(async () =>
        ['idle', 'run', 'jump', 'fall', 'land'].includes((await read(page)).player?.state ?? ''),
      )
      .toBe(true);
    const manaBefore = (await read(page)).combat?.currentMana;
    await page.keyboard.press('KeyQ');
    await waitForSimulation(page, 200);
    const state = await read(page);
    if (state.encounter?.boss?.lenses[index]?.state === 'latched') return;
    if ((state.deathReload?.count ?? 0) > 0 || state.encounter?.boss?.state !== 'phaseTwo') {
      throw new Error(`The boss encounter reset while awakening lens ${index + 1}.`);
    }
    if (state.combat?.currentMana !== manaBefore) {
      throw new Error(`Resonant Pulse spent mana without awakening lens ${index + 1}.`);
    }
    await waitForSimulation(page, 600);
  }
  throw new Error(`Resonant Pulse was not accepted at lens ${index + 1}.`);
}

async function attackUntil(
  page: Page,
  predicate: (boss: BossSnapshot) => boolean,
  useRecovery = false,
  attack: 'heavy' | 'light' | 'combo' = 'heavy',
): Promise<void> {
  let lowestBossHealth = 420;
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const state = await read(page);
    const boss = state.encounter?.boss;
    lowestBossHealth = Math.min(lowestBossHealth, boss?.vitality.currentHealth ?? 420);
    if ((state.deathReload?.count ?? 0) > 0)
      throw new Error(
        `The player died after ${attempt} attacks; lowest Cantor health ${lowestBossHealth}; remaining Sunmoss ${state.worldUi?.inventory.find(({ itemId }) => itemId === 'sunmoss-draught')?.quantity ?? 0}.`,
      );
    if (boss === null || boss === undefined) throw new Error('The boss encounter is unavailable.');
    if (predicate(boss)) return;
    if (
      useRecovery &&
      (state.worldUi?.player.currentHealth ?? 0) < 80 &&
      state.worldUi?.inventory.some(
        ({ itemId, quantity }) => itemId === 'sunmoss-draught' && quantity > 0,
      )
    )
      await recoverWithSunmoss(page);
    await moveTo(page, boss.position.x - PALLID_CANTOR_ENCOUNTER.body.halfWidth);
    await page.keyboard.down('ArrowRight');
    await waitForSimulation(page, 70);
    await page.keyboard.up('ArrowRight');
    if (attack === 'heavy') {
      await page.keyboard.down('KeyK');
      await waitForSimulation(page, 460);
      await page.keyboard.up('KeyK');
      await waitForSimulation(page, 260);
    } else if (attack === 'combo') {
      await expect
        .poll(async () => ['idle', 'run', 'land'].includes((await read(page)).player?.state ?? ''))
        .toBe(true);
      await lightCombo(page);
    } else {
      await page.keyboard.press('KeyJ');
      await waitForSimulation(page, 350);
    }
  }
  const boss = (await read(page)).encounter?.boss;
  expect(boss !== null && boss !== undefined && predicate(boss)).toBe(true);
}

test('real-input Cantor fight saves once, releases the arena, and stays defeated after reload', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await beginBossJourney(page);
  await expect(page.getByLabel('Gameplay status')).toBeVisible();
  await expect
    .poll(async () => (await read(page)).encounter?.boss?.state, { timeout: 15_000 })
    .toBe('phaseOne');
  await expect(page.getByText('The Pallid Cantor', { exact: true })).toBeVisible();

  await moveTo(page, 850);
  await attackUntil(page, (boss) => boss.state === 'transition' || boss.state === 'phaseTwo');
  await expect.poll(async () => (await read(page)).encounter?.boss?.state).toBe('phaseTwo');
  await expect.poll(async () => (await read(page)).combat?.currentMana).toBe(96);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if ((await read(page)).combat?.selectedAbilityId === 'resonant-pulse') break;
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(150);
  }
  await expect
    .poll(async () => (await read(page)).combat?.selectedAbilityId)
    .toBe('resonant-pulse');
  await awakenLens(page, 0, 360);
  await moveTo(page, 1560);
  await awakenLens(page, 1, 1560);
  await expect
    .poll(async () => (await read(page)).encounter?.boss?.lenses[1]?.state)
    .toBe('latched');
  await expect.poll(async () => (await read(page)).encounter?.boss?.heartExposed).toBe(true);

  await moveTo(page, 850);
  await attackUntil(page, (boss) => boss.state === 'defeat');
  await expect.poll(async () => (await read(page)).encounter?.boss?.defeatSave).toBe('committed');
  await expect.poll(async () => (await read(page)).encounter?.boss?.arenaLocked).toBe(false);
  await expect
    .poll(async () =>
      (await read(page)).worldUi?.inventory.find(({ itemId }) => itemId === 'cantor-sigil'),
    )
    .toMatchObject({ itemId: 'cantor-sigil', quantity: 1 });
  await expect
    .poll(
      async () =>
        (await read(page)).worldUi?.quests.find(({ questId }) => questId === 'the-silent-bloom')
          ?.stageId,
    )
    .toBe('return-to-sela');

  await page.reload();
  await page.waitForFunction(() => window.__RIVENBLOOM_TEST__?.read().titleReady === true);
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: /^Enter / }).click();
  await expect.poll(async () => (await read(page)).world?.roomId).toBe('hollow-choir-arena');
  expect((await read(page)).encounter?.boss).toBeNull();
  expect(
    (await read(page)).worldUi?.inventory.filter(({ itemId }) => itemId === 'cantor-sigil'),
  ).toEqual([expect.objectContaining({ itemId: 'cantor-sigil', quantity: 1 })]);
  expect(errors).toEqual([]);
});

test('normal endgame stats can finish the Cantor through real keyboard input', async ({ page }) => {
  test.setTimeout(180_000);
  await beginNormalStatBossJourney(page);
  await expect
    .poll(async () => (await read(page)).encounter?.boss?.state, { timeout: 15_000 })
    .toBe('phaseOne');
  await moveTo(page, 850);
  await attackUntil(
    page,
    (boss) => boss.state === 'transition' || boss.state === 'phaseTwo',
    true,
    'combo',
  );
  await expect.poll(async () => (await read(page)).encounter?.boss?.state).toBe('phaseTwo');
  await recoverWithSunmoss(page);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if ((await read(page)).combat?.selectedAbilityId === 'resonant-pulse') break;
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(150);
  }
  await awakenLens(page, 0, 360);
  await moveTo(page, 1560);
  await awakenLens(page, 1, 1560);
  await expect.poll(async () => (await read(page)).encounter?.boss?.heartExposed).toBe(true);
  await expect(page.getByText(/Heart exposed/)).toBeVisible();
  await moveTo(page, 850);
  await attackUntil(page, (boss) => boss.state === 'defeat', true, 'combo');
  await expect.poll(async () => (await read(page)).encounter?.boss?.defeatSave).toBe('committed');
});
