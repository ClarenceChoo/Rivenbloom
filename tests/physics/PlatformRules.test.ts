import { describe, expect, it } from 'vitest';
import type {
  CollisionBodyDefinition,
  RectDefinition,
  SurfaceDefinition
} from '../../src/game/data/types';
import { PlatformRules } from '../../src/game/physics/PlatformRules';

const roomBounds: RectDefinition = { x: 0, y: 0, width: 1280, height: 720 };
const playerBody: CollisionBodyDefinition = {
  offset: { x: -18, y: -82 },
  size: { width: 36, height: 82 }
};

const floor: SurfaceDefinition = {
  id: 'test-floor',
  roomId: 'test-room',
  kind: 'solid',
  collision: { x: 0, y: 566, width: 1280, height: 154 },
  materialId: 'wet-slate'
};

const ladder: SurfaceDefinition = {
  id: 'test-ladder',
  roomId: 'test-room',
  kind: 'climb',
  collision: { x: 200, y: 410, width: 40, height: 156 },
  materialId: 'woven-root'
};

const oneWay: SurfaceDefinition = {
  id: 'test-one-way',
  roomId: 'test-room',
  kind: 'one-way',
  collision: { x: 100, y: 410, width: 310, height: 24 },
  materialId: 'moss-root'
};

describe('PlatformRules', () => {
  it('queries authored solid support from the collision body rather than render bounds', () => {
    const rules = new PlatformRules([floor], roomBounds, playerBody);

    const contacts = rules.query({ x: 100, y: 566 }, { ignoreOneWay: false });

    expect(contacts).toEqual({
      grounded: true,
      supportKind: 'solid',
      climbable: false
    });
  });

  it('reports authored climb-zone overlap independently of support', () => {
    const rules = new PlatformRules([ladder], roomBounds, playerBody);

    const contacts = rules.query({ x: 220, y: 500 }, { ignoreOneWay: false });

    expect(contacts).toEqual({
      grounded: false,
      climbable: true
    });
  });

  it('sweeps downward motion onto the first authored solid surface', () => {
    const rules = new PlatformRules([floor], roomBounds, playerBody);

    const resolution = rules.resolve(
      { x: 100, y: 540 },
      { x: 104, y: 580 },
      { x: 240, y: 600 },
      { ignoreOneWay: false }
    );

    expect(resolution).toEqual({
      position: { x: 104, y: 566 },
      velocity: { x: 240, y: 0 }
    });
  });

  it('lands on one-way surfaces from above but permits upward and drop-through motion', () => {
    const rules = new PlatformRules([oneWay], roomBounds, playerBody);

    expect(rules.query({ x: 200, y: 410 }, { ignoreOneWay: false })).toEqual({
      grounded: true,
      supportKind: 'one-way',
      climbable: false
    });
    expect(
      rules.resolve(
        { x: 200, y: 390 },
        { x: 200, y: 430 },
        { x: 0, y: 480 },
        { ignoreOneWay: false }
      )
    ).toEqual({
      position: { x: 200, y: 410 },
      velocity: { x: 0, y: 0 }
    });
    expect(
      rules.resolve(
        { x: 200, y: 450 },
        { x: 200, y: 390 },
        { x: 0, y: -360 },
        { ignoreOneWay: false }
      )
    ).toEqual({
      position: { x: 200, y: 390 },
      velocity: { x: 0, y: -360 }
    });
    expect(rules.query({ x: 200, y: 410 }, { ignoreOneWay: true })).toEqual({
      grounded: false,
      climbable: false
    });
    expect(
      rules.resolve(
        { x: 200, y: 390 },
        { x: 200, y: 430 },
        { x: 0, y: 480 },
        { ignoreOneWay: true }
      )
    ).toEqual({
      position: { x: 200, y: 430 },
      velocity: { x: 0, y: 480 }
    });
  });

  it('contains the authored collision body within horizontal room bounds', () => {
    const rules = new PlatformRules([], roomBounds, playerBody);

    const resolution = rules.resolve(
      { x: 20, y: 500 },
      { x: -50, y: 500 },
      { x: -500, y: 0 },
      { ignoreOneWay: false }
    );

    expect(resolution).toEqual({
      position: { x: 18, y: 500 },
      velocity: { x: 0, y: 0 }
    });
  });

  it('sweeps the authored collision body against a solid wall', () => {
    const wall: SurfaceDefinition = {
      id: 'test-wall',
      roomId: 'test-room',
      kind: 'solid',
      collision: { x: 300, y: 300, width: 40, height: 250 },
      materialId: 'stone'
    };
    const rules = new PlatformRules([wall], roomBounds, playerBody);

    const resolution = rules.resolve(
      { x: 250, y: 500 },
      { x: 330, y: 500 },
      { x: 4800, y: 0 },
      { ignoreOneWay: false }
    );

    expect(resolution).toEqual({
      position: { x: 282, y: 500 },
      velocity: { x: 0, y: 0 }
    });
    expect(
      rules.resolve(
        { x: 390, y: 500 },
        { x: 300, y: 500 },
        { x: -5400, y: 0 },
        { ignoreOneWay: false }
      )
    ).toEqual({
      position: { x: 358, y: 500 },
      velocity: { x: 0, y: 0 }
    });
  });

  it('sweeps the authored collision body against a solid ceiling', () => {
    const ceiling: SurfaceDefinition = {
      id: 'test-ceiling',
      roomId: 'test-room',
      kind: 'solid',
      collision: { x: 100, y: 300, width: 300, height: 30 },
      materialId: 'stone'
    };
    const rules = new PlatformRules([ceiling], roomBounds, playerBody);

    const resolution = rules.resolve(
      { x: 200, y: 420 },
      { x: 200, y: 380 },
      { x: 0, y: -2400 },
      { ignoreOneWay: false }
    );

    expect(resolution).toEqual({
      position: { x: 200, y: 412 },
      velocity: { x: 0, y: 0 }
    });
  });

  it('permits lateral passage through one-way surfaces', () => {
    const rules = new PlatformRules([oneWay], roomBounds, playerBody);

    const resolution = rules.resolve(
      { x: 50, y: 450 },
      { x: 200, y: 450 },
      { x: 9000, y: 0 },
      { ignoreOneWay: false }
    );

    expect(resolution).toEqual({
      position: { x: 200, y: 450 },
      velocity: { x: 9000, y: 0 }
    });
  });
});
