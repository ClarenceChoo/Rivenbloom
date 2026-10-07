import type { WorldObjectSnapshot } from '../world/WorldObjectRuntime';
import { objectPresentation } from '../world/WorldObjectPresentation';
import Phaser from 'phaser';
import {
  ENEMY_POSE_ROWS,
  ENEMY_POSE_Y,
  ENEMY_POSE_X,
  enemyPose,
  WORLD_ART_FRAMES,
} from '../data/artFrames';

import type { AreaDefinition, Rect, RoomDefinition } from '../data/types';
import type { WorldCombatRuntimeSnapshot } from '../world/WorldCombatRuntime';

type FrameSpec = Readonly<{
  x: number;
  y: number;
  width: number;
  sourceHeight: number;
  displayHeight: number;
}>;

const FRAMES: Readonly<Record<string, FrameSpec>> = Object.freeze({
  'sela-quill': { x: 146, y: 151, width: 296, sourceHeight: 721, displayHeight: 112 },
  'orin-fen': { x: 697, y: 111, width: 337, sourceHeight: 764, displayHeight: 118 },
  'piri-moss': { x: 1271, y: 311, width: 242, sourceHeight: 560, displayHeight: 92 },
  'briar-scrapper': { x: 585, y: 375, width: 300, sourceHeight: 365, displayHeight: 108 },
  duskwing: { x: 575, y: 30, width: 450, sourceHeight: 390, displayHeight: 120 },
  'spore-scribe': { x: 875, y: 350, width: 235, sourceHeight: 390, displayHeight: 112 },
  barkbound: { x: 1080, y: 210, width: 250, sourceHeight: 530, displayHeight: 136 },
  rootlurker: { x: 1300, y: 335, width: 225, sourceHeight: 405, displayHeight: 112 },
  'thorn-sentinel': { x: 1490, y: 170, width: 250, sourceHeight: 570, displayHeight: 156 },
  'pallid-cantor': { x: 1695, y: 10, width: 384, sourceHeight: 730, displayHeight: 304 },
});

export class WorldActorView {
  private readonly layers: Phaser.GameObjects.TileSprite[] = [];
  private readonly backdrop: Phaser.GameObjects.Image;
  private readonly sprites = new Map<string, Phaser.GameObjects.Image>();
  private readonly environmentSprites: (
    Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite
  )[] = [];
  private readonly npcSprites: Phaser.GameObjects.Image[] = [];
  private disposed = false;
  private area: AreaDefinition;
  private readonly checkpointAuras = new Map<string, Phaser.GameObjects.Image>();
  private readonly props = new Map<string, Phaser.GameObjects.Image>();

  public constructor(
    private readonly scene: Phaser.Scene,
    area: AreaDefinition,
    room: RoomDefinition,
  ) {
    this.area = area;
    const backgrounds = scene.textures.get('rivenbloom-area-backgrounds');
    const source = backgrounds.getSourceImage();
    for (let index = 0; index < 5; index++) {
      const top = Math.round((index * source.height) / 5);
      if (!backgrounds.has(`area-${index}`))
        backgrounds.add(
          `area-${index}`,
          0,
          0,
          top,
          source.width,
          Math.round(((index + 1) * source.height) / 5) - top,
        );
    }
    if (
      !scene.textures.exists('rivenbloom-area-backgrounds') ||
      !scene.textures.exists('rivenbloom-character-lineup') ||
      !scene.textures.exists('rivenbloom-world-atlas')
    ) {
      throw new Error('Required production world art is unavailable.');
    }
    this.backdrop = scene.add
      .image(640, 360, 'rivenbloom-area-backgrounds', `area-${floorFrame(area.areaId)}`)
      .setScrollFactor(0)
      .setDepth(-100)
      .setDisplaySize(1280, 720);
    const texture = scene.textures.get('rivenbloom-npc-sprites');
    for (const actorId of ['sela-quill', 'orin-fen', 'piri-moss']) {
      const spec = FRAMES[actorId]!;
      if (!texture.has(actorId)) {
        texture.add(actorId, 0, spec.x, spec.y, spec.width, spec.sourceHeight);
      }
    }
    const worldTexture = scene.textures.get('rivenbloom-world-atlas');
    for (let index = 0; index < 24; index += 1) {
      const name = `world-${index}`;
      if (!worldTexture.has(name)) {
        const rect = WORLD_ART_FRAMES[index]!;
        worldTexture.add(name, 0, rect.x, rect.y, rect.width, rect.height);
      }
    }
    const poses = scene.textures.get('rivenbloom-enemy-poses');
    for (const [row, actorId] of ENEMY_POSE_ROWS.entries()) {
      const top = ENEMY_POSE_Y[row]!;
      const height = ENEMY_POSE_Y[row + 1]! - top;
      for (let column = 0; column < 6; column++) {
        const left = ENEMY_POSE_X[row]![column]!;
        const name = `${actorId}-${column}`;
        if (!poses.has(name))
          poses.add(name, 0, left, top, ENEMY_POSE_X[row]![column + 1]! - left, height);
      }
    }
    for (const [index, key] of ['distant-roots', 'hanging-vines', 'foreground-boughs'].entries()) {
      this.layers.push(
        scene.add
          .tileSprite(640, 360, 1280, 720, key)
          .setScrollFactor(0)
          .setDepth(index === 2 ? 105 : -90 + index * 10),
      );
    }
    this.bindRoom(area, room);
  }

  public bindRoom(area: AreaDefinition, room: RoomDefinition): void {
    if (this.disposed) return;
    this.clearRoomArt();
    this.area = area;
    this.backdrop.setFrame(`area-${floorFrame(area.areaId)}`);
    this.renderSurfaces(area, room);

    for (const zone of area.zones.filter((candidate) => candidate.roomId === room.roomId)) {
      if (zone.kind === 'hazard' && zone.attackId === 'bramble-thorn-contact') {
        const { x, y, width, height } = zone.bounds;
        const thorns = this.scene.add
          .tileSprite(x, y, width, height, 'terrain-thorns')
          .setOrigin(0, 0)
          .setDepth(-2);
        thorns.tileScaleY = height / 128;
        this.environmentSprites.push(thorns);
        continue;
      }
      this.addEnvironment(
        zone.kind === 'climb'
          ? 5
          : zone.kind === 'hazard'
            ? zone.attackId === 'bramble-thorn-contact'
              ? 14
              : 12
            : 13,
        zone.bounds,
        zone.kind === 'climb' ? 8 : -2,
      ).setDisplaySize(zone.bounds.width, zone.bounds.height);
    }
    for (const checkpoint of area.checkpoints.filter(
      (candidate) => candidate.roomId === room.roomId,
    )) {
      const aura = this.scene.add
        .image(
          checkpoint.interactionPosition.x,
          checkpoint.interactionPosition.y - 58,
          'effect-sigil',
        )
        .setDisplaySize(102, 102)
        .setDepth(3)
        .setTint(0xf5c96a);
      this.checkpointAuras.set(checkpoint.checkpointId, aura);
      this.environmentSprites.push(aura);
      this.addGrounded(
        6,
        checkpoint.interactionPosition.x,
        checkpoint.interactionPosition.y,
        112,
        4,
      );
    }
    for (const chest of area.chests.filter((candidate) => candidate.roomId === room.roomId)) {
      this.props.set(
        chest.chestId,
        this.addGrounded(7, centerX(chest.bounds), bottom(chest.bounds), 92, 5),
      );
    }
    for (const breakable of area.breakables.filter(
      (candidate) => candidate.roomId === room.roomId,
    )) {
      this.props.set(
        breakable.breakableId,
        this.addEnvironment(
          breakable.displayName.toLowerCase().includes('silt') ? 15 : 14,
          breakable.bounds,
          6,
        ),
      );
    }
    for (const mechanism of area.mechanisms.filter(
      (candidate) => candidate.roomId === room.roomId,
    )) {
      const frame = mechanism.kind === 'boss-lens' ? 17 : mechanism.kind === 'shortcut' ? 10 : 16;
      this.props.set(mechanism.mechanismId, this.addEnvironment(frame, mechanism.bounds, 7));
    }
    for (const gate of (area.bossGates ?? []).filter(
      (candidate) => candidate.roomId === room.roomId,
    )) {
      this.props.set(
        gate.gateId,
        this.addEnvironment(gate.side === 'entry' ? 9 : 10, gate.bounds, 9),
      );
    }
    for (const transition of area.transitions.filter(
      (candidate) => candidate.roomId === room.roomId && candidate.kind === 'area',
    )) {
      this.addEnvironment(11, transition.bounds, 2);
    }
    for (const spawn of area.actorSpawns.filter(
      (candidate) => candidate.roomId === room.roomId && candidate.encounterId === null,
    )) {
      const spec = FRAMES[spawn.actorId];
      if (spec === undefined) continue;
      const sprite = this.scene.add
        .image(spawn.position.x, spawn.position.y, 'rivenbloom-npc-sprites', spawn.actorId)
        .setOrigin(0.5, 1)
        .setDepth(40)
        .setFlipX(spawn.facing === 'left');
      sprite.setDisplaySize(
        spec.width * (spec.displayHeight / spec.sourceHeight),
        spec.displayHeight,
      );
      this.npcSprites.push(sprite);
    }
  }

  public sync(
    snapshot: WorldCombatRuntimeSnapshot,
    objects?: WorldObjectSnapshot,
    reducedMotion = false,
    currentCheckpoint?: string,
  ): void {
    if (this.disposed) return;
    for (const [id, aura] of this.checkpointAuras) aura.setVisible(id === currentCheckpoint);
    this.layers.forEach((layer, index) => {
      layer.setAlpha(index === 2 ? 0.55 : index === 1 ? 0.18 : 0.12);
      layer.tilePositionX = reducedMotion
        ? 0
        : this.scene.cameras.main.scrollX * [0.12, 0.24, 0.4][index]!;
    });
    const present = (
      id: string,
      kind: Parameters<typeof objectPresentation>[0],
      completed: boolean,
    ) => {
      const sprite = this.props.get(id);
      if (!sprite) return;
      const state = objectPresentation(kind, completed);
      sprite.setVisible(state.visible).setRotation(state.rotation);
      if (state.frame !== null) sprite.setFrame(`world-${state.frame}`);
    };
    if (objects !== undefined) {
      for (const chest of objects.chests) present(chest.chestId, 'chest', chest.state === 'opened');
      for (const breakable of objects.breakables)
        present(breakable.breakableId, 'breakable', breakable.state === 'opened');
      for (const mechanism of this.area.mechanisms) {
        const completed =
          mechanism.kind === 'puzzle'
            ? objects.puzzles.some(
                (puzzle) =>
                  puzzle.puzzleId === mechanism.puzzleId &&
                  (puzzle.state === 'solved' ||
                    puzzle.activatedMechanismIds?.includes(mechanism.mechanismId)),
              )
            : mechanism.kind === 'shortcut'
              ? objects.shortcuts.some(
                  (shortcut) =>
                    shortcut.shortcutId === mechanism.shortcutId && shortcut.state === 'opened',
                )
              : (snapshot.boss?.lenses.some(
                  (lens) => lens.mechanismId === mechanism.mechanismId && lens.state === 'latched',
                ) ?? false);
        present(mechanism.mechanismId, 'mechanism', completed);
      }
    }
    for (const gate of this.area.bossGates ?? [])
      present(gate.gateId, 'gate', snapshot.boss === null || !snapshot.boss.arenaLocked);
    const visibleIds = new Set<string>();
    for (const enemy of snapshot.enemies) {
      visibleIds.add(enemy.combatantId);
      const sprite = this.sprite(enemy.combatantId, enemy.actorId);
      sprite.setFrame(
        `${enemy.actorId}-${enemyPose(enemy.state, enemy.attackPhase, snapshot.simulationTimeMs)}`,
      );
      sprite.setPosition(enemy.position.x, enemy.position.y);
      sprite.setFlipX(enemy.facing === 'left');
      sprite.setVisible(!(enemy.hidden && enemy.state === 'sleep'));
      sprite.setAlpha(enemy.state === 'dead' ? 0.28 : 1);
      sprite.setTint(enemy.attackPhase === 'telegraph' ? 0xee765f : 0xffffff);
    }
    const boss = snapshot.boss;
    if (boss !== null) {
      visibleIds.add('pallid-cantor');
      const sprite = this.sprite('pallid-cantor', 'pallid-cantor');
      sprite.setFrame(
        `pallid-cantor-${enemyPose(boss.state, boss.attackPhase, snapshot.simulationTimeMs)}`,
      );
      sprite.setPosition(boss.position.x, boss.position.y);
      // The Cantor's source poses face left; the other actor sheets face right.
      sprite.setFlipX(boss.facing === 'right');
      sprite.setVisible(!boss.disposed);
      sprite.setAlpha(boss.state === 'intro' ? 0.82 : 1);
      sprite.setTint(boss.heartExposed ? 0x9ee7d7 : 0xffffff);
    }
    for (const [id, sprite] of this.sprites) {
      if (!visibleIds.has(id)) sprite.setVisible(false);
    }
  }

  public destroy(): boolean {
    if (this.disposed) return false;
    this.disposed = true;
    this.backdrop.destroy();
    for (const layer of this.layers) layer.destroy();
    this.clearRoomArt();
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
    return true;
  }

  private renderSurfaces(area: AreaDefinition, room: RoomDefinition): void {
    const key = `terrain-${area.areaId}`;
    const texture = this.scene.textures.get(key);
    if (!texture.has('body')) {
      texture.add('body', 0, 0, 0, 256, 256);
      texture.add('rim', 0, 0, 256, 256, 24);
      texture.add('ledge', 0, 0, 280, 256, 40);
    }
    for (const surface of area.surfaces.filter((candidate) => candidate.roomId === room.roomId)) {
      const { x, y, width, height } = surface.bounds;
      const addTile = (frame: string, tileHeight: number, depth: number) => {
        const tile = this.scene.add
          .tileSprite(x, y, width, tileHeight, key, frame)
          .setOrigin(0, 0)
          .setDepth(depth);
        // Keep material scale constant and continuous across adjacent colliders.
        tile.tilePositionX = x;
        this.environmentSprites.push(tile);
      };
      if (surface.kind === 'one-way') {
        addTile('ledge', Math.min(height, 40), -1);
      } else {
        addTile('body', height, -4);
        addTile('rim', Math.min(height, 24), -3);
      }
    }
  }

  private addEnvironment(frame: number, bounds: Rect, depth: number): Phaser.GameObjects.Image {
    const sprite = this.scene.add
      .image(
        centerX(bounds),
        bounds.y + bounds.height / 2,
        'rivenbloom-world-atlas',
        `world-${frame}`,
      )
      .setDepth(depth);
    sprite.setDisplaySize(Math.max(64, bounds.width), Math.max(72, bounds.height));
    this.environmentSprites.push(sprite);
    return sprite;
  }

  private addGrounded(
    frame: number,
    x: number,
    y: number,
    displayHeight: number,
    depth: number,
  ): Phaser.GameObjects.Image {
    const sprite = this.scene.add
      .image(x, y, 'rivenbloom-world-atlas', `world-${frame}`)
      .setOrigin(0.5, 1)
      .setDepth(depth);
    sprite.setDisplaySize(displayHeight, displayHeight);
    this.environmentSprites.push(sprite);
    return sprite;
  }

  private clearRoomArt(): void {
    for (const sprite of this.environmentSprites) sprite.destroy();
    for (const sprite of this.npcSprites) sprite.destroy();
    this.props.clear();
    this.checkpointAuras.clear();
    this.environmentSprites.length = 0;
    this.npcSprites.length = 0;
  }

  private sprite(id: string, actorId: string): Phaser.GameObjects.Image {
    const existing = this.sprites.get(id);
    if (existing !== undefined) return existing;
    const spec = FRAMES[actorId];
    if (spec === undefined) throw new Error(`Production art is missing for actor ${actorId}.`);
    const sprite = this.scene.add
      .image(0, 0, 'rivenbloom-enemy-poses', `${actorId}-0`)
      .setOrigin(0.5, 1)
      .setDepth(50);
    const row = ENEMY_POSE_ROWS.findIndex((id) => id === actorId);
    const sourceHeight = ENEMY_POSE_Y[row + 1]! - ENEMY_POSE_Y[row]!;
    sprite.setScale(spec.displayHeight / sourceHeight);
    this.sprites.set(id, sprite);
    return sprite;
  }
}

function floorFrame(areaId: string): number {
  if (areaId === 'wren-rest') return 0;
  if (areaId === 'brackenreach') return 1;
  if (areaId === 'singing-hollows') return 2;
  if (areaId === 'rootglass-reliquary') return 3;
  return 4;
}

function centerX(bounds: Rect): number {
  return bounds.x + bounds.width / 2;
}

function bottom(bounds: Rect): number {
  return bounds.y + bounds.height;
}
