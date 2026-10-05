import { test, expect } from '@playwright/test';
import { CONTENT_REGISTRY } from '../src/game/data/areas';

for (const area of CONTENT_REGISTRY.areas)
  for (const room of area.rooms) {
    test(`art review: ${room.roomId} loads original art with authored collision overlay`, async ({
      page,
    }, testInfo) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Rivenbloom', exact: true })).toBeVisible();
      for (const overlay of [true, false]) {
        await page.evaluate(
          async ({ roomId, overlay }) => {
            const path = '/src/game/testing/RoomArtPreview.ts';
            const module = (await import(
              path
            )) as typeof import('../src/game/testing/RoomArtPreview');
            await module.showRoomArt(roomId, overlay);
          },
          { roomId: room.roomId, overlay },
        );
        await page.locator('#room-art-review').screenshot({
          path: testInfo.outputPath(`${room.roomId}-${overlay ? 'collision' : 'art'}.png`),
        });
      }
    });
  }
