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
    let resolvedX = Math.max(minimumX, Math.min(maximumX, proposedPosition.x));
    let resolvedVelocityX = resolvedX === proposedPosition.x ? velocity.x : 0;
    const previousLeft = previousPosition.x + this.body.offset.x;
    const previousRight = previousLeft + this.body.size.width;
    const previousTop = previousPosition.y + this.body.offset.y;
    const previousBottom = previousTop + this.body.size.height;
    const solidSurfaces = this.surfaces.filter((surface) => surface.kind === 'solid');

    if (resolvedX > previousPosition.x) {
      const proposedRight = resolvedX + this.body.offset.x + this.body.size.width;
      const wall = solidSurfaces
        .filter(({ collision }) => {
          return (
            overlaps(previousTop, previousBottom, collision.y, collision.y + collision.height) &&
            previousRight <= collision.x + CONTACT_EPSILON &&
            proposedRight >= collision.x
          );
        })
        .sort((leftSurface, rightSurface) => leftSurface.collision.x - rightSurface.collision.x)[0];
      if (wall !== undefined) {
        resolvedX = wall.collision.x - this.body.offset.x - this.body.size.width;
        resolvedVelocityX = 0;
      }
    } else if (resolvedX < previousPosition.x) {
      const proposedLeft = resolvedX + this.body.offset.x;
      const wall = solidSurfaces
        .filter(({ collision }) => {
          const collisionRight = collision.x + collision.width;
          return (
            overlaps(previousTop, previousBottom, collision.y, collision.y + collision.height) &&
            previousLeft >= collisionRight - CONTACT_EPSILON &&
            proposedLeft <= collisionRight
          );
        })
        .sort(
          (leftSurface, rightSurface) =>
            rightSurface.collision.x +
            rightSurface.collision.width -
            (leftSurface.collision.x + leftSurface.collision.width)
        )[0];
      if (wall !== undefined) {
        resolvedX = wall.collision.x + wall.collision.width - this.body.offset.x;
        resolvedVelocityX = 0;
      }
    }

    const left = resolvedX + this.body.offset.x;
    const right = left + this.body.size.width;
    let resolvedY = proposedPosition.y;
    let resolvedVelocityY = velocity.y;
    if (proposedPosition.y > previousPosition.y) {
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
        resolvedY = landing.collision.y - this.body.offset.y - this.body.size.height;
        resolvedVelocityY = 0;
      }
    } else if (proposedPosition.y < previousPosition.y) {
      const proposedTop = proposedPosition.y + this.body.offset.y;
      const ceiling = solidSurfaces
        .filter(({ collision }) => {
          const collisionBottom = collision.y + collision.height;
          return (
            overlaps(left, right, collision.x, collision.x + collision.width) &&
            previousTop >= collisionBottom - CONTACT_EPSILON &&
            proposedTop <= collisionBottom
          );
        })
        .sort(
          (leftSurface, rightSurface) =>
            rightSurface.collision.y +
            rightSurface.collision.height -
            (leftSurface.collision.y + leftSurface.collision.height)
        )[0];
      if (ceiling !== undefined) {
        resolvedY = ceiling.collision.y + ceiling.collision.height - this.body.offset.y;
        resolvedVelocityY = 0;
      }
    }

    return {
      position: { x: resolvedX, y: resolvedY },
      velocity: { x: resolvedVelocityX, y: resolvedVelocityY }
    };
  }
}
