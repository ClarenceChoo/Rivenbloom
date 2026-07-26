import { abilityDefinitions } from './abilities';
import { actorDefinitions } from './actors';
import { ambienceProfiles, areaDefinitions } from './areas';
import { attackDefinitions } from './attacks';
import { bossMechanismDefinitions } from './bossMechanisms';
import { dialogueDefinitions } from './dialogue';
import { itemDefinitions } from './items';
import { questDefinitions } from './quests';
import type { ContentRegistry } from './types';

export const contentRegistry: ContentRegistry = {
  areas: areaDefinitions,
  actors: actorDefinitions,
  bossMechanisms: bossMechanismDefinitions,
  attacks: attackDefinitions,
  abilities: abilityDefinitions,
  items: itemDefinitions,
  quests: questDefinitions,
  dialogues: dialogueDefinitions,
  ambienceProfiles
};
