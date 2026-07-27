import Phaser from 'phaser';
import type { AccessibilitySettingsState } from '../config/accessibility';
import type { GameEvents } from '../core/GameEvents';
import { attackDefinitions } from '../data/attacks';
import type { ProjectileSnapshot } from '../abilities/AbilitySystem';
import type {
  ActorDefinition,
  ActorSpawnDefinition,
  AttackDefinition,
  PointDefinition,
  RectDefinition
} from '../data/types';
import { EffectPool } from '../effects/EffectPool';
import { combatFeedbackFor, impactLeafShapes } from '../effects/ParticleProfiles';
import type { EncounterDirector } from '../ai/EncounterDirector';
import type { EnemyController } from '../entities/enemies/EnemyController';
import type { PlayerCombatDirective, PlayerCombatState } from './PlayerCombat';
import type { PlayerProjectileIntercept } from './PlayerCombat';
import { damageTypeId } from './CombatTypes';
import {
  CombatTimeline,
  createProjectileAttackDefinition,
  type ProjectileAttackDefinition
} from './CombatTimeline';
import { HitboxSystem } from './HitboxSystem';
import type { Facing } from '../physics/MovementModel';
import {
  CombatAbilityRuntime,
  type CombatRuntimeOutput,
  type CombatRuntimeTarget
} from './CombatAbilityRuntime';

const FIXED_FRAME_MS = 1_000 / 60;
const MAX_FRAME_MS = 50;
const AMBER = 0xf5c96a;
const CREAM = 0xf0e3c0;
const MINT = 0x9ee7d7;

type SlashSpec = {
  readonly position: PointDefinition;
  readonly facing: Facing;
  readonly stage: number;
};

type ImpactSpec = {
  readonly position: PointDefinition;
  readonly flashAlpha: number;
  readonly particleCount: number;
};

type DamageLabelSpec = {
  readonly position: PointDefinition;
  readonly amount: number;
};

type AbilityVisualSpec = {
  readonly position: PointDefinition;
  readonly kind: 'barrier' | 'pulse';
};

type TimedGraphics = {
  readonly member: Phaser.GameObjects.Graphics;
  remainingFrames: number;
  readonly pool:
    | EffectPool<SlashSpec, Phaser.GameObjects.Graphics>
    | EffectPool<ImpactSpec, Phaser.GameObjects.Graphics>
    | EffectPool<AbilityVisualSpec, Phaser.GameObjects.Graphics>;
  readonly rotationPerFrame?: number;
};

type TimedLabel = {
  readonly member: Phaser.GameObjects.Text;
  remainingFrames: number;
};

export type EnemyRuntimeEntry = {
  readonly spawn: ActorSpawnDefinition;
  readonly actor: ActorDefinition;
  readonly controller: EnemyController;
};

export type PlayerHitOutcome = {
  readonly healthDamage: number;
  readonly blocked: boolean;
  readonly parried: boolean;
  readonly invulnerable: boolean;
  readonly knockback: number;
};

/** Scene-owned hooks the combat runtime needs from the world. */
export type CombatWorldPort = {
  readonly obstacles: readonly RectDefinition[];
  readonly cameraBounds: () => RectDefinition;
  readonly floorAhead: (position: PointDefinition) => { left: boolean; right: boolean };
  readonly receivePlayerHit: (
    damage: AttackDefinition['damage'],
    travelDirection: Facing
  ) => PlayerHitOutcome;
  readonly onEnemyDefeated: (
    entry: EnemyRuntimeEntry,
    drops: readonly { readonly itemId: string; readonly quantity: number }[]
  ) => void;
  readonly rollDrops: (count: number) => readonly number[];
};

export type CombatSceneSnapshot = {
  readonly targetHealth: number;
  readonly targetState: string;
  readonly targetPosition: PointDefinition;
  readonly activeProjectileCount: number;
  readonly lastAttackId: string | undefined;
  readonly lastAbilityId: string | undefined;
  readonly targetStatusIds: readonly string[];
  readonly lastMechanismRequestId: string | undefined;
  readonly enemiesRemaining: number;
  readonly lastDefeatedActorId: string | undefined;
};

export type CombatPlayerRuntimePort = {
  readonly interceptProjectile: (projectile: ProjectileSnapshot) => PlayerProjectileIntercept;
};

const drawSlashRibbon = (graphics: Phaser.GameObjects.Graphics): void => {
  graphics
    .clear()
    .fillStyle(AMBER, 0.8)
    .fillPoints(
      [
        { x: -52, y: 8 },
        { x: -28, y: -15 },
        { x: 6, y: -34 },
        { x: 62, y: -10 },
        { x: 13, y: -21 },
        { x: -23, y: -4 }
      ],
      true
    )
    .lineStyle(2, CREAM, 0.9)
    .lineBetween(-42, 3, 50, -11);
};

const drawImpactLeaves = (graphics: Phaser.GameObjects.Graphics, particleCount: number): void => {
  graphics.clear();
  for (const shape of impactLeafShapes(particleCount)) {
    graphics.fillStyle(shape.colour, shape.alpha).fillPoints([...shape.points], true);
  }
};

const drawLumenLeaf = (graphics: Phaser.GameObjects.Graphics): void => {
  graphics
    .clear()
    .fillStyle(MINT, 0.9)
    .fillPoints(
      [
        { x: -18, y: 2 },
        { x: -8, y: -4 },
        { x: 3, y: -9 },
        { x: 21, y: 0 },
        { x: 2, y: 8 },
        { x: -9, y: 6 }
      ],
      true
    )
    .lineStyle(2, CREAM, 0.85)
    .lineBetween(-11, 0, 15, 0);
};

const drawBotanicalGlyph = (graphics: Phaser.GameObjects.Graphics): void => {
  graphics.clear().fillStyle(MINT, 0.32).lineStyle(2, CREAM, 0.8);
  const leaves: { readonly x: number; readonly y: number }[][] = [
    [
      { x: 0, y: -32 },
      { x: 10, y: -16 },
      { x: 0, y: -5 },
      { x: -10, y: -16 }
    ],
    [
      { x: 30, y: -10 },
      { x: 17, y: 1 },
      { x: 5, y: -5 },
      { x: 18, y: -17 }
    ],
    [
      { x: 18, y: 27 },
      { x: 0, y: 17 },
      { x: 2, y: 4 },
      { x: 20, y: 12 }
    ],
    [
      { x: -18, y: 27 },
      { x: -20, y: 12 },
      { x: -2, y: 4 },
      { x: 0, y: 17 }
    ],
    [
      { x: -30, y: -10 },
      { x: -18, y: -17 },
      { x: -5, y: -5 },
      { x: -17, y: 1 }
    ]
  ];
  for (const leaf of leaves) graphics.fillPoints(leaf, true).strokePoints(leaf, true);
};

type EnemyVisual = {
  readonly entry: EnemyRuntimeEntry;
  readonly image: Phaser.GameObjects.Image;
  readonly flashImage: Phaser.GameObjects.Image;
  flashFrames: number;
  defeated: boolean;
};

export class CombatSceneAdapter {
  private readonly hitboxes: HitboxSystem;
  private readonly timeline: CombatTimeline;
  private readonly abilityRuntime: CombatAbilityRuntime;
  private readonly enemies = new Map<string, EnemyVisual>();
  private readonly primaryTargetId: string | undefined;
  private readonly slashPool: EffectPool<SlashSpec, Phaser.GameObjects.Graphics>;
  private readonly impactPool: EffectPool<ImpactSpec, Phaser.GameObjects.Graphics>;
  private readonly projectilePool: EffectPool<PointDefinition, Phaser.GameObjects.Graphics>;
  private readonly abilityPool: EffectPool<AbilityVisualSpec, Phaser.GameObjects.Graphics>;
  private readonly labelPool: EffectPool<DamageLabelSpec, Phaser.GameObjects.Text>;
  private readonly ownedObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly activeProjectiles = new Map<string, Phaser.GameObjects.Graphics>();
  private readonly timedGraphics: TimedGraphics[] = [];
  private readonly timedLabels: TimedLabel[] = [];
  private frameRemainderMs = 0;
  private hitStopRemainingMs = 0;
  private shakeOffset = { x: 0, y: 0 };
  private shakeFrames = 0;
  private lastAttackId: string | undefined;
  private lastAbilityId: string | undefined;
  private lastMechanismRequestId: string | undefined;
  private lastDefeatedActorId: string | undefined;
  private lastPlayerPosition: PointDefinition;
  private playerNoiseLevel = 0;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: ActorDefinition,
    playerPosition: PointDefinition,
    entries: readonly EnemyRuntimeEntry[],
    runtimeTargets: readonly CombatRuntimeTarget[],
    private readonly playerRuntime: CombatPlayerRuntimePort,
    private readonly settings: AccessibilitySettingsState,
    private readonly events: GameEvents,
    private readonly director: EncounterDirector,
    private readonly world: CombatWorldPort
  ) {
    this.lastPlayerPosition = { ...playerPosition };
    this.hitboxes = new HitboxSystem([
      {
        id: player.id,
        team: 'player',
        position: playerPosition,
        hurtboxes: player.hurtboxes,
        renderMetrics: player.render.size
      },
      ...entries.map((entry) => ({
        id: entry.spawn.id,
        team: 'enemy' as const,
        position: entry.spawn.position,
        hurtboxes: entry.actor.hurtboxes,
        renderMetrics: entry.actor.render.size
      }))
    ]);
    this.timeline = new CombatTimeline(this.hitboxes);
    this.abilityRuntime = new CombatAbilityRuntime(runtimeTargets);
    for (const entry of entries) {
      this.enemies.set(entry.spawn.id, this.createEnemyVisual(entry));
    }
    this.primaryTargetId =
      entries.find(({ spawn }) => spawn.id === 'arch-briar-scrapper')?.spawn.id ??
      entries[0]?.spawn.id;
    this.slashPool = new EffectPool({
      capacity: 6,
      create: () => {
        const graphics = scene.add.graphics().setDepth(14).setVisible(false);
        drawSlashRibbon(graphics);
        this.ownedObjects.push(graphics);
        return graphics;
      },
      activate: (graphics, spec) => {
        graphics
          .setPosition(spec.position.x + (spec.facing === 'right' ? 52 : -52), spec.position.y - 62)
          .setScale(spec.facing === 'right' ? 1 : -1, 0.82 + spec.stage * 0.08)
          .setAlpha(0.9)
          .setVisible(true);
      },
      deactivate: (graphics) => graphics.setVisible(false)
    });
    this.impactPool = new EffectPool({
      capacity: 10,
      create: () => {
        const graphics = scene.add.graphics().setDepth(16).setVisible(false);
        this.ownedObjects.push(graphics);
        return graphics;
      },
      activate: (graphics, spec) => {
        drawImpactLeaves(graphics, spec.particleCount);
        graphics
          .setPosition(spec.position.x, spec.position.y)
          .setAlpha(Math.max(0.35, spec.flashAlpha))
          .setVisible(true);
      },
      deactivate: (graphics) => graphics.setVisible(false)
    });
    this.projectilePool = new EffectPool({
      capacity: 8,
      create: () => {
        const graphics = scene.add.graphics().setDepth(15).setVisible(false);
        drawLumenLeaf(graphics);
        this.ownedObjects.push(graphics);
        return graphics;
      },
      activate: (graphics, position) =>
        graphics.setPosition(position.x, position.y).setVisible(true).setAlpha(1),
      deactivate: (graphics) => graphics.setVisible(false)
    });
    this.abilityPool = new EffectPool({
      capacity: 4,
      create: () => {
        const graphics = scene.add.graphics().setDepth(15).setVisible(false);
        drawBotanicalGlyph(graphics);
        this.ownedObjects.push(graphics);
        return graphics;
      },
      activate: (graphics, spec) =>
        graphics
          .setPosition(spec.position.x, spec.position.y - 54)
          .setScale(spec.kind === 'barrier' ? 1.45 : 3.2)
          .setRotation(0)
          .setAlpha(spec.kind === 'barrier' ? 0.78 : 0.62)
          .setVisible(true),
      deactivate: (graphics) => graphics.setVisible(false)
    });
    this.labelPool = new EffectPool({
      capacity: 8,
      create: () => {
        const label = scene.add
          .text(0, 0, '', {
            color: '#f0e3c0',
            fontFamily: 'Georgia, serif',
            fontSize: '20px',
            fontStyle: 'bold',
            stroke: '#171325',
            strokeThickness: 4
          })
          .setOrigin(0.5)
          .setDepth(18)
          .setVisible(false);
        this.ownedObjects.push(label);
        return label;
      },
      activate: (label, spec) =>
        label
          .setPosition(spec.position.x, spec.position.y)
          .setText(String(spec.amount))
          .setAlpha(1)
          .setVisible(true),
      deactivate: (label) => label.setVisible(false)
    });
  }

  private createEnemyVisual(entry: EnemyRuntimeEntry): EnemyVisual {
    const { actor, spawn } = entry;
    const texture = this.scene.textures.get(actor.render.assetKey);
    const frameName = `${actor.id}-idle`;
    if (!texture.has(frameName)) {
      const source = actor.render.source ?? {
        x: 0,
        y: 0,
        width: texture.getSourceImage().width,
        height: texture.getSourceImage().height
      };
      texture.add(frameName, 0, source.x, source.y, source.width, source.height);
    }
    const image = this.scene.add
      .image(spawn.position.x, spawn.position.y, actor.render.assetKey, frameName)
      .setOrigin(actor.render.origin.x, actor.render.origin.y)
      .setDisplaySize(actor.render.size.width, actor.render.size.height)
      .setFlipX(spawn.facing === 'right')
      .setDepth(actor.render.depth)
      .setData('actorId', actor.id)
      .setData('actorState', 'sleep');
    this.ownedObjects.push(image);
    const flashImage = this.scene.add
      .image(spawn.position.x, spawn.position.y, actor.render.assetKey, frameName)
      .setOrigin(actor.render.origin.x, actor.render.origin.y)
      .setDisplaySize(actor.render.size.width, actor.render.size.height)
      .setFlipX(spawn.facing === 'right')
      .setDepth(actor.render.depth + 0.1)
      .setTintFill(CREAM)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.ownedObjects.push(flashImage);
    return { entry, image, flashImage, flashFrames: 0, defeated: false };
  }

  public get snapshot(): CombatSceneSnapshot {
    const primary =
      this.primaryTargetId === undefined ? undefined : this.enemies.get(this.primaryTargetId);
    const enemiesRemaining = [...this.enemies.values()].filter(({ defeated }) => !defeated).length;
    return {
      targetHealth: primary?.entry.controller.remainingHealth ?? 0,
      targetState: primary?.entry.controller.state ?? 'dead',
      targetPosition: primary?.entry.controller.currentPosition ?? { x: 0, y: 0 },
      activeProjectileCount: this.activeProjectiles.size,
      lastAttackId: this.lastAttackId,
      lastAbilityId: this.lastAbilityId,
      targetStatusIds:
        this.primaryTargetId === undefined
          ? []
          : this.abilityRuntime
              .statusState(this.primaryTargetId)
              .effects.map(({ definition }) => definition.id),
      lastMechanismRequestId: this.lastMechanismRequestId,
      enemiesRemaining,
      lastDefeatedActorId: this.lastDefeatedActorId
    };
  }

  public interceptProjectile(projectile: ProjectileSnapshot): PlayerProjectileIntercept {
    const result = this.playerRuntime.interceptProjectile(projectile);
    if (result.converted) {
      this.events.emit('combat:projectile-converted', {
        actorId: this.player.id,
        projectileId: result.projectileId,
        manaRestored: result.manaRestored
      });
    }
    return result;
  }

  public consumeHitStop(deltaMs: number): boolean {
    if (this.hitStopRemainingMs <= 0) return false;
    this.hitStopRemainingMs = Math.max(0, this.hitStopRemainingMs - Math.max(0, deltaMs));
    return true;
  }

  public accept(
    directives: readonly PlayerCombatDirective[],
    playerPosition: PointDefinition,
    facing: Facing,
    combatState: PlayerCombatState
  ): void {
    this.hitboxes.updatePosition(this.player.id, playerPosition);
    const usedAbilities = new Set<string>();
    for (const directive of directives) {
      if (directive.kind === 'activate-attack') {
        const attack = attackDefinitions.find(({ id }) => id === directive.attackId);
        if (attack === undefined) continue;
        this.timeline.activate(
          this.player.id,
          attack,
          facing,
          directive.activationDelayFrames ?? 0
        );
        this.lastAttackId = attack.id;
        const stage = attack.id.endsWith('-2') ? 2 : attack.id.endsWith('-3') ? 3 : 1;
        const member = this.slashPool.spawn({ position: playerPosition, facing, stage });
        if (member !== undefined) {
          this.timedGraphics.push({ member, remainingFrames: 12, pool: this.slashPool });
        }
        continue;
      }
      if (directive.kind === 'cue') {
        this.events.emit('combat:cue-requested', {
          cueId: directive.cueId,
          kind: directive.cueId.endsWith('-sound') ? 'sound' : 'effect',
          sourceId: this.player.id
        });
        continue;
      }
      if (directive.effect.kind === 'projectile') {
        this.spawnProjectile(
          directive.effect.attackId,
          playerPosition,
          facing,
          directive.activationDelayFrames ?? 0
        );
        this.lastAbilityId = 'lumen-bolt';
        usedAbilities.add('lumen-bolt');
      } else if (directive.effect.kind === 'dash') {
        this.lastAbilityId = 'wayfinder-dash';
        usedAbilities.add('wayfinder-dash');
      } else if (directive.effect.kind === 'barrier') {
        this.lastAbilityId = 'aegis-veil';
        usedAbilities.add('aegis-veil');
        this.spawnAbilityGlyph(playerPosition, 'barrier', directive.effect.durationFrames);
      } else if (directive.effect.kind === 'area-status') {
        this.lastAbilityId = 'resonant-pulse';
        usedAbilities.add('resonant-pulse');
        this.handleRuntimeOutputs(
          this.abilityRuntime.applyAreaStatus(directive.effect, playerPosition, this.player.id)
        );
        this.spawnAbilityGlyph(playerPosition, 'pulse', directive.effect.statusDurationFrames);
      }
    }
    for (const abilityId of usedAbilities) {
      this.events.emit('combat:ability-used', {
        actorId: this.player.id,
        abilityId,
        mana: combatState.mana,
        cooldownReadyAt: combatState.cooldownReadyAt[abilityId] ?? 0
      });
    }
  }

  public update(deltaMs: number, playerPosition: PointDefinition, playerNoiseLevel: number): void {
    this.lastPlayerPosition = { ...playerPosition };
    this.playerNoiseLevel = playerNoiseLevel;
    this.hitboxes.updatePosition(this.player.id, playerPosition);
    this.frameRemainderMs += Math.min(MAX_FRAME_MS, Math.max(0, deltaMs));
    while (this.frameRemainderMs + Number.EPSILON >= FIXED_FRAME_MS) {
      this.advanceFrame();
      this.frameRemainderMs -= FIXED_FRAME_MS;
    }
  }

  public applyCameraFeedback(camera: Phaser.Cameras.Scene2D.Camera): void {
    if (this.shakeFrames <= 0) return;
    camera.setScroll(camera.scrollX + this.shakeOffset.x, camera.scrollY + this.shakeOffset.y);
    this.shakeFrames -= 1;
    this.shakeOffset = {
      x: this.shakeOffset.x * -0.55,
      y: this.shakeOffset.y * -0.55
    };
  }

  public dispose(): void {
    this.activeProjectiles.clear();
    this.timedGraphics.length = 0;
    this.timedLabels.length = 0;
    this.slashPool.dispose();
    this.impactPool.dispose();
    this.projectilePool.dispose();
    this.abilityPool.dispose();
    this.labelPool.dispose();
    for (const object of this.ownedObjects) object.destroy();
    this.ownedObjects.length = 0;
    this.enemies.clear();
  }

  private spawnProjectile(
    attackId: string,
    playerPosition: PointDefinition,
    facing: Facing,
    activationDelayFrames: number
  ): void {
    const definition = attackDefinitions.find(({ id }) => id === attackId);
    if (definition === undefined) return;
    const projectile = createProjectileAttackDefinition(definition, {
      speedPerFrame: 12,
      lifetimeFrames: 48,
      pierces: false
    });
    this.hitboxes.updatePosition(this.player.id, playerPosition);
    const instance = this.timeline.activate(
      this.player.id,
      projectile,
      facing,
      activationDelayFrames
    );
    const visual = this.projectilePool.spawn({
      x: playerPosition.x,
      y: playerPosition.y - 58
    });
    if (visual !== undefined) {
      visual.setVisible(false);
      this.activeProjectiles.set(instance.id, visual);
    }
  }

  private spawnAbilityGlyph(
    position: PointDefinition,
    kind: AbilityVisualSpec['kind'],
    remainingFrames: number
  ): void {
    const glyph = this.abilityPool.spawn({ position, kind });
    if (glyph === undefined) return;
    this.timedGraphics.push({
      member: glyph,
      remainingFrames,
      pool: this.abilityPool,
      rotationPerFrame: this.settings.current.reducedMotion ? 0 : 0.025
    });
  }

  private advanceFrame(): void {
    this.director.advance();
    this.advanceEnemies();
    const timeline = this.timeline.advance();
    for (const advanced of timeline.advances) {
      const projectile = this.activeProjectiles.get(advanced.instance.id);
      if (projectile !== undefined) {
        const attack = advanced.instance.attack as ProjectileAttackDefinition;
        const direction = advanced.instance.facing === 'right' ? 1 : -1;
        const travelFrame = Math.max(0, advanced.instance.frame - attack.anticipationFrames);
        projectile.setPosition(
          advanced.instance.origin.x +
            direction * (30 + travelFrame * attack.projectile.speedPerFrame),
          advanced.instance.origin.y - 58
        );
        projectile.setVisible(advanced.instance.phase === 'active');
      }
      for (const hit of advanced.hits) {
        if (hit.targetId === this.player.id) {
          this.damagePlayer(hit.damage, advanced.instance.facing);
          continue;
        }
        const enemy = this.enemies.get(hit.targetId);
        if (enemy !== undefined && !enemy.defeated) {
          this.damageEnemy(
            enemy,
            hit.damage,
            advanced.instance.facing,
            projectile === undefined ? 'melee' : 'projectile'
          );
        }
      }
    }
    for (const instanceId of timeline.completedInstanceIds) {
      const projectile = this.activeProjectiles.get(instanceId);
      if (projectile === undefined) continue;
      this.activeProjectiles.delete(instanceId);
      this.projectilePool.release(projectile);
    }
    this.handleRuntimeOutputs(this.abilityRuntime.advance());
    this.advanceTimedEffects();
    for (const enemy of this.enemies.values()) {
      if (enemy.flashFrames <= 0) continue;
      enemy.flashFrames -= 1;
      if (enemy.flashFrames === 0) enemy.flashImage.setVisible(false);
    }
  }

  private advanceEnemies(): void {
    const cameraBounds = this.world.cameraBounds();
    for (const enemy of this.enemies.values()) {
      if (enemy.defeated) continue;
      const output = enemy.entry.controller.update({
        player: {
          position: this.lastPlayerPosition,
          noiseLevel: this.playerNoiseLevel
        },
        obstacles: this.world.obstacles,
        cameraBounds,
        floorAhead: this.world.floorAhead(enemy.entry.controller.currentPosition)
      });
      this.hitboxes.updatePosition(enemy.entry.spawn.id, output.position);
      enemy.image
        .setPosition(output.position.x, output.position.y)
        .setFlipX(output.facing === 'right')
        .setData('actorState', output.state);
      enemy.flashImage
        .setPosition(output.position.x, output.position.y)
        .setFlipX(output.facing === 'right');
      if (output.state === 'telegraph') {
        enemy.flashImage.setTintFill(AMBER).setAlpha(0.55).setVisible(true);
        enemy.flashFrames = 2;
      }
      if (output.activatedAttackId !== undefined) {
        const attack = attackDefinitions.find(({ id }) => id === output.activatedAttackId);
        if (attack !== undefined) {
          this.timeline.activate(enemy.entry.spawn.id, attack, output.facing, 0);
        }
      }
      for (const cueId of output.cues) {
        this.events.emit('combat:cue-requested', {
          cueId,
          kind: cueId.endsWith('-sound') ? 'sound' : 'effect',
          sourceId: enemy.entry.actor.id
        });
      }
    }
  }

  private damagePlayer(damage: AttackDefinition['damage'], facing: Facing): void {
    const outcome = this.world.receivePlayerHit(damage, facing);
    if (outcome.invulnerable) return;
    const feedback = combatFeedbackFor(
      {
        hitStopMs: outcome.healthDamage > 0 ? damage.hitStopMs : 0,
        amount: outcome.healthDamage,
        direction: facing === 'right' ? 1 : -1
      },
      this.settings.current
    );
    if (outcome.healthDamage > 0) {
      this.hitStopRemainingMs = Math.max(this.hitStopRemainingMs, feedback.hitStopMs);
      this.shakeOffset = feedback.shake;
      this.shakeFrames = feedback.shake.x === 0 && feedback.shake.y === 0 ? 0 : 4;
    }
    const impact = this.impactPool.spawn({
      position: { x: this.lastPlayerPosition.x, y: this.lastPlayerPosition.y - 52 },
      flashAlpha: feedback.flashAlpha,
      particleCount: feedback.particleCount
    });
    if (impact !== undefined) {
      this.timedGraphics.push({
        member: impact,
        remainingFrames: 7 + feedback.highContrastHoldFrames,
        pool: this.impactPool
      });
    }
    if (feedback.showDamageLabel && outcome.healthDamage > 0) {
      const label = this.labelPool.spawn({
        position: { x: this.lastPlayerPosition.x, y: this.lastPlayerPosition.y - 96 },
        amount: Math.round(outcome.healthDamage)
      });
      if (label !== undefined) this.timedLabels.push({ member: label, remainingFrames: 34 });
    }
  }

  private damageEnemy(
    enemy: EnemyVisual,
    damage: AttackDefinition['damage'],
    facing: Facing,
    sourceKind: 'melee' | 'projectile' | 'hazard'
  ): void {
    const statusAdjusted = this.abilityRuntime.resolveDamage(
      enemy.entry.spawn.id,
      {
        kind: sourceKind,
        packet: {
          amount: damage.amount,
          damageType: damageTypeId(damage.type),
          criticalMultiplier: 1,
          poiseDamage: damage.poise,
          knockback: Math.abs(damage.knockback.x)
        }
      },
      {
        armor: 0,
        resistances: {},
        guard: { kind: 'none' },
        invulnerable: false
      }
    );
    const outcome = enemy.entry.controller.applyDamage(
      {
        packet: {
          amount: statusAdjusted.healthDamage,
          damageType: damageTypeId(damage.type),
          criticalMultiplier: 1,
          poiseDamage: damage.poise,
          knockback: Math.abs(damage.knockback.x)
        },
        travelDirection: facing
      },
      this.world.rollDrops(enemy.entry.actor.drops.length)
    );
    enemy.image.setData('actorState', outcome.state);
    const feedback = combatFeedbackFor(
      {
        hitStopMs: damage.hitStopMs,
        amount: outcome.result.healthDamage,
        direction: facing === 'right' ? 1 : -1
      },
      this.settings.current
    );
    this.hitStopRemainingMs = Math.max(this.hitStopRemainingMs, feedback.hitStopMs);
    this.shakeOffset = feedback.shake;
    this.shakeFrames = feedback.shake.x === 0 && feedback.shake.y === 0 ? 0 : 4;
    enemy.flashFrames = Math.max(3, feedback.highContrastHoldFrames);
    enemy.flashImage
      .setTintFill(CREAM)
      .setAlpha(feedback.flashAlpha)
      .setVisible(feedback.flashAlpha > 0);
    const impactPosition = {
      x: enemy.image.x,
      y: enemy.image.y - enemy.image.displayHeight * 0.55
    };
    const impact = this.impactPool.spawn({
      position: impactPosition,
      flashAlpha: feedback.flashAlpha,
      particleCount: feedback.particleCount
    });
    if (impact !== undefined) {
      this.timedGraphics.push({
        member: impact,
        remainingFrames: 7 + feedback.highContrastHoldFrames,
        pool: this.impactPool
      });
    }
    if (feedback.showDamageLabel) {
      const label = this.labelPool.spawn({
        position: { x: impactPosition.x, y: impactPosition.y - 34 },
        amount: Math.round(outcome.result.healthDamage)
      });
      if (label !== undefined) this.timedLabels.push({ member: label, remainingFrames: 34 });
    }
    this.events.emit('combat:damage-resolved', {
      targetId: enemy.entry.actor.id,
      sourceId: this.player.id,
      amount: outcome.result.healthDamage,
      remainingHealth: outcome.remainingHealth,
      critical: outcome.result.criticalApplied
    });
    if (outcome.died) {
      enemy.defeated = true;
      enemy.image.setAlpha(0.48).setData('actorState', 'dead');
      this.lastDefeatedActorId = enemy.entry.actor.id;
      this.events.emit('combat:actor-defeated', {
        actorId: enemy.entry.actor.id,
        actorKind: enemy.entry.actor.kind === 'boss' ? 'boss' : 'enemy'
      });
      this.world.onEnemyDefeated(enemy.entry, outcome.drops);
    }
  }

  private handleRuntimeOutputs(outputs: readonly CombatRuntimeOutput[]): void {
    for (const output of outputs) {
      if (output.kind === 'mechanism-requested') {
        this.lastMechanismRequestId = output.targetId;
        this.events.emit('combat:mechanism-requested', {
          mechanismId: output.targetId,
          hookId: output.mechanismHookId,
          sourceId: output.sourceId
        });
        continue;
      }
      this.events.emit('combat:status-changed', {
        targetId: output.targetId,
        statusId: output.statusId,
        state: output.kind === 'status-applied' ? 'applied' : 'expired',
        ...(output.kind === 'status-applied' ? { expiresAtFrame: output.expiresAtFrame } : {})
      });
    }
  }

  private advanceTimedEffects(): void {
    for (let index = this.timedGraphics.length - 1; index >= 0; index -= 1) {
      const effect = this.timedGraphics[index];
      if (effect === undefined) continue;
      effect.remainingFrames -= 1;
      effect.member.rotation += effect.rotationPerFrame ?? 0;
      effect.member.setAlpha(Math.max(0, effect.remainingFrames / 12));
      if (effect.remainingFrames > 0) continue;
      effect.pool.release(effect.member);
      this.timedGraphics.splice(index, 1);
    }
    for (let index = this.timedLabels.length - 1; index >= 0; index -= 1) {
      const effect = this.timedLabels[index];
      if (effect === undefined) continue;
      effect.remainingFrames -= 1;
      effect.member
        .setY(effect.member.y - (this.settings.current.reducedMotion ? 0 : 0.6))
        .setAlpha(Math.min(1, effect.remainingFrames / 8));
      if (effect.remainingFrames > 0) continue;
      this.labelPool.release(effect.member);
      this.timedLabels.splice(index, 1);
    }
  }
}
