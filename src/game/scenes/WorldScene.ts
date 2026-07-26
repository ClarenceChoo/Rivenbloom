import Phaser from 'phaser';
import { CameraDirector } from '../camera/CameraDirector';
import { PLAYER_CAMERA_TUNING, PLAYER_MOVEMENT_TUNING } from '../config/traversal';
import type { AccessibilitySettingsState } from '../config/accessibility';
import {
  AccessibilitySettingsToken,
  GAME_SERVICES_REGISTRY_KEY,
  InputServiceToken
} from '../core/GameServices';
import { SceneScope } from '../core/SceneScope';
import type { ServiceRegistry } from '../core/ServiceRegistry';
import { actorDefinitions } from '../data/actors';
import { getAreaDefinition, INITIAL_WORLD_AREA_ID } from '../data/areas';
import type {
  AreaDefinition,
  LayerDefinition,
  LoadedArea,
  RectDefinition,
  RenderDefinition
} from '../data/types';
import { PlayerController } from '../entities/player/PlayerController';
import type { PlayerStateName } from '../entities/player/PlayerState';
import { PlayerView } from '../entities/player/PlayerView';
import { PlatformRules } from '../physics/PlatformRules';
import { AreaLoader } from '../world/AreaLoader';
import { horizontalLayerTiles } from '../world/LayerTiling';
import { SceneKeys } from './SceneKeys';

type WorldPayload = {
  readonly areaId?: string;
};

export class WorldScene extends Phaser.Scene {
  private scope = new SceneScope();
  private payload: WorldPayload = {};
  private player: PlayerController | undefined;
  private cameraDirector: CameraDirector | undefined;
  private definition: AreaDefinition | undefined;
  private settings: AccessibilitySettingsState | undefined;
  private previousPlayerState: PlayerStateName | undefined;
  private landingCount = 0;

  public constructor() {
    super(SceneKeys.World);
  }

  public init(payload: WorldPayload): void {
    this.scope = new SceneScope();
    this.payload = payload;
    this.player = undefined;
    this.cameraDirector = undefined;
    this.definition = undefined;
    this.settings = undefined;
    this.previousPlayerState = undefined;
    this.landingCount = 0;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.scope.add(() => this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this));
  }

  public create(): void {
    const areaId = this.payload.areaId ?? INITIAL_WORLD_AREA_ID;
    const definition = getAreaDefinition(areaId);
    if (definition === undefined) throw new Error(`Unknown world area "${areaId}".`);
    const loaded = new AreaLoader().load(definition);
    const services = this.registry.get(GAME_SERVICES_REGISTRY_KEY) as ServiceRegistry;
    const input = services.get(InputServiceToken);
    this.settings = services.get(AccessibilitySettingsToken);
    this.definition = definition;

    this.cameras.main.setBackgroundColor('#171325');
    this.cameras.main.setBounds(
      loaded.bounds.x,
      loaded.bounds.y,
      loaded.bounds.width,
      loaded.bounds.height
    );
    this.cameras.main.centerOn(loaded.initialSpawn.position.x, loaded.bounds.height / 2);

    this.renderLayers(loaded);
    this.renderProps(definition);
    const mara = actorDefinitions.find(({ id }) => id === 'mara-vey');
    if (mara === undefined) throw new Error('Player actor "mara-vey" is not registered.');
    const view = new PlayerView(this, mara, loaded.initialSpawn.position);
    this.player = new PlayerController({
      input,
      platforms: new PlatformRules(definition.surfaces, definition.bounds, mara.collisionBody),
      view,
      tuning: PLAYER_MOVEMENT_TUNING,
      spawn: loaded.initialSpawn
    });
    this.scope.add(() => this.player?.dispose());
    this.cameraDirector = new CameraDirector(this.cameras.main, PLAYER_CAMERA_TUNING);
    this.scope.add(() => this.cameraDirector?.dispose());
    this.exposeSemanticState(loaded);
    this.updateSemanticState();
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('world-debug')) {
      this.renderDebugOverlay(definition);
    }
  }

  public update(time: number, delta: number): void {
    if (
      this.player === undefined ||
      this.cameraDirector === undefined ||
      this.definition === undefined ||
      this.settings === undefined
    ) {
      return;
    }
    this.player.update(time, delta);
    const snapshot = this.player.snapshot;
    this.cameraDirector.follow(snapshot.position, this.definition.bounds, {
      facing: snapshot.facing,
      reducedMotion: this.settings.current.reducedMotion,
      deltaSeconds: delta / 1000
    });
    this.updateSemanticState();
  }

  private renderLayers(loaded: LoadedArea): void {
    for (const layer of loaded.layers) {
      if (layer.kind === 'gameplay') continue;
      for (const x of horizontalLayerTiles(layer, loaded.bounds)) {
        const image = this.createImage(layer.assetKey, x, layer.position.y, layer);
        image.setScrollFactor(layer.scrollFactor);
      }
    }
  }

  private renderProps(definition: AreaDefinition): void {
    for (const prop of definition.props) {
      this.createImage(prop.render.assetKey, prop.position.x, prop.position.y, prop.render);
    }
  }

  private createImage(
    assetKey: string,
    x: number,
    y: number,
    render: LayerDefinition | RenderDefinition
  ): Phaser.GameObjects.Image {
    let frameKey: string | undefined;
    if (render.source !== undefined) {
      frameKey = [
        'crop',
        render.source.x,
        render.source.y,
        render.source.width,
        render.source.height
      ].join('-');
      const texture = this.textures.get(assetKey);
      if (!texture.has(frameKey)) {
        texture.add(
          frameKey,
          0,
          render.source.x,
          render.source.y,
          render.source.width,
          render.source.height
        );
      }
    }
    const image = this.add.image(x, y, assetKey, frameKey);
    const origin = 'origin' in render ? render.origin : { x: 0, y: 0 };
    image
      .setOrigin(origin.x, origin.y)
      .setDisplaySize(render.size.width, render.size.height)
      .setDepth(render.depth);
    this.scope.add(() => image.destroy());
    return image;
  }

  private exposeSemanticState(loaded: LoadedArea): void {
    const canvas = this.game.canvas;
    canvas.dataset.areaId = loaded.areaId;
    canvas.dataset.roomId = loaded.initialSpawn.roomId;
    canvas.setAttribute('aria-label', `${loaded.displayName} gameplay`);
    this.scope.add(() => {
      delete canvas.dataset.areaId;
      delete canvas.dataset.roomId;
      delete canvas.dataset.playerX;
      delete canvas.dataset.playerY;
      delete canvas.dataset.playerState;
      delete canvas.dataset.playerLandingCount;
      delete canvas.dataset.playerFacing;
      delete canvas.dataset.playerGrounded;
      delete canvas.dataset.cameraX;
      delete canvas.dataset.cameraY;
      delete canvas.dataset.cameraMinX;
      delete canvas.dataset.cameraMaxX;
      canvas.removeAttribute('aria-label');
    });
  }

  private updateSemanticState(): void {
    if (this.player === undefined || this.definition === undefined) return;
    const snapshot = this.player.snapshot;
    const room = this.definition.rooms.find(
      ({ bounds }) =>
        snapshot.position.x >= bounds.x &&
        snapshot.position.x < bounds.x + bounds.width &&
        snapshot.position.y >= bounds.y &&
        snapshot.position.y <= bounds.y + bounds.height
    );
    const canvas = this.game.canvas;
    if (snapshot.machine.value === 'land' && this.previousPlayerState !== 'land') {
      this.landingCount += 1;
    }
    this.previousPlayerState = snapshot.machine.value;
    if (room !== undefined) canvas.dataset.roomId = room.id;
    canvas.dataset.playerX = snapshot.position.x.toFixed(2);
    canvas.dataset.playerY = snapshot.position.y.toFixed(2);
    canvas.dataset.playerState = snapshot.machine.value;
    canvas.dataset.playerLandingCount = String(this.landingCount);
    canvas.dataset.playerFacing = snapshot.facing;
    canvas.dataset.playerGrounded = String(snapshot.grounded);
    canvas.dataset.cameraX = this.cameras.main.scrollX.toFixed(2);
    canvas.dataset.cameraY = this.cameras.main.scrollY.toFixed(2);
    canvas.dataset.cameraMinX = this.definition.bounds.x.toFixed(2);
    canvas.dataset.cameraMaxX = (
      this.definition.bounds.x +
      this.definition.bounds.width -
      this.cameras.main.width
    ).toFixed(2);
  }

  private renderDebugOverlay(definition: AreaDefinition): void {
    const graphics = this.add.graphics().setDepth(1000);
    for (const room of definition.rooms) {
      this.strokeRect(graphics, room.bounds, 0x9ee7d7, 0.5);
    }
    for (const surface of definition.surfaces) {
      this.strokeRect(graphics, surface.collision, 0xf0e3c0, 0.8);
    }
    for (const trigger of definition.triggers) {
      this.strokeRect(graphics, trigger.bounds, 0xf5c96a, 0.8);
    }
    for (const spawn of definition.playerSpawns) {
      graphics.lineStyle(2, 0xbc8ae8, 0.9).strokeCircle(spawn.position.x, spawn.position.y - 8, 8);
    }
    for (const spawn of definition.actorSpawns) {
      graphics.lineStyle(2, 0xee765f, 0.9).strokeCircle(spawn.position.x, spawn.position.y - 8, 8);
    }
    this.scope.add(() => graphics.destroy());
  }

  private strokeRect(
    graphics: Phaser.GameObjects.Graphics,
    bounds: RectDefinition,
    colour: number,
    alpha: number
  ): void {
    graphics
      .lineStyle(2, colour, alpha)
      .strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  }

  private shutdown(): void {
    this.scope.dispose();
  }
}
