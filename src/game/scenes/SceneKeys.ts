export const SceneKeys = {
  Boot: 'boot',
  Preload: 'preload',
  Title: 'title',
  Transition: 'transition'
} as const;

export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];
