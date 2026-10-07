import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { createSaveEnvelopeJson } from '../src/game/saves/SaveEnvelope';
import { rawSaveV1 } from '../tests/saves/saveFixtures';

type TestSnapshot = Readonly<{
  activeScene: string;
  titleReady: boolean;
  slotStates: readonly string[];
  transition: Readonly<{ mode: 'new' | 'load'; slotId: string }> | null;
}>;

type StoredSlotSeed = Readonly<{
  slotId: 'slot-1' | 'slot-2' | 'slot-3';
  currentJson: string | null;
  backupJson: string | null;
  quarantine: null;
}>;

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function waitForTitleReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (
        window as Window & {
          __RIVENBLOOM_TEST__?: { read(): TestSnapshot };
        }
      ).__RIVENBLOOM_TEST__?.read().titleReady === true,
  );
}

async function waitForTitle(page: Page): Promise<void> {
  await page.goto('/');
  await waitForTitleReady(page);
}

async function seedStoredSlots(page: Page, records: readonly StoredSlotSeed[]): Promise<void> {
  await page.evaluate(async (seedRecords) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('rivenbloom-saves', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('slots')) {
          request.result.createObjectStore('slots', { keyPath: 'slotId' });
        }
      };
      request.onerror = () => reject(request.error ?? new Error('Seed database did not open.'));
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('slots', 'readwrite');
      const store = transaction.objectStore('slots');
      for (const record of seedRecords) store.put(record);
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('Seed transaction aborted.'));
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('Seed transaction failed.'));
      transaction.oncomplete = () => resolve();
    });
    database.close();
  }, records);
}

async function installStandardGamepad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 18 }, () => 0);
    Object.defineProperty(window, '__RIVENBLOOM_E2E_GAMEPAD__', {
      configurable: true,
      value: buttons,
    });
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [
        {
          axes: [0, 0, 0, 0],
          buttons: buttons.map((value) => ({ pressed: value > 0.5, touched: false, value })),
          connected: true,
          id: 'Playwright standard gamepad',
          index: 0,
          mapping: 'standard',
          timestamp: performance.now(),
        },
      ],
    });
  });
}

async function pressGamepadButton(page: Page, button: number): Promise<void> {
  await page.evaluate((index) => {
    const buttons = (window as unknown as Window & { __RIVENBLOOM_E2E_GAMEPAD__: number[] })
      .__RIVENBLOOM_E2E_GAMEPAD__;
    buttons[index] = 1;
  }, button);
  await page.waitForTimeout(120);
  await page.evaluate((index) => {
    const buttons = (window as unknown as Window & { __RIVENBLOOM_E2E_GAMEPAD__: number[] })
      .__RIVENBLOOM_E2E_GAMEPAD__;
    buttons[index] = 0;
  }, button);
  await page.waitForTimeout(120);
}

async function focusWithGamepad(
  page: Page,
  button: number,
  target: Locator,
  maximumPresses: number,
): Promise<void> {
  for (let press = 0; press < maximumPresses; press += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await pressGamepadButton(page, button);
  }
  await expect(target).toBeFocused();
}

test('presents an accessible ready title and deterministic keyboard focus', async ({ page }) => {
  const errors = watchErrors(page);
  await waitForTitle(page);

  await expect(page.getByRole('heading', { level: 1, name: 'Rivenbloom' })).toBeVisible();
  const cards = page.getByRole('article', { name: /Journey [123]/ });
  await expect(cards).toHaveCount(3);
  await expect(page.getByText('No journey yet')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Credits' })).toBeVisible();

  const firstAction = page.getByRole('button', { name: 'Begin journey for Journey 1' });
  await expect(firstAction).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Import save for Journey 1')).toBeFocused();

  await page.getByRole('button', { name: 'Settings' }).click();
  const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
  const reducedMotion = settingsDialog.getByRole('checkbox', { name: /Reduced Motion/ });
  await reducedMotion.check();
  await expect(reducedMotion).toBeChecked();
  await expect(reducedMotion).toBeFocused();
  await expect(page.locator('.title-screen')).toHaveAttribute('data-reduced-motion', 'true');
  await settingsDialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('.title-screen')).toHaveAttribute('data-reduced-motion', 'false');
  await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused();
  expect(errors).toEqual([]);
});

test('settings opens at its first control with the heading in view', async ({ page }) => {
  await waitForTitle(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings.getByRole('checkbox', { name: /Reduced Motion/ })).toBeFocused();
  expect(await settings.evaluate((dialog) => dialog.scrollTop)).toBeLessThan(60);
});

test('keeps journey details and actions readable at the default text scale', async ({ page }) => {
  await waitForTitle(page);
  const detail = page.locator('.journey-card__detail').first();
  const action = page.getByRole('button', { name: 'Begin journey for Journey 1' });
  for (const control of [detail, action]) {
    const size = await control.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
    expect(size).toBeGreaterThanOrEqual(12);
  }
});

test('reaches the title with a persistent warning when IndexedDB is unavailable', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined });
  });
  await waitForTitle(page);

  await expect(
    page.getByText('Persistent save storage failed; this session is using memory storage.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Begin journey for Journey 1' })).toBeFocused();
  expect(errors).toEqual([]);
});

test('starts a new journey through visible keyboard actions', async ({ page }) => {
  const errors = watchErrors(page);
  await waitForTitle(page);

  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Begin a new journey in Journey 1?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { level: 1, name: "Wren's Rest" })).toBeVisible();
  await expect(page.getByText('The listening chimes have fallen silent.')).toBeVisible();
  const transition = await page.evaluate(
    () =>
      (
        window as Window & {
          __RIVENBLOOM_TEST__: { read(): TestSnapshot };
        }
      ).__RIVENBLOOM_TEST__.read().transition,
  );
  expect(transition).toEqual({ mode: 'new', slotId: 'slot-1' });
  expect(errors).toEqual([]);
});

test('operates settings and the transition return with a standard gamepad', async ({ page }) => {
  const errors = watchErrors(page);
  await installStandardGamepad(page);
  await waitForTitle(page);

  const settingsButton = page.getByRole('button', { name: 'Settings' });
  await focusWithGamepad(page, 13, settingsButton, 8);
  await expect(settingsButton).toBeFocused();
  await pressGamepadButton(page, 0);

  const settings = page.getByRole('dialog', { name: 'Settings' });
  const reducedMotion = settings.getByRole('checkbox', { name: /Reduced Motion/ });
  await expect(reducedMotion).toBeFocused();
  await pressGamepadButton(page, 0);
  await expect(reducedMotion).toBeChecked();

  const textScale = settings.getByRole('combobox', { name: /Text Scale/ });
  await focusWithGamepad(page, 13, textScale, 1);
  await expect(textScale).toBeFocused();
  await pressGamepadButton(page, 15);
  await expect(textScale).toHaveValue('1.15');

  const highContrast = settings.getByRole('checkbox', { name: /High-Contrast Prompts/ });
  await focusWithGamepad(page, 13, highContrast, 1);
  await expect(highContrast).toBeFocused();
  await pressGamepadButton(page, 0);
  await expect(highContrast).toBeChecked();
  await pressGamepadButton(page, 1);
  await expect(settingsButton).toBeFocused();

  await page.getByRole('button', { name: 'Begin journey for Journey 1' }).click();
  await focusWithGamepad(
    page,
    13,
    page
      .getByRole('dialog', { name: 'Begin a new journey in Journey 1?' })
      .getByRole('button', { name: 'Begin journey' }),
    2,
  );
  await pressGamepadButton(page, 0);
  await expect(page.getByRole('heading', { level: 1, name: "Wren's Rest" })).toBeVisible();
  await pressGamepadButton(page, 1);
  await expect(page.getByRole('heading', { level: 1, name: 'Rivenbloom' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('opens and completes the native file-picker path from gamepad polling', async ({ page }) => {
  const envelope = await createSaveEnvelopeJson(rawSaveV1(), 1_700_000_030_000);
  await installStandardGamepad(page);
  await waitForTitle(page);
  const importInput = page.getByLabel('Import save for Journey 1');
  await focusWithGamepad(page, 13, importInput, 2);
  await expect(importInput).toBeFocused();

  const fileChooser = page.waitForEvent('filechooser', { timeout: 1_500 });
  await pressGamepadButton(page, 0);
  const chooser = await fileChooser;
  await chooser.setFiles({
    name: 'rivenbloom-journey-1.json',
    mimeType: 'application/json',
    buffer: Buffer.from(envelope),
  });
  const preview = page.getByRole('dialog', { name: 'Import into Journey 1?' });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await pressGamepadButton(page, 1);
  await expect(page.getByLabel('Import save for Journey 1')).toBeFocused();
});

test('keeps a read-error retry actionable across dialog lifecycle', async ({ page }) => {
  const envelope = await createSaveEnvelopeJson(rawSaveV1(), 1_700_000_030_000);
  await waitForTitle(page);
  await page.getByLabel('Import save for Journey 1').setInputFiles({
    name: 'rivenbloom-journey-1.json',
    mimeType: 'application/json',
    buffer: Buffer.from(envelope),
  });
  await page
    .getByRole('dialog', { name: 'Import into Journey 1?' })
    .getByRole('button', { name: 'Import save' })
    .click();
  await expect(page.getByRole('button', { name: 'Continue Journey 1' })).toBeVisible();

  await page.evaluate(() => {
    IDBObjectStore.prototype.get = () => {
      throw new DOMException('Injected read failure', 'InvalidStateError');
    };
    Object.defineProperty(crypto.subtle, 'digest', {
      configurable: true,
      value: () => Promise.reject(new Error('Injected fallback seed failure')),
    });
  });
  await page.getByRole('button', { name: 'Continue Journey 1' }).click();
  await page.getByRole('button', { name: 'Return to title' }).click();
  const retry = page.getByRole('button', { name: 'Retry journeys' });
  await expect(retry).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  const appliedSettings = page.getByRole('dialog', { name: 'Settings' });
  await appliedSettings.getByRole('checkbox', { name: /Reduced Motion/ }).check();
  await appliedSettings.getByRole('button', { name: 'Apply settings' }).click();
  await expect(appliedSettings).not.toBeVisible();
  await expect(retry).toBeVisible();

  await page.getByRole('button', { name: 'Credits' }).click();
  await page
    .getByRole('dialog', { name: 'Credits' })
    .getByRole('button', { name: 'Cancel' })
    .click();
  await expect(retry).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page
    .getByRole('dialog', { name: 'Settings' })
    .getByRole('button', { name: 'Cancel' })
    .click();
  await expect(retry).toBeVisible();
  await expect(retry).toBeEnabled();
  await retry.focus();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(retry).toBeFocused();
  await retry.click();
  await expect(page.getByRole('button', { name: 'Retry journeys' })).toBeVisible();
});

test('keeps Settings inert until a selected save finishes loading', async ({ page }) => {
  const envelope = await createSaveEnvelopeJson(rawSaveV1(), 1_700_000_030_000);
  await waitForTitle(page);
  await seedStoredSlots(page, [
    {
      slotId: 'slot-1',
      currentJson: envelope,
      backupJson: null,
      quarantine: null,
    },
  ]);
  await page.addInitScript(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let release!: () => void;
    const loadingGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    Object.defineProperty(window, '__RIVENBLOOM_RELEASE_SAVE_READ__', { value: release });
    Object.defineProperty(crypto.subtle, 'digest', {
      configurable: true,
      value: async (...args: Parameters<SubtleCrypto['digest']>) => {
        await loadingGate;
        return digest(...args);
      },
    });
  });
  await page.reload();

  const settingsButton = page.getByRole('button', { name: 'Settings' });
  await expect(settingsButton).toBeVisible();
  await expect(settingsButton).toBeDisabled();
  await page.evaluate(() => {
    (
      window as unknown as Window & { __RIVENBLOOM_RELEASE_SAVE_READ__: () => void }
    ).__RIVENBLOOM_RELEASE_SAVE_READ__();
  });
  await waitForTitleReady(page);
  await expect(settingsButton).toBeEnabled();
  await settingsButton.click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
});

test('shows a failed save operation inside its active dialog', async ({ page }) => {
  const errors = watchErrors(page);
  const envelope = await createSaveEnvelopeJson(rawSaveV1(), 1_700_000_030_000);
  await waitForTitle(page);

  await page.getByLabel('Import save for Journey 1').setInputFiles({
    name: 'rivenbloom-journey-1.json',
    mimeType: 'application/json',
    buffer: Buffer.from(envelope),
  });
  const importDialog = page.getByRole('dialog', { name: 'Import into Journey 1?' });
  await importDialog.getByRole('button', { name: 'Import save' }).click();
  await page.getByRole('button', { name: 'Manage' }).click();
  await page
    .getByRole('dialog', { name: 'Manage Journey 1' })
    .getByRole('button', {
      name: 'Delete Journey 1',
    })
    .click();

  await page.evaluate(() => {
    IDBObjectStore.prototype.delete = () => {
      throw new DOMException('Injected write failure', 'InvalidStateError');
    };
    Object.defineProperty(crypto.subtle, 'digest', {
      configurable: true,
      value: () => Promise.reject(new Error('Injected fallback failure')),
    });
  });
  const deleteDialog = page.getByRole('dialog', { name: 'Delete Journey 1?' });
  await deleteDialog.getByRole('button', { name: 'Delete journey' }).click();
  await expect(
    deleteDialog.getByRole('alert').filter({
      hasText: 'That save operation did not finish. Your existing journey is unchanged.',
    }),
  ).toBeVisible();
  await expect(page.locator('.title-notice--error')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('reflows populated journeys at saved 200% text scale inside the stage', async ({ page }) => {
  const errors = watchErrors(page);
  const base = rawSaveV1();
  const readyEnvelope = await createSaveEnvelopeJson(
    { ...base, settings: { ...base.settings, textScale: 1 } },
    1_700_000_030_000,
  );
  const recoveredEnvelope = await createSaveEnvelopeJson(
    {
      ...rawSaveV1(),
      metadata: { ...rawSaveV1().metadata, snapshotAtEpochMs: 1_700_000_060_000 },
    },
    1_700_000_060_000,
  );
  await waitForTitle(page);
  await seedStoredSlots(page, [
    {
      slotId: 'slot-1',
      currentJson: readyEnvelope,
      backupJson: null,
      quarantine: null,
    },
    {
      slotId: 'slot-2',
      currentJson: '{broken-current',
      backupJson: recoveredEnvelope,
      quarantine: null,
    },
    {
      slotId: 'slot-3',
      currentJson: '{broken-current',
      backupJson: null,
      quarantine: null,
    },
  ]);
  await page.reload();
  await waitForTitleReady(page);
  await expect(page.getByText('Recovered journey')).toBeVisible();
  await expect(page.getByText('Save needs attention')).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('combobox', { name: /Text Scale/ }).selectOption('2');
  await settings.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.locator('.title-screen')).toHaveCSS('--user-text-scale', '2');
  await expect(settings).not.toBeVisible();

  await page.reload();
  await waitForTitleReady(page);
  const title = page.locator('.title-screen');
  await expect(title).toHaveCSS('--user-text-scale', '2');
  await expect(page.getByText('Recovered journey')).toBeVisible();

  const stageBox = await page.locator('.game-stage').boundingBox();
  expect(stageBox).not.toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  const layout = page.locator('.title-layout');
  const rail = page.locator('.title-rail');
  const panel = page.locator('.journeys-panel');
  const heading = page.getByRole('heading', { level: 1, name: 'Rivenbloom' });
  const tagline = page.getByText('Follow the silent chimes home.');
  const railNote = page.getByText(
    'Three paths wait beneath the rain. Choose the thread that still remembers you.',
  );
  const footer = page.locator('.title-footer');

  for (const region of [layout, rail, panel]) {
    const box = await region.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(stageBox!.x);
    expect(box!.y).toBeGreaterThanOrEqual(stageBox!.y);
    expect(box!.x + box!.width).toBeLessThanOrEqual(stageBox!.x + stageBox!.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(stageBox!.y + stageBox!.height);
  }

  const railBox = await rail.boundingBox();
  const panelBox = await panel.boundingBox();
  expect(railBox!.x + railBox!.width).toBeLessThanOrEqual(panelBox!.x);
  for (const textRegion of [heading, tagline, railNote]) {
    await textRegion.scrollIntoViewIfNeeded();
    const box = await textRegion.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(railBox!.x);
    expect(box!.x + box!.width).toBeLessThanOrEqual(railBox!.x + railBox!.width);
    expect(box!.y).toBeGreaterThanOrEqual(stageBox!.y);
    expect(box!.y + box!.height).toBeLessThanOrEqual(stageBox!.y + stageBox!.height);
    expect(
      await textRegion.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBe(true);
  }
  const headingBox = await heading.boundingBox();
  const taglineBox = await tagline.boundingBox();
  expect(headingBox!.y + headingBox!.height).toBeLessThanOrEqual(taglineBox!.y);
  expect(await rail.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  );

  const panelOverflow = await panel.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      overflowY: style.overflowY,
      scrollable: element.scrollHeight > element.clientHeight,
      horizontallyContained: element.scrollWidth <= element.clientWidth + 1,
    };
  });
  expect(panelOverflow).toEqual({
    overflowY: 'auto',
    scrollable: true,
    horizontallyContained: true,
  });

  const cards = page.getByRole('article', { name: /Journey [123]/ });
  await expect(cards).toHaveCount(3);
  const cardFlow = await cards.evaluateAll((elements) =>
    elements.map((element) => ({
      top: (element as HTMLElement).offsetTop,
      bottom: (element as HTMLElement).offsetTop + (element as HTMLElement).offsetHeight,
    })),
  );
  expect(cardFlow[1]!.top).toBeGreaterThanOrEqual(cardFlow[0]!.bottom);
  expect(cardFlow[2]!.top).toBeGreaterThanOrEqual(cardFlow[1]!.bottom);

  await expect(page.getByRole('button', { name: 'Continue Journey 1' })).toBeFocused();
  for (let press = 0; press < 7; press += 1) await page.keyboard.press('Tab');
  const settingsButton = page.getByRole('button', { name: 'Settings' });
  await expect(settingsButton).toBeFocused();
  const footerBox = await footer.boundingBox();
  expect(footerBox).not.toBeNull();
  expect(footerBox!.x).toBeGreaterThanOrEqual(stageBox!.x);
  expect(footerBox!.y).toBeGreaterThanOrEqual(stageBox!.y);
  expect(footerBox!.x + footerBox!.width).toBeLessThanOrEqual(stageBox!.x + stageBox!.width);
  expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(stageBox!.y + stageBox!.height);
  expect(await footer.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  );

  for (let index = 0; index < 3; index += 1) {
    const card = cards.nth(index);
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeVisible();
    const cardBox = await card.boundingBox();
    const bodyBox = await card.locator('.journey-card__body').boundingBox();
    const actionsBox = await card.locator('.journey-card__actions').boundingBox();
    expect(cardBox).not.toBeNull();
    expect(bodyBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();
    expect(cardBox!.x).toBeGreaterThanOrEqual(stageBox!.x);
    expect(cardBox!.y).toBeGreaterThanOrEqual(stageBox!.y);
    expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(stageBox!.x + stageBox!.width);
    expect(cardBox!.y + cardBox!.height).toBeLessThanOrEqual(stageBox!.y + stageBox!.height);
    expect(bodyBox!.y).toBeGreaterThanOrEqual(cardBox!.y);
    expect(bodyBox!.y + bodyBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height);
    expect(actionsBox!.y).toBeGreaterThanOrEqual(cardBox!.y);
    expect(actionsBox!.y + actionsBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height);
    expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
      true,
    );
    expect(
      await card
        .locator('.journey-card__actions')
        .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBe(true);
    const regionsOverlap = !(
      bodyBox!.x + bodyBox!.width <= actionsBox!.x ||
      actionsBox!.x + actionsBox!.width <= bodyBox!.x ||
      bodyBox!.y + bodyBox!.height <= actionsBox!.y ||
      actionsBox!.y + actionsBox!.height <= bodyBox!.y
    );
    expect(regionsOverlap).toBe(false);
  }

  const controls = page.locator(
    '.journey-card button:not(:disabled), .journey-card input[type="file"], .title-footer button',
  );
  await expect(controls).toHaveCount(9);
  for (let index = 0; index < (await controls.count()); index += 1) {
    const control = controls.nth(index);
    await control.scrollIntoViewIfNeeded();
    await control.focus();
    await expect(control).toBeFocused();
    const controlBox = await control.boundingBox();
    expect(controlBox).not.toBeNull();
    expect(controlBox!.x).toBeGreaterThanOrEqual(stageBox!.x);
    expect(controlBox!.y).toBeGreaterThanOrEqual(stageBox!.y);
    expect(controlBox!.x + controlBox!.width).toBeLessThanOrEqual(stageBox!.x + stageBox!.width);
    expect(controlBox!.y + controlBox!.height).toBeLessThanOrEqual(stageBox!.y + stageBox!.height);
  }

  expect(errors).toEqual([]);
});

test.describe('responsive reduced-motion title', () => {
  test.use({
    viewport: { width: 1024, height: 720 },
    contextOptions: { reducedMotion: 'reduce' },
  });

  test('fits at 1024px and removes decorative motion while retaining focus contrast', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await waitForTitle(page);

    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
      true,
    );

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const actions = page.locator(
      '.journey-card button, .journey-card input[type="file"], .title-footer button',
    );
    await expect(actions).toHaveCount(8);
    for (let index = 0; index < (await actions.count()); index += 1) {
      await expect(actions.nth(index)).toBeVisible();
    }

    const stageBox = await page.locator('.game-stage').boundingBox();
    expect(stageBox).not.toBeNull();
    for (let index = 0; index < (await actions.count()); index += 1) {
      const controlBox = await actions.nth(index).boundingBox();
      expect(controlBox).not.toBeNull();
      expect(controlBox!.x).toBeGreaterThanOrEqual(stageBox!.x);
      expect(controlBox!.y).toBeGreaterThanOrEqual(stageBox!.y);
      expect(controlBox!.x + controlBox!.width).toBeLessThanOrEqual(stageBox!.x + stageBox!.width);
      expect(controlBox!.y + controlBox!.height).toBeLessThanOrEqual(
        stageBox!.y + stageBox!.height,
      );
    }

    const focused = page.getByRole('button', { name: 'Begin journey for Journey 1' });
    const focusStyle = await focused.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    expect(focusStyle.outlineStyle).not.toBe('none');
    expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(2);

    await page.getByRole('button', { name: 'Settings' }).click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    const highContrast = settings.getByRole('checkbox', { name: /High-Contrast Prompts/ });
    await highContrast.check();
    await expect(page.locator('.title-screen')).toHaveAttribute(
      'data-high-contrast-prompts',
      'true',
    );
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(highContrast).toBeFocused();
    const highContrastFocus = await highContrast.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        outlineColor: style.outlineColor,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });
    expect(highContrastFocus.outlineColor).toBe('rgb(240, 227, 192)');
    expect(highContrastFocus.outlineStyle).toBe('solid');
    expect(Number.parseFloat(highContrastFocus.outlineWidth)).toBeGreaterThanOrEqual(3);

    await settings.getByRole('combobox', { name: /Text Scale/ }).selectOption('2');
    await expect(page.locator('.title-screen')).toHaveCSS('--user-text-scale', '2');
    const dialogBox = await settings.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.x).toBeGreaterThanOrEqual(stageBox!.x);
    expect(dialogBox!.y).toBeGreaterThanOrEqual(stageBox!.y);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(stageBox!.x + stageBox!.width);
    expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(stageBox!.y + stageBox!.height);

    const decorativeMotion = await page.locator('.scene-overlay__rain').evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        animationDuration: style.animationDuration,
        transitionDuration: style.transitionDuration,
      };
    });
    expect(decorativeMotion).toEqual({ animationDuration: '0s', transitionDuration: '0s' });
    await expect(page.locator('.scene-overlay__roots')).toHaveCSS('transform', 'none');
    await expect(page.locator('.journey-card').first()).toHaveCSS('transform', 'none');
    expect(errors).toEqual([]);
  });
});
