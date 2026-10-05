import type { SurfaceDefinition, Vec2, ZoneDefinition } from '../data/types';
import type { MovementContacts } from './MovementModel';

export type PlatformBody = Readonly<{
  bodyHalfWidth: number;
  bodyHeight: number;
  ignoreOneWay: boolean;
}>;

export function resolvePlatformContacts(
  previousFeet: Vec2,
  proposedFeet: Vec2,
  surfaces: readonly SurfaceDefinition[],
  zones: readonly ZoneDefinition[],
  body: PlatformBody,
): MovementContacts {
  const descending = proposedFeet.y >= previousFeet.y;
  const ground = surfaces
    .filter(
      (surface) =>
        horizontalOverlap(proposedFeet.x, body.bodyHalfWidth, surface) &&
        descending &&
        previousFeet.y <= surface.bounds.y &&
        proposedFeet.y >= surface.bounds.y &&
        (surface.kind === 'solid' || !body.ignoreOneWay),
    )
    .sort((left, right) => left.bounds.y - right.bounds.y)[0];
  const ladder = zones
    .filter((zone) => zone.kind === 'climb' && bodyNearClimbZone(proposedFeet, body, zone))
    .sort(
      (left, right) =>
        Math.abs(proposedFeet.x - (left.bounds.x + left.bounds.width / 2)) -
        Math.abs(proposedFeet.x - (right.bounds.x + right.bounds.width / 2)),
    )[0];

  return Object.freeze({
    groundY: ground?.bounds.y ?? null,
    groundedSurface: ground?.kind ?? null,
    ceilingY: null,
    climbZone: ladder !== undefined,
    climbCenterX: ladder === undefined ? null : ladder.bounds.x + ladder.bounds.width / 2,
  });
}

function bodyNearClimbZone(feet: Vec2, body: PlatformBody, zone: ZoneDefinition): boolean {
  const catchMargin = 96;
  return (
    feet.x + body.bodyHalfWidth + catchMargin > zone.bounds.x &&
    feet.x - body.bodyHalfWidth - catchMargin < zone.bounds.x + zone.bounds.width &&
    feet.y > zone.bounds.y &&
    feet.y - body.bodyHeight < zone.bounds.y + zone.bounds.height
  );
}

function horizontalOverlap(
  feetX: number,
  bodyHalfWidth: number,
  surface: SurfaceDefinition,
): boolean {
  return (
    feetX + bodyHalfWidth > surface.bounds.x &&
    feetX - bodyHalfWidth < surface.bounds.x + surface.bounds.width
  );
}
