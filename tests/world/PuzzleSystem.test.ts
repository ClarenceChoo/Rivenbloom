import { describe, expect, it } from 'vitest';
import type { MechanismDefinition } from '../../src/game/data/types';
import { PuzzleSystem, type PuzzleWorldState } from '../../src/game/world/PuzzleSystem';
import { BreakableSystem } from '../../src/game/world/BreakableSystem';

const mechanisms: readonly MechanismDefinition[] = [
  {
    id: 'listening-arch',
    roomId: 'listening-arch',
    kind: 'listening-arch',
    position: { x: 1972, y: 566 },
    triggerId: 'arch-listen',
    questId: 'silent-bloom',
    persistentFlagId: 'listening-arch-awake'
  },
  {
    id: 'gallery-lens-west',
    roomId: 'resonance-gallery',
    kind: 'lens',
    position: { x: 400, y: 500 },
    triggerId: 'lens-west-trigger',
    requiredAbilityId: 'resonant-pulse',
    persistentFlagId: 'gallery-lens-west-awake'
  },
  {
    id: 'verge-shortcut-gate',
    roomId: 'reliquary-verge',
    kind: 'shortcut',
    position: { x: 900, y: 500 },
    triggerId: 'shortcut-trigger',
    persistentFlagId: 'verge-shortcut-open'
  },
  {
    id: 'hollow-forge',
    roomId: 'wrens-rest',
    kind: 'rootglass-forge',
    position: { x: 300, y: 500 },
    triggerId: 'forge-trigger',
    rewardItemId: 'briar-core',
    persistentFlagId: 'hollow-forge-lit'
  }
];

const world = (update: Partial<PuzzleWorldState> = {}): PuzzleWorldState => ({
  solvedPuzzleIds: [],
  activatedShortcutIds: [],
  unlockedAbilities: ['lumen-bolt'],
  ...update
});

describe('PuzzleSystem', () => {
  it('solves interaction mechanisms and reports quest linkage', () => {
    const system = new PuzzleSystem(mechanisms);
    const result = system.apply('listening-arch', { kind: 'interact' }, world());
    expect(result).toMatchObject({
      kind: 'solved',
      mechanismKind: 'listening-arch',
      persistentFlagId: 'listening-arch-awake',
      firstSolve: true,
      questId: 'silent-bloom'
    });
  });

  it('only lets Resonant Pulse wake a lens', () => {
    const system = new PuzzleSystem(mechanisms);
    expect(system.apply('gallery-lens-west', { kind: 'interact' }, world())).toEqual({
      kind: 'rejected',
      reason: 'wrong-activation'
    });
    expect(
      system.apply('gallery-lens-west', { kind: 'ability', abilityId: 'lumen-bolt' }, world())
    ).toEqual({ kind: 'rejected', reason: 'missing-ability' });
    expect(
      system.apply('gallery-lens-west', { kind: 'ability', abilityId: 'resonant-pulse' }, world())
    ).toMatchObject({ kind: 'solved', mechanismKind: 'lens', firstSolve: true });
  });

  it('replays solved mechanisms idempotently without re-granting rewards', () => {
    const system = new PuzzleSystem(mechanisms);
    const first = system.apply('hollow-forge', { kind: 'interact' }, world());
    expect(first).toMatchObject({ kind: 'solved', firstSolve: true, rewardItemId: 'briar-core' });

    const replay = system.apply(
      'hollow-forge',
      { kind: 'interact' },
      world({ solvedPuzzleIds: ['hollow-forge-lit'] })
    );
    expect(replay).toMatchObject({ kind: 'solved', firstSolve: false });
    expect(replay.kind === 'solved' && replay.rewardItemId).toBeFalsy();
  });

  it('tracks shortcut activation against the shortcut persistence set', () => {
    const system = new PuzzleSystem(mechanisms);
    const opened = system.apply('verge-shortcut-gate', { kind: 'interact' }, world());
    expect(opened).toMatchObject({ kind: 'solved', mechanismKind: 'shortcut', firstSolve: true });

    const replay = system.apply(
      'verge-shortcut-gate',
      { kind: 'interact' },
      world({ activatedShortcutIds: ['verge-shortcut-open'] })
    );
    expect(replay).toMatchObject({ kind: 'solved', firstSolve: false });
    expect(system.apply('missing-gate', { kind: 'interact' }, world())).toEqual({
      kind: 'rejected',
      reason: 'unknown-mechanism'
    });
  });
});

describe('BreakableSystem', () => {
  const walls = [
    {
      id: 'stacks-cracked-wall',
      roomId: 'flooded-stacks',
      bounds: { x: 100, y: 100, width: 40, height: 160 },
      health: 30,
      persistentFlagId: 'stacks-cracked-wall-broken'
    },
    {
      id: 'verge-rootglass-seal',
      roomId: 'reliquary-verge',
      bounds: { x: 400, y: 100, width: 40, height: 160 },
      health: 20,
      requiredDamageType: 'rootglass' as const,
      persistentFlagId: 'verge-rootglass-seal-broken'
    }
  ];

  it('takes cumulative damage, breaks once, and persists broken flags', () => {
    const system = new BreakableSystem(walls);
    expect(system.applyHit('stacks-cracked-wall', { amount: 18, damageType: 'physical' })).toEqual({
      kind: 'damaged',
      breakableId: 'stacks-cracked-wall',
      remainingHealth: 12
    });
    expect(
      system.applyHit('stacks-cracked-wall', { amount: 18, damageType: 'physical' })
    ).toMatchObject({ kind: 'broken', persistentFlagId: 'stacks-cracked-wall-broken' });
    expect(system.applyHit('stacks-cracked-wall', { amount: 18, damageType: 'physical' })).toEqual({
      kind: 'already-broken',
      breakableId: 'stacks-cracked-wall'
    });
    expect(system.brokenFlagIds).toEqual(['stacks-cracked-wall-broken']);

    const reloaded = new BreakableSystem(walls, system.brokenFlagIds);
    expect(reloaded.isBroken('stacks-cracked-wall')).toBe(true);
    expect(reloaded.isBroken('verge-rootglass-seal')).toBe(false);
  });

  it('resists the wrong damage type and unknown ids', () => {
    const system = new BreakableSystem(walls);
    expect(system.applyHit('verge-rootglass-seal', { amount: 50, damageType: 'physical' })).toEqual(
      { kind: 'resisted', breakableId: 'verge-rootglass-seal' }
    );
    expect(
      system.applyHit('verge-rootglass-seal', { amount: 25, damageType: 'rootglass' })
    ).toMatchObject({ kind: 'broken' });
    expect(system.applyHit('missing-wall', { amount: 5, damageType: 'physical' })).toEqual({
      kind: 'unknown-breakable'
    });
  });
});
