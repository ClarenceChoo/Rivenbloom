export const PLAYER_BASE_HEALTH = 100;
export const PLAYER_BASE_MANA = 50;
export const HEALTH_PER_UPGRADE = 20;
export const MANA_PER_UPGRADE = 15;
export const MAX_STAT_UPGRADES = 3;
export const MAX_WEAPON_LEVEL = 3;

export const ENEMY_XP_AWARDS: Readonly<Record<string, number>> = {
  'briar-scrapper': 14,
  duskwing: 16,
  'spore-scribe': 18,
  barkbound: 22,
  rootlurker: 20,
  'thorn-sentinel': 60,
  'pallid-cantor': 240
};

export const maxHealthFor = (healthUpgrades: number): number =>
  PLAYER_BASE_HEALTH +
  Math.max(0, Math.min(MAX_STAT_UPGRADES, healthUpgrades)) * HEALTH_PER_UPGRADE;

export const maxManaFor = (manaUpgrades: number): number =>
  PLAYER_BASE_MANA + Math.max(0, Math.min(MAX_STAT_UPGRADES, manaUpgrades)) * MANA_PER_UPGRADE;

export const experienceForDefeat = (actorId: string): number => ENEMY_XP_AWARDS[actorId] ?? 0;
