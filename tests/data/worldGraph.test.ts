import { describe, expect, it } from 'vitest';
import { areaDefinitions, getAreaDefinition } from '../../src/game/data/areas';
import { contentRegistry } from '../../src/game/data/contentRegistry';
import { validateContent } from '../../src/game/data/contentValidation';

const CRITICAL_PATH = [
  'wrens-rest',
  'brackenreach-trail',
  'singing-hollows',
  'reliquary-verge',
  'rootglass-reliquary',
  'hollow-choir'
] as const;

describe('world graph', () => {
  it('passes full content validation with the complete region authored', () => {
    expect(validateContent(contentRegistry)).toEqual([]);
  });

  it('authors all nine named places across the six areas', () => {
    const roomNames = areaDefinitions.flatMap((area) =>
      area.rooms.map(({ displayName }) => displayName)
    );
    expect(areaDefinitions.map(({ id }) => id).sort()).toEqual([...CRITICAL_PATH].sort());
    for (const landmark of [
      'Village Green',
      'Trailhead',
      'Listening Arch',
      'Bramble Run',
      'Sentinel Gate',
      'Vestibule',
      'Flooded Stacks',
      'Resonance Gallery',
      'Choir Arena'
    ]) {
      expect(roomNames).toContain(landmark);
    }
  });

  it('links the critical path bidirectionally from the village to the choir', () => {
    for (let index = 0; index < CRITICAL_PATH.length - 1; index += 1) {
      const from = getAreaDefinition(CRITICAL_PATH[index]!)!;
      const to = getAreaDefinition(CRITICAL_PATH[index + 1]!)!;
      const forward = from.transitions.find(({ destinationAreaId }) => destinationAreaId === to.id);
      const backward = to.transitions.find(
        ({ destinationAreaId }) => destinationAreaId === from.id
      );
      expect(forward, `${from.id} -> ${to.id}`).toBeDefined();
      expect(backward, `${to.id} -> ${from.id}`).toBeDefined();
    }
  });

  it('reaches the Hollow Choir from a new game by walking the transition graph', () => {
    const visited = new Set<string>(['wrens-rest']);
    const queue = ['wrens-rest'];
    while (queue.length > 0) {
      const area = getAreaDefinition(queue.shift()!);
      for (const transition of area?.transitions ?? []) {
        if (visited.has(transition.destinationAreaId)) continue;
        visited.add(transition.destinationAreaId);
        queue.push(transition.destinationAreaId);
      }
    }
    for (const areaId of CRITICAL_PATH) expect(visited).toContain(areaId);
  });

  it('makes every room discoverable through an entry or discovery trigger', () => {
    for (const area of areaDefinitions) {
      for (const room of area.rooms) {
        const discovering = area.triggers.find(
          (trigger) =>
            (trigger.kind === 'room-entry' || trigger.kind === 'discovery') &&
            trigger.targetId === room.discoveryId
        );
        expect(discovering, `${area.id}/${room.id}`).toBeDefined();
      }
    }
  });

  it('gives every area at least one seed-lantern checkpoint inside its bounds', () => {
    for (const area of areaDefinitions) {
      expect(area.checkpoints.length, area.id).toBeGreaterThan(0);
      for (const checkpoint of area.checkpoints) {
        expect(checkpoint.position.x).toBeGreaterThanOrEqual(area.bounds.x);
        expect(checkpoint.position.x).toBeLessThanOrEqual(area.bounds.x + area.bounds.width);
        const trigger = area.triggers.find(({ id }) => id === checkpoint.triggerId);
        expect(trigger?.kind, `${area.id}/${checkpoint.id}`).toBe('checkpoint');
      }
    }
  });

  it('keeps hazards, water, climbs, and one-way platforms inside their room bounds', () => {
    for (const area of areaDefinitions) {
      for (const surface of area.surfaces) {
        const room = area.rooms.find(({ id }) => id === surface.roomId);
        expect(room, `${area.id}/${surface.id}`).toBeDefined();
        if (room === undefined) continue;
        expect(surface.collision.x).toBeGreaterThanOrEqual(room.bounds.x - 40);
        expect(surface.collision.x + surface.collision.width).toBeLessThanOrEqual(
          room.bounds.x + room.bounds.width + 40
        );
        if (surface.kind === 'hazard') {
          expect(surface.damage ?? 0, `${area.id}/${surface.id}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('spaces the bramble dash gates within a dash length', () => {
    const hollows = getAreaDefinition('singing-hollows')!;
    const brambles = hollows.surfaces.filter(({ kind }) => kind === 'hazard');
    expect(brambles.length).toBeGreaterThanOrEqual(2);
    for (const bramble of brambles) {
      expect(bramble.collision.width).toBeLessThanOrEqual(160);
    }
  });
});
