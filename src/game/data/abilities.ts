import { abilityId, stableId } from '../core/StableId';
import { deepFreeze } from './immutability';
import type { AbilityDefinition } from './types';

const authoredAbilities = [
  {
    abilityId: abilityId('lumen-bolt'),
    displayName: 'Lumen Bolt',
    manaCost: 8,
    cooldownMs: 450,
    unlockFactId: null,
    action: {
      kind: 'projectile',
      projectileId: stableId<'projectile'>('lumen-bolt-projectile'),
      attackId: stableId<'attack'>('lumen-bolt-impact'),
      speed: 720,
      lifetimeMs: 900,
      bounds: { x: 32, y: -76, width: 16, height: 16 },
    },
  },
  {
    abilityId: abilityId('wayfinder-dash'),
    displayName: 'Wayfinder Dash',
    manaCost: 0,
    cooldownMs: 600,
    unlockFactId: null,
    action: {
      kind: 'dash',
      speed: 720,
      durationMs: 160,
      invulnerableMs: 120,
      invulnerabilityStatusId: stableId<'status'>('dash-invulnerable'),
    },
  },
  {
    abilityId: abilityId('aegis-veil'),
    displayName: 'Aegis Veil',
    manaCost: 12,
    cooldownMs: 6000,
    unlockFactId: null,
    action: {
      kind: 'barrier',
      statusId: stableId<'status'>('aegis-veil'),
      durationMs: 5000,
      projectileAbsorptions: 1,
    },
  },
  {
    abilityId: abilityId('resonant-pulse'),
    displayName: 'Resonant Pulse',
    manaCost: 16,
    cooldownMs: 3500,
    unlockFactId: null,
    action: {
      kind: 'pulse',
      attackId: stableId<'attack'>('resonant-pulse-wave'),
      radius: 160,
      mechanismTag: 'rootglass-affecting',
    },
  },
] satisfies readonly AbilityDefinition[];

export const ABILITIES: readonly AbilityDefinition[] = deepFreeze(authoredAbilities);
