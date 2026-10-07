import { describe, expect, it } from 'vitest';
import {
  anchoredImageTop,
  surfaceFrame,
  maraGroundAnchor,
  coverArtScale,
  terrainSpan,
  TERRAIN_ART_FRAMES,
} from '../../src/game/data/artFrames';

describe('authored artwork anchors', () => {
  it('fills the stage with one uniform background scale, preserving architecture proportions', () => {
    const scale = coverArtScale(971, 324, 1280, 720);
    expect(scale).toBe(720 / 324);
    expect(971 * scale).toBeGreaterThanOrEqual(1280);
    expect(324 * scale).toBe(720);
    expect(coverArtScale(1920, 1080, 1280, 720)).toBeCloseTo(2 / 3);
  });
  it('terrain end caps and repeatable middle cover short and long collision spans exactly', () => {
    for (const width of [8, 48, 220, 1280, 4000]) {
      const span = terrainSpan(width, 0.75);
      expect(span.capWidth * 2 + span.middleWidth).toBe(width);
      expect(span.middleWidth).toBeGreaterThanOrEqual(0);
      expect(span.capWidth).toBeLessThanOrEqual(width / 2);
    }
  });
  it('places the visible surface at collision height across scales', () => {
    expect(anchoredImageTop(540, 64, 0.5)).toBe(508);
    for (const height of [96, 118, 400]) {
      for (let frame = 0; frame < 5; frame += 1) {
        const anchor = surfaceFrame(frame).surfaceY;
        expect(anchoredImageTop(540, anchor, height / 256) + (anchor * height) / 256).toBe(540);
      }
    }
    for (const frame of TERRAIN_ART_FRAMES) {
      for (const height of [80, 118]) {
        const scale = height / frame.height;
        const anchor = frame.surfaceY - frame.y;
        expect(anchoredImageTop(600, anchor, scale) + anchor * scale).toBe(600);
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
