import type { PointDefinition, RectDefinition, TriggerDefinition } from '../data/types';

const contains = (bounds: RectDefinition, point: PointDefinition): boolean =>
  point.x >= bounds.x &&
  point.x <= bounds.x + bounds.width &&
  point.y >= bounds.y &&
  point.y <= bounds.y + bounds.height;

export class TriggerSystem {
  private readonly firedOnce: Set<string>;
  private readonly inside = new Set<string>();

  public constructor(
    private readonly triggers: readonly TriggerDefinition[],
    firedOnceIds: readonly string[] = []
  ) {
    this.firedOnce = new Set(firedOnceIds);
  }

  public get firedOnceIds(): readonly string[] {
    return [...this.firedOnce].sort();
  }

  /**
   * Fires automatic triggers on boundary entry only; interaction triggers are
   * excluded and require an explicit interact() press.
   */
  public advance(position: PointDefinition): readonly TriggerDefinition[] {
    const fired: TriggerDefinition[] = [];
    for (const trigger of this.triggers) {
      const within = contains(trigger.bounds, position);
      const wasInside = this.inside.has(trigger.id);
      if (!within) {
        if (wasInside) this.inside.delete(trigger.id);
        continue;
      }
      if (wasInside) continue;
      this.inside.add(trigger.id);
      if (trigger.kind === 'interaction') continue;
      if (!this.tryFire(trigger)) continue;
      fired.push(trigger);
    }
    return fired;
  }

  public interact(position: PointDefinition): TriggerDefinition | undefined {
    for (const trigger of this.triggers) {
      if (trigger.kind !== 'interaction') continue;
      if (!contains(trigger.bounds, position)) continue;
      if (!this.tryFire(trigger)) continue;
      return trigger;
    }
    return undefined;
  }

  private tryFire(trigger: TriggerDefinition): boolean {
    if (trigger.once && this.firedOnce.has(trigger.id)) return false;
    if (trigger.once) this.firedOnce.add(trigger.id);
    return true;
  }
}
