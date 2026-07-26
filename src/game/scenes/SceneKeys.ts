export const SceneKeys = {
  Boot: 'boot',
  Preload: 'preload',
  Title: 'title',
  Transition: 'transition',
  World: 'world'
} as const;

export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];
