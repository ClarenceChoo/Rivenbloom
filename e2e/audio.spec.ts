import { expect, test } from '@playwright/test';

type AudioProbe = {
  tracks: HTMLAudioElement[];
  gains: Map<AudioContext, GainNode[]>;
  contexts: AudioContext[];
  musicContext: AudioContext | null;
};

test('gesture starts decoded music, pause retains one track, settings mute and restore it', async ({
  page,
}) => {
  test.setTimeout(30_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const probe: AudioProbe = { tracks: [], gains: new Map(), contexts: [], musicContext: null };
    Object.assign(window, { __audioProbe: probe });
    const NativeAudio = window.Audio;
    window.Audio = class extends NativeAudio {
      constructor(src?: string) {
        super(src);
        probe.tracks.push(this);
      }
    };
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        probe.contexts.push(this);
        probe.gains.set(this, []);
      }
      override createMediaElementSource(element: HTMLMediaElement) {
        probe.musicContext = this;
        return super.createMediaElementSource(element);
      }
      override createGain() {
        const gain = super.createGain();
        probe.gains.get(this)!.push(gain);
        return gain;
      }
    };
  });
  const read = () =>
    page.evaluate(() => {
      const probe = (window as unknown as { __audioProbe: AudioProbe }).__audioProbe;
      return {
        tracks: probe.tracks
          .filter((track) => !track.paused)
          .map((track) => ({ src: track.src, time: track.currentTime, ready: track.readyState })),
        master: probe.musicContext
          ? probe.gains.get(probe.musicContext)?.[0]?.gain.value
          : undefined,
        contexts: probe.contexts.length,
      };
    });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Rivenbloom', exact: true })).toBeVisible();
  const initialContexts = (await read()).contexts;
  expect((await read()).tracks).toHaveLength(0);
  await page.getByRole('button', { name: 'Begin journey for Journey 1' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Begin journey', exact: true })
    .click();
  await page.getByRole('button', { name: "Enter Wren's Rest" }).click();
  await expect(page.getByLabel('Gameplay status')).toBeVisible();
  await expect
    .poll(async () => (await read()).tracks)
    .toEqual([
      {
        src: expect.stringContaining('02-lanterns-above-the-rain.mp3'),
        time: expect.any(Number),
        ready: 4,
      },
    ]);
  await expect.poll(async () => (await read()).tracks[0]?.time ?? 0).toBeGreaterThan(0.2);
  await page.keyboard.press('Escape');
  const menu = page.getByRole('dialog', { name: 'Wayfinder Ledger' });
  await menu.getByRole('button', { name: 'Settings', exact: true }).click();
  for (const volume of ['0', '0.6']) {
    const slider = menu.getByLabel('Master volume', { exact: true });
    await slider.focus();
    await page.keyboard.press('Home');
    if (volume !== '0')
      for (let step = 0; step < 12; step++) await page.keyboard.press('ArrowRight');
    await menu.getByRole('button', { name: 'Apply settings' }).click();
    await expect.poll(async () => (await read()).master).toBeCloseTo(Number(volume));
  }
  await menu.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(menu).toBeHidden();
  expect((await read()).tracks).toHaveLength(1);
  expect((await read()).contexts).toBe(initialContexts + 1);
  expect(errors).toEqual([]);
});
