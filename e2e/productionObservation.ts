import type { Page } from '@playwright/test';
import { CONTENT_REGISTRY } from '../src/game/data/areas';
import {
  ENEMY_POSE_ROWS,
  ENEMY_ART_FRAMES,
  MARA_LOCOMOTION_FRAMES,
  TERRAIN_ART_FRAMES,
  anchoredImageTop,
} from '../src/game/data/artFrames';
import type { SaveV1 } from '../src/game/saves/SaveSchema';

type Paint = {
  kind: string;
  width: number;
  height: number;
  source: number[];
  transform: number[];
  alpha: number;
};
export type RenderedActor = {
  actor: string;
  x: number;
  y: number;
  pose: number;
  facing: 'left' | 'right';
  alpha: number;
};
export type RenderedWorld = { room: string; player: RenderedActor; enemies: RenderedActor[] };

/** Test-only observation of public Canvas drawing calls. Never imports or mutates game runtime. */
export async function observeProductionCanvas(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let paints: Paint[] = [];
    Object.defineProperty(window, '__RIVENBLOOM_RENDER_OBSERVATION__', { value: () => paints });
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.parentElement?.classList.contains('game-stage')) paints = [];
      return clear.apply(this, args);
    };
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (
      this: CanvasRenderingContext2D,
      ...args: unknown[]
    ) {
      if (this.canvas.parentElement?.classList.contains('game-stage')) {
        const image = args[0] as HTMLImageElement | HTMLCanvasElement;
        const t = this.getTransform();
        paints.push({
          kind: image instanceof HTMLCanvasElement ? 'canvas' : 'image',
          width: image.width,
          height: image.height,
          source: args.slice(1) as number[],
          transform: [t.a, t.b, t.c, t.d, t.e, t.f],
          alpha: this.globalAlpha,
        });
      }
      return draw.apply(this, args as Parameters<typeof draw>);
    } as typeof draw;
  });
}

export async function renderedWorld(page: Page): Promise<RenderedWorld | null> {
  const { label, paints } = await page.evaluate(() => ({
    label: document.querySelector('[data-hud=location]')?.textContent ?? '',
    paints: (
      window as unknown as { __RIVENBLOOM_RENDER_OBSERVATION__: () => Paint[] }
    ).__RIVENBLOOM_RENDER_OBSERVATION__(),
  }));
  const area = CONTENT_REGISTRY.areas.find((a) =>
    a.rooms.some((r) => label === `${a.displayName} · ${r.displayName}`),
  );
  const room = area?.rooms.find((r) => label === `${area.displayName} · ${r.displayName}`);
  if (!area || !room) return null;
  const floor = area.surfaces.find((s) => s.roomId === room.roomId && s.kind === 'solid')!;
  const material = TERRAIN_ART_FRAMES[CONTENT_REGISTRY.areas.indexOf(area)]!;
  const face = paints.find(
    (p) =>
      p.kind === 'image' &&
      p.width === 1536 &&
      p.height === 1024 &&
      p.source[0] === 0 &&
      p.source[1] === material.y &&
      p.source[2] === 24,
  );
  const hero = paints.find(
    (p) =>
      p.kind === 'image' &&
      p.width === 1536 &&
      p.height === 1024 &&
      ((p.source[2] === 256 && [341, 342].includes(p.source[3]!)) ||
        MARA_LOCOMOTION_FRAMES.some(
          (frame) =>
            frame.x === p.source[0] &&
            frame.y === p.source[1] &&
            frame.width === p.source[2] &&
            frame.height === p.source[3],
        )),
  );
  if (!face || !hero) return null;
  const surfaceTop = anchoredImageTop(
    floor.bounds.y,
    material.surfaceY - material.y,
    118 / material.height,
  );
  const position = (p: Paint) => ({
    x: floor.bounds.x + p.transform[4]! - face.transform[4]!,
    y: surfaceTop + p.transform[5]! - face.transform[5]!,
  });
  const enemies = paints
    .filter((p) => p.kind === 'image' && p.width === 1161 && p.height === 1354)
    .map((p) => {
      const row = ENEMY_ART_FRAMES.findIndex((frames) =>
        frames.some((frame) => frame.x === p.source[0] && frame.y === p.source[1]),
      );
      return {
        actor: ENEMY_POSE_ROWS[row]!,
        ...position(p),
        pose: ENEMY_ART_FRAMES[row]!.findIndex(
          (frame) => frame.x === p.source[0] && frame.y === p.source[1],
        ),
        facing: (p.transform[0]! < 0 ? 'left' : 'right') as 'left' | 'right',
        alpha: p.alpha,
      };
    });
  return {
    room: room.roomId,
    player: {
      actor: 'mara',
      ...position(hero),
      pose:
        hero.source[2] !== 256
          ? MARA_LOCOMOTION_FRAMES.findIndex(
              (frame) => frame.x === hero.source[0] && frame.y === hero.source[1],
            ) < 6
            ? 1
            : hero.source[0] === MARA_LOCOMOTION_FRAMES[6].x
              ? 17
              : 0
          : Math.floor(hero.source[1]! / 341) * 6 + hero.source[0]! / 256,
      facing: hero.transform[0]! < 0 ? 'left' : 'right',
      alpha: hero.alpha,
    },
    enemies,
  };
}

/** Observe the application's durable record using an IndexedDB readonly transaction. */
export async function savedJourney(page: Page): Promise<SaveV1> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('rivenbloom-saves');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const record = await new Promise<{ currentJson: string }>((resolve, reject) => {
        const request = db.transaction('slots', 'readonly').objectStore('slots').get('slot-1');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return JSON.parse(record.currentJson).payload as SaveV1;
    } finally {
      db.close();
    }
  });
}
