import { describe, expect, it } from 'vitest';
import { EncounterDirector } from '../../../src/game/ai/EncounterDirector';
import { damageTypeId } from '../../../src/game/combat/CombatTypes';
import type { ActorSpawnDefinition } from '../../../src/game/data/types';
import {
  EnemyController,
  type EnemyWorldContext,
  type EnemyFrameOutput
} from '../../../src/game/entities/enemies/EnemyController';
import { EnemyFactory } from '../../../src/game/entities/enemies/EnemyFactory';

const spawn = (update: Partial<ActorSpawnDefinition> = {}): ActorSpawnDefinition => ({
  id: 'trail-scrapper-1',
  roomId: 'trailhead',
  actorId: 'briar-scrapper',
  position: { x: 600, y: 600 },
  facing: 'left',
  ...update
});

const context = (update: Partial<EnemyWorldContext> = {}): EnemyWorldContext => ({
  player: { position: { x: 650, y: 600 }, noiseLevel: 0 },
  obstacles: [],
  cameraBounds: { x: 0, y: 0, width: 1280, height: 720 },
  floorAhead: { left: true, right: true },
  ...update
});

const stepUntil = (
  enemy: EnemyController,
  worldContext: EnemyWorldContext,
  predicate: (output: EnemyFrameOutput) => boolean,
  maxFrames = 600
): EnemyFrameOutput => {
  let output = enemy.update(worldContext);
  for (let frame = 0; frame < maxFrames && !predicate(output); frame += 1) {
    output = enemy.update(worldContext);
  }
  return output;
};

const strike = (amount: number, poise: number) => ({
  packet: {
    amount,
    damageType: damageTypeId('physical'),
    criticalMultiplier: 1,
    poiseDamage: poise,
    knockback: 120
  },
  travelDirection: 'right' as const
});

describe('EnemyFactory', () => {
  it('creates controllers for registered enemies and rejects unknown or non-enemy actors', () => {
    const factory = new EnemyFactory(new EncounterDirector());
    const enemy = factory.create(spawn());
    expect(enemy.state).toBe('sleep');
    expect(enemy.remainingHealth).toBe(100);

    expect(() => factory.create(spawn({ actorId: 'unknown-actor' }))).toThrow(/Unknown enemy/);
    expect(() => factory.create(spawn({ actorId: 'sela-quill' }))).toThrow(/not an enemy/);
  });
});

describe('EnemyController', () => {
  it('wakes on camera, alerts on a visible player, and telegraphs a granted lunge', () => {
    const director = new EncounterDirector();
    const enemy = new EnemyFactory(director).create(spawn());

    const telegraphed = stepUntil(
      enemy,
      context(),
      (output) => output.activatedAttackId !== undefined,
      60
    );
    expect(telegraphed.activatedAttackId).toBe('briar-scrapper-lunge');
    expect(telegraphed.state).toBe('telegraph');
    expect(telegraphed.cues).toContain('briar-scrapper-lunge-telegraph');
    expect(director.activeAttackerIds).toEqual(['trail-scrapper-1']);

    const recovered = stepUntil(enemy, context(), (output) => output.state === 'chase', 90);
    expect(recovered.state).toBe('chase');
    expect(director.activeAttackerIds).toEqual([]);
  });

  it('patrols within its span and turns at missing floor edges', () => {
    const director = new EncounterDirector();
    const enemy = new EnemyFactory(director).create(spawn({ facing: 'right' }));
    const quiet = context({ player: { position: { x: 4000, y: 600 }, noiseLevel: 0 } });

    const patrolling = stepUntil(enemy, quiet, (output) => output.state === 'patrol', 120);
    expect(patrolling.state).toBe('patrol');
    const beforeEdge = enemy.currentPosition.x;
    const paused = stepUntil(
      enemy,
      context({
        player: { position: { x: 4000, y: 600 }, noiseLevel: 0 },
        floorAhead: { left: true, right: false }
      }),
      (output) => output.state === 'idle',
      10
    );
    expect(paused.state).toBe('idle');
    expect(enemy.currentPosition.x).toBe(beforeEdge);

    const reversed = stepUntil(
      enemy,
      quiet,
      (output) => output.state === 'patrol' && output.facing === 'left',
      160
    );
    expect(reversed.facing).toBe('left');
  });

  it('leashes a pulled chase back to its spawn and calms down', () => {
    const director = new EncounterDirector();
    const enemy = new EnemyFactory(director).create(spawn());
    const pulled = context({ player: { position: { x: 1100, y: 600 }, noiseLevel: 1 } });

    stepUntil(enemy, pulled, (output) => output.state === 'chase', 60);
    const retreating = stepUntil(enemy, pulled, (output) => output.state === 'retreat', 2000);
    expect(retreating.state).toBe('retreat');
    expect(Math.abs(enemy.currentPosition.x - 600)).toBeGreaterThan(420);

    const calmed = stepUntil(
      enemy,
      context({ player: { position: { x: 4000, y: 600 }, noiseLevel: 0 } }),
      (output) => output.state === 'idle' && output.position.x === 600,
      2000
    );
    expect(calmed.position.x).toBe(600);
  });

  it('keeps fully offscreen dormant enemies asleep and attack-free', () => {
    const director = new EncounterDirector();
    const enemy = new EnemyFactory(director).create(spawn({ position: { x: 2400, y: 600 } }));
    const offscreen = context({ player: { position: { x: 2450, y: 600 }, noiseLevel: 1 } });

    for (let frame = 0; frame < 180; frame += 1) {
      const output = enemy.update(offscreen);
      expect(output.state).toBe('sleep');
      expect(output.activatedAttackId).toBeUndefined();
    }
    expect(director.activeAttackerIds).toEqual([]);
  });

  it('blocks frontal damage behind the bark-door until stagger breaks the guard', () => {
    const director = new EncounterDirector();
    const enemy = new EnemyFactory(director).create(
      spawn({ id: 'gate-barkbound', actorId: 'barkbound' })
    );

    const guarded = enemy.applyDamage(strike(30, 25));
    expect(guarded.result.blocked).toBe(true);
    const guardedDamage = guarded.result.healthDamage;

    enemy.applyDamage(strike(30, 25));
    const breaking = enemy.applyDamage(strike(30, 25));
    expect(breaking.staggered).toBe(true);
    expect(breaking.state).toBe('stagger');

    const open = enemy.applyDamage(strike(30, 0));
    expect(open.result.blocked).toBe(false);
    expect(open.result.healthDamage).toBeGreaterThan(guardedDamage);
  });

  it('keeps the rootlurker concealed until the ambush range and re-conceals after losing the player', () => {
    const director = new EncounterDirector();
    const enemy = new EnemyFactory(director).create(
      spawn({ id: 'burrow-rootlurker', actorId: 'rootlurker' })
    );

    const distant = context({ player: { position: { x: 900, y: 600 }, noiseLevel: 1 } });
    for (let frame = 0; frame < 60; frame += 1) {
      expect(enemy.update(distant).state).toBe('sleep');
    }

    const ambushed = stepUntil(
      enemy,
      context({ player: { position: { x: 700, y: 600 }, noiseLevel: 0 } }),
      (output) => output.activatedAttackId !== undefined,
      10
    );
    expect(ambushed.activatedAttackId).toBe('rootlurker-bite');

    const reconcealed = stepUntil(
      enemy,
      context({ player: { position: { x: 4000, y: 600 }, noiseLevel: 0 } }),
      (output) => output.state === 'sleep',
      600
    );
    expect(reconcealed.state).toBe('sleep');
  });

  it('hovers the duskwing above its spawn and dives toward the locked target', () => {
    const director = new EncounterDirector();
    const enemy = new EnemyFactory(director).create(
      spawn({
        id: 'canopy-duskwing',
        actorId: 'duskwing',
        position: { x: 600, y: 560 },
        facing: 'right'
      })
    );
    const below = context({ player: { position: { x: 660, y: 560 }, noiseLevel: 0 } });

    const hovering = stepUntil(enemy, below, (output) => output.state === 'chase', 60);
    expect(hovering.state).toBe('chase');
    expect(hovering.position.y).toBeLessThan(560 - 120);

    const startedDive = stepUntil(enemy, below, (output) => output.state === 'attack', 60);
    expect(startedDive.state).toBe('attack');
    const altitudeAtDiveStart = startedDive.position.y;
    const diving = enemy.update(below);
    expect(diving.state).toBe('attack');
    expect(diving.position.y).toBeGreaterThan(altitudeAtDiveStart);
  });

  it('resolves deterministic drops on death and frees the encounter slot', () => {
    const director = new EncounterDirector({ maxSimultaneousAttackers: 1 });
    const factory = new EnemyFactory(director);
    const generous = factory.create(spawn({ id: 'drop-a' }));
    const stingy = factory.create(spawn({ id: 'drop-b', position: { x: 800, y: 600 } }));

    const dropped = generous.applyDamage(strike(1000, 0), [0.1]);
    expect(dropped.died).toBe(true);
    expect(dropped.drops).toEqual([{ itemId: 'briar-core', quantity: 1 }]);
    expect(generous.update(context()).state).toBe('dead');

    const empty = stingy.applyDamage(strike(1000, 0), [0.9]);
    expect(empty.died).toBe(true);
    expect(empty.drops).toEqual([]);
  });

  it('never exceeds the attacker cap in a mixed encounter and still rotates every enemy in', () => {
    const director = new EncounterDirector({ maxSimultaneousAttackers: 2 });
    const factory = new EnemyFactory(director);
    const pack = [
      factory.create(spawn({ id: 'pack-a', position: { x: 560, y: 600 } })),
      factory.create(spawn({ id: 'pack-b', position: { x: 740, y: 600 } })),
      factory.create(spawn({ id: 'pack-c', position: { x: 680, y: 600 } }))
    ];
    const arena = context({ player: { position: { x: 650, y: 600 }, noiseLevel: 1 } });

    const attackedOnce = new Set<string>();
    for (let frame = 0; frame < 900; frame += 1) {
      let attacking = 0;
      for (const enemy of pack) {
        const output = enemy.update(arena);
        if (output.state === 'telegraph' || output.state === 'attack') attacking += 1;
        if (output.activatedAttackId !== undefined) attackedOnce.add(enemy.id);
      }
      expect(attacking).toBeLessThanOrEqual(2);
      expect(director.activeAttackerIds.length).toBeLessThanOrEqual(2);
      director.advance(1);
    }
    expect([...attackedOnce].sort()).toEqual(['pack-a', 'pack-b', 'pack-c']);
  });
});
