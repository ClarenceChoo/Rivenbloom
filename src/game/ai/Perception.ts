import type { Rect, Vec2 } from '../data/types';

export type PerceptionSurface = Readonly<{
  kind: 'solid' | 'one-way';
  bounds: Rect;
}>;

export type PerceptionQuery = Readonly<{
  eye: Vec2;
  targetChest: Vec2;
  horizontalRange: number;
  verticalRange: number;
  surfaces: readonly PerceptionSurface[];
}>;

export function canPerceive(query: PerceptionQuery): boolean {
  assertPoint(query.eye, 'Perception eye');
  assertPoint(query.targetChest, 'Perception target');
  assertNonNegativeFinite(query.horizontalRange, 'Horizontal perception range');
  assertNonNegativeFinite(query.verticalRange, 'Vertical perception range');

  if (Math.abs(query.targetChest.x - query.eye.x) > query.horizontalRange) return false;
  if (Math.abs(query.targetChest.y - query.eye.y) > query.verticalRange) return false;
  return hasLineOfSight(query.eye, query.targetChest, query.surfaces);
}

export function hasLineOfSight(
  start: Vec2,
  end: Vec2,
  surfaces: readonly PerceptionSurface[],
): boolean {
  assertPoint(start, 'Line-of-sight start');
  assertPoint(end, 'Line-of-sight end');

  for (const surface of surfaces) {
    assertRect(surface.bounds, 'Perception surface');
    if (surface.kind !== 'solid' && surface.kind !== 'one-way') {
      throw new RangeError('Perception surface kind is invalid.');
    }
    if (surface.kind === 'solid' && openSegmentCrossesRectInterior(start, end, surface.bounds)) {
      return false;
    }
  }
  return true;
}

export function isLedgeProbeSupported(
  start: Vec2,
  end: Vec2,
  surfaces: readonly PerceptionSurface[],
): boolean {
  assertPoint(start, 'Ledge probe start');
  assertPoint(end, 'Ledge probe end');
  const deltaY = end.y - start.y;
  if (deltaY <= 0) return false;
  return surfaces.some((surface) => {
    assertRect(surface.bounds, 'Ledge surface');
    if (surface.kind !== 'solid' && surface.kind !== 'one-way') {
      throw new RangeError('Ledge surface kind is invalid.');
    }
    const { x, y, width, height } = surface.bounds;
    const t = (y - start.y) / deltaY;
    if (t < 0 || t > 1) return false;
    const crossingX = start.x + (end.x - start.x) * t;
    return crossingX >= x && crossingX < x + width && height > 0;
  });
}

function openSegmentCrossesRectInterior(start: Vec2, end: Vec2, rect: Rect): boolean {
  const xInterval = strictAxisInterval(start.x, end.x - start.x, rect.x, rect.x + rect.width);
  if (xInterval === null) return false;
  const yInterval = strictAxisInterval(start.y, end.y - start.y, rect.y, rect.y + rect.height);
  if (yInterval === null) return false;

  const lower = Math.max(0, xInterval.lower, yInterval.lower);
  const upper = Math.min(1, xInterval.upper, yInterval.upper);
  return lower < upper && upper > 0 && lower < 1;
}

function strictAxisInterval(
  origin: number,
  delta: number,
  minimum: number,
  maximum: number,
): Readonly<{ lower: number; upper: number }> | null {
  if (delta === 0) {
    return origin > minimum && origin < maximum
      ? { lower: Number.NEGATIVE_INFINITY, upper: Number.POSITIVE_INFINITY }
      : null;
  }
  const first = (minimum - origin) / delta;
  const second = (maximum - origin) / delta;
  return { lower: Math.min(first, second), upper: Math.max(first, second) };
}

function assertPoint(point: Vec2, label: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError(`${label} must be finite.`);
  }
}

function assertRect(rect: Rect, label: string): void {
  if (
    !Number.isFinite(rect.x) ||
    !Number.isFinite(rect.y) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    !Number.isFinite(rect.x + rect.width) ||
    !Number.isFinite(rect.y + rect.height)
  ) {
    throw new RangeError(`${label} geometry must be finite and positive.`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be non-negative.`);
}
