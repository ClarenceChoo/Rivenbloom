export const SceneKeys = Object.freeze({
  Boot: 'boot',
  Preload: 'preload',
  Title: 'title',
  Transition: 'transition',
  World: 'world',
  Dialogue: 'dialogue',
  UI: 'ui',
  Menu: 'menu',
} as const);

export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];
