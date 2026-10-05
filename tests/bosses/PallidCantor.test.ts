import { describe, expect, test } from 'vitest';

import type { CombatImpact } from '../../src/game/combat/CombatImpact';
import { damageTypeId, stableId } from '../../src/game/core/StableId';
import { PallidCantorController } from '../../src/game/entities/bosses/PallidCantorController';

function controller(): PallidCantorController {
  return new PallidCantorController({
    readTarget: () => ({
      position: { x: 800, y: 900 },
      hurtboxTarget: {
        targetId: stableId<'combatant'>('mara'),
        teamId: stableId<'team'>('player'),
        hurtboxes: [{ x: 776, y: 804, width: 48, height: 96 }],
      },
    }),
    receiveTargetImpact: () => ({
      kind: 'unresolved',
      projectileDisposition: 'continue',
      commands: [],
    }),
  });
}

function advance(boss: PallidCantorController, count: number): void {
  let previous = boss.snapshot().simulationTimeMs;
  for (let index = 0; index < count; index += 1) {
    const stepIndex = boss.snapshot().stepIndex + 1;
    const nowMs = Math.round((stepIndex * 1000) / 60);
    boss.update({ stepIndex, nowMs, stepMs: nowMs - previous, pulses: [] });
    previous = nowMs;
  }
}

function impact(boss: PallidCantorController, baseDamage = 1000): CombatImpact {
  return {
    attackId: stableId<'attack'>('mara-light-one'),
    targetId: stableId<'combatant'>('pallid-cantor-at-hollow-choir'),
    source: {
      ownerId: stableId<'combatant'>('mara'),
      teamId: stableId<'team'>('player'),
      position: { x: 900, y: 900 },
      facing: 'right',
    },
    occurredAtMs: boss.snapshot().simulationTimeMs,
    delivery: 'melee',
    damage: {
      baseDamage,
      damageType: damageTypeId('physical'),
      poiseDamage: 0,
      critical: { kind: 'excluded' },
    },
    knockback: { x: 0, y: 0 },
    hitStopMs: 55,
    tags: ['blockable'],
    projectile: null,
  };
}

describe('PallidCantorController', () => {
  test('uses exact intro/transition timing, the 210 floor, two lenses, and tokenized defeat', () => {
    const boss = controller();
    expect(boss.snapshot()).toMatchObject({ state: 'intro', arenaLocked: true });
    advance(boss, 143);
    expect(boss.snapshot().state).toBe('intro');
    advance(boss, 1);
    expect(boss.snapshot()).toMatchObject({
      state: 'phaseOne',
      phaseId: 'pallid-cantor-first-verse',
    });

    const threshold = boss.receiveImpact(impact(boss));
    expect(threshold).toMatchObject({ kind: 'resolved', remainingHealth: 210 });
    expect(boss.snapshot().state).toBe('transition');
    advance(boss, 107);
    expect(boss.snapshot().state).toBe('transition');
    const completed = boss.update({
      stepIndex: boss.snapshot().stepIndex + 1,
      nowMs: boss.snapshot().simulationTimeMs + 17,
      stepMs: 17,
      pulses: [],
    });
    expect(completed.snapshot.state).toBe('phaseTwo');
    expect(completed.commands).toContainEqual({ kind: 'restore-player-mana-to-maximum' });

    for (const origin of [
      { x: 360, y: 820 },
      { x: 1560, y: 820 },
    ]) {
      const before = boss.snapshot();
      boss.update({
        stepIndex: before.stepIndex + 1,
        nowMs: before.simulationTimeMs + 17,
        stepMs: 17,
        pulses: [
          {
            abilityId: stableId<'ability'>('resonant-pulse'),
            attackId: stableId<'attack'>('resonant-pulse-wave'),
            ownerId: stableId<'combatant'>('mara'),
            teamId: stableId<'team'>('player'),
            origin,
            occurredAtMs: before.simulationTimeMs,
            radius: 160,
            mechanismTag: 'rootglass-affecting',
          },
        ],
      });
    }
    expect(boss.snapshot()).toMatchObject({ state: 'stagger', heartExposed: true });
    expect(boss.receiveImpact(impact(boss))).toMatchObject({ defeated: true, remainingHealth: 0 });
    expect(boss.snapshot()).toMatchObject({
      state: 'defeat',
      defeatSave: 'pending',
      defeatSaveToken: 1,
    });
    const defeatTick = boss.update({
      stepIndex: boss.snapshot().stepIndex + 1,
      nowMs: boss.snapshot().simulationTimeMs + 17,
      stepMs: 17,
      pulses: [],
    });
    expect(defeatTick.commands).toContainEqual({ kind: 'music-layer', layer: 'release' });
    expect(boss.confirmDefeatSaved(1, 1000)).toBe(true);
    expect(boss.confirmDefeatSaved(1, 1000)).toBe(false);
  });

  test('consumes projectile contacts against the sealed shell without damage', () => {
    const boss = controller();
    advance(boss, 144);
    boss.receiveImpact(impact(boss));
    advance(boss, 108);
    const projectile = {
      ...impact(boss, 40),
      delivery: 'projectile' as const,
      projectile: { instanceId: 1, projectileId: stableId<'projectile'>('test-note') },
    };
    expect(boss.receiveImpact(projectile)).toMatchObject({
      kind: 'resolved',
      remainingHealth: 210,
      projectileDisposition: 'consume',
      damage: { healthDamage: 0, poiseDamage: 0 },
    });
  });
});

test('spear lanes apply damage only inside the shown active regions', () => {
  const impacts: CombatImpact[] = [];
  const boss = new PallidCantorController({
    readTarget: () => ({
      position: { x: 360, y: 900 },
      hurtboxTarget: {
        targetId: stableId<'combatant'>('mara'),
        teamId: stableId<'team'>('player'),
        hurtboxes: [{ x: 336, y: 804, width: 48, height: 96 }],
      },
    }),
    receiveTargetImpact: (hit) => {
      impacts.push(hit);
      return { kind: 'unresolved', projectileDisposition: 'continue', commands: [] };
    },
  });
  advance(boss, 700);
  expect(impacts.filter((hit) => hit.attackId === 'pallid-cantor-spearfall')).toHaveLength(1);
});

test('inversion fan warns its outer regions, then warns and damages the center', () => {
  const impacts: CombatImpact[] = [];
  let position = { x: 360, y: 900 };
  const boss = new PallidCantorController({
    readTarget: () => ({
      position,
      hurtboxTarget: {
        targetId: stableId<'combatant'>('mara'),
        teamId: stableId<'team'>('player'),
        hurtboxes: [{ x: position.x - 24, y: 804, width: 48, height: 96 }],
      },
    }),
    receiveTargetImpact: (hit) => {
      impacts.push(hit);
      return { kind: 'unresolved', projectileDisposition: 'continue', commands: [] };
    },
  });
  advance(boss, 144);
  boss.receiveImpact(impact(boss));
  advance(boss, 108);
  advance(boss, 30);
  expect(boss.snapshot().presentationBounds).toHaveLength(2);
  advance(boss, 40);
  position = { x: 960, y: 900 };
  const warning = boss.snapshot();
  expect(warning.attackPhase).toBe('telegraph');
  expect(warning.presentationBounds).toEqual([{ x: 576, y: 300, width: 768, height: 600 }]);
  advance(boss, 25);
  expect(impacts.filter((hit) => hit.attackId === 'pallid-cantor-inversion-fan')).toHaveLength(2);
});
