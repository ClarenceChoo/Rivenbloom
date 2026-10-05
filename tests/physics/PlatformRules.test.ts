import { describe, expect, test } from 'vitest';

import { stableId } from '../../src/game/core/StableId';
import { resolvePlatformContacts } from '../../src/game/physics/PlatformRules';
import type { SurfaceDefinition, ZoneDefinition } from '../../src/game/data/types';

const ROOM_ID = stableId<'room'>('test-room');

function surface(kind: SurfaceDefinition['kind'], y: number): SurfaceDefinition {
  return Object.freeze({
    surfaceId: stableId<'surface'>(`${kind}-ledge`),
    kind,
    roomId: ROOM_ID,
    bounds: Object.freeze({ x: 0, y, width: 400, height: 32 }),
    materialId: stableId<'material'>('test-stone'),
  });
}

describe('resolvePlatformContacts', () => {
  test('sweeps prior-to-proposed feet so a dropped frame cannot tunnel through solid ground', () => {
    const contacts = resolvePlatformContacts(
      { x: 100, y: 560 },
      { x: 100, y: 660 },
      [surface('solid', 608)],
      [],
      { bodyHalfWidth: 24, bodyHeight: 96, ignoreOneWay: false },
    );

    expect(contacts.groundY).toBe(608);
    expect(contacts.groundedSurface).toBe('solid');
  });

  test('detects a climb zone against the player body instead of feet alone', () => {
    const climbZone: ZoneDefinition = Object.freeze({
      zoneId: stableId<'zone'>('test-ladder'),
      kind: 'climb',
      roomId: ROOM_ID,
      bounds: Object.freeze({ x: 80, y: 180, width: 40, height: 100 }),
    });

    const contacts = resolvePlatformContacts(
      { x: 100, y: 300 },
      { x: 100, y: 300 },
      [],
      [climbZone],
      { bodyHalfWidth: 24, bodyHeight: 96, ignoreOneWay: false },
    );

    expect(contacts.climbZone).toBe(true);
  });

  test('offers a nearby ladder catch after a running player overshoots its edge', () => {
    const ladder: ZoneDefinition = Object.freeze({
      zoneId: stableId<'zone'>('dash-trial-ladder'),
      kind: 'climb',
      roomId: ROOM_ID,
      bounds: { x: 4544, y: 1440, width: 64, height: 248 },
    });
    const contacts = resolvePlatformContacts(
      { x: 4700, y: 1688 },
      { x: 4700, y: 1688 },
      [],
      [ladder],
      { bodyHalfWidth: 24, bodyHeight: 96, ignoreOneWay: false },
    );
    expect(contacts).toMatchObject({ climbZone: true, climbCenterX: 4576 });
  });

  test('ignores one-way support while drop-through is armed without disabling solid ground', () => {
    const oneWay = resolvePlatformContacts(
      { x: 100, y: 590 },
      { x: 100, y: 620 },
      [surface('one-way', 608)],
      [],
      { bodyHalfWidth: 24, bodyHeight: 96, ignoreOneWay: true },
    );
    const solid = resolvePlatformContacts(
      { x: 100, y: 590 },
      { x: 100, y: 620 },
      [surface('solid', 608)],
      [],
      { bodyHalfWidth: 24, bodyHeight: 96, ignoreOneWay: true },
    );

    expect(oneWay.groundY).toBeNull();
    expect(solid.groundY).toBe(608);
  });
});
