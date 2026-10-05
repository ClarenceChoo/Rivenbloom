import { abilityId, damageTypeId } from '../../src/game/core/StableId';
import type { DefenseSnapshot } from '../../src/game/combat/CombatTypes';

const frost = damageTypeId('frost');
const mistStep = abilityId('mist-step');

type MutableResistanceMap = {
  -readonly [DamageType in keyof DefenseSnapshot['resistances']]?: number;
};

const resistances: MutableResistanceMap = {};

resistances[frost] = -0.5;

// @ts-expect-error Ability IDs cannot populate a damage-type resistance map.
resistances[mistStep] = 0.5;

// @ts-expect-error Plain strings cannot populate a damage-type resistance map.
resistances['frost'] = 0.5;
