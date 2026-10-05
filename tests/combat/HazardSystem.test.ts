import { describe, expect, test } from 'vitest';

import { HazardSystem } from '../../src/game/combat/HazardSystem';
import { stableId } from '../../src/game/core/StableId';

describe('HazardSystem', () => {
  test('hits on entry, waits through stay interval, and hits immediately after re-entry', () => {
    const hazards = new HazardSystem();
    const hazardId = stableId<'hazard'>('thorn-bed');
    const targetId = stableId<'combatant'>('mara');

    expect(hazards.sample(hazardId, targetId, true, 0, 100)).toBe(true);
    expect(hazards.sample(hazardId, targetId, true, 99, 100)).toBe(false);
    expect(hazards.sample(hazardId, targetId, true, 100, 100)).toBe(true);
    expect(hazards.sample(hazardId, targetId, false, 120, 100)).toBe(false);
    expect(hazards.sample(hazardId, targetId, true, 121, 100)).toBe(true);
  });

  test('rejects non-positive intervals and backward time', () => {
    const hazards = new HazardSystem();
    const hazardId = stableId<'hazard'>('thorn-bed');
    const targetId = stableId<'combatant'>('mara');
    expect(() => hazards.sample(hazardId, targetId, true, 0, 0)).toThrow(RangeError);
    expect(hazards.sample(hazardId, targetId, true, 10, 100)).toBe(true);
    expect(() => hazards.sample(hazardId, targetId, true, 9, 100)).toThrow(RangeError);
  });
});
