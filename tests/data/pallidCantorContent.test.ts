import { describe, expect, test } from 'vitest';

import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { PALLID_CANTOR_ENCOUNTER } from '../../src/game/data/bosses/pallidCantor';
import { validateContent } from '../../src/game/data/ContentValidation';

describe('Pallid Cantor authored content', () => {
  test('registers the exact actor, phases, attacks, reward, and encounter geometry', () => {
    const boss = CONTENT_REGISTRY.actors.find(({ actorId }) => actorId === 'pallid-cantor');
    expect(boss).toMatchObject({
      kind: 'boss',
      bossId: 'pallid-cantor',
      displayName: 'The Pallid Cantor',
      visualHeight: 320,
      stats: { maxHealth: 420, armour: 4, maxPoise: 84 },
    });
    if (boss?.kind !== 'boss') return;
    expect(boss.phases.map(({ phaseId, attackIds }) => [phaseId, attackIds])).toEqual([
      [
        'pallid-cantor-first-verse',
        [
          'pallid-cantor-note-volley',
          'pallid-cantor-fan-sweep',
          'pallid-cantor-chime-slam',
          'pallid-cantor-spearfall',
        ],
      ],
      [
        'pallid-cantor-broken-refrain',
        [
          'pallid-cantor-inversion-fan',
          'pallid-cantor-note-chain',
          'pallid-cantor-hover-chime',
          'pallid-cantor-spear-cascade',
        ],
      ],
    ]);
    expect(
      CONTENT_REGISTRY.attacks.filter(({ attackId }) => attackId.startsWith('pallid-cantor-')),
    ).toHaveLength(8);
    expect(CONTENT_REGISTRY.items).toContainEqual(
      expect.objectContaining({ itemId: 'cantor-sigil', category: 'quest', maxStack: 1 }),
    );
    expect(CONTENT_REGISTRY.bossEncounters).toEqual([PALLID_CANTOR_ENCOUNTER]);
    expect(PALLID_CANTOR_ENCOUNTER).toMatchObject({
      roomBounds: { x: 0, y: 0, width: 1920, height: 1080 },
      combatBounds: { x: 192, y: 300, width: 1536, height: 600 },
      projectileCapacity: 16,
      hazardCapacity: 15,
    });
    expect(Object.isFrozen(PALLID_CANTOR_ENCOUNTER.lenses)).toBe(true);
    expect(validateContent(CONTENT_REGISTRY)).toEqual([]);
  });
});
