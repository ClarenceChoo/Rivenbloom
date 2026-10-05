import { stableId } from '../core/StableId';
import { deepFreeze } from './immutability';
import type { NpcDefinition } from './types';

export const NPCS: readonly NpcDefinition[] = deepFreeze([
  {
    actorId: stableId<'actor'>('sela-quill'),
    spawnId: stableId<'actor-spawn'>('sela-at-chart-table'),
    role: 'cartographer',
    prompt: 'Speak with Sela',
    dialogueId: stableId<'dialogue'>('sela-village'),
    defaultFacing: 'left',
    shopId: null,
  },
  {
    actorId: stableId<'actor'>('orin-fen'),
    spawnId: stableId<'actor-spawn'>('orin-at-forge'),
    role: 'smith',
    prompt: 'Speak with Orin',
    dialogueId: stableId<'dialogue'>('orin-village'),
    defaultFacing: 'left',
    shopId: stableId<'shop'>('orin-forge'),
  },
  {
    actorId: stableId<'actor'>('piri-moss'),
    spawnId: stableId<'actor-spawn'>('piri-at-herb-stall'),
    role: 'herbalist',
    prompt: 'Speak with Piri',
    dialogueId: stableId<'dialogue'>('piri-village'),
    defaultFacing: 'left',
    shopId: stableId<'shop'>('piri-remedies'),
  },
]);
