import type { PlayerCombatRuntimeSnapshot } from '../entities/player/PlayerCombatRuntime';
import { ATTACKS } from '../data/attacks';
import type { Rect, Vec2 } from '../data/types';
import type { ProjectileSnapshot } from '../combat/ProjectileSystem';
import type { PallidCantorSnapshot } from '../entities/bosses/PallidCantorController';
import type { WorldCombatEnemySnapshot } from '../world/WorldCombatRuntime';

// Includes 8 player bolts, 16 boss notes, 12 ordnance and all authored attack regions.
export const THREAT_CAPACITY = 128;

export type CombatVisual = Readonly<{
  key: string;
  kind: 'bolt' | 'sigil' | 'slash';
  x: number;
  y: number;
  width: number;
  height: number;
  phase: 'warning' | 'active';
  friendly: boolean;
}>;
type WorldVisualInput = Readonly<{
  enemies: readonly WorldCombatEnemySnapshot[];
  ordnance: readonly Readonly<{ instanceId: number; bounds: Rect; armed: boolean }>[];
  boss: PallidCantorSnapshot | null;
}>;

export function projectCombatVisuals(
  projectiles: readonly ProjectileSnapshot[],
  world: WorldVisualInput | null,
  player?: Readonly<{
    position: Vec2;
    facing: 'left' | 'right';
    combat: PlayerCombatRuntimeSnapshot;
  }>,
): readonly CombatVisual[] {
  const visuals: CombatVisual[] = projectiles.map((p) =>
    bolt(`player:${p.instanceId}`, p.position, true),
  );
  if (player?.combat.aegisActive) {
    visuals.push({
      key: 'player:aegis',
      kind: 'sigil',
      x: player.position.x,
      y: player.position.y - 48,
      width: 100,
      height: 116,
      phase: 'active',
      friendly: true,
    });
  }
  if (player?.combat.activeAttackId !== null && player?.combat.attackPhase === 'active') {
    const attack = ATTACKS.find((attack) => attack.attackId === player.combat.activeAttackId);
    for (const hitbox of attack?.hitboxes ?? []) {
      const frame = player.combat.attackFrame ?? -1;
      if (frame < hitbox.fromFrame || frame > hitbox.toFrame) continue;
      visuals.push({
        ...region(
          `player-slash:${hitbox.hitboxId}`,
          place(hitbox.bounds, player.position, player.facing),
          'active',
        ),
        kind: 'slash',
        friendly: true,
      });
    }
  }
  if (world === null) return visuals;
  for (const p of world.ordnance)
    visuals.push(region(`ordnance:${p.instanceId}`, p.bounds, p.armed ? 'active' : 'warning'));
  for (const enemy of world.enemies) {
    if (enemy.activeAttackId === null || !['telegraph', 'active'].includes(enemy.attackPhase ?? ''))
      continue;
    const attack = ATTACKS.find((a) => a.attackId === enemy.activeAttackId);
    for (const hitbox of attack?.hitboxes ?? []) {
      visuals.push(
        region(
          `${enemy.combatantId}:${hitbox.hitboxId}`,
          place(hitbox.bounds, enemy.position, enemy.facing),
          enemy.attackPhase === 'telegraph' ? 'warning' : 'active',
        ),
      );
    }
  }
  const boss = world.boss;
  if (boss !== null && !boss.disposed && boss.state !== 'defeat') {
    for (const p of boss.projectiles) visuals.push(bolt(`boss:${p.instanceId}`, p.position, false));
    for (const [i, bounds] of (boss.presentationBounds ?? []).entries()) {
      visuals.push(
        region(`boss-zone:${i}`, bounds, boss.attackPhase === 'telegraph' ? 'warning' : 'active'),
      );
    }
  }
  return visuals;
}

function bolt(key: string, position: Vec2, friendly: boolean): CombatVisual {
  return { key, kind: 'bolt', ...position, width: 64, height: 44, phase: 'active', friendly };
}
function region(key: string, bounds: Rect, phase: CombatVisual['phase']): CombatVisual {
  return {
    key,
    kind: 'sigil',
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
    width: bounds.width,
    height: bounds.height,
    phase,
    friendly: false,
  };
}
function place(b: Rect, p: Vec2, facing: 'left' | 'right'): Rect {
  return { ...b, x: p.x + (facing === 'right' ? b.x : -b.x - b.width), y: p.y + b.y };
}
