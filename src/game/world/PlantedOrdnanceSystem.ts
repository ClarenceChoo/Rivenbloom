import { freezeCombatImpact } from '../combat/CombatImpact';
import type { CombatImpact } from '../combat/CombatImpact';
import type { HurtboxTarget } from '../combat/HitboxSystem';
import { stableId } from '../core/StableId';
import type { CombatantId } from '../core/StableId';
import type { Rect } from '../data/types';
import type { EnemyOrdnanceCommand } from '../entities/enemies/EnemyController';

type PlantedOrdnance = {
  instanceId: number;
  command: EnemyOrdnanceCommand;
  contactedTargetIds: Set<CombatantId>;
};

export type PlantedOrdnanceSnapshot = Readonly<{
  instanceId: number;
  attackId: EnemyOrdnanceCommand['attackId'];
  ownerId: CombatantId;
  position: EnemyOrdnanceCommand['position'];
  bounds: Rect;
  armsAtMs: number;
  expiresAtMs: number;
  armed: boolean;
  contactedTargets: number;
}>;

export type PlantedOrdnanceImpact = Readonly<{
  instanceId: number;
  impact: CombatImpact;
}>;

export type PlantedOrdnanceStep = Readonly<{
  impacts: readonly PlantedOrdnanceImpact[];
  expiredInstanceIds: readonly number[];
}>;

export class PlantedOrdnanceSystem {
  private readonly active: PlantedOrdnance[] = [];
  private nextInstanceId = 1;
  private lastObservedMs = 0;
  private disposed = false;

  public constructor(private readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new RangeError('Planted ordnance capacity must be a positive safe integer.');
    }
  }

  public plant(command: EnemyOrdnanceCommand): number | null {
    if (this.disposed) return null;
    assertCommand(command);
    if (this.active.length >= this.capacity || this.active.length >= command.roomCap) return null;
    const instanceId = this.nextInstanceId;
    this.nextInstanceId += 1;
    if (!Number.isSafeInteger(this.nextInstanceId)) {
      throw new RangeError('Planted ordnance instance sequence exceeded its safe range.');
    }
    this.active.push({
      instanceId,
      command: freezeCommand(command),
      contactedTargetIds: new Set(),
    });
    return instanceId;
  }

  public step(nowMs: number, target: HurtboxTarget | null): PlantedOrdnanceStep {
    this.assertTime(nowMs);
    if (this.disposed)
      return Object.freeze({ impacts: Object.freeze([]), expiredInstanceIds: Object.freeze([]) });
    const impacts: PlantedOrdnanceImpact[] = [];
    const expiredInstanceIds: number[] = [];
    for (let index = this.active.length - 1; index >= 0; index -= 1) {
      const entry = this.active[index]!;
      if (nowMs >= entry.command.expiresAtMs) {
        expiredInstanceIds.push(entry.instanceId);
        this.active.splice(index, 1);
        continue;
      }
      if (
        nowMs < entry.command.armsAtMs ||
        target === null ||
        target.teamId === entry.command.teamId ||
        target.targetId === entry.command.ownerId ||
        entry.contactedTargetIds.has(target.targetId) ||
        entry.contactedTargetIds.size >= entry.command.maxHits
      ) {
        continue;
      }
      const bounds = placedBounds(entry.command);
      if (!target.hurtboxes.some((hurtbox) => overlaps(bounds, hurtbox))) continue;
      entry.contactedTargetIds.add(target.targetId);
      impacts.push(
        Object.freeze({
          instanceId: entry.instanceId,
          impact: freezeCombatImpact({
            attackId: entry.command.attackId,
            targetId: target.targetId,
            source: {
              ownerId: entry.command.ownerId,
              teamId: entry.command.teamId,
              position: entry.command.position,
              facing: entry.command.facing,
            },
            occurredAtMs: nowMs,
            delivery: entry.command.delivery,
            damage: entry.command.damage,
            knockback: {
              x:
                entry.command.facing === 'right'
                  ? entry.command.knockback.x
                  : -entry.command.knockback.x,
              y: entry.command.knockback.y,
            },
            hitStopMs: entry.command.hitStopMs,
            tags: entry.command.tags,
            projectile: {
              instanceId: entry.instanceId,
              projectileId: stableId<'projectile'>('spore-pollen-ordnance'),
            },
          }),
        }),
      );
    }
    impacts.sort((left, right) => left.instanceId - right.instanceId);
    expiredInstanceIds.sort((left, right) => left - right);
    return Object.freeze({
      impacts: Object.freeze(impacts),
      expiredInstanceIds: Object.freeze(expiredInstanceIds),
    });
  }

  public consume(instanceId: number): boolean {
    if (!Number.isSafeInteger(instanceId) || instanceId <= 0) {
      throw new RangeError('Planted ordnance instance ID must be a positive safe integer.');
    }
    const index = this.active.findIndex((entry) => entry.instanceId === instanceId);
    if (index < 0) return false;
    this.active.splice(index, 1);
    return true;
  }

  public snapshot(nowMs: number = this.lastObservedMs): readonly PlantedOrdnanceSnapshot[] {
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
      throw new RangeError('Planted ordnance snapshot time must be a non-negative safe integer.');
    }
    return Object.freeze(
      this.active
        .map((entry) =>
          Object.freeze({
            instanceId: entry.instanceId,
            attackId: entry.command.attackId,
            ownerId: entry.command.ownerId,
            position: Object.freeze({ ...entry.command.position }),
            bounds: Object.freeze(placedBounds(entry.command)),
            armsAtMs: entry.command.armsAtMs,
            expiresAtMs: entry.command.expiresAtMs,
            armed: nowMs >= entry.command.armsAtMs,
            contactedTargets: entry.contactedTargetIds.size,
          }),
        )
        .sort((left, right) => left.instanceId - right.instanceId),
    );
  }

  public clear(): boolean {
    if (this.active.length === 0) return false;
    this.active.length = 0;
    return true;
  }

  public dispose(): boolean {
    if (this.disposed) return false;
    this.clear();
    this.disposed = true;
    return true;
  }

  private assertTime(nowMs: number): void {
    if (!Number.isSafeInteger(nowMs) || nowMs < this.lastObservedMs) {
      throw new RangeError('Planted ordnance time must be a monotonic non-negative safe integer.');
    }
    this.lastObservedMs = nowMs;
  }
}

function freezeCommand(command: EnemyOrdnanceCommand): EnemyOrdnanceCommand {
  return Object.freeze({
    ...command,
    position: Object.freeze({ ...command.position }),
    damage: Object.freeze({
      ...command.damage,
      critical: Object.freeze({ ...command.damage.critical }),
    }),
    knockback: Object.freeze({ ...command.knockback }),
    tags: Object.freeze([...command.tags]),
    bounds: Object.freeze({ ...command.bounds }),
  });
}

function assertCommand(command: EnemyOrdnanceCommand): void {
  if (
    !Number.isSafeInteger(command.armsAtMs) ||
    !Number.isSafeInteger(command.expiresAtMs) ||
    command.armsAtMs < 0 ||
    command.expiresAtMs <= command.armsAtMs ||
    !Number.isSafeInteger(command.roomCap) ||
    command.roomCap <= 0 ||
    !Number.isSafeInteger(command.maxHits) ||
    command.maxHits <= 0
  ) {
    throw new RangeError('Planted ordnance command has invalid timing or capacity.');
  }
  for (const value of [
    command.position.x,
    command.position.y,
    command.bounds.x,
    command.bounds.y,
    command.bounds.width,
    command.bounds.height,
  ]) {
    if (!Number.isFinite(value)) throw new RangeError('Planted ordnance bounds must be finite.');
  }
  if (command.bounds.width <= 0 || command.bounds.height <= 0) {
    throw new RangeError('Planted ordnance bounds must be positive.');
  }
}

function placedBounds(command: EnemyOrdnanceCommand): Rect {
  return {
    x: command.position.x + command.bounds.x,
    y: command.position.y + command.bounds.y,
    width: command.bounds.width,
    height: command.bounds.height,
  };
}

function overlaps(left: Rect, right: Rect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}
