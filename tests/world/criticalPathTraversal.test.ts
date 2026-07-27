import { describe, expect, it } from 'vitest';
import { actorDefinitions } from '../../src/game/data/actors';
import { areaDefinitions, getAreaDefinition } from '../../src/game/data/areas';
import type { AreaDefinition, RectDefinition } from '../../src/game/data/types';
import { PLAYER_MOVEMENT_TUNING } from '../../src/game/config/traversal';
import { advanceMovementFrame } from '../../src/game/physics/MovementFrame';
import { createMovementState, type MovementInput } from '../../src/game/physics/MovementModel';
import { PlatformRules } from '../../src/game/physics/PlatformRules';

const CRITICAL_PATH = [
  'wrens-rest',
  'brackenreach-trail',
  'singing-hollows',
  'reliquary-verge',
  'rootglass-reliquary',
  'hollow-choir'
] as const;

const FIXED_DT = 1 / 60;
const SEGMENT_BUDGET_SECONDS = 90;
const ROUTE_BUDGET_SECONDS = 480;

const neutralInput: MovementInput = {
  moveX: 0,
  moveY: 0,
  jumpPressed: false,
  jumpHeld: false,
  dropPressed: false,
  respawn: false
};

const contains = (bounds: RectDefinition, x: number, y: number): boolean =>
  x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;

type WalkResult = {
  readonly reached: boolean;
  readonly seconds: number;
};

/**
 * Drives the real movement model along the ground route toward a target
 * trigger, hopping when horizontal progress stalls. Water surfaces are
 * wadeable, so every critical-path segment is a ground route; any newly
 * authored blocker on the path fails this walk.
 */
function walkToBounds(area: AreaDefinition, spawnId: string, target: RectDefinition): WalkResult {
  const mara = actorDefinitions.find(({ id }) => id === 'mara-vey');
  if (mara === undefined) throw new Error('Player actor missing.');
  const spawn = area.playerSpawns.find(({ id }) => id === spawnId);
  if (spawn === undefined) throw new Error(`Spawn "${spawnId}" missing in ${area.id}.`);
  const platforms = new PlatformRules(area.surfaces, area.bounds, mara.collisionBody);
  let state = createMovementState(spawn.position, spawn.facing);
  const targetX = target.x + target.width / 2;
  let stalledFrames = 0;
  let jumpCooldown = 0;
  const maxFrames = SEGMENT_BUDGET_SECONDS * 60;
  for (let frame = 0; frame < maxFrames; frame += 1) {
    if (contains(target, state.position.x, state.position.y)) {
      return { reached: true, seconds: frame * FIXED_DT };
    }
    const direction = targetX > state.position.x ? 1 : -1;
    const previousX = state.position.x;
    const jumpPressed = stalledFrames > 12 && state.grounded && jumpCooldown === 0;
    if (jumpPressed) {
      jumpCooldown = 40;
      stalledFrames = 0;
    }
    jumpCooldown = Math.max(0, jumpCooldown - 1);
    state = advanceMovementFrame(
      state,
      { ...neutralInput, moveX: direction, jumpPressed, jumpHeld: jumpCooldown > 20 },
      platforms,
      PLAYER_MOVEMENT_TUNING,
      FIXED_DT
    ).state;
    if (Math.abs(state.position.x - previousX) < 0.05) stalledFrames += 1;
    else stalledFrames = 0;
  }
  return { reached: false, seconds: SEGMENT_BUDGET_SECONDS };
}

function transitionTo(area: AreaDefinition, destinationAreaId: string) {
  const transition = area.transitions.find(
    (candidate) => candidate.destinationAreaId === destinationAreaId
  );
  if (transition === undefined) {
    throw new Error(`No transition ${area.id} -> ${destinationAreaId}.`);
  }
  const trigger = area.triggers.find(({ id }) => id === transition.triggerId);
  if (trigger === undefined) {
    throw new Error(`Transition trigger "${transition.triggerId}" missing in ${area.id}.`);
  }
  return { transition, trigger };
}

describe('timed critical-path traversal', () => {
  it('walks the full route from the village to the Hollow Choir inside the budget', () => {
    let spawnId = getAreaDefinition('wrens-rest')?.defaultSpawnId;
    expect(spawnId).toBeDefined();
    let totalSeconds = 0;
    for (let index = 0; index < CRITICAL_PATH.length - 1; index += 1) {
      const area = getAreaDefinition(CRITICAL_PATH[index]!);
      expect(area, CRITICAL_PATH[index]).toBeDefined();
      const { transition, trigger } = transitionTo(area!, CRITICAL_PATH[index + 1]!);
      const walk = walkToBounds(area!, spawnId!, trigger.bounds);
      expect(walk.reached, `${area!.id} -> ${transition.destinationAreaId}`).toBe(true);
      expect(walk.seconds).toBeLessThan(SEGMENT_BUDGET_SECONDS);
      totalSeconds += walk.seconds;
      spawnId = transition.destinationSpawnId;
    }
    const choir = getAreaDefinition('hollow-choir');
    expect(choir).toBeDefined();
    const arena = choir!.rooms[choir!.rooms.length - 1];
    const finalWalk = walkToBounds(choir!, spawnId!, {
      x: arena!.bounds.x + arena!.bounds.width - 220,
      y: 0,
      width: 200,
      height: 720
    });
    expect(finalWalk.reached, 'hollow-choir arena approach').toBe(true);
    totalSeconds += finalWalk.seconds;
    expect(totalSeconds).toBeGreaterThan(30);
    expect(totalSeconds).toBeLessThan(ROUTE_BUDGET_SECONDS);
  });

  it('walks every backward link so shortcuts home stay open', () => {
    for (let index = CRITICAL_PATH.length - 1; index > 0; index -= 1) {
      const area = getAreaDefinition(CRITICAL_PATH[index]!);
      expect(area, CRITICAL_PATH[index]).toBeDefined();
      const back = transitionTo(area!, CRITICAL_PATH[index - 1]!);
      const forward = transitionTo(
        getAreaDefinition(CRITICAL_PATH[index - 1]!)!,
        CRITICAL_PATH[index]!
      );
      const walk = walkToBounds(area!, forward.transition.destinationSpawnId, back.trigger.bounds);
      expect(walk.reached, `${area!.id} -> ${CRITICAL_PATH[index - 1]}`).toBe(true);
    }
  });

  it('keeps authored breakable pockets off the critical path', () => {
    for (const area of areaDefinitions) {
      for (const breakable of area.breakables ?? []) {
        const surface = area.surfaces.find(({ id }) => id === breakable.surfaceId);
        expect(surface, `${area.id}:${breakable.id}`).toBeDefined();
        // Every wall must sit above the ground route, never across it.
        expect(surface!.collision.y + surface!.collision.height).toBeLessThanOrEqual(420);
      }
    }
  });
});
