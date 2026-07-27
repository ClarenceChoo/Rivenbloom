import Phaser from 'phaser';
import { SceneScope } from '../core/SceneScope';
import { BrackenreachAssetKeys } from '../data/areas';
import { createLoadingShell } from '../ui/dom/menuShell';
import { SceneKeys } from './SceneKeys';

const TITLE_BACKGROUND_KEY = 'title-wrens-rest-background';
const TITLE_BACKGROUND_URL = '/assets/ui/title-wrens-rest-background.png';
const WORLD_ASSETS = [
  {
    key: BrackenreachAssetKeys.far,
    url: '/assets/backgrounds/brackenreach-far.png'
  },
  {
    key: BrackenreachAssetKeys.mid,
    url: '/assets/backgrounds/brackenreach-mid.png'
  },
  {
    key: BrackenreachAssetKeys.foreground,
    url: '/assets/backgrounds/brackenreach-foreground.png'
  },
  {
    key: BrackenreachAssetKeys.terrain,
    url: '/assets/atlases/source/brackenreach-terrain.png'
  },
  {
    key: BrackenreachAssetKeys.mara,
    url: '/assets/atlases/source/mara-sheet.png'
  },
  {
    key: 'briar-scrapper-sheet',
    url: '/assets/atlases/source/briar-scrapper-sheet.png'
  },
  {
    key: 'duskwing-sheet',
    url: '/assets/atlases/source/duskwing-sheet.png'
  },
  {
    key: 'spore-scribe-sheet',
    url: '/assets/atlases/source/spore-scribe-sheet.png'
  },
  {
    key: 'barkbound-sheet',
    url: '/assets/atlases/source/barkbound-sheet.png'
  },
  {
    key: 'rootlurker-sheet',
    url: '/assets/atlases/source/rootlurker-sheet.png'
  },
  {
    key: 'thorn-sentinel-sheet',
    url: '/assets/atlases/source/thorn-sentinel-sheet.png'
  },
  {
    key: 'pallid-cantor-sheet',
    url: '/assets/atlases/source/pallid-cantor-sheet.png'
  },
  {
    key: 'dialogue-portraits',
    url: '/assets/portraits/dialogue-portraits.png'
  }
] as const;

export class PreloadScene extends Phaser.Scene {
  private scope = new SceneScope();
  private failedGroups = new Set<string>();
  private loadingShell: ReturnType<typeof createLoadingShell> | undefined;

  public constructor() {
    super(SceneKeys.Preload);
  }

  public init(): void {
    this.scope = new SceneScope();
    this.failedGroups = new Set();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.scope.add(() => this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this));
  }

  public preload(): void {
    this.loadingShell = createLoadingShell();
    this.scope.add(() => this.loadingShell?.dispose());
    const onProgress = (progress: number): void => this.loadingShell?.setProgress(progress);
    const onLoadError = (file: Phaser.Loader.File): void => {
      this.failedGroups.add(file.key);
    };
    this.load.on(Phaser.Loader.Events.PROGRESS, onProgress);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
    this.scope.add(() => this.load.off(Phaser.Loader.Events.PROGRESS, onProgress));
    this.scope.add(() => this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError));
    this.load.image(TITLE_BACKGROUND_KEY, TITLE_BACKGROUND_URL);
    for (const asset of WORLD_ASSETS) this.load.image(asset.key, asset.url);
  }

  public create(): void {
    if (this.failedGroups.size > 0) {
      this.loadingShell?.showError([...this.failedGroups].join(', '), () => this.scene.restart());
      return;
    }
    this.scene.start(SceneKeys.Title);
  }

  private shutdown(): void {
    this.scope.dispose();
  }
}
