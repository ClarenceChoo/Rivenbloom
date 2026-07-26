import { describe, expect, it } from 'vitest';
import { EncounterDirector, type AttackRequest } from '../../src/game/ai/EncounterDirector';

const melee = (update: Partial<AttackRequest> = {}): AttackRequest => ({
  kind: 'melee',
  cooldownFrames: 60,
  onCamera: true,
  ...update
});

describe('EncounterDirector', () => {
  it('caps simultaneous attackers and grants freed slots to waiting enemies', () => {
    const director = new EncounterDirector({ maxSimultaneousAttackers: 2 });
    for (const enemyId of ['a', 'b', 'c']) director.register(enemyId);

    expect(director.requestAttack('a', melee())).toEqual({ granted: true });
    expect(director.requestAttack('b', melee())).toEqual({ granted: true });
    expect(director.requestAttack('c', melee())).toEqual({
      granted: false,
      reason: 'slots-full'
    });
    expect(director.activeAttackerIds).toEqual(['a', 'b']);

    director.releaseAttack('a');
    expect(director.requestAttack('c', melee())).toEqual({ granted: true });
  });

  it('keeps a granted slot idempotent while the attack is in flight', () => {
    const director = new EncounterDirector({ maxSimultaneousAttackers: 1 });
    director.register('a');
    expect(director.requestAttack('a', melee())).toEqual({ granted: true });
    expect(director.requestAttack('a', melee())).toEqual({ granted: true });
    expect(director.activeAttackerIds).toEqual(['a']);
  });

  it('enforces a per-enemy cooldown that only ticks after release', () => {
    const director = new EncounterDirector({ maxSimultaneousAttackers: 2 });
    director.register('a');
    expect(director.requestAttack('a', melee({ cooldownFrames: 30 }))).toEqual({ granted: true });
    director.advance(120);
    director.releaseAttack('a');
    expect(director.requestAttack('a', melee())).toEqual({
      granted: false,
      reason: 'cooling-down'
    });
    director.advance(29);
    expect(director.requestAttack('a', melee())).toEqual({
      granted: false,
      reason: 'cooling-down'
    });
    director.advance(1);
    expect(director.requestAttack('a', melee())).toEqual({ granted: true });
  });

  it('denies every offscreen attack so unseen enemies stay fair', () => {
    const director = new EncounterDirector();
    director.register('a');
    director.register('b');
    expect(director.requestAttack('a', melee({ onCamera: false }))).toEqual({
      granted: false,
      reason: 'offscreen'
    });
    expect(director.requestAttack('b', melee({ kind: 'ranged', onCamera: false }))).toEqual({
      granted: false,
      reason: 'offscreen'
    });
    expect(director.activeAttackerIds).toEqual([]);
  });

  it('frees the slot of a defeated enemy and refuses further grants', () => {
    const director = new EncounterDirector({ maxSimultaneousAttackers: 1 });
    director.register('a');
    director.register('b');
    expect(director.requestAttack('a', melee())).toEqual({ granted: true });
    director.deactivate('a');
    expect(director.activeAttackerIds).toEqual([]);
    expect(director.requestAttack('a', melee())).toEqual({
      granted: false,
      reason: 'inactive'
    });
    expect(director.requestAttack('b', melee())).toEqual({ granted: true });
  });

  it('treats unregistered enemies as inactive instead of throwing', () => {
    const director = new EncounterDirector();
    expect(director.requestAttack('ghost', melee())).toEqual({
      granted: false,
      reason: 'inactive'
    });
  });
});
