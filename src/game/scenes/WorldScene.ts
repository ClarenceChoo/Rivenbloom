import Phaser from 'phaser';
import { SceneScope } from '../core/SceneScope';
import { actorDefinitions } from '../data/actors';
import { getAreaDefinition, INITIAL_WORLD_AREA_ID } from '../data/areas';
import type {
  AreaDefinition,
  LayerDefinition,
  LoadedArea,
  RectDefinition,
  RenderDefinition
} from '../data/types';
import { AreaLoader } from '../world/AreaLoader';
import { SceneKeys } from './SceneKeys';

type WorldPayload = {
  readonly areaId?: string;
};

export class WorldScene extends Phaser.Scene {
  private scope = new SceneScope();
  private payload: WorldPayload = {};

  public constructor() {
    super(SceneKeys.World);
  }

  public init(payload: WorldPayload): void {
    this.scope = new SceneScope();
    this.payload = payload;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.scope.add(() => this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this));
  }

  public create(): void {
    const areaId = this.payload.areaId ?? INITIAL_WORLD_AREA_ID;
    const definition = getAreaDefinition(areaId);
    if (definition === undefined) throw new Error(`Unknown world area "${areaId}".`);
    const loaded = new AreaLoader().load(definition);

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
    this.renderPlayer(loaded);
    this.exposeSemanticState(loaded);
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('world-debug')) {
      this.renderDebugOverlay(definition);
    }
  }

  private renderLayers(loaded: LoadedArea): void {
    for (const layer of loaded.layers) {
      if (layer.kind === 'gameplay') continue;
      const image = this.createImage(layer.assetKey, layer.position.x, layer.position.y, layer);
      image.setScrollFactor(layer.scrollFactor);
    }
  }

  private renderProps(definition: AreaDefinition): void {
    for (const prop of definition.props) {
      this.createImage(prop.render.assetKey, prop.position.x, prop.position.y, prop.render);
    }
  }

  private renderPlayer(loaded: LoadedArea): void {
    const mara = actorDefinitions.find(({ id }) => id === 'mara-vey');
    if (mara === undefined) throw new Error('Player actor "mara-vey" is not registered.');
    const image = this.createImage(
      mara.render.assetKey,
      loaded.initialSpawn.position.x,
      loaded.initialSpawn.position.y,
      mara.render
    );
    image.setFlipX(loaded.initialSpawn.facing === 'left');
    image.setData('actorId', mara.id);
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
      canvas.removeAttribute('aria-label');
    });
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
