import type { CollisionBodyDefinition, RectDefinition, SurfaceDefinition } from '../data/types';
import type { MovementContacts, Vector2 } from './MovementModel';

export type PlatformQueryOptions = {
  readonly ignoreOneWay: boolean;
};

export type MotionResolution = {
  readonly position: Vector2;
  readonly velocity: Vector2;
};

const CONTACT_EPSILON = 0.5;
const TIME_EPSILON = 1e-9;
const MAX_SWEEP_COLLISIONS = 2;

const overlaps = (startA: number, endA: number, startB: number, endB: number): boolean =>
  startA < endB && endA > startB;

type AxisSweep = {
  readonly entry: number;
  readonly exit: number;
};

type SweepHit = {
  readonly time: number;
  readonly blocksX: boolean;
  readonly blocksY: boolean;
};

const axisSweep = (
  movingStart: number,
  movingEnd: number,
  delta: number,
  obstacleStart: number,
  obstacleEnd: number
): AxisSweep | undefined => {
  if (delta > 0) {
    return {
      entry: (obstacleStart - movingEnd) / delta,
      exit: (obstacleEnd - movingStart) / delta
    };
  }
  if (delta < 0) {
    return {
      entry: (obstacleEnd - movingStart) / delta,
      exit: (obstacleStart - movingEnd) / delta
    };
  }
  if (movingEnd <= obstacleStart || movingStart >= obstacleEnd) return undefined;
  return { entry: Number.NEGATIVE_INFINITY, exit: Number.POSITIVE_INFINITY };
};

const sweepSolid = (
  position: Vector2,
  delta: Vector2,
  body: CollisionBodyDefinition,
  obstacle: RectDefinition
): SweepHit | undefined => {
  const left = position.x + body.offset.x;
  const right = left + body.size.width;
  const top = position.y + body.offset.y;
  const bottom = top + body.size.height;
  const xSweep = axisSweep(left, right, delta.x, obstacle.x, obstacle.x + obstacle.width);
  const ySweep = axisSweep(top, bottom, delta.y, obstacle.y, obstacle.y + obstacle.height);
  if (xSweep === undefined || ySweep === undefined) return undefined;
  const entry = Math.max(xSweep.entry, ySweep.entry);
  const exit = Math.min(xSweep.exit, ySweep.exit);
  if (
    entry >= exit - TIME_EPSILON ||
    exit < -TIME_EPSILON ||
    entry < -TIME_EPSILON ||
    entry > 1 + TIME_EPSILON
  ) {
    return undefined;
  }
  const simultaneousAxes = Math.abs(xSweep.entry - ySweep.entry) <= TIME_EPSILON;
  return {
    time: Math.max(0, Math.min(1, entry)),
    blocksX: simultaneousAxes || xSweep.entry > ySweep.entry,
    blocksY: simultaneousAxes || ySweep.entry > xSweep.entry
  };
};

const sweepOneWay = (
  position: Vector2,
  delta: Vector2,
  body: CollisionBodyDefinition,
  obstacle: RectDefinition
): SweepHit | undefined => {
  if (delta.y <= 0) return undefined;
  const left = position.x + body.offset.x;
  const right = left + body.size.width;
  const bottom = position.y + body.offset.y + body.size.height;
  if (bottom > obstacle.y + CONTACT_EPSILON) return undefined;
  const rawTime = (obstacle.y - bottom) / delta.y;
  if (rawTime < -TIME_EPSILON || rawTime > 1 + TIME_EPSILON) return undefined;
  const time = Math.max(0, Math.min(1, rawTime));
  const leftAtImpact = left + delta.x * time;
  const rightAtImpact = right + delta.x * time;
  if (!overlaps(leftAtImpact, rightAtImpact, obstacle.x, obstacle.x + obstacle.width)) {
    return undefined;
  }
  return { time, blocksX: false, blocksY: true };
};

export class PlatformRules {
  public constructor(
    private readonly surfaces: readonly SurfaceDefinition[],
    private readonly bounds: RectDefinition,
    private readonly body: CollisionBodyDefinition
  ) {}

  public query(position: Vector2, options: PlatformQueryOptions): MovementContacts {
    const left = position.x + this.body.offset.x;
    const right = left + this.body.size.width;
    const top = position.y + this.body.offset.y;
    const bottom = top + this.body.size.height;
    const climbable = this.surfaces.some((surface) => {
      if (surface.kind !== 'climb') return false;
      const collision = surface.collision;
      return (
        overlaps(left, right, collision.x, collision.x + collision.width) &&
        overlaps(top, bottom, collision.y, collision.y + collision.height)
      );
    });
    const support = this.surfaces.find((surface) => {
      // Water is wadeable until a swim system lands: it supports from above
      // like a one-way platform but cannot be dropped through.
      if (surface.kind !== 'solid' && surface.kind !== 'one-way' && surface.kind !== 'water') {
        return false;
      }
      if (surface.kind === 'one-way' && options.ignoreOneWay) return false;
      const collision = surface.collision;
      return (
        overlaps(left, right, collision.x, collision.x + collision.width) &&
        Math.abs(bottom - collision.y) <= CONTACT_EPSILON
      );
    });
    if (support === undefined) return { grounded: false, climbable };
    return {
      grounded: true,
      supportKind: support.kind === 'one-way' ? 'one-way' : 'solid',
      climbable
    };
  }

  public resolve(
    previousPosition: Vector2,
    proposedPosition: Vector2,
    velocity: Vector2,
    options: PlatformQueryOptions
  ): MotionResolution {
    const minimumX = this.bounds.x - this.body.offset.x;
    const maximumX = this.bounds.x + this.bounds.width - this.body.offset.x - this.body.size.width;
    const boundedTargetX = Math.max(minimumX, Math.min(maximumX, proposedPosition.x));
    let position = previousPosition;
    let remainingDelta = {
      x: boundedTargetX - previousPosition.x,
      y: proposedPosition.y - previousPosition.y
    };
    let resolvedVelocity = {
      x: boundedTargetX === proposedPosition.x ? velocity.x : 0,
      y: velocity.y
    };
    const solidSurfaces = this.surfaces.filter((surface) => surface.kind === 'solid');

    for (let collisionCount = 0; collisionCount < MAX_SWEEP_COLLISIONS; collisionCount += 1) {
      const hits = solidSurfaces
        .map(({ collision }) => sweepSolid(position, remainingDelta, this.body, collision))
        .filter((hit): hit is SweepHit => hit !== undefined);
      for (const surface of this.surfaces) {
        if (surface.kind === 'one-way' && options.ignoreOneWay) continue;
        if (surface.kind !== 'one-way' && surface.kind !== 'water') continue;
        const hit = sweepOneWay(position, remainingDelta, this.body, surface.collision);
        if (hit !== undefined) hits.push(hit);
      }
      const earliestTime = hits.reduce(
        (earliest, hit) => Math.min(earliest, hit.time),
        Number.POSITIVE_INFINITY
      );
      if (!Number.isFinite(earliestTime)) {
        position = {
          x: position.x + remainingDelta.x,
          y: position.y + remainingDelta.y
        };
        remainingDelta = { x: 0, y: 0 };
        break;
      }
      const earliestHits = hits.filter(({ time }) => Math.abs(time - earliestTime) <= TIME_EPSILON);
      const blocksX = earliestHits.some(({ blocksX: blocked }) => blocked);
      const blocksY = earliestHits.some(({ blocksY: blocked }) => blocked);
      position = {
        x: position.x + remainingDelta.x * earliestTime,
        y: position.y + remainingDelta.y * earliestTime
      };
      const remainingTime = 1 - earliestTime;
      remainingDelta = {
        x: blocksX ? 0 : remainingDelta.x * remainingTime,
        y: blocksY ? 0 : remainingDelta.y * remainingTime
      };
      resolvedVelocity = {
        x: blocksX ? 0 : resolvedVelocity.x,
        y: blocksY ? 0 : resolvedVelocity.y
      };
      if (remainingDelta.x === 0 && remainingDelta.y === 0) break;
    }

    return {
      position,
      velocity: resolvedVelocity
    };
  }
}
