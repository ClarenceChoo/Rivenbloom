import type { AiProfileDefinition } from '../../../data/types';
import { BARKBOUND_PROFILE } from './BarkboundProfile';
import { BRIAR_SCRAPPER_PROFILE } from './BriarScrapperProfile';
import { DUSKWING_PROFILE } from './DuskwingProfile';
import { ROOTLURKER_PROFILE } from './RootlurkerProfile';
import { SPORE_SCRIBE_PROFILE } from './SporeScribeProfile';
import { THORN_SENTINEL_PROFILE } from './ThornSentinelProfile';

export {
  BARKBOUND_PROFILE,
  BRIAR_SCRAPPER_PROFILE,
  DUSKWING_PROFILE,
  ROOTLURKER_PROFILE,
  SPORE_SCRIBE_PROFILE,
  THORN_SENTINEL_PROFILE,
};

export const ENEMY_PROFILES = Object.freeze([
  BRIAR_SCRAPPER_PROFILE,
  DUSKWING_PROFILE,
  SPORE_SCRIBE_PROFILE,
  BARKBOUND_PROFILE,
  ROOTLURKER_PROFILE,
  THORN_SENTINEL_PROFILE,
]) satisfies readonly AiProfileDefinition[];
