import Phaser from 'phaser';
import { EffectPool } from './EffectPool';
import type { EffectLease } from './EffectPool';
import type { CombatVisual } from './CombatPresentation';
import type { SaveSettings } from '../saves/SaveSchema';
import type { Vec2 } from '../data/types';
import { stableId } from '../core/StableId';
import { combatFeedback } from './CombatFeedback';
import { THREAT_CAPACITY } from './CombatPresentation';

export class CombatPresentationView {
  private readonly images: Phaser.GameObjects.Image[] = [];
  private readonly leases = new Map<string, EffectLease<Phaser.GameObjects.Image>>();
  private readonly pool: EffectPool<Phaser.GameObjects.Image>;
  private readonly impacts: { lease: EffectLease<Phaser.GameObjects.Image>; until: number }[] = [];
  private readonly impactPool: EffectPool<Phaser.GameObjects.Image>;
  private readonly decorations: {
    lease: EffectLease<Phaser.GameObjects.Image>;
    until: number;
    born: number;
    x: number;
    y: number;
    drift: boolean;
  }[] = [];
  private readonly decorationPool: EffectPool<Phaser.GameObjects.Image>;
  private lastTrailAt = 0;
  private readonly labels: Phaser.GameObjects.DOMElement[] = [];
  private readonly labelPool: EffectPool<Phaser.GameObjects.DOMElement>;
  private readonly activeLabels: {
    lease: EffectLease<Phaser.GameObjects.DOMElement>;
    until: number;
  }[] = [];
  public constructor(private readonly scene: Phaser.Scene) {
    const create = () => {
      const image = scene.add.image(0, 0, 'effect-bolt').setDepth(110).setVisible(false);
      this.images.push(image);
      return image;
    };
    this.pool = new EffectPool(THREAT_CAPACITY, create, (image) => image.setVisible(false));
    this.impactPool = new EffectPool(32, create, (image) => image.setVisible(false));
    this.decorationPool = new EffectPool(64, create, (image) => image.setVisible(false));
    this.labelPool = new EffectPool(
      24,
      () => {
        const label = document.createElement('span');
        label.className = 'combat-damage';
        const object = scene.add.dom(0, 0, label).setDepth(120).setVisible(false);
        this.labels.push(object);
        return object;
      },
      (label) => label.setVisible(false),
    );
  }
  public sync(visuals: readonly CombatVisual[], now: number, settings?: SaveSettings): void {
    const keys = new Set(visuals.map((v) => v.key));
    for (const [key, lease] of this.leases)
      if (!keys.has(key)) {
        lease.release();
        this.leases.delete(key);
      }
    for (const visual of visuals) {
      let lease = this.leases.get(visual.key);
      if (lease === undefined) {
        lease = this.pool.acquire() ?? undefined;
        if (lease === undefined) throw new Error('Authored threat presentation capacity exceeded.');
        this.leases.set(visual.key, lease);
      }
      lease.value
        .setTexture(`effect-${visual.kind}`)
        .setPosition(visual.x, visual.y)
        .setDisplaySize(visual.width, visual.height)
        .setVisible(true)
        .setAlpha(visual.phase === 'warning' ? 0.6 : 1)
        .setTint(visual.friendly ? 0x9ee7d7 : visual.phase === 'warning' ? 0xee765f : 0xffd5ad);
    }
    if (settings !== undefined && !settings.reducedMotion && now - this.lastTrailAt >= 80) {
      this.lastTrailAt = now;
      for (const visual of visuals.filter((visual) => visual.kind === 'bolt'))
        this.decorate({ x: visual.x, y: visual.y }, 22, 22, 'effect-bolt', false, 180);
    }
    for (const entry of this.decorations) {
      const progress = Math.min(1, (now - entry.born) / (entry.until - entry.born));
      entry.lease.value.setAlpha(0.5 * (1 - progress));
      if (entry.drift && !settings?.reducedMotion)
        entry.lease.value.setPosition(entry.x, entry.y - progress * 20);
    }
    for (const entries of [this.impacts, this.activeLabels, this.decorations]) {
      for (let i = entries.length - 1; i >= 0; i -= 1)
        if (entries[i]!.until <= now) {
          entries[i]!.lease.release();
          entries.splice(i, 1);
        }
    }
  }
  public impact(position: Vec2, damage: number, settings: SaveSettings): void {
    const now = this.scene.time.now;
    const feedback = combatFeedback(
      {
        kind: 'damaging',
        class: 'ordinary',
        damage,
        particleProfileId: stableId<'particle-profile'>('blade-sedge-spark'),
        audioCueId: stableId<'audio-cue'>('blade-impact'),
      },
      settings,
    );
    for (const command of feedback.commands) {
      if (command.kind === 'shake' && command.intensity > 0)
        this.scene.cameras.main.shake(60, 0.002 * command.intensity);
      if (command.kind === 'particles') {
        for (const offset of [-22, 0, 22])
          this.decorate(
            { x: position.x + offset, y: position.y - 48 },
            16,
            16,
            'effect-impact',
            command.drift,
            250,
          );
      }
      if (command.kind === 'trail')
        this.decorate({ x: position.x, y: position.y - 48 }, 92, 48, 'effect-slash', false, 160);
    }
    const lease = this.impactPool.acquire((image) =>
      image
        .setTexture('effect-impact')
        .setPosition(position.x, position.y - 48)
        .setDisplaySize(76, 76)
        .setTint(0xffffff)
        .setAlpha(settings.flashIntensity)
        .setVisible(true),
    );
    if (lease !== null) this.impacts.push({ lease, until: now + 160 });
    if (settings.damageNumbers && damage > 0) {
      const label = this.labelPool.acquire((object) => {
        object.node.textContent = String(damage);
        object.setPosition(position.x, position.y - 105).setVisible(true);
      });
      if (label !== null) this.activeLabels.push({ lease: label, until: now + 650 });
    }
  }
  public pulse(position: Vec2, radius: number, settings: SaveSettings): void {
    this.decorate(position, radius * 2, radius * 2, 'effect-sigil', !settings.reducedMotion, 320);
  }
  private decorate(
    position: Vec2,
    width: number,
    height: number,
    texture: string,
    drift: boolean,
    duration: number,
  ): void {
    const now = this.scene.time.now;
    const lease = this.decorationPool.acquire((image) =>
      image
        .setTexture(texture)
        .setPosition(position.x, position.y)
        .setDisplaySize(width, height)
        .setAlpha(0.5)
        .setTint(0x9ee7d7)
        .setVisible(true),
    );
    if (lease !== null)
      this.decorations.push({
        lease,
        born: now,
        until: now + duration,
        x: position.x,
        y: position.y,
        drift,
      });
  }
  public clear(): void {
    for (const lease of this.leases.values()) lease.release();
    this.leases.clear();
    for (const entry of [...this.impacts, ...this.activeLabels, ...this.decorations])
      entry.lease.release();
    this.impacts.length = 0;
    this.activeLabels.length = 0;
    this.decorations.length = 0;
    this.lastTrailAt = 0;
  }
  public destroy(): void {
    this.clear();
    this.pool.dispose();
    this.impactPool.dispose();
    this.labelPool.dispose();
    this.decorationPool.dispose();
    for (const object of [...this.images, ...this.labels]) object.destroy();
  }
}
