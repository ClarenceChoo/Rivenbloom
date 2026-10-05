import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CONTENT_REGISTRY } from '../src/game/data/areas';

type TraversalSnapshot = Readonly<{
  titleReady: boolean;
  domainEvents: readonly Readonly<{
    kind: string;
    event?: Readonly<{ kind: string; id: string | null }>;
  }>[];
  world: Readonly<{
    mode: 'new' | 'load';
    areaId: string;
    roomId: string;
    checkpointId: string;
  }> | null;
  player: Readonly<{
    position: Readonly<{ x: number; y: number }>;
    velocity: Readonly<{ x: number; y: number }>;
    state: string;
  }> | null;
  combat: Readonly<{
    actionSequence: number;
    lastAcceptedAction: string | null;
    currentMana: number;
    selectedAbilityId: string;
    guarding: boolean;
  }> | null;
  deathReload: Readonly<{ count: number }> | null;
  encounter: Readonly<{
    stepIndex: number;
    simulationTimeMs: number;
    enemies: readonly Readonly<{
      combatantId: string;
      state: string;
      position: Readonly<{ x: number; y: number }>;
      facing: 'left' | 'right';
      health: number;
      maxHealth: number;
      targetable: boolean;
    }>[];
  }> | null;
  worldUi: Readonly<{
    prompt: string | null;
    checkpoint: Readonly<{ checkpointId: string }>;
    player: Readonly<{
      currentHealth: number;
      maxHealth: number;
      currentMana: number;
      maxMana: number;
      experience: number;
      currency: number;
      weaponLevel: number;
    }>;
    world: Readonly<{
      discoveredRoomIds: readonly string[];
      objects: Readonly<{
        puzzles: readonly Readonly<{
          puzzleId: string;
          state: string;
          activatedMechanismIds?: readonly string[];
        }>[];
        chests: readonly Readonly<{ chestId: string; state: string }>[];
        shortcuts: readonly Readonly<{ shortcutId: string; state: string }>[];
        breakables: readonly Readonly<{ breakableId: string; state: string }>[];
      }>;
    }>;
    quests: readonly Readonly<{ questId: string; stageId: string }>[];
    inventory: readonly Readonly<{ itemId: string; quantity: number }>[];
  }> | null;
}>;

async function snapshot(page: Page): Promise<TraversalSnapshot> {
  return page.evaluate(() =>
    (
      window as Window & {
        __RIVENBLOOM_TEST__: { read(): TraversalSnapshot };
      }
    ).__RIVENBLOOM_TEST__.read(),
  );
}

async function beginJourney(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(
    () =>
      (
        window as Window & {
          __RIVENBLOOM_TEST__?: { read(): TraversalSnapshot };
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

async function moveRightUntil(page: Page, areaId: string, roomId: string): Promise<void> {
  await moveUntil(page, 'ArrowRight', areaId, roomId);
}

async function moveLeftUntil(page: Page, areaId: string, roomId: string): Promise<void> {
  await moveUntil(page, 'ArrowLeft', areaId, roomId);
}

async function moveUntil(
  page: Page,
  key: 'ArrowLeft' | 'ArrowRight',
  areaId: string,
  roomId: string,
): Promise<void> {
  await page.waitForTimeout(100);
  for (let segment = 0; segment < 16; segment += 1) {
    const current = await snapshot(page);
    if (current.world?.areaId === areaId && current.world.roomId === roomId) return;
    await page.keyboard.down(key);
    try {
      await page.waitForTimeout(34);
      await page.keyboard.press('ShiftLeft');
      const arrived = await expect
        .poll(
          async () => {
            const world = (await snapshot(page)).world;
            return world === null ? null : { areaId: world.areaId, roomId: world.roomId };
          },
          { timeout: 2_500 },
        )
        .toEqual({ areaId, roomId })
        .then(() => true)
        .catch(() => false);
      if (arrived) return;
    } finally {
      await page.keyboard.up(key);
    }
    const after = await snapshot(page);
    if (
      current.player !== null &&
      after.player !== null &&
      Math.abs(after.player.position.x - current.player.position.x) < 2
    ) {
      const awayKey = key === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
      const awayTarget = current.player.position.x + (key === 'ArrowLeft' ? 72 : -72);
      await page.keyboard.down(awayKey);
      try {
        await expect
          .poll(
            async () => {
              const x = (await snapshot(page)).player?.position.x;
              return (
                x !== undefined && (awayKey === 'ArrowRight' ? x >= awayTarget : x <= awayTarget)
              );
            },
            { timeout: 1_500 },
          )
          .toBe(true)
          .catch(() => undefined);
      } finally {
        await page.keyboard.up(awayKey);
      }
      await waitForNeutralSteps(page);
    }
  }
  const stalled = await snapshot(page);
  throw new Error(
    `Traversal stalled: ${JSON.stringify({ world: stalled.world, player: stalled.player })}`,
  );
}

async function moveToPrompt(page: Page, centerX: number, prompt: string): Promise<void> {
  await page.waitForTimeout(100);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const current = await snapshot(page);
    const x = current.player?.position.x;
    if (
      x !== undefined &&
      Math.abs(current.player?.velocity.x ?? 1) < 0.01 &&
      current.worldUi?.prompt === prompt
    ) {
      return;
    }
    if (x === undefined) throw new Error(`Player disappeared while seeking ${prompt}.`);
    const movingRight = x < centerX;
    const key = movingRight ? 'ArrowRight' : 'ArrowLeft';
    await page.keyboard.down(key);
    try {
      if (Math.abs(centerX - x) > 220) {
        const target = centerX + (movingRight ? -160 : 160);
        await page.waitForFunction(
          ({ targetX, right, expectedPrompt }) => {
            const state = (
              window as Window & { __RIVENBLOOM_TEST__: { read(): TraversalSnapshot } }
            ).__RIVENBLOOM_TEST__.read();
            const player = state.player;
            return (
              state.worldUi?.prompt === expectedPrompt ||
              (player !== null &&
                (right ? player.position.x >= targetX : player.position.x <= targetX))
            );
          },
          { targetX: target, right: movingRight, expectedPrompt: prompt },
          { polling: 'raf', timeout: 8_000 },
        );
      } else {
        await page.waitForTimeout(50);
      }
    } finally {
      await page.keyboard.up(key);
    }
    await page.waitForFunction(
      () => Math.abs(window.__RIVENBLOOM_TEST__?.read().player?.velocity.x ?? 1) < 0.01,
      undefined,
      { polling: 'raf' },
    );
  }
  const stalled = await snapshot(page);
  throw new Error(
    `Prompt ${prompt} was not reachable at x=${centerX}: ${JSON.stringify({
      player: stalled.player,
      prompt: stalled.worldUi?.prompt,
    })}`,
  );
}

async function moveToX(page: Page, targetX: number): Promise<void> {
  await page.waitForTimeout(100);
  const start = (await snapshot(page)).player?.position.x;
  if (start === undefined) throw new Error('Player disappeared before movement.');
  const movingRight = start < targetX;
  const key = movingRight ? 'ArrowRight' : 'ArrowLeft';
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(
      ({ x, right }) => {
        const player = (
          window as Window & { __RIVENBLOOM_TEST__: { read(): TraversalSnapshot } }
        ).__RIVENBLOOM_TEST__.read().player;
        return player !== null && (right ? player.position.x >= x : player.position.x <= x);
      },
      { x: targetX, right: movingRight },
      { polling: 'raf', timeout: 12_000 },
    );
  } finally {
    await page.keyboard.up(key);
  }
  await page.waitForFunction(
    () => Math.abs(window.__RIVENBLOOM_TEST__?.read().player?.velocity.x ?? 1) < 0.01,
    undefined,
    { polling: 'raf' },
  );
}

async function enterInteractRoom(page: Page, targetX: number, roomId: string): Promise<void> {
  await moveToPrompt(page, targetX, 'Enter passage');
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.keyboard.press('e');
    const entered = await page
      .waitForFunction(
        (targetRoomId) =>
          (
            window as Window & { __RIVENBLOOM_TEST__: { read(): TraversalSnapshot } }
          ).__RIVENBLOOM_TEST__.read().world?.roomId === targetRoomId,
        roomId,
        { polling: 'raf', timeout: 2_000 },
      )
      .then(() => true)
      .catch(() => false);
    if (entered) return;
    await waitForNeutralSteps(page);
  }
  throw new Error(`Interact transition did not enter ${roomId}.`);
}

async function crossInteractTransition(
  page: Page,
  targetX: number,
  areaId: string,
  roomId: string,
): Promise<void> {
  await moveToX(page, targetX);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.keyboard.press('e');
    const entered = await page
      .waitForFunction(
        ({ area, room }) => {
          const world = (
            window as Window & { __RIVENBLOOM_TEST__: { read(): TraversalSnapshot } }
          ).__RIVENBLOOM_TEST__.read().world;
          return world?.areaId === area && world.roomId === room;
        },
        { area: areaId, room: roomId },
        { polling: 'raf', timeout: 3_000 },
      )
      .then(() => true)
      .catch(() => false);
    if (entered) return;
    await waitForNeutralSteps(page);
    await moveToX(page, targetX + (attempt % 2 === 0 ? -24 : 24));
  }
  throw new Error(`Interact transition did not enter ${areaId}/${roomId}.`);
}

async function interactFor(page: Page, condition: () => Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.keyboard.press('e');
    if (await condition()) return;
    await waitForNeutralSteps(page);
    if (await condition()) return;
  }
  throw new Error('Interaction did not commit after four neutral input attempts.');
}

async function waitForNeutralSteps(page: Page): Promise<void> {
  const neutralStep = (await snapshot(page)).encounter?.stepIndex ?? 0;
  await page.waitForFunction(
    (step) =>
      ((
        window as Window & { __RIVENBLOOM_TEST__: { read(): TraversalSnapshot } }
      ).__RIVENBLOOM_TEST__.read().encounter?.stepIndex ?? step) >=
      step + 2,
    neutralStep,
    { polling: 'raf', timeout: 1_000 },
  );
}

async function waitForPlayerIdle(page: Page): Promise<void> {
  await expect
    .poll(async () => (await snapshot(page)).player?.state, { timeout: 4_000 })
    .toBe('idle');
}

async function pressCombatAction(
  page: Page,
  key: 'j' | 'q',
  expectedAction: 'attack-light' | 'cast',
): Promise<void> {
  const initialSequence = (await snapshot(page)).combat?.actionSequence ?? 0;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (expectedAction === 'cast') await waitForPlayerIdle(page);
    const beforeStep = (await snapshot(page)).encounter?.stepIndex ?? 0;
    await page.keyboard.press(key);
    await page.waitForFunction(
      ({ sequence, step }) => {
        const state = (
          window as Window & { __RIVENBLOOM_TEST__: { read(): TraversalSnapshot } }
        ).__RIVENBLOOM_TEST__.read();
        return (
          (state.combat?.actionSequence ?? sequence) > sequence ||
          (state.encounter?.stepIndex ?? step) >= step + 6
        );
      },
      { sequence: initialSequence, step: beforeStep },
      { polling: 'raf', timeout: 1_000 },
    );
    const accepted = await snapshot(page);
    if (
      accepted.combat !== null &&
      accepted.combat.actionSequence > initialSequence &&
      accepted.combat.lastAcceptedAction === expectedAction
    ) {
      return;
    }
  }
  throw new Error(`${expectedAction} input did not acquire after neutral fixed steps.`);
}

async function moveTowardTarget(page: Page, combatantId: string, stopAtTargetable: boolean) {
  const before = await snapshot(page);
  const target = before.encounter?.enemies.find((enemy) => enemy.combatantId === combatantId);
  if (target === undefined || before.player === null)
    throw new Error(`Missing combatant ${combatantId}.`);
  const direction = target.position.x >= before.player.position.x ? 'ArrowRight' : 'ArrowLeft';
  await page.keyboard.down(direction);
  try {
    await page.waitForFunction(
      ({ targetId, targetableOnly }) => {
        const state = (
          window as Window & { __RIVENBLOOM_TEST__: { read(): TraversalSnapshot } }
        ).__RIVENBLOOM_TEST__.read();
        const enemy = state.encounter?.enemies.find(
          (candidate) => candidate.combatantId === targetId,
        );
        if (enemy?.state === 'dead') return true;
        if (enemy === undefined || state.player === null) return false;
        return targetableOnly
          ? enemy.targetable
          : Math.abs(enemy.position.x - state.player.position.x) <= 80;
      },
      { targetId: combatantId, targetableOnly: stopAtTargetable },
      { polling: 'raf', timeout: 5_000 },
    );
  } finally {
    await page.keyboard.up(direction);
  }
}

async function wakeTarget(page: Page, combatantId: string): Promise<boolean> {
  const before = await snapshot(page);
  const target = before.encounter?.enemies.find((enemy) => enemy.combatantId === combatantId);
  if (before.player === null) throw new Error('Player disappeared while waking an enemy.');
  if (target === undefined) return false;
  if (target.targetable || target.state === 'dead') return true;
  const needsJump = before.player.position.y - target.position.y > 240;
  if (needsJump && Math.abs(target.position.x - before.player.position.x) > 220) {
    const direction = target.position.x >= before.player.position.x ? 'ArrowRight' : 'ArrowLeft';
    await moveToX(page, target.position.x + (direction === 'ArrowRight' ? -200 : 200));
    await waitForPlayerIdle(page);
  }
  if (needsJump) {
    await page.keyboard.down('Space');
    try {
      return await page
        .waitForFunction(
          (targetId) => {
            const enemy = (
              window as Window & { __RIVENBLOOM_TEST__: { read(): TraversalSnapshot } }
            ).__RIVENBLOOM_TEST__
              .read()
              .encounter?.enemies.find((candidate) => candidate.combatantId === targetId);
            return enemy?.targetable === true || enemy?.state === 'dead';
          },
          combatantId,
          { polling: 'raf', timeout: 5_000 },
        )
        .then(() => true)
        .catch(() => false);
    } finally {
      await page.keyboard.up('Space');
    }
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = await snapshot(page);
    const currentTarget = current.encounter?.enemies.find(
      (enemy) => enemy.combatantId === combatantId,
    );
    if (currentTarget?.targetable || currentTarget?.state === 'dead') return true;
    if (currentTarget === undefined || current.player === null) break;
    const direction =
      currentTarget.position.x >= current.player.position.x ? 'ArrowRight' : 'ArrowLeft';
    await page.keyboard.down(direction);
    try {
      const awakened = await page
        .waitForFunction(
          (targetId) => {
            const enemy = (
              window as Window & { __RIVENBLOOM_TEST__: { read(): TraversalSnapshot } }
            ).__RIVENBLOOM_TEST__
              .read()
              .encounter?.enemies.find((candidate) => candidate.combatantId === targetId);
            return enemy?.targetable === true || enemy?.state === 'dead';
          },
          combatantId,
          { polling: 'raf', timeout: 2_000 },
        )
        .then(() => true)
        .catch(() => false);
      if (awakened) return true;
    } finally {
      await page.keyboard.up(direction);
    }
  }
  return false;
}

async function clearEncounter(page: Page, combatantIds: readonly string[]): Promise<void> {
  await page.waitForFunction(
    (targetIds) => {
      const enemies = (
        window as Window & { __RIVENBLOOM_TEST__: { read(): TraversalSnapshot } }
      ).__RIVENBLOOM_TEST__.read().encounter?.enemies;
      return targetIds.every((targetId) =>
        enemies?.some((enemy) => enemy.combatantId === targetId),
      );
    },
    combatantIds,
    { polling: 'raf', timeout: 3_000 },
  );
  await page.evaluate((targetIds) => {
    const bridge = (
      window as Window & {
        __RIVENBLOOM_TEST__: {
          read(): TraversalSnapshot;
          act(action: Readonly<{ kind: 'defeat-enemies'; combatantIds: readonly string[] }>): void;
        };
      }
    ).__RIVENBLOOM_TEST__;
    const defeatWhenTargetable = () => {
      const enemies = bridge.read().encounter?.enemies;
      const remaining = targetIds.filter((targetId) =>
        enemies?.some((enemy) => enemy.combatantId === targetId && enemy.state !== 'dead'),
      );
      if (remaining.length === 0) return;
      bridge.act({ kind: 'defeat-enemies', combatantIds: remaining });
      window.requestAnimationFrame(defeatWhenTargetable);
    };
    defeatWhenTargetable();
  }, combatantIds);
  for (const combatantId of combatantIds) {
    if (!(await wakeTarget(page, combatantId))) {
      throw new Error(`Could not activate ${combatantId} before clearing the encounter.`);
    }
    await expect
      .poll(
        async () =>
          (await snapshot(page)).encounter?.enemies.find(
            (enemy) => enemy.combatantId === combatantId,
          )?.state,
        { timeout: 5_000 },
      )
      .toBe('dead');
  }
  await waitForNeutralSteps(page);
}

async function dashThroughTelegraph(page: Page, combatantId: string): Promise<boolean> {
  await waitForPlayerIdle(page);
  let before = await snapshot(page);
  let target = before.encounter?.enemies.find((enemy) => enemy.combatantId === combatantId);
  if (target === undefined || before.player === null || before.combat === null) {
    return false;
  }
  const ready = await page
    .waitForFunction(
      (targetId) => {
        const state = (
          window as Window & { __RIVENBLOOM_TEST__: { read(): TraversalSnapshot } }
        ).__RIVENBLOOM_TEST__
          .read()
          .encounter?.enemies.find((enemy) => enemy.combatantId === targetId)?.state;
        return (
          state === 'idle' ||
          state === 'patrol' ||
          state === 'suspect' ||
          state === 'chase' ||
          state === 'retreat' ||
          state === 'telegraph'
        );
      },
      combatantId,
      { polling: 'raf', timeout: 3_000 },
    )
    .then(() => true)
    .catch(() => false);
  if (!ready) return false;
  before = await snapshot(page);
  target = before.encounter?.enemies.find((enemy) => enemy.combatantId === combatantId);
  if (target === undefined || before.player === null || before.combat === null) {
    return false;
  }
  const approachDirection =
    target.position.x >= before.player.position.x ? 'ArrowRight' : 'ArrowLeft';
  let direction: 'ArrowRight' | 'ArrowLeft' = approachDirection;
  await page.keyboard.down(approachDirection);
  try {
    const committedTelegraph = await page
      .waitForFunction(
        (targetId) =>
          (
            window as Window & { __RIVENBLOOM_TEST__: { read(): TraversalSnapshot } }
          ).__RIVENBLOOM_TEST__
            .read()
            .encounter?.enemies.find((enemy) => enemy.combatantId === targetId)?.state ===
          'telegraph',
        combatantId,
        { polling: 'raf', timeout: 8_000 },
      )
      .then(() => true)
      .catch(() => false);
    if (!committedTelegraph) return false;
    const committed = await snapshot(page);
    const committedTarget = committed.encounter?.enemies.find(
      (enemy) => enemy.combatantId === combatantId,
    );
    if (committedTarget === undefined || committed.combat === null) {
      throw new Error('Sentinel committed telegraph projection disappeared.');
    }
    const movingRight =
      committed.player !== null && committedTarget.position.x >= committed.player.position.x;
    direction = movingRight ? 'ArrowRight' : 'ArrowLeft';
    if (direction !== approachDirection) {
      await page.keyboard.up(approachDirection);
      await page.keyboard.down(direction);
    }
    const inRange = await page
      .waitForFunction(
        ({ targetId, right }) => {
          const state = (
            window as Window & { __RIVENBLOOM_TEST__: { read(): TraversalSnapshot } }
          ).__RIVENBLOOM_TEST__.read();
          const enemy = state.encounter?.enemies.find(
            (candidate) => candidate.combatantId === targetId,
          );
          return (
            enemy !== undefined &&
            state.player !== null &&
            Math.abs(enemy.position.x - state.player.position.x) <= 105 &&
            (right ? state.player.velocity.x > 0 : state.player.velocity.x < 0)
          );
        },
        { targetId: combatantId, right: direction === 'ArrowRight' },
        { polling: 'raf', timeout: 1_500 },
      )
      .then(() => true)
      .catch(() => false);
    if (!inRange) return false;
    await page.keyboard.press('ShiftLeft');
    const dashed = await page
      .waitForFunction(
        (sequence) => {
          const combat = (
            window as Window & { __RIVENBLOOM_TEST__: { read(): TraversalSnapshot } }
          ).__RIVENBLOOM_TEST__.read().combat;
          return (
            combat !== null &&
            combat.actionSequence > sequence &&
            combat.lastAcceptedAction === 'dash'
          );
        },
        committed.combat.actionSequence,
        { polling: 'raf', timeout: 1_500 },
      )
      .then(() => true)
      .catch(() => false);
    if (!dashed) return false;
    return await page
      .waitForFunction(
        ({ targetX, right }) => {
          const player = (
            window as Window & { __RIVENBLOOM_TEST__: { read(): TraversalSnapshot } }
          ).__RIVENBLOOM_TEST__.read().player;
          return (
            player !== null && (right ? player.position.x > targetX : player.position.x < targetX)
          );
        },
        { targetX: committedTarget.position.x, right: movingRight },
        { polling: 'raf', timeout: 1_000 },
      )
      .then(() => true)
      .catch(() => false);
  } finally {
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up(approachDirection);
    await page.keyboard.up(direction);
  }
}

async function flankSentinel(page: Page): Promise<void> {
  const combatantId = 'verge-thorn-sentinel';
  await waitForPlayerIdle(page);
  await waitForNeutralSteps(page);
  if (!(await wakeTarget(page, combatantId))) {
    throw new Error('Thorn Sentinel did not wake during the bounded approach.');
  }
  await moveTowardTarget(page, combatantId, true);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (await dashThroughTelegraph(page, combatantId)) return;
    await waitForNeutralSteps(page);
  }
  throw new Error('Thorn Sentinel was not crossed during a committed telegraph.');
}

async function activateCheckpoint(page: Page, checkpointId: string): Promise<void> {
  const checkpoint = CONTENT_REGISTRY.areas
    .flatMap((area) => area.checkpoints)
    .find((candidate) => candidate.checkpointId === checkpointId);
  if (checkpoint === undefined) throw new Error(`Unknown checkpoint ${checkpointId}.`);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await moveToPrompt(page, checkpoint.interactionPosition.x, `Rest at ${checkpoint.displayName}`);
    await page.keyboard.press('e');
    const state = await snapshot(page);
    if (
      state.worldUi?.checkpoint.checkpointId === checkpointId &&
      state.worldUi.player.currentHealth === state.worldUi.player.maxHealth &&
      state.worldUi.player.currentMana === state.worldUi.player.maxMana
    ) {
      return;
    }
    await waitForNeutralSteps(page);
  }
  throw new Error(`Checkpoint ${checkpointId} did not activate.`);
}

async function acceptSilentBloom(page: Page): Promise<void> {
  await moveToPrompt(page, 672, 'Speak with Sela');
  await waitForPlayerIdle(page);
  await page.keyboard.press('e');
  const dialogue = page.getByRole('dialog', { name: 'Sela Quill' });
  await expect(dialogue).toBeVisible();
  await dialogue.getByRole('button', { name: 'I will listen.' }).click();
  await expect
    .poll(async () =>
      (await snapshot(page)).worldUi?.quests.find(({ questId }) => questId === 'the-silent-bloom'),
    )
    .toMatchObject({ stageId: 'trace-listening-arch' });
}

async function turnInRootMemory(page: Page): Promise<void> {
  await moveToPrompt(page, 1760, 'Speak with Piri');
  await waitForPlayerIdle(page);
  await page.keyboard.press('e');
  const dialogue = page.getByRole('dialog', { name: 'Piri Moss' });
  await expect(dialogue).toBeVisible();
  await dialogue.getByRole('button', { name: 'Let its memory teach me.' }).click();
  await expect
    .poll(async () =>
      (await snapshot(page)).worldUi?.quests.find(({ questId }) => questId === 'the-silent-bloom'),
    )
    .toMatchObject({ stageId: 'ask-orin-to-reforge' });
  const leaveShop = dialogue.getByRole('button', { name: 'Leave shop' });
  if (await leaveShop.isVisible()) await leaveShop.click();
}

async function reforgeSurveyorEdge(page: Page): Promise<void> {
  await moveToPrompt(page, 1216, 'Speak with Orin');
  await waitForPlayerIdle(page);
  await page.keyboard.press('e');
  const dialogue = page.getByRole('dialog', { name: 'Orin Fen' });
  await expect(dialogue).toBeVisible();
  await dialogue.getByRole('button', { name: 'Browse wares' }).click();
  const offer = dialogue.locator('article').filter({ hasText: 'Reforge Surveyor Edge' });
  await offer.getByRole('button', { name: 'Purchase' }).click();
  await expect
    .poll(async () => (await snapshot(page)).worldUi?.player)
    .toMatchObject({
      currency: 25,
      weaponLevel: 1,
    });
  await expect
    .poll(async () =>
      (await snapshot(page)).worldUi?.quests.find(({ questId }) => questId === 'the-silent-bloom'),
    )
    .toMatchObject({ stageId: 'enter-rootglass-reliquary' });
  await dialogue.getByRole('button', { name: 'Leave shop' }).click();
}

async function breakWithChargedHeavy(
  page: Page,
  stanceX: number,
  breakableId: string,
): Promise<void> {
  const currentX = (await snapshot(page)).player?.position.x;
  if (currentX === undefined) throw new Error('Player disappeared before a charged heavy.');
  if (currentX >= stanceX) await moveToX(page, stanceX - 160);
  await moveToX(page, stanceX);
  await waitForPlayerIdle(page);
  const sequence = (await snapshot(page)).combat?.actionSequence ?? 0;
  await page.keyboard.down('k');
  await page.waitForTimeout(400);
  await page.keyboard.up('k');
  await page.waitForFunction(
    (beforeSequence) => {
      const combat = (
        window as Window & { __RIVENBLOOM_TEST__: { read(): TraversalSnapshot } }
      ).__RIVENBLOOM_TEST__.read().combat;
      return (
        combat !== null &&
        combat.actionSequence > beforeSequence &&
        combat.lastAcceptedAction === 'attack-heavy'
      );
    },
    sequence,
    { polling: 'raf', timeout: 2_000 },
  );
  await expect
    .poll(
      async () =>
        (await snapshot(page)).worldUi?.world.objects.breakables.find(
          (breakable) => breakable.breakableId === breakableId,
        )?.state,
    )
    .toBe('opened');
}

async function lightMemorialLantern(page: Page, centerX: number, factId: string): Promise<void> {
  await moveToPrompt(page, centerX, 'Light memorial lantern');
  await waitForPlayerIdle(page);
  await interactFor(page, async () =>
    (await snapshot(page)).domainEvents.some(
      (entry) =>
        entry.kind === 'progression' &&
        entry.event?.kind === 'fact-set' &&
        entry.event.id === factId,
    ),
  );
}

async function claimDiscovery(
  page: Page,
  centerX: number,
  displayName: string,
  completed: () => Promise<boolean>,
): Promise<void> {
  await moveToPrompt(page, centerX, `Examine ${displayName}`);
  await interactFor(page, completed);
}

async function turnInLanterns(page: Page): Promise<void> {
  await moveToPrompt(page, 1760, 'Speak with Piri');
  await waitForPlayerIdle(page);
  await page.keyboard.press('e');
  const dialogue = page.getByRole('dialog', { name: 'Piri Moss' });
  await expect(dialogue).toBeVisible();
  await dialogue.getByRole('button', { name: 'Their light belongs with you.' }).click();
  await expect
    .poll(async () =>
      (await snapshot(page)).worldUi?.quests.find(
        ({ questId }) => questId === 'lanterns-for-the-absent',
      ),
    )
    .toMatchObject({ stageId: 'complete' });
  await expect.poll(async () => (await snapshot(page)).worldUi?.player.maxMana).toBe(56);
  const close = dialogue.getByRole('button', { name: 'Close' });
  if (await close.isVisible()) {
    await close.click();
    return;
  }
  const leaveShop = dialogue.getByRole('button', { name: 'Leave shop' });
  if (await leaveShop.isVisible()) await leaveShop.click();
}

async function turnInFolio(page: Page): Promise<void> {
  await moveToPrompt(page, 672, 'Speak with Sela');
  await waitForPlayerIdle(page);
  await page.keyboard.press('e');
  const dialogue = page.getByRole('dialog', { name: 'Sela Quill' });
  await expect(dialogue).toBeVisible();
  await dialogue.getByRole('button', { name: 'The folio is yours.' }).click();
  await expect
    .poll(async () =>
      (await snapshot(page)).worldUi?.quests.find(({ questId }) => questId === 'lost-folio'),
    )
    .toMatchObject({ stageId: 'complete' });
  await expect
    .poll(async () => (await snapshot(page)).worldUi?.inventory)
    .toContainEqual(expect.objectContaining({ itemId: 'quiet-step', quantity: 1 }));
  await expect(dialogue).toHaveCount(0);
}

async function solveDashCircuit(page: Page): Promise<void> {
  // Climb before starting the timed set, then descend from rib to dew to song.
  // All three activations still use real movement and the authored nine-second window.
  await moveToX(page, 4570);
  await page.keyboard.down('ArrowUp');
  try {
    await page.waitForFunction(
      () =>
        ((
          window as Window & { __RIVENBLOOM_TEST__: { read(): TraversalSnapshot } }
        ).__RIVENBLOOM_TEST__.read().player?.position.y ?? 1688) <= 1440,
      undefined,
      { polling: 'raf', timeout: 3_000 },
    );
  } finally {
    await page.keyboard.up('ArrowUp');
  }
  await moveToX(page, 4480);
  await expect
    .poll(
      async () =>
        (await snapshot(page)).worldUi?.world.objects.puzzles.find(
          ({ puzzleId }) => puzzleId === 'hollows-dash-circuit',
        )?.activatedMechanismIds,
    )
    .toContain('dash-circuit-rib-plate');
  await moveToX(page, 3904);
  await expect
    .poll(
      async () =>
        (await snapshot(page)).worldUi?.world.objects.puzzles.find(
          ({ puzzleId }) => puzzleId === 'hollows-dash-circuit',
        )?.activatedMechanismIds,
    )
    .toEqual(expect.arrayContaining(['dash-circuit-rib-plate', 'dash-circuit-dew-plate']));
  await moveToX(page, 4992);
  await expect
    .poll(
      async () =>
        (await snapshot(page)).worldUi?.world.objects.puzzles.find(
          ({ puzzleId }) => puzzleId === 'hollows-dash-circuit',
        )?.state,
    )
    .toBe('solved');
}

async function usePuzzleMechanism(
  page: Page,
  centerX: number,
  displayName: string,
  puzzleId: string,
  mechanismId: string,
  completes: boolean,
): Promise<void> {
  // Several dials share one prompt; reach the requested dial before matching its label.
  await moveToX(page, centerX);
  await moveToPrompt(page, centerX, `Use ${displayName}`);
  await interactFor(page, async () => {
    const puzzle = (await snapshot(page)).worldUi?.world.objects.puzzles.find(
      (candidate) => candidate.puzzleId === puzzleId,
    );
    return completes
      ? puzzle?.state === 'solved'
      : puzzle?.activatedMechanismIds?.includes(mechanismId) === true;
  });
}

async function selectAbility(page: Page, abilityId: string): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if ((await snapshot(page)).combat?.selectedAbilityId === abilityId) return;
    const previous = (await snapshot(page)).combat?.selectedAbilityId;
    await page.keyboard.press('r');
    await expect
      .poll(async () => (await snapshot(page)).combat?.selectedAbilityId)
      .not.toBe(previous);
  }
  throw new Error(`Could not select ${abilityId}.`);
}

async function waitForCombatTime(page: Page, targetMs: number): Promise<void> {
  await page.waitForFunction(
    (minimumMs) =>
      ((
        window as Window & { __RIVENBLOOM_TEST__: { read(): TraversalSnapshot } }
      ).__RIVENBLOOM_TEST__.read().encounter?.simulationTimeMs ?? 0) >= minimumMs,
    targetMs,
    { polling: 'raf', timeout: 8_000 },
  );
}

test('Thorn Sentinel can be flanked through its committed telegraph', async ({ page }) => {
  test.setTimeout(120_000);
  await beginJourney(page, '/?debug-encounter=sentinel');
  await flankSentinel(page);
});

test('semantic first-pair defeat preserves the checkpoint', async ({ page }) => {
  test.setTimeout(90_000);
  await beginJourney(page);
  await acceptSilentBloom(page);
  await moveRightUntil(page, 'brackenreach', 'brackenreach-trail');

  await clearEncounter(page, ['trail-briar-west', 'trail-briar-east']);

  const cleared = await snapshot(page);
  expect(cleared.encounter?.enemies).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ combatantId: 'trail-briar-west', state: 'dead' }),
      expect.objectContaining({ combatantId: 'trail-briar-east', state: 'dead' }),
    ]),
  );
  expect(cleared.worldUi?.player.currentHealth).toBeGreaterThan(0);
});

test('fresh real-input route clears the Briars and reaches Split Cedar', async ({ page }) => {
  test.setTimeout(120_000);
  await beginJourney(page);
  await acceptSilentBloom(page);
  await moveRightUntil(page, 'brackenreach', 'brackenreach-trail');

  const initial = await snapshot(page);
  const initialCheckpoint = initial.worldUi?.checkpoint.checkpointId;
  const initialDeathReloads = initial.deathReload?.count ?? 0;
  const observations: string[] = [];
  await wakeTarget(page, 'trail-briar-west');
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const before = await snapshot(page);
    if (before.player === null) throw new Error('Player disappeared during the Briar fight.');
    const living = before.encounter?.enemies.filter(
      (enemy) =>
        ['trail-briar-west', 'trail-briar-east'].includes(enemy.combatantId) &&
        enemy.state !== 'dead',
    );
    if (living?.length === 0) break;
    if (living === undefined) throw new Error('Briar encounter disappeared.');
    const target = living.sort(
      (a, b) =>
        Math.abs(a.position.x - before.player!.position.x) -
        Math.abs(b.position.x - before.player!.position.x),
    )[0]!;
    const distance = Math.abs(target.position.x - before.player.position.x);
    if (distance > 80) {
      const direction = target.position.x > before.player.position.x ? 'ArrowRight' : 'ArrowLeft';
      await page.keyboard.down(direction);
      try {
        await page.waitForTimeout(Math.min(450, Math.max(100, (distance - 80) * 3)));
      } finally {
        await page.keyboard.up(direction);
      }
    }
    const approach = await snapshot(page);
    if (approach.player === null) throw new Error('Player disappeared during the Briar fight.');
    const nearest = approach.encounter?.enemies
      .filter(
        (enemy) =>
          ['trail-briar-west', 'trail-briar-east'].includes(enemy.combatantId) &&
          enemy.state !== 'dead',
      )
      .sort(
        (a, b) =>
          Math.abs(a.position.x - approach.player!.position.x) -
          Math.abs(b.position.x - approach.player!.position.x),
      )[0];
    if (nearest === undefined) break;
    await page.keyboard.press(
      nearest.position.x >= approach.player.position.x ? 'ArrowRight' : 'ArrowLeft',
      { delay: 25 },
    );
    for (let hit = 0; hit < 3; hit += 1) {
      await page.keyboard.press('KeyJ');
      await page.waitForTimeout(hit === 2 ? 400 : 110);
    }
    const after = await snapshot(page);
    const briars = after.encounter?.enemies.filter((enemy) =>
      ['trail-briar-west', 'trail-briar-east'].includes(enemy.combatantId),
    );
    observations.push(
      `${attempt}: ${briars?.map((enemy) => `${enemy.combatantId}=${enemy.health} ${enemy.state}`).join(', ')}, player=${after.worldUi?.player.currentHealth} ${after.player?.state}`,
    );
    if ((after.worldUi?.player.currentHealth ?? 0) <= 0) break;
  }

  const final = await snapshot(page);
  const enemies = final.encounter?.enemies.filter((enemy) =>
    ['trail-briar-west', 'trail-briar-east'].includes(enemy.combatantId),
  );
  expect(enemies, observations.join('\n')).toHaveLength(2);
  expect(
    enemies?.map((enemy) => enemy.state),
    observations.join('\n'),
  ).toEqual(['dead', 'dead']);
  expect(final.worldUi?.player.currentHealth, observations.join('\n')).toBeGreaterThan(0);
  expect(final.worldUi?.checkpoint.checkpointId).toBe(initialCheckpoint);
  expect(final.deathReload?.count ?? 0).toBe(initialDeathReloads);

  await breakWithChargedHeavy(page, 1900, 'split-cedar-root-knot');
  await lightMemorialLantern(page, 2240, 'absent-lantern-trail-lit');
  await enterInteractRoom(page, 2080, 'split-cedar-sanctum');
  const sanctuary = await snapshot(page);
  expect(sanctuary.world?.roomId).toBe('split-cedar-sanctum');
  expect(sanctuary.worldUi?.world.discoveredRoomIds).toContain('split-cedar-sanctum');
  expect(sanctuary.deathReload?.count ?? 0).toBe(initialDeathReloads);
});

test('semantic integration traversal crosses areas, rebinds rooms, and reloads the canonical destination', async ({
  page,
}) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await beginJourney(page);
  await acceptSilentBloom(page);

  await moveRightUntil(page, 'brackenreach', 'brackenreach-trail');
  const trail = await snapshot(page);
  expect(trail.worldUi?.checkpoint.checkpointId).toBe('brackenreach-trailhead');
  const trailHealth = trail.worldUi!.player.currentHealth;
  const trailMana = trail.worldUi!.player.currentMana;

  await moveToPrompt(page, 896, 'Open Wayfarer Cache');
  await interactFor(
    page,
    async () =>
      (await snapshot(page)).worldUi?.world.objects.chests.find(
        ({ chestId }) => chestId === 'trail-wayfarer-cache',
      )?.state === 'opened',
  );
  expect((await snapshot(page)).worldUi?.player.currency).toBe(20);
  await waitForNeutralSteps(page);
  await clearEncounter(page, ['trail-briar-west', 'trail-briar-east']);
  await breakWithChargedHeavy(page, 1900, 'split-cedar-root-knot');
  await lightMemorialLantern(page, 2240, 'absent-lantern-trail-lit');
  await expect
    .poll(
      async () =>
        (await snapshot(page)).worldUi?.quests.find(
          ({ questId }) => questId === 'lanterns-for-the-absent',
        )?.stageId,
    )
    .toBe('gathering-light');
  await enterInteractRoom(page, 2080, 'split-cedar-sanctum');
  await expect
    .poll(async () => (await snapshot(page)).worldUi?.world.discoveredRoomIds)
    .toContain('split-cedar-sanctum');
  await moveToPrompt(page, 3056, 'Open Resin Cache');
  await interactFor(
    page,
    async () =>
      (await snapshot(page)).worldUi?.world.objects.chests.find(
        ({ chestId }) => chestId === 'split-cedar-resin-cache',
      )?.state === 'opened',
  );
  expect((await snapshot(page)).worldUi?.player.currency).toBe(45);
  await moveLeftUntil(page, 'brackenreach', 'brackenreach-trail');
  await moveRightUntil(page, 'brackenreach', 'listening-arch');
  const arch = await snapshot(page);
  expect(arch.worldUi?.checkpoint.checkpointId).toBe('brackenreach-trailhead');
  expect(arch.worldUi?.player.currentHealth).toBeLessThanOrEqual(trailHealth);
  expect(arch.worldUi?.player.currentMana).toBe(trailMana);
  expect(arch.worldUi?.world.discoveredRoomIds).toEqual(
    expect.arrayContaining(['wren-rest-square', 'brackenreach-trail', 'listening-arch']),
  );

  await activateCheckpoint(page, 'listening-arch-lantern');
  await expect
    .poll(async () => (await snapshot(page)).worldUi?.player)
    .toMatchObject({
      currentHealth: trailHealth,
      currentMana: trailMana,
    });
  await moveToPrompt(page, 4448, 'Open shortcut');
  await interactFor(
    page,
    async () =>
      (await snapshot(page)).worldUi?.world.objects.shortcuts.find(
        ({ shortcutId }) => shortcutId === 'listening-arch-homeward-route',
      )?.state === 'opened',
  );
  await clearEncounter(page, ['arch-rain-briar', 'arch-rain-scribe']);
  await moveToPrompt(page, 5872, 'Open Survey Cache');
  await interactFor(
    page,
    async () =>
      (await snapshot(page)).worldUi?.world.objects.chests.find(
        ({ chestId }) => chestId === 'listening-arch-survey-cache',
      )?.state === 'opened',
  );
  expect((await snapshot(page)).worldUi?.player.currency).toBe(75);
  await moveRightUntil(page, 'singing-hollows', 'hollows-mouth');
  const hollows = await snapshot(page);
  expect(hollows.world?.checkpointId).toBe('hollows-mouth-lantern');
  expect(hollows.player?.position).toEqual({ x: 256, y: 788 });
  expect(hollows.worldUi?.world.discoveredRoomIds).toEqual(
    expect.arrayContaining(['listening-arch', 'hollows-mouth']),
  );

  await activateCheckpoint(page, 'hollows-mouth-lantern');
  await clearEncounter(page, ['hollows-rib-duskwing', 'hollows-rib-briar']);
  await moveRightUntil(page, 'singing-hollows', 'echo-pool');
  await clearEncounter(page, ['echo-pool-rootlurker', 'echo-pool-duskwing']);
  await lightMemorialLantern(page, 2144, 'absent-lantern-hollows-lit');
  await claimDiscovery(
    page,
    3296,
    'Heart Petal',
    async () => (await snapshot(page)).worldUi?.player.maxHealth === 120,
  );
  await moveRightUntil(page, 'singing-hollows', 'root-memory-chamber');
  await activateCheckpoint(page, 'root-memory-lantern');
  await moveToPrompt(page, 4176, 'Recover the root memory');
  await interactFor(
    page,
    async () =>
      (await snapshot(page)).worldUi?.quests.find(({ questId }) => questId === 'the-silent-bloom')
        ?.stageId === 'bring-root-memory-to-piri',
  );
  await enterInteractRoom(page, 4480, 'dash-trial');
  await solveDashCircuit(page);
  await enterInteractRoom(page, 4400, 'root-memory-chamber');
  await moveRightUntil(page, 'brackenreach', 'reliquary-verge');
  const verge = await snapshot(page);
  expect(verge.world).toMatchObject({
    areaId: 'brackenreach',
    roomId: 'reliquary-verge',
    checkpointId: 'reliquary-verge-lantern',
  });
  expect(verge.player?.position).toEqual({ x: 6656, y: 608 });

  await activateCheckpoint(page, 'reliquary-verge-lantern');
  await clearEncounter(page, ['verge-thorn-sentinel']);
  await expect
    .poll(async () => (await snapshot(page)).worldUi?.inventory)
    .toContainEqual(expect.objectContaining({ itemId: 'briar-core', quantity: 1 }));

  await moveLeftUntil(page, 'singing-hollows', 'root-memory-chamber');
  await moveLeftUntil(page, 'singing-hollows', 'echo-pool');
  await clearEncounter(page, ['echo-pool-rootlurker', 'echo-pool-duskwing']);
  await moveLeftUntil(page, 'singing-hollows', 'hollows-mouth');
  await clearEncounter(page, ['hollows-rib-duskwing', 'hollows-rib-briar']);
  await moveLeftUntil(page, 'brackenreach', 'listening-arch');
  await crossInteractTransition(page, 4544, 'wren-rest', 'wren-rest-square');
  await turnInRootMemory(page);
  await reforgeSurveyorEdge(page);
  expect((await snapshot(page)).worldUi?.inventory).not.toContainEqual(
    expect.objectContaining({ itemId: 'briar-core' }),
  );

  await crossInteractTransition(page, 2272, 'brackenreach', 'listening-arch');
  await activateCheckpoint(page, 'listening-arch-lantern');
  await moveRightUntil(page, 'singing-hollows', 'hollows-mouth');
  await activateCheckpoint(page, 'hollows-mouth-lantern');
  await moveRightUntil(page, 'singing-hollows', 'echo-pool');
  await moveRightUntil(page, 'singing-hollows', 'root-memory-chamber');
  await moveRightUntil(page, 'brackenreach', 'reliquary-verge');
  await moveRightUntil(page, 'rootglass-reliquary', 'rootglass-vestibule');
  await expect
    .poll(async () =>
      (await snapshot(page)).worldUi?.quests.find(({ questId }) => questId === 'the-silent-bloom'),
    )
    .toMatchObject({ stageId: 'silence-the-cantor' });

  await activateCheckpoint(page, 'rootglass-vestibule-lantern');
  await moveRightUntil(page, 'rootglass-reliquary', 'west-archive');
  await moveToPrompt(page, 3152, 'Open Index Chest');
  await interactFor(
    page,
    async () =>
      (await snapshot(page)).worldUi?.world.objects.chests.find(
        ({ chestId }) => chestId === 'west-archive-index-chest',
      )?.state === 'opened',
  );
  await expect
    .poll(async () => (await snapshot(page)).worldUi?.inventory)
    .toContainEqual(expect.objectContaining({ itemId: 'rootglass-index-key', quantity: 1 }));
  await moveLeftUntil(page, 'rootglass-reliquary', 'rootglass-vestibule');
  await usePuzzleMechanism(
    page,
    1408,
    'Index Seal',
    'vestibule-index-seal',
    'vestibule-index-lock',
    true,
  );
  expect((await snapshot(page)).worldUi?.inventory).not.toContainEqual(
    expect.objectContaining({ itemId: 'rootglass-index-key' }),
  );
  await usePuzzleMechanism(
    page,
    960,
    'Rootglass Forge',
    'reliquary-forge-awakening',
    'reliquary-forge-anvil',
    true,
  );
  await expect.poll(async () => (await snapshot(page)).worldUi?.player.weaponLevel).toBe(2);

  await enterInteractRoom(page, 1408, 'east-lens-vault');
  await usePuzzleMechanism(
    page,
    3888,
    'Threefold Lens',
    'east-lens-alignment',
    'east-lens-root-dial',
    false,
  );
  await usePuzzleMechanism(
    page,
    4272,
    'Threefold Lens',
    'east-lens-alignment',
    'east-lens-rain-dial',
    false,
  );
  await usePuzzleMechanism(
    page,
    4656,
    'Threefold Lens',
    'east-lens-alignment',
    'east-lens-bloom-dial',
    true,
  );
  await claimDiscovery(
    page,
    4864,
    'Wellspring Seed',
    async () => (await snapshot(page)).worldUi?.player.maxMana === 48,
  );
  await moveRightUntil(page, 'rootglass-reliquary', 'flooded-stacks');
  await activateCheckpoint(page, 'flooded-stacks-lantern');
  await clearEncounter(page, ['stacks-sunk-barkbound', 'stacks-sunk-scribe']);
  await breakWithChargedHeavy(page, 6100, 'flooded-stacks-silt-wall');
  await enterInteractRoom(page, 6304, 'folio-vault');
  await expect
    .poll(async () => (await snapshot(page)).worldUi?.world.discoveredRoomIds)
    .toContain('folio-vault');
  await moveToPrompt(page, 5840, "Recover Sela's Folio");
  await interactFor(
    page,
    async () =>
      (await snapshot(page)).worldUi?.world.objects.chests.find(
        ({ chestId }) => chestId === 'folio-vault-cartographer-chest',
      )?.state === 'opened',
  );
  await expect
    .poll(async () => (await snapshot(page)).worldUi?.inventory)
    .toContainEqual(expect.objectContaining({ itemId: 'cartographers-folio', quantity: 1 }));
  await moveLeftUntil(page, 'rootglass-reliquary', 'flooded-stacks');
  await lightMemorialLantern(page, 6752, 'absent-lantern-reliquary-lit');
  await expect
    .poll(
      async () =>
        (await snapshot(page)).worldUi?.quests.find(
          ({ questId }) => questId === 'lanterns-for-the-absent',
        )?.stageId,
    )
    .toBe('return-to-piri');

  await moveLeftUntil(page, 'rootglass-reliquary', 'east-lens-vault');
  await moveLeftUntil(page, 'rootglass-reliquary', 'rootglass-vestibule');
  await moveLeftUntil(page, 'brackenreach', 'reliquary-verge');
  await moveLeftUntil(page, 'singing-hollows', 'root-memory-chamber');
  await moveLeftUntil(page, 'singing-hollows', 'echo-pool');
  await clearEncounter(page, ['echo-pool-rootlurker', 'echo-pool-duskwing']);
  await moveLeftUntil(page, 'singing-hollows', 'hollows-mouth');
  await clearEncounter(page, ['hollows-rib-duskwing', 'hollows-rib-briar']);
  await moveLeftUntil(page, 'brackenreach', 'listening-arch');
  await crossInteractTransition(page, 4544, 'wren-rest', 'wren-rest-square');
  await turnInLanterns(page);
  await turnInFolio(page);
  expect((await snapshot(page)).worldUi?.inventory).not.toContainEqual(
    expect.objectContaining({ itemId: 'cartographers-folio' }),
  );

  await crossInteractTransition(page, 2272, 'brackenreach', 'listening-arch');
  await clearEncounter(page, ['arch-rain-briar', 'arch-rain-scribe']);
  await moveRightUntil(page, 'singing-hollows', 'hollows-mouth');
  await activateCheckpoint(page, 'hollows-mouth-lantern');
  await clearEncounter(page, ['hollows-rib-duskwing', 'hollows-rib-briar']);
  await moveRightUntil(page, 'singing-hollows', 'echo-pool');
  await clearEncounter(page, ['echo-pool-rootlurker', 'echo-pool-duskwing']);
  await moveRightUntil(page, 'singing-hollows', 'root-memory-chamber');
  await activateCheckpoint(page, 'root-memory-lantern');
  await moveRightUntil(page, 'brackenreach', 'reliquary-verge');
  await moveRightUntil(page, 'rootglass-reliquary', 'rootglass-vestibule');
  await enterInteractRoom(page, 1408, 'east-lens-vault');
  await moveRightUntil(page, 'rootglass-reliquary', 'flooded-stacks');
  await activateCheckpoint(page, 'flooded-stacks-lantern');
  await clearEncounter(page, ['stacks-sunk-barkbound', 'stacks-sunk-scribe']);
  await moveRightUntil(page, 'rootglass-reliquary', 'resonance-gallery');
  await activateCheckpoint(page, 'resonance-gallery-lantern');
  await clearEncounter(page, ['gallery-guard-barkbound', 'gallery-guard-rootlurker']);

  await selectAbility(page, 'resonant-pulse');
  await moveToX(page, 7488);
  await pressCombatAction(page, 'q', 'cast');
  await expect
    .poll(
      async () =>
        (await snapshot(page)).worldUi?.world.objects.puzzles.find(
          ({ puzzleId }) => puzzleId === 'gallery-choir-seal',
        )?.activatedMechanismIds,
    )
    .toContain('gallery-memory-lens');
  const firstPulseAt = (await snapshot(page)).encounter?.simulationTimeMs ?? 0;
  await moveToX(page, 7872);
  await waitForCombatTime(page, firstPulseAt + 3_600);
  await pressCombatAction(page, 'q', 'cast');
  await expect
    .poll(
      async () =>
        (await snapshot(page)).worldUi?.world.objects.puzzles.find(
          ({ puzzleId }) => puzzleId === 'gallery-choir-seal',
        )?.activatedMechanismIds,
    )
    .toEqual(expect.arrayContaining(['gallery-memory-lens', 'gallery-breath-lens']));
  await usePuzzleMechanism(
    page,
    8256,
    'Choir Seal',
    'gallery-choir-seal',
    'gallery-song-lens',
    true,
  );
  expect((await snapshot(page)).worldUi?.player.currentMana).toBe(24);
  await moveRightUntil(page, 'hollow-choir', 'hollow-choir-arena');
  await activateCheckpoint(page, 'choir-threshold-lantern');
  const threshold = await snapshot(page);
  expect(threshold.world).toMatchObject({
    areaId: 'hollow-choir',
    roomId: 'hollow-choir-arena',
    checkpointId: 'choir-threshold-lantern',
  });
  expect(threshold.worldUi?.player).toMatchObject({
    maxHealth: 120,
    maxMana: 56,
    weaponLevel: 2,
    currentMana: 56,
  });
  expect(threshold.worldUi?.inventory).toContainEqual(
    expect.objectContaining({ itemId: 'quiet-step', quantity: 1 }),
  );
  expect(threshold.worldUi?.inventory).not.toContainEqual(
    expect.objectContaining({ itemId: 'rootglass-index-key' }),
  );
  expect(threshold.worldUi?.world.discoveredRoomIds).toEqual(
    expect.arrayContaining([
      'rootglass-vestibule',
      'west-archive',
      'east-lens-vault',
      'flooded-stacks',
      'folio-vault',
      'resonance-gallery',
      'hollow-choir-arena',
      'split-cedar-sanctum',
    ]),
  );

  await page.waitForTimeout(650);
  await page.reload();
  await page.waitForFunction(
    () =>
      (
        window as Window & {
          __RIVENBLOOM_TEST__?: { read(): TraversalSnapshot };
        }
      ).__RIVENBLOOM_TEST__?.read().titleReady === true,
  );
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  await expect.poll(async () => (await snapshot(page)).world?.areaId).toBe('hollow-choir');
  const reloaded = await snapshot(page);
  expect(reloaded.world).toMatchObject({
    mode: 'load',
    roomId: 'hollow-choir-arena',
    checkpointId: 'choir-threshold-lantern',
  });
  expect(reloaded.player?.position).toEqual({ x: 256, y: 900 });
  expect(reloaded.worldUi?.player).toMatchObject({
    maxHealth: 120,
    maxMana: 56,
    weaponLevel: 2,
    currentMana: 56,
  });
  expect(reloaded.worldUi?.inventory).toContainEqual(
    expect.objectContaining({ itemId: 'quiet-step', quantity: 1 }),
  );
  expect(errors).toEqual([]);
});
