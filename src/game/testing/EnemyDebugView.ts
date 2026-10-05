import Phaser from 'phaser';

import type { WorldCombatRuntimeSnapshot } from '../world/WorldCombatRuntime';

export class EnemyDebugView {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private disposed = false;

  public constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(20);
  }

  public sync(snapshot: WorldCombatRuntimeSnapshot): void {
    if (this.disposed) return;
    this.graphics.clear();
    for (const enemy of snapshot.enemies) {
      if (enemy.hidden && enemy.state === 'sleep') continue;
      const bodyWidth = enemy.actorId === 'spore-scribe' ? 56 : 52;
      const bodyHeight = enemy.actorId === 'spore-scribe' ? 96 : 88;
      const colour = enemy.state === 'dead' ? 0x5f6470 : 0x8d4f63;
      this.graphics.fillStyle(colour, enemy.state === 'dead' ? 0.45 : 0.9);
      this.graphics.fillRoundedRect(
        enemy.position.x - bodyWidth / 2,
        enemy.position.y - bodyHeight,
        bodyWidth,
        bodyHeight,
        10,
      );
      const healthRatio = enemy.maxHealth === 0 ? 0 : enemy.health / enemy.maxHealth;
      this.graphics.fillStyle(0x17151e, 0.9);
      this.graphics.fillRect(enemy.position.x - 30, enemy.position.y - bodyHeight - 14, 60, 5);
      this.graphics.fillStyle(0xb9cf75, 1);
      this.graphics.fillRect(
        enemy.position.x - 30,
        enemy.position.y - bodyHeight - 14,
        60 * healthRatio,
        5,
      );
      if (enemy.attackPhase === 'telegraph') {
        this.graphics.lineStyle(3, 0xe2b86b, 0.95);
        this.graphics.strokeCircle(enemy.position.x, enemy.position.y - bodyHeight / 2, 44);
      }
      if (enemy.attackPhase === 'active') {
        this.graphics.lineStyle(3, 0xe96b66, 0.95);
        const direction = enemy.facing === 'right' ? 1 : -1;
        this.graphics.lineBetween(
          enemy.position.x,
          enemy.position.y - 48,
          enemy.position.x + 90 * direction,
          enemy.position.y - 48,
        );
      }
    }
    for (const ordnance of snapshot.ordnance) {
      this.graphics.fillStyle(ordnance.armed ? 0xd8cf73 : 0x716a8a, 0.75);
      this.graphics.fillCircle(
        ordnance.bounds.x + ordnance.bounds.width / 2,
        ordnance.bounds.y + ordnance.bounds.height / 2,
        ordnance.bounds.width / 2,
      );
    }
  }

  public destroy(): boolean {
    if (this.disposed) return false;
    this.disposed = true;
    this.graphics.destroy();
    return true;
  }
}
