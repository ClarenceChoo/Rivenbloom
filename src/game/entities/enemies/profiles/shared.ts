export const ENEMY_HURT_MS = 180;
export const ENEMY_STAGGER_MS = 650;
export const ENEMY_SUSPECT_MS = 500;
export const ENEMY_LOST_SIGHT_MS = 750;
export const ENEMY_CAMERA_SLEEP_MARGIN = 192;

export const COMMON_AWARENESS_TIMING = Object.freeze({
  suspectMs: ENEMY_SUSPECT_MS,
  lostSightMs: ENEMY_LOST_SIGHT_MS,
  cameraSleepMargin: ENEMY_CAMERA_SLEEP_MARGIN,
});
