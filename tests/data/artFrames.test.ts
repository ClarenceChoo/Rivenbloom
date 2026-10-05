import { describe, expect, it } from 'vitest';
import { anchoredImageTop, surfaceFrame, maraGroundAnchor } from '../../src/game/data/artFrames';

describe('authored artwork anchors', () => {
  it('places the visible surface at collision height across scales', () => {
    expect(anchoredImageTop(540, 64, 0.5)).toBe(508);
    for (const height of [96, 118, 400]) {
      for (let frame = 0; frame < 5; frame += 1) {
        const anchor = surfaceFrame(frame).surfaceY;
        expect(anchoredImageTop(540, anchor, height / 256) + (anchor * height) / 256).toBe(540);
      }
    }
  });
  it('uses pose-specific ground anchors inside the source frame', () => {
    for (let frame = 0; frame < 18; frame += 1) {
      expect(maraGroundAnchor(frame)).toBeGreaterThan(0);
      expect(maraGroundAnchor(frame)).toBeLessThanOrEqual(1);
    }
  });
});
