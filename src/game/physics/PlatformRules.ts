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

const overlaps = (startA: number, endA: number, startB: number, endB: number): boolean =>
  startA < endB && endA > startB;

export class PlatformRules {
  public constructor(
    private readonly surfaces: readonly SurfaceDefinition[],
    private readonly bounds: RectDefinition,
    private readonly body: CollisionBodyDefinition
  ) {}

  public query(position: Vector2, options: PlatformQueryOptions): MovementContacts {
    void this.bounds;
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
      if (surface.kind !== 'solid' && surface.kind !== 'one-way') return false;
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
    const resolvedX = Math.max(minimumX, Math.min(maximumX, proposedPosition.x));
    const resolvedVelocityX = resolvedX === proposedPosition.x ? velocity.x : 0;
    if (velocity.y >= 0) {
      const left = resolvedX + this.body.offset.x;
      const right = left + this.body.size.width;
      const previousBottom = previousPosition.y + this.body.offset.y + this.body.size.height;
      const proposedBottom = proposedPosition.y + this.body.offset.y + this.body.size.height;
      const landing = this.surfaces
        .filter((surface) => {
          if (surface.kind !== 'solid' && surface.kind !== 'one-way') return false;
          if (surface.kind === 'one-way' && options.ignoreOneWay) return false;
          const collision = surface.collision;
          return (
            overlaps(left, right, collision.x, collision.x + collision.width) &&
            previousBottom <= collision.y + CONTACT_EPSILON &&
            proposedBottom >= collision.y
          );
        })
        .sort((leftSurface, rightSurface) => leftSurface.collision.y - rightSurface.collision.y)[0];
      if (landing !== undefined) {
        return {
          position: {
            x: resolvedX,
            y: landing.collision.y - this.body.offset.y - this.body.size.height
          },
          velocity: { x: resolvedVelocityX, y: 0 }
        };
      }
    }
    return {
      position: { x: resolvedX, y: proposedPosition.y },
      velocity: { x: resolvedVelocityX, y: velocity.y }
    };
  }
}
