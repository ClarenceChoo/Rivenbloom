import { describe, expect, test } from 'vitest';

import { CONTENT_REGISTRY } from '../../src/game/data/areas';
import { ATTACKS } from '../../src/game/data/attacks';
import { validateContent } from '../../src/game/data/ContentValidation';

describe('Task 12 canonical world content', () => {
  test('registers the five authored areas and all eighteen rooms', () => {
    expect(CONTENT_REGISTRY.areas.map(({ areaId }) => areaId)).toEqual([
      'wren-rest',
      'brackenreach',
      'singing-hollows',
      'rootglass-reliquary',
      'hollow-choir',
    ]);
    expect(CONTENT_REGISTRY.areas.flatMap(({ rooms }) => rooms)).toHaveLength(18);
    expect(validateContent(CONTENT_REGISTRY)).toEqual([]);
  });

  test('authors the required traversal geometry and ten named checkpoints', () => {
    const surfaces = CONTENT_REGISTRY.areas.flatMap(({ surfaces }) => surfaces);
    const zones = CONTENT_REGISTRY.areas.flatMap(({ zones }) => zones);
    const checkpoints = CONTENT_REGISTRY.areas.flatMap(
      ({ checkpoints }) => checkpoints,
    ) as readonly Readonly<{ checkpointId: string; displayName?: string }>[];

    expect(
      surfaces.filter(({ kind }) => kind === 'one-way').map(({ surfaceId }) => surfaceId),
    ).toEqual([
      'wren-herb-drying-rack',
      'trail-rain-shelf',
      'arch-upper-step',
      'hollows-rib-ledge',
      'echo-pool-ledge',
      'dash-trial-rib',
      'west-archive-shelf',
      'flooded-stacks-shelf',
      'resonance-gallery-ledge',
    ]);
    expect(zones.filter(({ kind }) => kind === 'climb').map(({ zoneId }) => zoneId)).toEqual([
      'wren-herb-ladder',
      'split-cedar-root-climb',
      'dash-trial-rib-climb',
      'flooded-stacks-ladder',
    ]);
    expect(zones.filter(({ kind }) => kind === 'water').map(({ zoneId }) => zoneId)).toEqual([
      'echo-pool-water',
      'flooded-stacks-water',
    ]);
    expect(zones.filter(({ kind }) => kind === 'hazard').map(({ zoneId }) => zoneId)).toEqual([
      'hollows-bramble-gate',
      'rootglass-silt-bed',
    ]);
    expect(
      ATTACKS.filter(({ attackId }) =>
        ['bramble-thorn-contact', 'rootglass-silt-contact'].includes(attackId),
      ).map(({ attackId, hitPolicy }) => [attackId, hitPolicy]),
    ).toEqual([
      ['bramble-thorn-contact', { kind: 'interval', rehitIntervalMs: 650 }],
      ['rootglass-silt-contact', { kind: 'interval', rehitIntervalMs: 650 }],
    ]);
    expect(checkpoints.map(({ checkpointId, displayName }) => [checkpointId, displayName])).toEqual(
      [
        ['village-well', 'Village Seed-Lantern'],
        ['brackenreach-trailhead', 'Trailhead Seed-Lantern'],
        ['listening-arch-lantern', 'Listening Arch Seed-Lantern'],
        ['reliquary-verge-lantern', 'Reliquary Verge Seed-Lantern'],
        ['hollows-mouth-lantern', 'Hollows Mouth Seed-Lantern'],
        ['root-memory-lantern', 'Root-Memory Seed-Lantern'],
        ['rootglass-vestibule-lantern', 'Vestibule Seed-Lantern'],
        ['flooded-stacks-lantern', 'Flooded Stacks Seed-Lantern'],
        ['resonance-gallery-lantern', 'Gallery Seed-Lantern'],
        ['choir-threshold-lantern', 'Choir Threshold Seed-Lantern'],
      ],
    );
  });

  test('authors the frozen thirty-six-edge room and area transition graph', () => {
    const transitions = CONTENT_REGISTRY.areas.flatMap(
      ({ transitions }) => transitions,
    ) as readonly Readonly<{
      transitionId: string;
      kind?: string;
      activation?: string;
      predicate?: object;
    }>[];

    expect(transitions.map(({ transitionId }) => transitionId)).toEqual([
      'wren-rest-to-brackenreach',
      'wren-homeward-to-listening-arch',
      'wren-square-to-herb-loft',
      'wren-herb-loft-to-square',
      'wren-square-to-forge-cellar',
      'wren-forge-cellar-to-square',
      'brackenreach-to-wren-rest',
      'listening-arch-homeward-to-wren',
      'listening-arch-to-hollows',
      'reliquary-verge-to-root-memory',
      'reliquary-verge-to-rootglass',
      'trail-to-split-cedar-sanctum',
      'split-cedar-sanctum-to-trail',
      'trail-to-listening-arch',
      'listening-arch-to-trail',
      'hollows-mouth-to-listening-arch',
      'root-memory-to-reliquary-verge',
      'hollows-mouth-to-echo-pool',
      'echo-pool-to-hollows-mouth',
      'echo-pool-to-root-memory',
      'root-memory-to-echo-pool',
      'root-memory-to-dash-trial',
      'dash-trial-to-root-memory',
      'rootglass-to-reliquary-verge',
      'resonance-gallery-to-hollow-choir',
      'vestibule-to-west-archive',
      'west-archive-to-vestibule',
      'vestibule-to-east-lens-vault',
      'east-lens-vault-to-vestibule',
      'east-lens-vault-to-flooded-stacks',
      'flooded-stacks-to-east-lens-vault',
      'flooded-stacks-to-folio-vault',
      'folio-vault-to-flooded-stacks',
      'flooded-stacks-to-resonance-gallery',
      'resonance-gallery-to-flooded-stacks',
      'hollow-choir-to-resonance-gallery',
    ]);
    expect(transitions.filter(({ kind }) => kind === 'room')).toHaveLength(24);
    expect(transitions.filter(({ kind }) => kind === 'area')).toHaveLength(12);
    expect(
      transitions.find(({ transitionId }) => transitionId === 'listening-arch-homeward-to-wren'),
    ).toMatchObject({ activation: 'interact' });
    expect(
      transitions
        .filter(({ transitionId }) =>
          ['trail-to-split-cedar-sanctum', 'flooded-stacks-to-folio-vault'].includes(transitionId),
        )
        .map(({ activation }) => activation),
    ).toEqual(['interact', 'interact']);
    expect(
      transitions.every(({ predicate }) => predicate !== undefined && Object.isFrozen(predicate)),
    ).toBe(true);
  });

  test('authors story triggers, mechanisms, encounters, rewards, discoveries, and breakables', () => {
    const areas = CONTENT_REGISTRY.areas as readonly Readonly<{
      triggers: readonly Readonly<{ triggerId: string }>[];
      mechanisms: readonly Readonly<{ mechanismId: string }>[];
      encounters?: readonly Readonly<{ encounterId: string }>[];
      chests?: readonly Readonly<{ chestId: string }>[];
      discoveries?: readonly Readonly<{ discoveryId: string }>[];
      breakables?: readonly Readonly<{ breakableId: string }>[];
      actorSpawns: readonly Readonly<{ encounterId: string | null }>[];
    }>[];

    const storyTriggerIds = new Set([
      'light-absent-lantern-trail',
      'trace-listening-arch',
      'light-absent-lantern-hollows',
      'recover-root-memory',
      'enter-rootglass-reliquary',
      'light-absent-lantern-reliquary',
    ]);
    expect(
      areas
        .flatMap(({ triggers }) => triggers)
        .map(({ triggerId }) => triggerId)
        .filter((triggerId) => storyTriggerIds.has(triggerId)),
    ).toEqual([...storyTriggerIds]);
    expect(
      areas.flatMap(({ mechanisms }) => mechanisms).map(({ mechanismId }) => mechanismId),
    ).toEqual([
      'listening-arch-homeward-latch',
      'dash-circuit-dew-plate',
      'dash-circuit-rib-plate',
      'dash-circuit-song-plate',
      'vestibule-index-lock',
      'reliquary-forge-anvil',
      'east-lens-root-dial',
      'east-lens-rain-dial',
      'east-lens-bloom-dial',
      'gallery-memory-lens',
      'gallery-breath-lens',
      'gallery-song-lens',
      'hollow-choir-west-lens',
      'hollow-choir-east-lens',
    ]);
    expect(
      areas.flatMap(({ encounters = [] }) => encounters).map(({ encounterId }) => encounterId),
    ).toEqual([
      'trail-briar-crossing',
      'arch-rain-steps',
      'verge-sentinel-gate',
      'hollows-rib-crossing',
      'echo-pool-ambush',
      'stacks-sunk-index',
      'gallery-resonance-guard',
      'hollow-choir-cantor',
    ]);
    expect(
      areas
        .flatMap(({ actorSpawns }) => actorSpawns)
        .filter(({ encounterId }) => encounterId !== null),
    ).toHaveLength(14);
    expect(areas.flatMap(({ chests = [] }) => chests).map(({ chestId }) => chestId)).toEqual([
      'trail-wayfarer-cache',
      'listening-arch-survey-cache',
      'split-cedar-resin-cache',
      'west-archive-index-chest',
      'folio-vault-cartographer-chest',
    ]);
    expect(
      areas.flatMap(({ discoveries = [] }) => discoveries).map(({ discoveryId }) => discoveryId),
    ).toEqual([
      'wren-herb-loft-discovery',
      'split-cedar-sanctum-discovery',
      'echo-pool-heart-petal',
      'east-lens-wellspring-seed',
      'folio-vault-discovery',
    ]);
    expect(
      areas.flatMap(({ breakables = [] }) => breakables).map(({ breakableId }) => breakableId),
    ).toEqual(['split-cedar-root-knot', 'flooded-stacks-silt-wall']);
    expect(CONTENT_REGISTRY.items).toContainEqual(
      expect.objectContaining({ itemId: 'rootglass-index-key', maxStack: 1 }),
    );
  });
});
