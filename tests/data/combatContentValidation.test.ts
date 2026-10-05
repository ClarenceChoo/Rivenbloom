import { describe, expect, test } from 'vitest';

import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { validateContent } from '../../src/game/data/ContentValidation';
import type {
  AbilityDefinition,
  AttackDefinition,
  ContentRegistry,
} from '../../src/game/data/types';

describe('combat content validation', () => {
  test('rejects fractional ability mana and cooldown values at their precise paths', () => {
    const abilities: readonly AbilityDefinition[] = [
      { ...CONTENT_REGISTRY.abilities[0]!, manaCost: 0.5 },
      { ...CONTENT_REGISTRY.abilities[1]!, cooldownMs: 1.5 },
      ...CONTENT_REGISTRY.abilities.slice(2),
    ];

    expect(validateContent({ ...CONTENT_REGISTRY, abilities })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/abilities/0/manaCost',
          code: 'invalid-value',
        }),
        expect.objectContaining({
          path: '/abilities/1/cooldownMs',
          code: 'invalid-value',
        }),
      ]),
    );
  });

  test('rejects malformed attack runtime metadata and duplicate tags', () => {
    const base = CONTENT_REGISTRY.attacks[0]!;
    const attack = {
      ...base,
      delivery: 'projectile',
      knockback: { x: Number.NaN, y: 0 },
      hitStopMs: -1,
      tags: ['blockable', 'blockable'],
      hitPolicy: { kind: 'interval', rehitIntervalMs: 0 },
    } as unknown as AttackDefinition;
    const registry: ContentRegistry = { ...CONTENT_REGISTRY, attacks: [attack] };

    const issues = validateContent(registry);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/attacks/0/knockback/x', code: 'invalid-value' }),
        expect.objectContaining({ path: '/attacks/0/hitStopMs', code: 'invalid-value' }),
        expect.objectContaining({ path: '/attacks/0/tags/1', code: 'duplicate-id' }),
        expect.objectContaining({
          path: '/attacks/0/hitPolicy/rehitIntervalMs',
          code: 'invalid-value',
        }),
        expect.objectContaining({ path: '/attacks/0/tags', code: 'invalid-value' }),
      ]),
    );
  });

  test('validates action-specific ability numbers, status IDs, and attack references', () => {
    const invalid = [
      {
        ...CONTENT_REGISTRY.abilities[0]!,
        action: {
          kind: 'projectile',
          projectileId: 'Not Stable',
          attackId: 'missing',
          speed: 0,
          lifetimeMs: -1,
          bounds: { x: Number.NaN, y: 0, width: 0, height: -1 },
        },
      },
      {
        ...CONTENT_REGISTRY.abilities[1]!,
        action: {
          kind: 'dash',
          speed: -1,
          durationMs: 0,
          invulnerableMs: 2,
          invulnerabilityStatusId: 'Not Stable',
        },
      },
      {
        ...CONTENT_REGISTRY.abilities[2]!,
        action: {
          kind: 'barrier',
          statusId: 'Not Stable',
          durationMs: 0,
          projectileAbsorptions: 0,
        },
      },
      {
        ...CONTENT_REGISTRY.abilities[3]!,
        action: { kind: 'pulse', attackId: 'missing', radius: 0, mechanismTag: 'wrong' },
      },
    ] as unknown as readonly AbilityDefinition[];
    const issues = validateContent({ ...CONTENT_REGISTRY, abilities: invalid });

    for (const path of [
      '/abilities/0/action/attackId',
      '/abilities/0/action/projectileId',
      '/abilities/0/action/speed',
      '/abilities/0/action/lifetimeMs',
      '/abilities/0/action/bounds/x',
      '/abilities/0/action/bounds/width',
      '/abilities/0/action/bounds/height',
      '/abilities/1/action/speed',
      '/abilities/1/action/durationMs',
      '/abilities/1/action/invulnerableMs',
      '/abilities/1/action/invulnerabilityStatusId',
      '/abilities/2/action/statusId',
      '/abilities/2/action/durationMs',
      '/abilities/2/action/projectileAbsorptions',
      '/abilities/3/action/attackId',
      '/abilities/3/action/radius',
      '/abilities/3/action/mechanismTag',
    ]) {
      expect(issues).toContainEqual(expect.objectContaining({ path }));
    }
  });

  test('rejects conflicting attack tags and ability-to-delivery mismatches', () => {
    const conflictingAttack = {
      ...CONTENT_REGISTRY.attacks[0]!,
      tags: ['blockable', 'unblockable'],
    } as unknown as AttackDefinition;
    const projectileAbility = {
      ...CONTENT_REGISTRY.abilities[0]!,
      action: {
        ...CONTENT_REGISTRY.abilities[0]!.action,
        kind: 'projectile',
        projectileId: 'test-projectile',
        attackId: CONTENT_REGISTRY.attacks[0]!.attackId,
        speed: 720,
        lifetimeMs: 900,
        bounds: { x: 0, y: 0, width: 16, height: 16 },
      },
    } as AbilityDefinition;
    const registry: ContentRegistry = {
      ...CONTENT_REGISTRY,
      attacks: [conflictingAttack, ...CONTENT_REGISTRY.attacks.slice(1)],
      abilities: [projectileAbility, ...CONTENT_REGISTRY.abilities.slice(1)],
    };

    expect(validateContent(registry)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/attacks/0/tags', code: 'invalid-value' }),
        expect.objectContaining({
          path: '/abilities/0/action/attackId',
          code: 'invalid-reference',
        }),
      ]),
    );
  });

  test('rejects an unknown ability action at its discriminant', () => {
    const ability = {
      ...CONTENT_REGISTRY.abilities[0]!,
      action: { kind: 'teleport' },
    } as unknown as AbilityDefinition;

    expect(validateContent({ ...CONTENT_REGISTRY, abilities: [ability] })).toContainEqual(
      expect.objectContaining({
        path: '/abilities/0/action/kind',
        code: 'invalid-value',
      }),
    );
  });

  test('rejects a heavy charge range whose maximum precedes its minimum', () => {
    const attack = {
      ...CONTENT_REGISTRY.attacks[4]!,
      charge: { minimumMs: 900, maximumMs: 350 },
    } as unknown as AttackDefinition;

    expect(
      validateContent({
        ...CONTENT_REGISTRY,
        attacks: [
          ...CONTENT_REGISTRY.attacks.slice(0, 4),
          attack,
          ...CONTENT_REGISTRY.attacks.slice(5),
        ],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/attacks/4/charge/maximumMs', code: 'invalid-value' }),
      ]),
    );
  });
});
