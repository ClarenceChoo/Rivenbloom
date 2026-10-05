import { test, expect } from '@playwright/test';
import {
  PALLID_CANTOR_PHASE_ONE_ATTACKS,
  PALLID_CANTOR_PHASE_TWO_ATTACKS,
} from '../src/game/entities/bosses/pallidCantorAttacks';
for (const attackId of [...PALLID_CANTOR_PHASE_ONE_ATTACKS, ...PALLID_CANTOR_PHASE_TWO_ATTACKS]) {
  test(`rendered boss fixture: ${attackId} warning and active with motion/flash/audio disabled`, async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Rivenbloom', exact: true })).toBeVisible();
    for (const phase of ['warning', 'active'] as const) {
      await page.evaluate(
        async ({ attackId, phase }) => {
          const path = '/src/game/testing/RoomArtPreview.ts';
          const module = (await import(
            path
          )) as typeof import('../src/game/testing/RoomArtPreview');
          await module.showRoomArt('hollow-choir-arena', false, { attackId, phase });
        },
        { attackId, phase },
      );
      await page
        .locator('#room-art-review')
        .screenshot({ path: testInfo.outputPath(`${attackId}-${phase}.png`) });
    }
  });
}
