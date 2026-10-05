import { describe, expect, test } from 'vitest';

import { canPerceive, hasLineOfSight, isLedgeProbeSupported } from '../../src/game/ai/Perception';
import type { Rect, SurfaceDefinition, Vec2 } from '../../src/game/data/types';
import { stableId } from '../../src/game/core/StableId';

const roomId = stableId<'room'>('test-room');
const materialId = stableId<'material'>('test-stone');

function surface(kind: SurfaceDefinition['kind'], bounds: Rect): SurfaceDefinition {
  return {
    surfaceId: stableId<'surface'>(`test-${kind}-${bounds.x}-${bounds.y}`.replaceAll('.', '-')),
    kind,
    roomId,
    bounds,
    materialId,
  };
}

describe('perception rules', () => {
  test('includes exact horizontal and vertical awareness boundaries', () => {
    expect(
      canPerceive({
        eye: { x: 10, y: 20 },
        targetChest: { x: 110, y: 70 },
        horizontalRange: 100,
        verticalRange: 50,
        surfaces: [],
      }),
    ).toBe(true);
    expect(
      canPerceive({
        eye: { x: 10, y: 20 },
        targetChest: { x: -90, y: -30 },
        horizontalRange: 100,
        verticalRange: 50,
        surfaces: [],
      }),
    ).toBe(true);
  });

  test('does not apply a hidden facing cone', () => {
    expect(
      canPerceive({
        eye: { x: 100, y: 100 },
        targetChest: { x: 40, y: 100 },
        horizontalRange: 60,
        verticalRange: 0,
        surfaces: [],
      }),
    ).toBe(true);
  });

  test('solid interiors occlude while one-way floors remain transparent', () => {
    const wall = surface('solid', { x: 40, y: 20, width: 20, height: 100 });
    const oneWay = surface('one-way', { x: 40, y: 20, width: 20, height: 100 });

    expect(hasLineOfSight({ x: 0, y: 50 }, { x: 100, y: 50 }, [wall])).toBe(false);
    expect(hasLineOfSight({ x: 0, y: 50 }, { x: 100, y: 50 }, [oneWay])).toBe(true);
  });

  test('tangential boundary contact alone stays clear for either segment direction', () => {
    const wall = surface('solid', { x: 40, y: 40, width: 20, height: 20 });
    const left: Vec2 = { x: 0, y: 40 };
    const right: Vec2 = { x: 100, y: 40 };

    expect(hasLineOfSight(left, right, [wall])).toBe(true);
    expect(hasLineOfSight(right, left, [wall])).toBe(true);
  });

  test('reversed segments crossing a solid interior are both occluded', () => {
    const wall = surface('solid', { x: 40, y: 40, width: 20, height: 20 });
    expect(hasLineOfSight({ x: 0, y: 50 }, { x: 100, y: 50 }, [wall])).toBe(false);
    expect(hasLineOfSight({ x: 100, y: 50 }, { x: 0, y: 50 }, [wall])).toBe(false);
  });

  test.each(['solid', 'one-way'] as const)(
    'a 48px downward ledge probe crosses a thin 16px %s top',
    (kind) => {
      const floor = surface(kind, { x: 40, y: 80, width: 20, height: 16 });
      expect(isLedgeProbeSupported({ x: 40, y: 64 }, { x: 40, y: 112 }, [floor])).toBe(true);
      expect(isLedgeProbeSupported({ x: 59.999, y: 64 }, { x: 59.999, y: 112 }, [floor])).toBe(
        true,
      );
      expect(isLedgeProbeSupported({ x: 60, y: 64 }, { x: 60, y: 112 }, [floor])).toBe(false);
      expect(isLedgeProbeSupported({ x: 40, y: 32 }, { x: 40, y: 79 }, [floor])).toBe(false);
    },
  );

  test('rejects upward and non-finite ledge segments', () => {
    const floor = surface('solid', { x: 40, y: 80, width: 20, height: 16 });
    expect(isLedgeProbeSupported({ x: 40, y: 112 }, { x: 40, y: 64 }, [floor])).toBe(false);
    expect(() =>
      isLedgeProbeSupported({ x: 40, y: 64 }, { x: Number.NaN, y: 112 }, [floor]),
    ).toThrow(RangeError);
  });

  test.each([
    [
      { x: Number.NaN, y: 0 },
      { x: 1, y: 1 },
    ],
    [
      { x: 0, y: 0 },
      { x: Number.POSITIVE_INFINITY, y: 1 },
    ],
  ])('rejects non-finite segment input %#', (start, end) => {
    expect(() => hasLineOfSight(start, end, [])).toThrow(RangeError);
  });

  test('rejects non-finite ranges and malformed surface geometry', () => {
    expect(() =>
      canPerceive({
        eye: { x: 0, y: 0 },
        targetChest: { x: 1, y: 1 },
        horizontalRange: Number.NaN,
        verticalRange: 10,
        surfaces: [],
      }),
    ).toThrow(RangeError);
    expect(() =>
      hasLineOfSight({ x: 0, y: 0 }, { x: 1, y: 1 }, [
        surface('solid', { x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 2 }),
      ]),
    ).toThrow(RangeError);
  });
});
