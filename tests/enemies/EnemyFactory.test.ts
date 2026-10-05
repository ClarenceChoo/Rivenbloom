import { describe, expect, test } from 'vitest';

import { EncounterDirector } from '../../src/game/ai/EncounterDirector';
import { EnemyFactory } from '../../src/game/entities/enemies/EnemyFactory';
import type { EnemyDynamicPorts } from '../../src/game/entities/enemies/EnemyController';
import { ACTORS, AI_PROFILES, DROP_TABLES } from '../../src/game/data/actors';
import { ATTACKS } from '../../src/game/data/attacks';
import type { ActorSpawnDefinition } from '../../src/game/data/types';
import { stableId } from '../../src/game/core/StableId';

function spawn(actorId = 'briar-scrapper', spawnId = 'scrapper-one'): ActorSpawnDefinition {
  return {
    spawnId: stableId<'actor-spawn'>(spawnId),
    actorId: stableId<'actor'>(actorId),
    roomId: stableId<'room'>('test-room'),
    position: { x: 120, y: 300 },
    facing: 'right',
    encounterId: stableId<'encounter'>('test-encounter'),
  };
}

function ports(): EnemyDynamicPorts {
  return {
    readTarget: () => null,
    readCameraBounds: () => ({ x: 0, y: 0, width: 1280, height: 720 }),
    readSurfaces: () => [],
    receiveTargetImpact: () => ({
      kind: 'unresolved',
      projectileDisposition: 'continue',
      commands: [],
    }),
    readRoomOrdnanceCount: () => 0,
  };
}

function factory(patch: Partial<ConstructorParameters<typeof EnemyFactory>[0]> = {}) {
  return new EnemyFactory({
    actors: ACTORS,
    profiles: AI_PROFILES,
    attacks: ATTACKS,
    dropTables: DROP_TABLES,
    ...patch,
  });
}

describe('enemy factory', () => {
  test('rejects missing and non-enemy actors', () => {
    expect(() =>
      factory().create(spawn('missing-enemy'), new EncounterDirector(), ports()),
    ).toThrow(/actor/i);
    expect(() => factory().create(spawn('mara'), new EncounterDirector(), ports())).toThrow(
      /enemy/i,
    );
  });

  test('rejects missing profile, attack, and drop-table references', () => {
    expect(() =>
      factory({
        profiles: AI_PROFILES.filter(({ actorId }) => actorId !== 'briar-scrapper'),
      }).create(spawn(), new EncounterDirector(), ports()),
    ).toThrow(/profile/i);
    expect(() =>
      factory({
        attacks: ATTACKS.filter(({ attackId }) => attackId !== 'briar-scrapper-lunge'),
      }).create(spawn(), new EncounterDirector(), ports()),
    ).toThrow(/attack/i);
    expect(() =>
      factory({ dropTables: [] }).create(
        spawn('thorn-sentinel', 'sentinel-one'),
        new EncounterDirector(),
        ports(),
      ),
    ).toThrow(/drop/i);
  });

  test('derives unique combatant IDs from globally unique spawn IDs', () => {
    const enemyFactory = factory();
    const first = enemyFactory.create(
      spawn('briar-scrapper', 'scrapper-one'),
      new EncounterDirector(),
      ports(),
    );
    const second = enemyFactory.create(
      spawn('briar-scrapper', 'scrapper-two'),
      new EncounterDirector(),
      ports(),
    );

    expect(first.identity()).toEqual({ combatantId: 'scrapper-one', teamId: 'hostile' });
    expect(second.identity()).toEqual({ combatantId: 'scrapper-two', teamId: 'hostile' });
  });

  test('copies spawn values and returns independent immutable controller snapshots', () => {
    const authoredSpawn = spawn();
    const enemyFactory = factory();
    const first = enemyFactory.create(authoredSpawn, new EncounterDirector(), ports());
    const second = enemyFactory.create(
      { ...authoredSpawn, spawnId: stableId<'actor-spawn'>('scrapper-two') },
      new EncounterDirector(),
      ports(),
    );
    Reflect.set(authoredSpawn.position, 'x', 999);

    expect(first.snapshot().position.x).toBe(120);
    expect(second.snapshot().position.x).toBe(120);
    expect(Object.isFrozen(first.snapshot())).toBe(true);
    expect(Object.isFrozen(first.snapshot().position)).toBe(true);
    expect(first.snapshot()).not.toBe(second.snapshot());
  });
});
