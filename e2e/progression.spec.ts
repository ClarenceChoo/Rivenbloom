import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type DomainEvent = Readonly<{
  sequence: number;
  kind: 'progression' | 'checkpoint-activated' | 'death-restored';
  checkpointId?: string;
  event?: Readonly<{ kind: string; id: string | null; amount: number | null }>;
}>;

type ProgressionSnapshot = Readonly<{
  titleReady: boolean;
  world: Readonly<{
    mode: 'new' | 'load';
    position: Readonly<{ x: number; y: number }>;
  }> | null;
  player: Readonly<{
    position: Readonly<{ x: number; y: number }>;
    velocity: Readonly<{ x: number; y: number }>;
    state: string;
  }> | null;
  combat: Readonly<{ currentMana: number; projectileCount: number }> | null;
  encounter: Readonly<{
    enemies: readonly Readonly<{ health: number; maxHealth: number; state: string }>[];
    activeOrdnance: number;
    playerVitality: Readonly<{ currentHealth: number; maxHealth: number }> | null;
  }> | null;
  worldUi: Readonly<{
    prompt: string | null;
    player: Readonly<{
      currentHealth: number;
      maxHealth: number;
      currentMana: number;
      maxMana: number;
      currency: number;
    }>;
    quests: readonly Readonly<{
      questId: string;
      stageId: string;
      objective: string;
    }>[];
    autosave: 'idle' | 'queued' | 'saving' | 'failed' | 'session-only';
  }> | null;
  modal: Readonly<{
    sessionId: number;
    revision: number;
    mode: 'dialogue' | 'shop';
    copy: string;
  }> | null;
  domainEvents: readonly DomainEvent[];
  runtimeSaveRevision: number | null;
  deathReload: Readonly<{
    slotId: string;
    count: number;
    initial: Readonly<{
      position: Readonly<{ x: number; y: number }>;
      currentHealth: number;
      maxHealth: number;
      currentMana: number;
      maxMana: number;
      projectileCount: number;
      activeOrdnance: number;
      enemiesFresh: boolean;
    }> | null;
  }> | null;
}>;

type ProgressionBridge = Readonly<{ read(): ProgressionSnapshot }>;

function snapshot(page: Page): Promise<ProgressionSnapshot> {
  return page.evaluate(() =>
    (
      window as Window & {
        __RIVENBLOOM_TEST__: ProgressionBridge;
      }
    ).__RIVENBLOOM_TEST__.read(),
  );
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function waitForTitle(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (
        window as Window & {
          __RIVENBLOOM_TEST__?: ProgressionBridge;
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
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  await expect.poll(async () => (await snapshot(page)).world?.mode).toBe('new');
}

async function continueJourney(page: Page): Promise<void> {
  await waitForTitle(page);
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  await expect.poll(async () => (await snapshot(page)).world?.mode).toBe('load');
}

async function walkToPrompt(page: Page, centerX: number, prompt: string): Promise<void> {
  // Interaction cleanup deliberately gates input until one neutral frame is observed.
  await page.waitForTimeout(100);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const current = await snapshot(page);
    const x = current.player?.position.x ?? Number.NEGATIVE_INFINITY;
    if (Math.abs(current.player?.velocity.x ?? 1) < 0.01 && current.worldUi?.prompt === prompt) {
      return;
    }
    const movingRight = x < centerX;
    const key = movingRight ? 'ArrowRight' : 'ArrowLeft';
    const brakingTarget = centerX + (movingRight ? -20 : 20);
    await page.keyboard.down(key);
    try {
      await page.waitForFunction(
        ({ target, right }) => {
          const player = (
            window as Window & { __RIVENBLOOM_TEST__: ProgressionBridge }
          ).__RIVENBLOOM_TEST__.read().player;
          return (
            player !== null && (right ? player.position.x >= target : player.position.x <= target)
          );
        },
        { target: brakingTarget, right: movingRight },
        { polling: 'raf' },
      );
    } finally {
      await page.keyboard.up(key);
    }
    await page.waitForFunction(
      () => {
        const player = (
          window as Window & { __RIVENBLOOM_TEST__: ProgressionBridge }
        ).__RIVENBLOOM_TEST__.read().player;
        return player !== null && Math.abs(player.velocity.x) < 0.01;
      },
      undefined,
      { polling: 'raf' },
    );
  }
  const settled = await snapshot(page);
  expect(settled.worldUi?.prompt).toBe(prompt);
}

async function openNpc(page: Page, speaker: string): Promise<void> {
  await expect.poll(async () => (await snapshot(page)).player?.state).toBe('idle');
  await page.waitForTimeout(100);
  await page.keyboard.down('e');
  await expect(page.getByRole('dialog', { name: speaker })).toBeVisible();
  const opened = await snapshot(page);
  expect(opened.player?.state).toBe('interact');
  const heldSession = opened.modal?.sessionId;
  const heldRevision = opened.modal?.revision;
  const heldPosition = opened.player?.position;
  await page.waitForTimeout(250);
  expect((await snapshot(page)).modal).toMatchObject({
    sessionId: heldSession,
    revision: heldRevision,
  });
  expect((await snapshot(page)).player?.position).toEqual(heldPosition);
  await page.keyboard.up('e');
}

test('real progression input rests, advances Sela, rejects shops, and reloads after death', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto('/');
  await waitForTitle(page);
  await beginJourney(page);

  await expect
    .poll(async () => (await snapshot(page)).worldUi?.prompt)
    .toBe('Rest at Village Seed-Lantern');
  await page.keyboard.press('q');
  await expect.poll(async () => (await snapshot(page)).combat?.currentMana).toBe(32);
  await expect.poll(async () => (await snapshot(page)).player?.state).toBe('idle');
  const beforeRestRevision = (await snapshot(page)).runtimeSaveRevision;
  await page.keyboard.down('e');
  await expect.poll(async () => (await snapshot(page)).worldUi?.player.currentMana).toBe(40);
  await page.waitForTimeout(300);
  const rested = await snapshot(page);
  expect(rested.worldUi?.player).toMatchObject({
    currentHealth: 100,
    maxHealth: 100,
    currentMana: 40,
    maxMana: 40,
  });
  expect(rested.combat).toMatchObject({ currentMana: 40, projectileCount: 0 });
  await expect.poll(async () => (await snapshot(page)).worldUi?.autosave).toBe('idle');
  expect(rested.runtimeSaveRevision).toBe((beforeRestRevision ?? 0) + 1);
  expect(rested.domainEvents.filter(({ kind }) => kind === 'checkpoint-activated')).toHaveLength(1);
  await page.keyboard.up('e');

  await walkToPrompt(page, 672, 'Speak with Sela');
  const beforeSelaRevision = (await snapshot(page)).runtimeSaveRevision;
  await openNpc(page, 'Sela Quill');
  const selaDialog = page.getByRole('dialog', { name: 'Sela Quill' });
  await expect(
    selaDialog.getByText(
      'The root-song has gone thin beneath my maps. Will you follow where the ink trembles?',
    ),
  ).toHaveCSS('user-select', 'text');
  await selaDialog.getByRole('button', { name: 'I will listen.' }).click();
  await expect(selaDialog).toHaveCount(0);
  await expect
    .poll(async () =>
      (await snapshot(page)).worldUi?.quests.find(({ questId }) => questId === 'the-silent-bloom'),
    )
    .toMatchObject({
      stageId: 'trace-listening-arch',
      objective: 'Trace the root-song beneath Brackenreach.',
    });
  const accepted = await snapshot(page);
  expect(accepted.runtimeSaveRevision).toBe((beforeSelaRevision ?? 0) + 1);
  expect(
    accepted.domainEvents.some(
      ({ kind, event }) =>
        kind === 'progression' &&
        event?.kind === 'fact-set' &&
        event.id === 'silent-bloom-accepted',
    ),
  ).toBe(true);
  expect(
    accepted.domainEvents.some(
      ({ kind, event }) =>
        kind === 'progression' &&
        event?.kind === 'quest-advanced' &&
        event.id === 'the-silent-bloom',
    ),
  ).toBe(true);

  await page.waitForTimeout(650);
  await page.reload();
  await continueJourney(page);
  await walkToPrompt(page, 672, 'Speak with Sela');
  await openNpc(page, 'Sela Quill');
  await expect(
    page
      .getByRole('dialog', { name: 'Sela Quill' })
      .getByText(
        'The Listening Arch lies east of the old briar mile. Trust the root-song when the ink fails.',
      ),
  ).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Sela Quill' })
    .getByRole('button', {
      name: 'Until next time.',
    })
    .click();

  await walkToPrompt(page, 1_216, 'Speak with Orin');
  await openNpc(page, 'Orin Fen');
  const orinDialog = page.getByRole('dialog', { name: 'Orin Fen' });
  await orinDialog.getByRole('button', { name: 'Browse wares' }).click();
  await expect.poll(async () => (await snapshot(page)).modal?.mode).toBe('shop');
  const beforeOrinReject = (await snapshot(page)).runtimeSaveRevision;
  await orinDialog.getByRole('button', { name: 'Try purchase' }).click();
  await expect(orinDialog.getByRole('alert')).toBeVisible();
  expect((await snapshot(page)).runtimeSaveRevision).toBe(beforeOrinReject);
  await orinDialog.getByRole('button', { name: 'Leave shop' }).click();

  await walkToPrompt(page, 1_760, 'Speak with Piri');
  await openNpc(page, 'Piri Moss');
  const piriDialog = page.getByRole('dialog', { name: 'Piri Moss' });
  await piriDialog.getByRole('button', { name: 'Browse wares' }).click();
  await expect.poll(async () => (await snapshot(page)).modal?.mode).toBe('shop');
  const beforePiriReject = (await snapshot(page)).runtimeSaveRevision;
  await piriDialog.getByRole('button', { name: 'Try purchase' }).first().click();
  await expect(piriDialog.getByRole('alert')).toContainText(/currency|available|funds/i);
  expect((await snapshot(page)).runtimeSaveRevision).toBe(beforePiriReject);
  await piriDialog.getByRole('button', { name: 'Leave shop' }).click();

  await page.waitForTimeout(650);
  await page.goto('/?debug-encounter=mixed');
  await continueJourney(page);
  await expect.poll(async () => (await snapshot(page)).encounter?.enemies.length).toBe(3);
  // Stay among the active attackers instead of running past them while waiting for a real death.
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const current = await snapshot(page);
    if ((current.deathReload?.count ?? 0) > 0) break;
    const x = current.player?.position.x ?? 420;
    const key = x < 340 ? 'ArrowRight' : x > 560 ? 'ArrowLeft' : null;
    if (key !== null) await page.keyboard.down(key);
    await page.waitForTimeout(350);
    if (key !== null) await page.keyboard.up(key);
  }
  await expect.poll(async () => (await snapshot(page)).deathReload?.count).toBe(1);
  await expect.poll(async () => (await snapshot(page)).world?.mode).toBe('load');
  await expect.poll(async () => (await snapshot(page)).encounter?.enemies.length).toBe(3);
  const restored = await snapshot(page);
  expect(restored.world?.position).toEqual({ x: 256, y: 608 });
  expect(restored.deathReload?.initial).toMatchObject({
    position: { x: 256, y: 608 },
    currentHealth: 100,
    maxHealth: 100,
    currentMana: 40,
    maxMana: 40,
    projectileCount: 0,
    activeOrdnance: 0,
    enemiesFresh: true,
  });
  expect(restored.encounter?.enemies.every(({ health, maxHealth }) => health === maxHealth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});
