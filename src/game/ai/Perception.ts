import type { PointDefinition, RectDefinition } from '../data/types';
import type { Facing } from '../physics/MovementModel';

export type PerceptionLevel = 'unaware' | 'suspicious' | 'alert';

export type PerceptionObserver = {
  readonly position: PointDefinition;
  readonly facing: Facing;
  readonly eyeHeight: number;
  readonly sightRange: number;
  readonly sightVerticalRange: number;
  readonly rearRange: number;
  readonly hearingRange: number;
};

export type PerceptionTarget = {
  readonly position: PointDefinition;
  readonly eyeHeight: number;
  readonly noiseLevel: number;
};

export type PerceptionSample = {
  readonly level: PerceptionLevel;
  readonly distance: number;
  readonly visible: boolean;
  readonly heard: boolean;
};

const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

export const segmentIntersectsRect = (
  start: PointDefinition,
  end: PointDefinition,
  rect: RectDefinition
): boolean => {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  let entry = 0;
  let exit = 1;
  const edges: readonly (readonly [number, number])[] = [
    [-deltaX, start.x - rect.x],
    [deltaX, rect.x + rect.width - start.x],
    [-deltaY, start.y - rect.y],
    [deltaY, rect.y + rect.height - start.y]
  ];
  for (const [direction, distance] of edges) {
    if (direction === 0) {
      if (distance < 0) return false;
      continue;
    }
    const ratio = distance / direction;
    if (direction < 0) {
      if (ratio > exit) return false;
      entry = Math.max(entry, ratio);
    } else {
      if (ratio < entry) return false;
      exit = Math.min(exit, ratio);
    }
  }
  return entry <= exit;
};

export const senseTarget = (
  observer: PerceptionObserver,
  target: PerceptionTarget,
  obstacles: readonly RectDefinition[]
): PerceptionSample => {
  const eye = { x: observer.position.x, y: observer.position.y - observer.eyeHeight };
  const mark = { x: target.position.x, y: target.position.y - target.eyeHeight };
  const deltaX = mark.x - eye.x;
  const deltaY = mark.y - eye.y;
  const distance = Math.hypot(deltaX, deltaY);
  const lineOfSight = !obstacles.some((rect) => segmentIntersectsRect(eye, mark, rect));
  const facingToward = observer.facing === 'right' ? deltaX >= 0 : deltaX <= 0;
  const withinCone =
    facingToward &&
    Math.abs(deltaX) <= observer.sightRange &&
    Math.abs(deltaY) <= observer.sightVerticalRange;
  const withinRear = distance <= observer.rearRange;
  const visible = lineOfSight && (withinCone || withinRear);
  const heard = distance <= observer.hearingRange * clamp01(target.noiseLevel);
  return {
    level: visible ? 'alert' : heard ? 'suspicious' : 'unaware',
    distance,
    visible,
    heard
  };
};
