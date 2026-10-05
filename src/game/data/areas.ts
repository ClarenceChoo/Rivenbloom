import { isStableId, stableId } from '../core/StableId';
import type { AreaId } from '../saves/SaveSchema';
import { ABILITIES } from './abilities';
import { ACTORS, AI_PROFILES, ANIMATION_SETS, AUDIO_SETS, DROP_TABLES } from './actors';
import { ATTACKS } from './attacks';
import { PALLID_CANTOR_ENCOUNTER } from './bosses/pallidCantor';
import {
  BRACKENREACH_AREA,
  HOLLOW_CHOIR_AREA,
  ROOTGLASS_RELIQUARY_AREA,
  SINGING_HOLLOWS_AREA,
  WRENS_REST_AREA,
  PUZZLES,
} from './areas/index';
import { DIALOGUE } from './dialogue';
import { ITEMS } from './items';
import { NPCS } from './npcs';
import { SHOP_OFFERS } from './shops';
import { deepFreeze } from './immutability';
import { QUESTS } from './quests';
import type {
  AmbienceDefinition,
  BackgroundSetDefinition,
  ContentRegistry,
  MusicCueDefinition,
} from './types';

export {
  BRACKENREACH_AREA,
  HOLLOW_CHOIR_AREA,
  ROOTGLASS_RELIQUARY_AREA,
  SINGING_HOLLOWS_AREA,
  WRENS_REST_AREA,
  PUZZLES,
};

export const AREA_DISPLAY_NAMES: Readonly<Record<string, string>> = Object.freeze({
  'wren-rest': "Wren's Rest",
  brackenreach: 'Brackenreach',
  'singing-hollows': 'Singing Hollows',
  'rootglass-reliquary': 'Rootglass Reliquary',
  'hollow-choir': 'Hollow Choir',
});

const BACKGROUND_SETS = Object.freeze([]) satisfies readonly BackgroundSetDefinition[];
const AMBIENCE_PROFILES = Object.freeze([]) satisfies readonly AmbienceDefinition[];
const MUSIC_CUES = Object.freeze([]) satisfies readonly MusicCueDefinition[];

export const CONTENT_REGISTRY: ContentRegistry = deepFreeze({
  assetKeys: [
    stableId<'asset'>('rivenbloom-character-lineup'),
    stableId<'asset'>('rivenbloom-mara-animation-sheet'),
    stableId<'asset'>('rivenbloom-ui-atlas'),
    stableId<'asset'>('rivenbloom-world-panorama'),
    stableId<'asset'>('rivenbloom-world-atlas'),
  ],
  backgroundSets: BACKGROUND_SETS,
  ambienceProfiles: AMBIENCE_PROFILES,
  musicCues: MUSIC_CUES,
  animationSets: ANIMATION_SETS,
  audioSets: AUDIO_SETS,
  aiProfiles: AI_PROFILES,
  dropTables: DROP_TABLES,
  bossEncounters: [PALLID_CANTOR_ENCOUNTER],
  areas: [
    WRENS_REST_AREA,
    BRACKENREACH_AREA,
    SINGING_HOLLOWS_AREA,
    ROOTGLASS_RELIQUARY_AREA,
    HOLLOW_CHOIR_AREA,
  ],
  puzzles: PUZZLES,
  actors: ACTORS,
  attacks: ATTACKS,
  abilities: ABILITIES,
  items: ITEMS,
  quests: QUESTS,
  dialogue: DIALOGUE,
  npcs: NPCS,
  shopOffers: SHOP_OFFERS,
  newGame: {
    initialRegionId: stableId<'region'>('brackenreach'),
    initialAreaId: stableId<'area'>('wren-rest'),
    initialCheckpointId: stableId<'checkpoint'>('village-well'),
    baseStats: { maxHealth: 100, maxMana: 40, attackPower: 12, armour: 3 },
    initialQuests: {
      stages: [
        {
          questId: stableId<'quest'>('lanterns-for-the-absent'),
          stageId: stableId<'quest-stage'>('unlit'),
        },
        { questId: stableId<'quest'>('lost-folio'), stageId: stableId<'quest-stage'>('missing') },
        {
          questId: stableId<'quest'>('the-silent-bloom'),
          stageId: stableId<'quest-stage'>('unheard'),
        },
      ],
      flags: [],
    },
    startingAbilities: [stableId<'ability'>('lumen-bolt')],
  },
});

const LOADABLE_AREA_IDS: ReadonlySet<string> = new Set(
  CONTENT_REGISTRY.areas.map(({ areaId }) => areaId),
);

export function isAreaLoadable(areaId: string): areaId is AreaId {
  return isStableId(areaId) && LOADABLE_AREA_IDS.has(areaId);
}
