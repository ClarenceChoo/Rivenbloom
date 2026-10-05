import { expect, it } from 'vitest';
import { objectPresentation } from '../../src/game/world/WorldObjectPresentation';
it('changes chest silhouette, removes broken barriers, and opens solved mechanisms', () => {
  expect(objectPresentation('chest', true)).toMatchObject({ frame: 8, visible: true });
  expect(objectPresentation('chest', false)).toMatchObject({ frame: 7 });
  expect(objectPresentation('breakable', true)).toMatchObject({ visible: false });
  expect(objectPresentation('mechanism', true)).toMatchObject({ frame: 17, rotation: Math.PI / 4 });
  expect(objectPresentation('gate', true)).toMatchObject({ visible: false });
});
