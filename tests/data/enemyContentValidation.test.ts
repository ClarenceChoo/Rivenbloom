import { describe, expect, test } from 'vitest';

import { validateContent } from '../../src/game/data/ContentValidation';
import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import type {
  AiProfileDefinition,
  ContentRegistry,
  EnemyActorDefinition,
} from '../../src/game/data/types';

function validate(patch: Partial<ContentRegistry>) {
  return validateContent({ ...CONTENT_REGISTRY, ...patch });
}

describe('enemy content validation', () => {
  test('accepts the complete authored enemy registry', () => {
    expect(validateContent(CONTENT_REGISTRY)).toEqual([]);
  });

  test('reports malformed geometry, awareness, territory, timing, and slot rules', () => {
    const profile = CONTENT_REGISTRY.aiProfiles[0]!;
    const invalid: AiProfileDefinition = {
      ...profile,
      bodyBounds: { ...profile.bodyBounds, width: 0 },
      awareness: { ...profile.awareness, lostSightMs: -1 },
      territory: { ...profile.territory, leashRange: 10, patrolRange: 20 },
      attacks: [
        {
          ...profile.attacks[0]!,
          activeMs: 500,
          band: { minimumX: 90, maximumX: 20, vertical: -1 },
          slotClass: 'elite',
          pressureCost: 1,
        },
      ],
    };
    const issues = validate({ aiProfiles: [invalid, ...CONTENT_REGISTRY.aiProfiles.slice(1)] });
    for (const path of [
      '/aiProfiles/0/bodyBounds',
      '/aiProfiles/0/awareness/lostSightMs',
      '/aiProfiles/0/territory/leashRange',
      '/aiProfiles/0/attacks/0/activeMs',
      '/aiProfiles/0/attacks/0/band',
      '/aiProfiles/0/attacks/0/pressureCost',
    ]) {
      expect(issues).toContainEqual(expect.objectContaining({ path }));
    }
  });

  test('reports missing profile attack/actor references and actor-profile disagreement', () => {
    const profile = CONTENT_REGISTRY.aiProfiles[0]!;
    const actor = CONTENT_REGISTRY.actors.find(
      ({ actorId }) => actorId === profile.actorId,
    )! as EnemyActorDefinition;
    const issues = validate({
      aiProfiles: [
        {
          ...profile,
          actorId: 'missing-enemy' as typeof profile.actorId,
          attacks: [
            {
              ...profile.attacks[0]!,
              attackId: 'missing-attack' as (typeof profile.attacks)[0]['attackId'],
            },
          ],
        },
        ...CONTENT_REGISTRY.aiProfiles.slice(1),
      ],
      actors: [
        ...CONTENT_REGISTRY.actors.filter(({ actorId }) => actorId !== actor.actorId),
        { ...actor, aiProfileId: CONTENT_REGISTRY.aiProfiles[1]!.aiProfileId },
      ],
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/aiProfiles/0/actorId', code: 'missing-reference' }),
        expect.objectContaining({
          path: '/aiProfiles/0/attacks/0/attackId',
          code: 'missing-reference',
        }),
        expect.objectContaining({
          path: expect.stringMatching(/\/actors\/\d+\/aiProfileId/),
          code: 'invalid-reference',
        }),
      ]),
    );
  });

  test('requires enemies to own a profile and rejects duplicate resistance types', () => {
    const actor = CONTENT_REGISTRY.actors.find(
      ({ kind }) => kind === 'enemy',
    )! as EnemyActorDefinition;
    const issues = validate({
      actors: [
        ...CONTENT_REGISTRY.actors.filter((candidate) => candidate.actorId !== actor.actorId),
        {
          ...actor,
          aiProfileId: null as unknown as EnemyActorDefinition['aiProfileId'],
          resistances: [
            {
              damageTypeId: 'physical' as (typeof actor.resistances)[number]['damageTypeId'],
              multiplier: 0.1,
            },
            {
              damageTypeId: 'physical' as (typeof actor.resistances)[number]['damageTypeId'],
              multiplier: 0.2,
            },
          ],
        },
      ],
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringMatching(/\/actors\/\d+\/aiProfileId/),
          code: 'missing-reference',
        }),
        expect.objectContaining({
          path: expect.stringMatching(/\/actors\/\d+\/resistances\/1\/damageTypeId/),
          code: 'duplicate-id',
        }),
      ]),
    );
  });

  test('requires actor sight and locomotion speed to agree with its owned profile', () => {
    const actorIndex = CONTENT_REGISTRY.actors.findIndex(
      ({ actorId }) => actorId === 'briar-scrapper',
    );
    const actor = CONTENT_REGISTRY.actors[actorIndex]! as EnemyActorDefinition;
    const actors = [...CONTENT_REGISTRY.actors];
    actors[actorIndex] = {
      ...actor,
      movement: { ...actor.movement, maxSpeed: actor.movement.maxSpeed - 1 },
      perception: { range: actor.perception.range + 1 },
    };

    const issues = validate({ actors });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-reference',
          path: `/actors/${actorIndex}/movement/maxSpeed`,
        }),
        expect.objectContaining({
          code: 'invalid-reference',
          path: `/actors/${actorIndex}/perception/range`,
        }),
      ]),
    );
  });

  test('rejects duplicate actor attack IDs independently of profile agreement', () => {
    const actorIndex = CONTENT_REGISTRY.actors.findIndex(
      ({ actorId }) => actorId === 'thorn-sentinel',
    );
    const actor = CONTENT_REGISTRY.actors[actorIndex]! as EnemyActorDefinition;
    const actors = [...CONTENT_REGISTRY.actors];
    actors[actorIndex] = { ...actor, attackIds: [...actor.attackIds, actor.attackIds[0]!] };

    expect(validate({ actors })).toContainEqual(
      expect.objectContaining({
        code: 'duplicate-id',
        path: `/actors/${actorIndex}/attackIds/${actor.attackIds.length}`,
      }),
    );
  });

  test('requires every AI profile actor reference to resolve to an enemy actor', () => {
    const profile = CONTENT_REGISTRY.aiProfiles[0]!;
    const player = CONTENT_REGISTRY.actors.find(({ kind }) => kind === 'player')!;
    const profiles = [
      { ...profile, actorId: player.actorId },
      ...CONTENT_REGISTRY.aiProfiles.slice(1),
    ];

    expect(validate({ aiProfiles: profiles })).toContainEqual(
      expect.objectContaining({
        code: 'invalid-reference',
        path: '/aiProfiles/0/actorId',
      }),
    );
  });
});
