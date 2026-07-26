import { describe, expect, it } from 'vitest';
import type { TriggerDefinition } from '../../src/game/data/types';
import { TriggerSystem } from '../../src/game/world/TriggerSystem';

const triggers: readonly TriggerDefinition[] = [
  {
    id: 'entry-discovery',
    roomId: 'trailhead',
    kind: 'discovery',
    bounds: { x: 100, y: 100, width: 200, height: 200 },
    targetId: 'trailhead-vista',
    once: true
  },
  {
    id: 'lantern-rest',
    roomId: 'trailhead',
    kind: 'checkpoint',
    bounds: { x: 400, y: 100, width: 100, height: 200 },
    targetId: 'trail-seed-lantern',
    once: false
  },
  {
    id: 'arch-listen',
    roomId: 'listening-arch',
    kind: 'interaction',
    bounds: { x: 600, y: 100, width: 100, height: 200 },
    targetId: 'listening-arch',
    once: false
  }
];

describe('TriggerSystem', () => {
  it('fires automatic triggers on entry only and repeats non-once triggers after leaving', () => {
    const system = new TriggerSystem(triggers);
    expect(system.advance({ x: 450, y: 150 }).map(({ id }) => id)).toEqual(['lantern-rest']);
    expect(system.advance({ x: 460, y: 150 })).toEqual([]);
    expect(system.advance({ x: 0, y: 0 })).toEqual([]);
    expect(system.advance({ x: 450, y: 150 }).map(({ id }) => id)).toEqual(['lantern-rest']);
  });

  it('fires once-triggers a single time and persists them across sessions', () => {
    const system = new TriggerSystem(triggers);
    expect(system.advance({ x: 150, y: 150 })).toHaveLength(1);
    system.advance({ x: 0, y: 0 });
    expect(system.advance({ x: 150, y: 150 })).toEqual([]);
    expect(system.firedOnceIds).toEqual(['entry-discovery']);

    const reloaded = new TriggerSystem(triggers, system.firedOnceIds);
    expect(reloaded.advance({ x: 150, y: 150 })).toEqual([]);
  });

  it('reserves interaction triggers for explicit presses inside their bounds', () => {
    const system = new TriggerSystem(triggers);
    expect(system.advance({ x: 650, y: 150 })).toEqual([]);
    expect(system.interact({ x: 650, y: 150 })?.id).toBe('arch-listen');
    expect(system.interact({ x: 30, y: 30 })).toBeUndefined();
  });
});
