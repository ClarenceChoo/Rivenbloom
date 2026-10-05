import { describe, expect, test } from 'vitest';

import { AI_PROFILES, ACTORS, DROP_TABLES } from '../../src/game/data/actors';
import { ATTACKS } from '../../src/game/data/attacks';
import { ITEMS } from '../../src/game/data/items';

describe('authored enemy content', () => {
  test('defines the six original enemy actors with exact core stats and references', () => {
    const enemies = ACTORS.filter(({ kind }) => kind === 'enemy');
    expect(
      enemies.map((actor) => [
        actor.actorId,
        actor.stats.maxHealth,
        actor.stats.armour,
        actor.stats.maxPoise,
        actor.movement.maxSpeed,
        actor.aiProfileId,
        actor.dropTableId,
      ]),
    ).toEqual([
      ['briar-scrapper', 42, 1, 20, 145, 'briar-scrapper-ai', null],
      ['duskwing', 30, 0, 14, 230, 'duskwing-ai', null],
      ['spore-scribe', 38, 1, 18, 90, 'spore-scribe-ai', null],
      ['barkbound', 72, 5, 38, 75, 'barkbound-ai', null],
      ['rootlurker', 50, 2, 26, 0, 'rootlurker-ai', null],
      ['thorn-sentinel', 180, 6, 70, 100, 'thorn-sentinel-ai', 'thorn-sentinel-briar-core'],
    ]);
  });

  test('authors exact damage resistances without duplicate damage types', () => {
    const byId = new Map<string, (typeof ACTORS)[number]>(
      ACTORS.map((actor) => [actor.actorId, actor]),
    );
    expect(byId.get('duskwing')?.resistances).toEqual([
      { damageTypeId: 'lumen', multiplier: -0.15 },
    ]);
    expect(byId.get('spore-scribe')?.resistances).toEqual([
      { damageTypeId: 'lumen', multiplier: 0.2 },
    ]);
    expect(byId.get('barkbound')?.resistances).toEqual([
      { damageTypeId: 'physical', multiplier: 0.25 },
      { damageTypeId: 'resonance', multiplier: -0.25 },
    ]);
    expect(byId.get('rootlurker')?.resistances).toEqual([
      { damageTypeId: 'resonance', multiplier: -0.2 },
    ]);
    expect(byId.get('thorn-sentinel')?.resistances).toEqual([
      { damageTypeId: 'physical', multiplier: 0.25 },
      { damageTypeId: 'resonance', multiplier: -0.25 },
    ]);
  });

  test('authors awareness, territory, defense, and attack scheduling exactly', () => {
    const profiles = new Map<string, (typeof AI_PROFILES)[number]>(
      AI_PROFILES.map((profile) => [profile.actorId, profile]),
    );
    expect(profiles.get('briar-scrapper')).toMatchObject({
      aiProfileId: 'briar-scrapper-ai',
      awareness: {
        wakeRange: 220,
        sightRange: 420,
        verticalRange: 112,
        suspectMs: 500,
        lostSightMs: 750,
        cameraSleepMargin: 192,
      },
      territory: { patrolRange: 140, leashRange: 300, ledgeProbe: { ahead: 28, depth: 48 } },
      locomotion: { kind: 'ground', speed: 145 },
      attacks: [
        expect.objectContaining({
          attackId: 'briar-scrapper-lunge',
          telegraphMs: 200,
          activeMs: 80,
          recoveryMs: 320,
          band: { minimumX: 0, maximumX: 96, vertical: 112 },
          slotClass: 'close',
          pressureCost: 1,
          motion: { kind: 'lunge', recoilSpeed: 260 },
        }),
      ],
    });

    expect(profiles.get('duskwing')).toMatchObject({
      awareness: { wakeRange: 260, sightRange: 520, verticalRange: 280 },
      territory: { patrolRange: 220, leashRange: 360, ledgeProbe: null },
      locomotion: { kind: 'aerial', speed: 230 },
      attacks: [
        expect.objectContaining({
          attackId: 'duskwing-hook-dive',
          telegraphMs: 300,
          activeMs: 240,
          recoveryMs: 420,
          band: { minimumX: 72, maximumX: 300, vertical: 240 },
          motion: { kind: 'dive', hoverMs: 150, arcDepth: 64 },
        }),
      ],
    });

    expect(profiles.get('spore-scribe')).toMatchObject({
      awareness: { wakeRange: 260, sightRange: 600, verticalRange: 160 },
      territory: { patrolRange: 120, leashRange: 320, ledgeProbe: { ahead: 24, depth: 48 } },
      attacks: [
        expect.objectContaining({
          attackId: 'spore-scribe-pollen-plant',
          telegraphMs: 450,
          activeMs: 50,
          recoveryMs: 400,
          band: { minimumX: 220, maximumX: 480, vertical: 160 },
          slotClass: 'ranged',
          cameraInset: 96,
          motion: {
            kind: 'plant',
            armsMs: 350,
            lifetimeMs: 900,
            roomCap: 6,
            maxHits: 1,
          },
        }),
      ],
    });

    expect(profiles.get('barkbound')).toMatchObject({
      frontalDefense: { multiplier: 0.15, exposeCoreMs: 900 },
      attacks: [expect.objectContaining({ attackId: 'barkbound-shield-bash', activeMs: 100 })],
    });
    expect(profiles.get('rootlurker')).toMatchObject({
      locomotion: { kind: 'stationary', speed: 0 },
      awareness: { wakeRange: 150, sightRange: 150, verticalRange: 128 },
      territory: { patrolRange: 0, leashRange: 0, ledgeProbe: null },
      attacks: [
        expect.objectContaining({
          attackId: 'rootlurker-bell-eruption',
          telegraphMs: 550,
          activeMs: 120,
          recoveryMs: 700,
          motion: { kind: 'hide' },
        }),
      ],
    });
    expect(profiles.get('thorn-sentinel')).toMatchObject({
      frontalDefense: { multiplier: 0.25, exposeCoreMs: null },
      attacks: [
        expect.objectContaining({ attackId: 'thorn-sentinel-press', telegraphMs: 300 }),
        expect.objectContaining({ attackId: 'thorn-sentinel-sweep-one', telegraphMs: 420 }),
        expect.objectContaining({ attackId: 'thorn-sentinel-sweep-two', telegraphMs: 550 }),
      ],
    });
    expect(
      profiles.get('thorn-sentinel')?.attacks.every((pattern) => pattern.slotClass === 'elite'),
    ).toBe(true);
    expect(
      profiles.get('thorn-sentinel')?.attacks.every((pattern) => pattern.pressureCost === 2),
    ).toBe(true);
  });

  test('authors attack damage, canonical timing frames, and legal tags', () => {
    const ids = [
      'briar-scrapper-lunge',
      'duskwing-hook-dive',
      'spore-scribe-pollen-plant',
      'barkbound-shield-bash',
      'rootlurker-bell-eruption',
      'thorn-sentinel-press',
      'thorn-sentinel-sweep-one',
      'thorn-sentinel-sweep-two',
    ];
    const attacks = ids.map((id) => ATTACKS.find(({ attackId }) => attackId === id)!);
    expect(
      attacks.map(({ attackId, damage }) => [attackId, damage.baseDamage, damage.poiseDamage]),
    ).toEqual([
      ['briar-scrapper-lunge', 10, 10],
      ['duskwing-hook-dive', 9, 8],
      ['spore-scribe-pollen-plant', 8, 6],
      ['barkbound-shield-bash', 13, 20],
      ['rootlurker-bell-eruption', 14, 16],
      ['thorn-sentinel-press', 14, 14],
      ['thorn-sentinel-sweep-one', 12, 14],
      ['thorn-sentinel-sweep-two', 18, 24],
    ]);
    expect(attacks.find(({ attackId }) => attackId === 'rootlurker-bell-eruption')?.tags).toEqual([
      'unblockable',
    ]);
    expect(attacks.find(({ attackId }) => attackId === 'spore-scribe-pollen-plant')).toMatchObject({
      delivery: 'projectile',
      tags: ['blockable', 'parryable', 'projectile'],
    });
    for (const attack of attacks.filter(
      ({ attackId }) => attackId !== 'rootlurker-bell-eruption',
    )) {
      expect(attack.tags).not.toContain('unblockable');
    }
  });

  test('adds only the guaranteed Briar Core drop requested by the slice', () => {
    expect(ITEMS).toContainEqual({
      itemId: 'briar-core',
      displayName: 'Briar Core',
      category: 'material',
      description: 'A resin-bright heart cut from an elder briar guardian.',
      maxStack: 1,
      equipment: null,
    });
    expect(DROP_TABLES).toEqual([
      {
        dropTableId: 'thorn-sentinel-briar-core',
        entries: [{ itemId: 'briar-core', quantity: 1, weight: 1 }],
      },
    ]);
  });

  test('deep-freezes profiles, geometry, patterns, motion, actors, attacks, and drops', () => {
    const profile = AI_PROFILES[0]!;
    expect(Object.isFrozen(AI_PROFILES)).toBe(true);
    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.bodyBounds)).toBe(true);
    expect(Object.isFrozen(profile.hurtboxes)).toBe(true);
    expect(Object.isFrozen(profile.hurtboxes[0])).toBe(true);
    expect(Object.isFrozen(profile.attacks)).toBe(true);
    expect(Object.isFrozen(profile.attacks[0]!.motion)).toBe(true);
    expect(Object.isFrozen(ACTORS.find(({ actorId }) => actorId === 'briar-scrapper'))).toBe(true);
    expect(
      Object.isFrozen(ATTACKS.find(({ attackId }) => attackId === 'briar-scrapper-lunge')),
    ).toBe(true);
    expect(Object.isFrozen(DROP_TABLES[0]!.entries)).toBe(true);
    expect(Reflect.set(profile.attacks[0]!.motion, 'kind', 'hide')).toBe(false);
  });
});
