import { describe, expect, it } from 'vitest';
import {
  CombatTimeline,
  createProjectileAttackDefinition
} from '../../src/game/combat/CombatTimeline';
import { HitboxSystem, type HurtboxOwner } from '../../src/game/combat/HitboxSystem';
import { attackDefinitions } from '../../src/game/data/attacks';
import type { AttackDefinition } from '../../src/game/data/types';

const owner = (id: string, team: HurtboxOwner['team'], x: number, y = 100): HurtboxOwner => ({
  id,
  team,
  position: { x, y },
  hurtboxes: [
    {
      offset: { x: -5, y: -20 },
      size: { width: 10, height: 20 }
    }
  ]
});

const slash: AttackDefinition = {
  id: 'timeline-slash',
  displayName: 'Timeline Slash',
  anticipationFrames: 0,
  activeFrames: 3,
  recoveryFrames: 0,
  hitboxes: [
    {
      startFrame: 1,
      endFrame: 3,
      bounds: {
        offset: { x: 10, y: -20 },
        size: { width: 20, height: 20 }
      }
    }
  ],
  damage: {
    amount: 10,
    poise: 4,
    knockback: { x: 0, y: 0 },
    hitStopMs: 0,
    type: 'physical',
    tags: []
  },
  movementImpulse: { x: 0, y: 0 },
  cancelAfterFrame: 1,
  cooldownMs: 0,
  soundCueId: 'timeline-slash-sound',
  effectCueId: 'timeline-slash-effect'
};

describe('CombatTimeline', () => {
  it('delays a later-substep activation instead of over-advancing it for a render frame', () => {
    const hitboxes = new HitboxSystem([
      owner('mara', 'player', 100),
      owner('target', 'enemy', 125)
    ]);
    const timeline = new CombatTimeline(hitboxes);
    const instance = timeline.activate('mara', slash, 'right', 1);

    const delayed = timeline.advance();
    const active = timeline.advance();

    expect(delayed.advances).toEqual([]);
    expect(delayed.activeAttacks).toMatchObject([{ id: instance.id, frame: 0 }]);
    expect(active.advances).toMatchObject([
      {
        instance: { id: instance.id, frame: 1 },
        hits: [{ targetId: 'target' }]
      }
    ]);
  });

  it('preserves Lumen anticipation before moving and releases a non-piercing projectile on hit', () => {
    const lumen = attackDefinitions.find(({ id }) => id === 'lumen-bolt-burst');
    if (lumen === undefined) throw new Error('Expected authored Lumen attack.');
    const projectile = createProjectileAttackDefinition(lumen, {
      speedPerFrame: 12,
      lifetimeFrames: 48,
      pierces: false
    });
    const hitboxes = new HitboxSystem([
      owner('mara', 'player', 100),
      owner('target', 'enemy', 135, 50)
    ]);
    const timeline = new CombatTimeline(hitboxes);
    const instance = timeline.activate('mara', projectile, 'right');

    const anticipation = timeline.advance(6);
    const contact = timeline.advance();

    expect(projectile.anticipationFrames).toBe(7);
    expect(anticipation.activeAttacks).toMatchObject([{ id: instance.id, frame: 6 }]);
    expect(anticipation.hits).toEqual([]);
    expect(contact.hits.map(({ targetId }) => targetId)).toEqual(['target']);
    expect(contact.completedInstanceIds).toEqual([instance.id]);
    expect(contact.activeAttacks).toEqual([]);
  });
});
