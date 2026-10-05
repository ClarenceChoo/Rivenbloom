import { stableId } from '../../core/StableId';
import { WORLD_ALWAYS } from '../../world/WorldPredicates';
import { deepFreeze } from '../immutability';
import type { PuzzleDefinition, WorldPredicate } from '../types';

export { BRACKENREACH_AREA } from './brackenreach';
export { HOLLOW_CHOIR_AREA } from './hollowChoir';
export { ROOTGLASS_RELIQUARY_AREA } from './rootglassReliquary';
export { SINGING_HOLLOWS_AREA } from './singingHollows';
export { WRENS_REST_AREA } from './wrensRest';

const requires = (patch: Partial<WorldPredicate>): WorldPredicate => ({
  ...WORLD_ALWAYS,
  ...patch,
});

export const PUZZLES: readonly PuzzleDefinition[] = deepFreeze([
  {
    puzzleId: stableId<'puzzle'>('hollows-dash-circuit'),
    displayName: 'Wayfinder Circuit',
    description: 'Wake all three dew plates before the root-song fades.',
    roomId: stableId<'room'>('dash-trial'),
    program: {
      kind: 'timed-set',
      windowMs: 9000,
      steps: [
        step('dash-circuit-dew-plate', 'enter'),
        step('dash-circuit-rib-plate', 'enter'),
        step('dash-circuit-song-plate', 'enter'),
      ],
    },
    predicate: WORLD_ALWAYS,
    rewardCommands: [
      { kind: 'unlock-ability', abilityId: stableId<'ability'>('wayfinder-dash') },
      { kind: 'set-fact', factId: stableId<'quest-flag'>('wayfinder-dash-awakened') },
    ],
  },
  {
    puzzleId: stableId<'puzzle'>('vestibule-index-seal'),
    displayName: 'Index Seal',
    description: 'The copper index lock waits for its missing tooth.',
    roomId: stableId<'room'>('rootglass-vestibule'),
    program: {
      kind: 'item-lock',
      step: step('vestibule-index-lock', 'interact'),
      itemId: stableId<'item'>('rootglass-index-key'),
      quantity: 1,
    },
    predicate: requires({
      requiresItems: [{ itemId: stableId<'item'>('rootglass-index-key'), quantity: 1 }],
    }),
    rewardCommands: [
      { kind: 'consume-item', itemId: stableId<'item'>('rootglass-index-key'), quantity: 1 },
    ],
  },
  {
    puzzleId: stableId<'puzzle'>('reliquary-forge-awakening'),
    displayName: 'Rootglass Forge',
    description: 'The awakened anvil answers a reforged Surveyor Edge.',
    roomId: stableId<'room'>('rootglass-vestibule'),
    program: {
      kind: 'single',
      step: step('reliquary-forge-anvil', 'interact'),
      requiredWeaponLevel: 1,
    },
    predicate: requires({
      requiresFacts: [stableId<'quest-flag'>('surveyor-edge-reforged')],
      requiresSolvedPuzzles: [stableId<'puzzle'>('vestibule-index-seal')],
    }),
    rewardCommands: [
      { kind: 'unlock-ability', abilityId: stableId<'ability'>('resonant-pulse') },
      { kind: 'set-fact', factId: stableId<'quest-flag'>('resonant-pulse-awakened') },
      { kind: 'upgrade-weapon', fromLevel: 1, toLevel: 2 },
      { kind: 'set-fact', factId: stableId<'quest-flag'>('rootglass-edge-forged') },
    ],
  },
  {
    puzzleId: stableId<'puzzle'>('east-lens-alignment'),
    displayName: 'Threefold Lens',
    description: 'Turn root, rain, then bloom to align the eastern lens.',
    roomId: stableId<'room'>('east-lens-vault'),
    program: {
      kind: 'ordered',
      steps: [
        step('east-lens-root-dial', 'interact'),
        step('east-lens-rain-dial', 'interact'),
        step('east-lens-bloom-dial', 'interact'),
      ],
    },
    predicate: requires({
      requiresFacts: [stableId<'quest-flag'>('resonant-pulse-awakened')],
    }),
    rewardCommands: [],
  },
  {
    puzzleId: stableId<'puzzle'>('gallery-choir-seal'),
    displayName: 'Choir Seal',
    description: 'Memory, breath, and song must answer in their ancient order.',
    roomId: stableId<'room'>('resonance-gallery'),
    program: {
      kind: 'ordered',
      steps: [
        step('gallery-memory-lens', 'resonant-pulse'),
        step('gallery-breath-lens', 'resonant-pulse'),
        step('gallery-song-lens', 'interact'),
      ],
    },
    predicate: requires({
      requiresAbilities: [stableId<'ability'>('resonant-pulse')],
      requiresFacts: [stableId<'quest-flag'>('resonant-pulse-awakened')],
    }),
    rewardCommands: [],
  },
]);

function step(mechanismId: string, activation: 'enter' | 'interact' | 'resonant-pulse') {
  return { mechanismId: stableId<'mechanism'>(mechanismId), activation } as const;
}
