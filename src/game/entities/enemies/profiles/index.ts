import type { EnemyProfile } from '../EnemyProfile';
import { barkboundProfile } from './barkbound';
import { briarScrapperProfile } from './briarScrapper';
import { duskwingProfile } from './duskwing';
import { rootlurkerProfile } from './rootlurker';
import { sporeScribeProfile } from './sporeScribe';
import { thornSentinelProfile } from './thornSentinel';

export const enemyProfiles: readonly EnemyProfile[] = [
  briarScrapperProfile,
  duskwingProfile,
  sporeScribeProfile,
  barkboundProfile,
  rootlurkerProfile,
  thornSentinelProfile
];

export const getEnemyProfile = (profileId: string): EnemyProfile | undefined =>
  enemyProfiles.find(({ id }) => id === profileId);
