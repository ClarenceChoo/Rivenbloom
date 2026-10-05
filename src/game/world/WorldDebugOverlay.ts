import Phaser from 'phaser';

import type { LoadedArea } from './AreaLoader';

export function createWorldDebugOverlay(scene: Phaser.Scene, area: LoadedArea): () => void {
  const graphics = scene.add.graphics().setDepth(10_000);
  graphics.lineStyle(2, 0x9ee7d7, 0.9);
  area.definition.rooms.forEach(({ bounds }) =>
    graphics.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height),
  );
  graphics.lineStyle(2, 0xf5c96a, 0.9);
  area.definition.surfaces.forEach(({ bounds }) =>
    graphics.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height),
  );
  graphics.lineStyle(2, 0xb96f45, 0.9);
  area.definition.triggers.forEach(({ bounds }) =>
    graphics.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height),
  );
  graphics.lineStyle(2, 0xee765f, 0.9);
  area.definition.checkpoints.forEach(({ safeZone, canonicalPosition }) => {
    graphics.strokeRect(safeZone.x, safeZone.y, safeZone.width, safeZone.height);
    graphics.strokeCircle(canonicalPosition.x, canonicalPosition.y, 8);
  });
  graphics.lineStyle(2, 0xd8a7e8, 0.9);
  area.definition.actorSpawns.forEach(({ position }) =>
    graphics.strokeCircle(position.x, position.y, 7),
  );
  return () => graphics.destroy();
}
