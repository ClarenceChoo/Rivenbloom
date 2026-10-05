import Phaser from 'phaser';
import { CONTENT_REGISTRY } from '../data/areas';
import { MARA_ACTOR } from '../data/actors';
import { WorldActorView } from '../entities/WorldActorView';
import { PlayerView } from '../entities/player/PlayerView';
import { PlayerController } from '../entities/player/PlayerController';
import { InputService } from '../input/InputService';
import { PRELOAD_MANIFEST } from '../scenes/PreloadScene';
import { createNewSave } from '../saves/SaveSchema';
import { AreaLoader } from '../world/AreaLoader';
import { WorldRoomRuntime } from '../world/WorldRoomRuntime';
import { PallidCantorController } from '../entities/bosses/PallidCantorController';
import { PALLID_CANTOR_PHASE_TWO_ATTACKS } from '../entities/bosses/pallidCantorAttacks';
import { stableId, damageTypeId } from '../core/StableId';
import { CombatPresentationView } from '../effects/CombatPresentationView';
import { projectCombatVisuals } from '../effects/CombatPresentation';
import { DEFAULT_SAVE_SETTINGS } from '../saves/SaveSchema';

let preview: Phaser.Game | null = null;

/** Development-only art review harness; never imported by the application entry point. */
export async function showRoomArt(
  roomId: string,
  overlay: boolean,
  combat?: Readonly<{ attackId: string; phase: 'warning' | 'active' }>,
): Promise<void> {
  if (!import.meta.env.DEV) throw new Error('Art preview is development-only.');
  preview?.destroy(true);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  document.querySelector('#room-art-review')?.remove();
  const parent = document.createElement('div');
  parent.id = 'room-art-review';
  Object.assign(parent.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '1000',
    background: '#171325',
  });
  document.body.append(parent);
  const area = CONTENT_REGISTRY.areas.find((area) =>
    area.rooms.some((room) => room.roomId === roomId),
  );
  const room = area?.rooms.find((room) => room.roomId === roomId);
  if (!area || !room) throw new Error('Unknown room.');
  const surfaces = area.surfaces.filter((surface) => surface.roomId === room.roomId);
  const checkpoint = area.checkpoints[0]!;
  const content = CONTENT_REGISTRY.newGame;
  const save = createNewSave({
    nowEpochMs: 1,
    location: {
      regionId: area.regionId,
      areaId: area.areaId,
      checkpointId: checkpoint.checkpointId,
      safePosition: checkpoint.canonicalPosition,
    },
    baseStats: content.baseStats,
    initialQuests: content.initialQuests,
    startingAbilities: content.startingAbilities,
  });
  await new Promise<void>((resolve, reject) => {
    class ReviewScene extends Phaser.Scene {
      preload() {
        for (const asset of PRELOAD_MANIFEST) this.load.image(asset.key, asset.url);
        this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () =>
          reject(new Error('Art asset failed to load.')),
        );
      }
      create() {
        const loader = new AreaLoader(CONTENT_REGISTRY);
        const runtime = new WorldRoomRuntime({
          registry: CONTENT_REGISTRY,
          loader,
          area: loader.load(area!),
          roomId: room!.roomId,
          save,
          baseline: { lastStepIndex: 0, simulationTimeMs: 0 },
          readCameraBounds: () => room!.bounds,
        });
        const view = new WorldActorView(this, area!, room!);
        const encounter = runtime.snapshot().combat;
        const illustratedBoss = combat === undefined ? null : bossPresentationFixture(combat);
        view.sync(
          illustratedBoss === null ? encounter : { ...encounter, boss: illustratedBoss },
          runtime.snapshot().objects,
          true,
          checkpoint.checkpointId,
        );
        const effects = new CombatPresentationView(this);
        if (illustratedBoss !== null)
          effects.sync(projectCombatVisuals([], { ...encounter, boss: illustratedBoss }), 0, {
            ...DEFAULT_SAVE_SETTINGS,
            reducedMotion: true,
            flashIntensity: 0,
            shakeIntensity: 0,
            masterVolume: 0,
          });
        const surface = surfaces.find((surface) => surface.kind === 'solid')!;
        const player = new PlayerController({
          input: new InputService({
            read: () => ({
              focused: true,
              keyboard: { heldCodes: [], pressed: [], released: [], activityAtMs: null },
              gamepad: null,
            }),
            clearTransient: () => undefined,
          }),
          position: {
            x: surface.bounds.x + Math.min(256, surface.bounds.width / 2),
            y: surface.bounds.y,
          },
          surfaces,
          zones: [],
        });
        const playerView = new PlayerView(this, MARA_ACTOR.visualHeight);
        playerView.sync(player.snapshot());
        const camera = this.cameras.main;
        camera.setZoom(Math.min(1280 / room!.bounds.width, 720 / room!.bounds.height));
        camera.centerOn(
          room!.bounds.x + room!.bounds.width / 2,
          room!.bounds.y + room!.bounds.height / 2,
        );
        if (overlay) {
          const lines = this.add.graphics().setDepth(500).lineStyle(2, 0xff5870, 1);
          for (const surface of surfaces)
            lines.strokeRectShape(
              new Phaser.Geom.Rectangle(
                surface.bounds.x,
                surface.bounds.y,
                surface.bounds.width,
                surface.bounds.height,
              ),
            );
        }
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
          view.destroy();
          effects.destroy();
          playerView.destroy();
          player.dispose();
          runtime.dispose();
        });
        this.time.delayedCall(50, resolve);
      }
    }
    preview = new Phaser.Game({
      type: Phaser.CANVAS,
      parent,
      width: 1280,
      height: 720,
      backgroundColor: '#171325',
      scene: ReviewScene,
      audio: { noAudio: true },
    });
  });
}

function bossPresentationFixture(
  request: Readonly<{ attackId: string; phase: 'warning' | 'active' }>,
) {
  const boss = new PallidCantorController({
    readTarget: () => ({
      position: { x: 800, y: 900 },
      hurtboxTarget: {
        targetId: stableId<'combatant'>('mara'),
        teamId: stableId<'team'>('player'),
        hurtboxes: [{ x: 776, y: 804, width: 48, height: 96 }],
      },
    }),
    receiveTargetImpact: () => ({
      kind: 'unresolved',
      projectileDisposition: 'continue',
      commands: [],
    }),
  });
  const second = PALLID_CANTOR_PHASE_TWO_ATTACKS.some((id) => id === request.attackId);
  for (let i = 0; i < 2400; i++) {
    const before = boss.snapshot();
    if (second && before.state === 'phaseOne')
      boss.receiveImpact({
        attackId: stableId<'attack'>('mara-light-one'),
        targetId: before.combatantId,
        source: {
          ownerId: stableId<'combatant'>('mara'),
          teamId: stableId<'team'>('player'),
          position: { x: 900, y: 900 },
          facing: 'right',
        },
        occurredAtMs: before.simulationTimeMs,
        delivery: 'melee',
        damage: {
          baseDamage: 1000,
          damageType: damageTypeId('physical'),
          poiseDamage: 0,
          critical: { kind: 'excluded' },
        },
        knockback: { x: 0, y: 0 },
        hitStopMs: 0,
        tags: ['blockable'],
        projectile: null,
      });
    const current = boss.update({
      stepIndex: before.stepIndex + 1,
      nowMs: before.simulationTimeMs + 17,
      stepMs: 17,
      pulses: [],
    }).snapshot;
    if (
      current.activeAttackId === request.attackId &&
      (request.phase === 'warning'
        ? current.attackPhase === 'telegraph'
        : current.attackPhase === 'active' ||
          (request.attackId.includes('note-') && current.projectiles.length > 0))
    ) {
      boss.dispose();
      return current;
    }
  }
  boss.dispose();
  throw new Error(`No authored ${request.phase} frame for ${request.attackId}.`);
}
