import { describe, expect, it } from 'vitest';
import type { AttackDefinition } from '../../src/game/data/types';
import {
  HitboxSystem,
  type AttackInstance,
  type HurtboxOwner
} from '../../src/game/combat/HitboxSystem';

const slash: AttackDefinition = {
  id: 'test-slash',
  displayName: 'Test Slash',
  anticipationFrames: 2,
  activeFrames: 2,
  recoveryFrames: 3,
  hitboxes: [
    {
      startFrame: 2,
      endFrame: 3,
      bounds: {
        offset: { x: 10, y: -20 },
        size: { width: 30, height: 20 }
      }
    }
  ],
  damage: {
    amount: 12,
    poise: 8,
    knockback: { x: 180, y: -70 },
    hitStopMs: 55,
    type: 'physical',
    tags: []
  },
  movementImpulse: { x: 0, y: 0 },
  cancelAfterFrame: 4,
  cooldownMs: 0,
  soundCueId: 'test-slash-sound',
  effectCueId: 'test-slash-effect'
};

const owner = (
  id: string,
  team: HurtboxOwner['team'],
  x: number,
  hurtboxWidth = 10,
  renderWidth = 400
): HurtboxOwner => ({
  id,
  team,
  position: { x, y: 100 },
  renderMetrics: { width: renderWidth, height: 400 },
  hurtboxes: [
    {
      offset: { x: -hurtboxWidth / 2, y: -20 },
      size: { width: hurtboxWidth, height: 20 }
    }
  ]
});

describe('HitboxSystem', () => {
  it('keeps anticipation inactive and resolves the authored active keyframe', () => {
    const system = new HitboxSystem([owner('mara', 'player', 100), owner('target', 'enemy', 125)]);
    const attack = system.activate('mara', slash, 'right');

    const anticipation = system.advance(attack, 1);
    const active = system.advance(anticipation.instance, 1);

    expect(anticipation.instance.phase).toBe('anticipation');
    expect(anticipation.hits).toEqual([]);
    expect(active.instance.phase).toBe('active');
    expect(active.hits.map(({ targetId }) => targetId)).toEqual(['target']);
  });

  it('mirrors authored hitboxes around the owner origin when facing left', () => {
    const system = new HitboxSystem([
      owner('mara', 'player', 100),
      owner('left-target', 'enemy', 75),
      owner('right-target', 'enemy', 125)
    ]);

    const result = system.advance(system.activate('mara', slash, 'left'), 2);

    expect(result.worldHitboxes).toEqual([{ x: 60, y: 80, width: 30, height: 20 }]);
    expect(result.hits.map(({ targetId }) => targetId)).toEqual(['left-target']);
  });

  it('hits each target once while allowing one attack to hit multiple enemies', () => {
    const system = new HitboxSystem([
      owner('mara', 'player', 100),
      owner('target-a', 'enemy', 120),
      owner('target-b', 'enemy', 135)
    ]);
    const firstActive = system.advance(system.activate('mara', slash, 'right'), 2);
    const secondActive = system.advance(firstActive.instance, 1);

    expect(firstActive.hits.map(({ targetId }) => targetId)).toEqual(['target-a', 'target-b']);
    expect(secondActive.hits).toEqual([]);
  });

  it('uses authored hurtboxes independently of much larger render metrics', () => {
    const system = new HitboxSystem([
      owner('mara', 'player', 100),
      owner('visually-large-but-outside', 'enemy', 60, 4, 500)
    ]);

    const result = system.advance(system.activate('mara', slash, 'right'), 2);

    expect(result.hits).toEqual([]);
  });

  it('resolves moving melee hitboxes from the owner position after activation', () => {
    const system = new HitboxSystem([
      owner('mara', 'player', 100),
      owner('moving-target', 'enemy', 225)
    ]);
    const attack = system.activate('mara', slash, 'right');

    system.updatePosition('mara', { x: 200, y: 100 });
    const result = system.advance(attack, 2);

    expect(result.hits.map(({ targetId }) => targetId)).toEqual(['moving-target']);
    expect(result.instance.origin).toEqual({ x: 100, y: 100 });
  });

  it('excludes the attacking owner and friendly hurtboxes', () => {
    const system = new HitboxSystem([
      owner('mara', 'player', 100),
      owner('ally', 'player', 125),
      owner('enemy', 'enemy', 130)
    ]);

    const result = system.advance(system.activate('mara', slash, 'right'), 2);

    expect(result.hits.map(({ targetId }) => targetId)).toEqual(['enemy']);
  });

  it('moves projectiles for a bounded lifetime and expires without further hits', () => {
    const projectileAttack: AttackDefinition & {
      readonly projectile: {
        readonly speedPerFrame: number;
        readonly lifetimeFrames: number;
        readonly pierces: boolean;
      };
    } = {
      ...slash,
      id: 'test-projectile',
      anticipationFrames: 0,
      activeFrames: 5,
      recoveryFrames: 0,
      hitboxes: [
        {
          startFrame: 1,
          endFrame: 5,
          bounds: {
            offset: { x: 0, y: -20 },
            size: { width: 8, height: 8 }
          }
        }
      ],
      projectile: { speedPerFrame: 10, lifetimeFrames: 3, pierces: true }
    };
    const system = new HitboxSystem([
      owner('mara', 'player', 100),
      owner('near', 'enemy', 112),
      owner('far', 'enemy', 136)
    ]);
    let instance: AttackInstance = system.activate('mara', projectileAttack, 'right');

    const first = system.advance(instance);
    instance = first.instance;
    const second = system.advance(instance);
    instance = second.instance;
    const third = system.advance(instance);
    const expired = system.advance(third.instance);

    expect(first.hits.map(({ targetId }) => targetId)).toEqual(['near']);
    expect(second.hits.map(({ targetId }) => targetId)).toEqual([]);
    expect(third.hits.map(({ targetId }) => targetId)).toEqual(['far']);
    expect(third.instance.phase).toBe('complete');
    expect(expired.hits).toEqual([]);
    expect(expired.instance).toEqual(third.instance);
  });

  it('completes a non-piercing projectile on first contact before later targets', () => {
    const projectileAttack: AttackDefinition & {
      readonly projectile: {
        readonly speedPerFrame: number;
        readonly lifetimeFrames: number;
        readonly pierces: boolean;
      };
    } = {
      ...slash,
      id: 'test-non-piercing-projectile',
      anticipationFrames: 0,
      activeFrames: 5,
      recoveryFrames: 0,
      hitboxes: [
        {
          startFrame: 1,
          endFrame: 5,
          bounds: {
            offset: { x: 0, y: -20 },
            size: { width: 8, height: 8 }
          }
        }
      ],
      projectile: { speedPerFrame: 10, lifetimeFrames: 5, pierces: false }
    };
    const system = new HitboxSystem([
      owner('mara', 'player', 100),
      owner('near', 'enemy', 112),
      owner('far', 'enemy', 136)
    ]);

    const contact = system.advance(system.activate('mara', projectileAttack, 'right'));
    const afterContact = system.advance(contact.instance, 4);

    expect(contact.hits.map(({ targetId }) => targetId)).toEqual(['near']);
    expect(contact.instance.phase).toBe('complete');
    expect(afterContact.hits).toEqual([]);
    expect(afterContact.instance.frame).toBe(1);
  });
});
