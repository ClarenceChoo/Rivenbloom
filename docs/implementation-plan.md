# Rivenbloom Vertical Slice Implementation Plan

Historical implementation plan. For current completed scope and remaining qualification, use [progress](progress.md), the [release checklist](remaining-work-checklist.md) and [October 7 verification](polish-verification.md); the original task checkboxes below are retained as planning history.

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a polished, original 20–40 minute fantasy
action-adventure vertical slice with one complete region, progression arc,
dungeon, boss, persistence, menus, audio, and browser/PWA/macOS packaging.

**Architecture:** A small set of Phaser coordinator scenes owns lifecycle while
framework-independent TypeScript modules implement rules. Typed, data-driven
area and actor definitions feed reusable world, combat, AI, quest, input, and
save systems. Platform persistence is isolated behind `SaveRepository`.

**Tech Stack:** Phaser 3, strict TypeScript, Vite, Vitest, Playwright, ESLint,
Prettier, IndexedDB, Vite PWA/service worker, Web Audio through Phaser, Tauri 2,
HTML/CSS overlays only where native text/input controls materially help.

## Global Constraints

- Original content only; do not copy or trace Swordigo or any other game.
- Logical resolution is 1280 × 720 with responsive contain scaling.
- Minimum supported viewport width is approximately 1024 pixels.
- Browser saves use IndexedDB and preserve a previous valid backup.
- Finished gameplay cannot contain debug primitives, emoji, generic
  placeholders, or unlicensed assets.
- Core controls are remappable and support keyboard and gamepad.
- Every command reported as passing must be run in this environment.
- Rust/Cargo are the initial external prerequisite for native Tauri
  verification. Apple Command Line Tools are already installed.

---

## Planned File Structure

```text
index.html
package.json
vite.config.ts
vitest.config.ts
playwright.config.ts
tsconfig.json
eslint.config.js
src/
  main.ts
  styles/
    global.css
    shell.css
  game/
    config/
      gameConfig.ts
      balance.ts
    core/
      GameEvents.ts
      ServiceRegistry.ts
      SceneScope.ts
      StateMachine.ts
    scenes/
      BootScene.ts
      PreloadScene.ts
      TitleScene.ts
      WorldScene.ts
      UIScene.ts
      MenuScene.ts
      DialogueScene.ts
      TransitionScene.ts
    data/
      areas.ts
      actors.ts
      attacks.ts
      abilities.ts
      items.ts
      quests.ts
      dialogue.ts
      audio.ts
      types.ts
    entities/
      player/
      enemies/
      bosses/
      npcs/
    combat/
      DamageResolver.ts
      HitboxSystem.ts
      CombatTypes.ts
      StatusEffects.ts
    abilities/
      AbilitySystem.ts
      CooldownTracker.ts
    ai/
      Perception.ts
      EncounterDirector.ts
    physics/
      MovementModel.ts
      PlatformRules.ts
    camera/
      CameraDirector.ts
    world/
      AreaLoader.ts
      TriggerSystem.ts
      PuzzleSystem.ts
      CheckpointSystem.ts
    quests/
      QuestStore.ts
    inventory/
      InventoryStore.ts
      EquipmentStore.ts
    dialogue/
      DialogueController.ts
    audio/
      AudioDirector.ts
    saves/
      SaveSchema.ts
      SaveRepository.ts
      IndexedDbSaveRepository.ts
      TauriSaveRepository.ts
      MemorySaveRepository.ts
      SaveService.ts
      migrations.ts
    input/
      InputActions.ts
      InputService.ts
      bindings.ts
    ui/
      HudController.ts
      MenuController.ts
      dom/
    effects/
      EffectPool.ts
      ParticleProfiles.ts
    testing/
      TestBridge.ts
public/
  assets/
    atlases/
    backgrounds/
    portraits/
    ui/
    audio/
  manifest.webmanifest
  icons/
src-tauri/
docs/
tests/
e2e/
```

## Task 1: Project Foundation and Deterministic Shell

**Files:**

- Create: `package.json`, `package-lock.json`, `index.html`
- Create: `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`
- Create: `eslint.config.js`, `.prettierrc.json`, `.prettierignore`
- Create: `src/main.ts`, `src/styles/global.css`, `src/styles/shell.css`
- Test: `tests/smoke/project-config.test.ts`

**Interfaces:**

- Produces `createGame(parent: string): Phaser.Game` from `src/main.ts`.
- Produces npm scripts `dev`, `build`, `preview`, `typecheck`, `test`,
  `test:watch`, `test:e2e`, `lint`, `format`, `format:check`, `check`, `tauri`.

- [ ] Install pinned runtime and development dependencies and commit the lockfile.
- [ ] Configure strict TypeScript with DOM and ES2022 libraries.
- [ ] Configure Phaser canvas/WebGL shell at 1280 × 720 with letterboxing.
- [ ] Add a config test that asserts strict mode and required scripts.
- [ ] Run `npm run typecheck`, `npm run test`, and `npm run build`.

## Task 2: Core Contracts and Lifecycle

**Files:**

- Create: `src/game/core/GameEvents.ts`
- Create: `src/game/core/ServiceRegistry.ts`
- Create: `src/game/core/SceneScope.ts`
- Create: `src/game/core/StateMachine.ts`
- Test: `tests/core/StateMachine.test.ts`, `tests/core/SceneScope.test.ts`

**Interfaces:**

- `StateMachine<S, C>.request(next: S, context: C): boolean`
- `SceneScope.add(cleanup: () => void): void`
- `SceneScope.dispose(): void`
- `GameEventMap` supplies payload types for all event names.

- [ ] Write failing transition and cleanup tests.
- [ ] Implement guarded transition tables and idempotent cleanup.
- [ ] Implement a typed event emitter wrapper.
- [ ] Verify focused tests and type checking.

## Task 3: Pure Progression Rules

**Files:**

- Create: `src/game/combat/CombatTypes.ts`
- Create: `src/game/combat/DamageResolver.ts`
- Create: `src/game/abilities/CooldownTracker.ts`
- Create: `src/game/inventory/InventoryStore.ts`
- Create: `src/game/inventory/EquipmentStore.ts`
- Create: `src/game/quests/QuestStore.ts`
- Test: `tests/combat/DamageResolver.test.ts`
- Test: `tests/abilities/CooldownTracker.test.ts`
- Test: `tests/inventory/InventoryStore.test.ts`
- Test: `tests/quests/QuestStore.test.ts`

**Interfaces:**

- `resolveDamage(packet: DamagePacket, target: DefenseSnapshot): DamageResult`
- `CooldownTracker.tryUse(id: AbilityId, nowMs: number): boolean`
- `InventoryStore.add(itemId: ItemId, quantity: number): InventoryChange`
- `QuestStore.apply(event: QuestEvent): readonly QuestTransition[]`

- [ ] Define branded stable IDs and deterministic data types.
- [ ] Write tests for armour, resistance, block, parry, critical exclusion,
      poise, cooldown time, inventory caps, and quest idempotency.
- [ ] Implement the smallest pure stores that satisfy those tests.
- [ ] Run all pure-rule tests.

## Task 4: Versioned Save System

**Files:**

- Create: `src/game/saves/SaveSchema.ts`
- Create: `src/game/saves/SaveRepository.ts`
- Create: `src/game/saves/MemorySaveRepository.ts`
- Create: `src/game/saves/IndexedDbSaveRepository.ts`
- Create: `src/game/saves/SaveService.ts`
- Create: `src/game/saves/migrations.ts`
- Test: `tests/saves/SaveSchema.test.ts`
- Test: `tests/saves/SaveMigrations.test.ts`
- Test: `tests/saves/SaveRecovery.test.ts`

**Interfaces:**

- `SaveRepository.list(): Promise<readonly SaveSlotPreview[]>`
- `SaveRepository.read(slot: SaveSlotId): Promise<SaveReadResult>`
- `SaveRepository.write(slot: SaveSlotId, save: SaveV1): Promise<void>`
- `SaveRepository.delete(slot: SaveSlotId): Promise<void>`
- `SaveService.export(slot): Promise<string>`
- `SaveService.import(candidateJson): Promise<ImportPreview>`

- [ ] Define schema version 1, defaults, validation errors, envelope checksum,
      and migration result types.
- [ ] Test round-trip, missing optionals, prior-version migration, invalid
      current/valid backup, invalid both, and three-slot isolation.
- [ ] Implement memory and IndexedDB transactional adapters.
- [ ] Implement debounced autosave, import preview, export, and recovery notices.
- [ ] Run save tests in Chromium as well as Vitest where IndexedDB is required.

## Task 5: Input Abstraction and Settings

**Files:**

- Create: `src/game/input/InputActions.ts`
- Create: `src/game/input/bindings.ts`
- Create: `src/game/input/InputService.ts`
- Create: `src/game/config/accessibility.ts`
- Test: `tests/input/InputService.test.ts`
- Test: `tests/input/bindings.test.ts`

**Interfaces:**

- `InputService.sample(nowMs: number): Readonly<InputFrame>`
- `InputService.rebind(action: InputAction, binding: Binding): RebindResult`
- `InputService.clearTransient(): void`

- [ ] Test keyboard aliases, gamepad axes/deadzones, buffering, rebind conflict,
      focus loss, hold/toggle, and serialisation.
- [ ] Implement device adapters behind semantic actions.
- [ ] Persist bindings and accessibility/audio settings through `SaveService`.
- [ ] Add haptic calls as optional progressive enhancement.

## Task 6: Boot, Loading, Title, Save Slots, and Credits

**Files:**

- Create: `src/game/scenes/BootScene.ts`
- Create: `src/game/scenes/PreloadScene.ts`
- Create: `src/game/scenes/TitleScene.ts`
- Create: `src/game/scenes/TransitionScene.ts`
- Create: `src/game/ui/dom/menuShell.ts`
- Modify: `src/main.ts`
- Test: `e2e/title.spec.ts`

**Interfaces:**

- Scene keys are exported through `SceneKeys`.
- Title actions issue `new-game`, `load-slot`, `delete-slot`, `open-settings`,
  and `open-credits` commands.

- [ ] Build accessible keyboard/gamepad title navigation and three slot cards.
- [ ] Show deterministic load progress plus retryable asset errors.
- [ ] Add new-game confirmation, delete confirmation, import/export, and credits.
- [ ] Write Playwright checks for title readiness and new-game transition.

## Task 7: Data Schemas and First Playable Area Runner

**Files:**

- Create: `src/game/data/types.ts`
- Create: `src/game/data/areas.ts`
- Create: `src/game/data/actors.ts`
- Create: `src/game/data/attacks.ts`
- Create: `src/game/data/abilities.ts`
- Create: `src/game/data/items.ts`
- Create: `src/game/data/quests.ts`
- Create: `src/game/data/dialogue.ts`
- Create: `src/game/world/AreaLoader.ts`
- Create: `src/game/scenes/WorldScene.ts`
- Test: `tests/data/contentValidation.test.ts`

**Interfaces:**

- `validateContent(registry: ContentRegistry): readonly ContentIssue[]`
- `AreaLoader.load(definition: AreaDefinition): LoadedArea`

- [ ] Define stable schemas for surfaces, layers, actors, attacks, triggers,
      mechanisms, checkpoints, transitions, props, ambience, and rooms.
- [ ] Validate all cross-referenced IDs and required boss/content fields.
- [ ] Build a typed Brackenreach room using final scale and collision metrics.
- [ ] Add development-only collision/spawn/trigger/room debug overlay.

## Task 8: Responsive Player Movement and Camera

**Files:**

- Create: `src/game/physics/MovementModel.ts`
- Create: `src/game/physics/PlatformRules.ts`
- Create: `src/game/entities/player/PlayerState.ts`
- Create: `src/game/entities/player/PlayerController.ts`
- Create: `src/game/entities/player/PlayerView.ts`
- Create: `src/game/camera/CameraDirector.ts`
- Test: `tests/physics/MovementModel.test.ts`
- Test: `tests/physics/PlatformRules.test.ts`
- Test: `e2e/movement.spec.ts`

**Interfaces:**

- `stepMovement(state, input, contacts, tuning, dt): MovementStep`
- `CameraDirector.follow(target, roomBounds, options): void`

- [ ] Test acceleration, friction, coyote time, input buffer, variable jump,
      fall cap, landing, drop-through, ladder, knockback, and respawn reset.
- [ ] Implement player FSM and animation intent output.
- [ ] Implement camera dead zone, look-ahead, vertical smoothing, boundaries,
      reduced motion, and cinematic framing.
- [ ] Tune at 60 Hz and simulated moderate frame drops.

## Task 9: Combat, Abilities, and Feedback

**Files:**

- Create: `src/game/combat/HitboxSystem.ts`
- Create: `src/game/combat/StatusEffects.ts`
- Create: `src/game/abilities/AbilitySystem.ts`
- Create: `src/game/effects/EffectPool.ts`
- Create: `src/game/effects/ParticleProfiles.ts`
- Modify: `src/game/entities/player/PlayerController.ts`
- Test: `tests/combat/HitboxSystem.test.ts`
- Test: `tests/abilities/AbilitySystem.test.ts`
- Test: `e2e/combat.spec.ts`

**Interfaces:**

- `HitboxSystem.activate(ownerId, AttackDefinition, facing): AttackInstance`
- `AbilitySystem.tryCast(abilityId, actorSnapshot): AbilityResult`

- [ ] Implement light combo, air slash, charged strike, block/parry, dash,
      Lumen Bolt, Aegis Veil, and Resonant Pulse.
- [ ] Implement anticipation/active/recovery, cooldowns, mana, stagger,
      invulnerability, projectiles, hazards, and status hooks.
- [ ] Add hit-stop, shake, slash trails, flashes, optional damage labels, audio
      cues, and accessibility scaling.
- [ ] Verify no render-bound hit detection remains.

## Task 10: Enemy AI and Encounters

**Files:**

- Create: `src/game/ai/Perception.ts`
- Create: `src/game/ai/EncounterDirector.ts`
- Create: `src/game/entities/enemies/EnemyController.ts`
- Create: `src/game/entities/enemies/EnemyFactory.ts`
- Create: one focused profile module per enemy under
  `src/game/entities/enemies/profiles/`
- Test: `tests/ai/Perception.test.ts`
- Test: `tests/ai/EncounterDirector.test.ts`

**Interfaces:**

- `EnemyFactory.create(spawn: EnemySpawnDefinition): EnemyController`
- `EncounterDirector.requestAttack(enemyId, profile): AttackGrant`

- [ ] Implement sleep, idle, patrol, suspect, chase, telegraph, attack, recover,
      retreat, hurt, stagger, and death states.
- [ ] Add line of sight, edges, leash, camera-safe ranged attacks, configurable
      drops/resistances, and attacker slots.
- [ ] Implement Briar Scrapper, Duskwing, Spore Scribe, Barkbound, Rootlurker,
      and elite Thorn Sentinel profiles.
- [ ] Tune mixed encounters and verify fair offscreen behaviour.

## Task 11: World Interaction, NPCs, Quest, Shop, and Checkpoints

**Files:**

- Create: `src/game/world/TriggerSystem.ts`
- Create: `src/game/world/CheckpointSystem.ts`
- Create: `src/game/dialogue/DialogueController.ts`
- Create: `src/game/entities/npcs/NpcController.ts`
- Create: `src/game/scenes/DialogueScene.ts`
- Create: `src/game/ui/ShopController.ts`
- Test: `tests/world/CheckpointSystem.test.ts`
- Test: `tests/dialogue/DialogueController.test.ts`
- Test: `tests/quests/SilentBloom.test.ts`

**Interfaces:**

- `CheckpointSystem.restore(save, area): RestoredCheckpoint`
- `DialogueController.start(nodeId, context): DialoguePage`

- [ ] Add Sela, Orin, and Piri with conditional original dialogue.
- [ ] Implement The Silent Bloom quest, two optional discoveries, shop,
      currency, XP, health/mana upgrades, two blade upgrades, and charms.
- [ ] Implement seed-lantern checkpoint, death, respawn, and autosave.
- [ ] Ensure chests, shortcuts, discoveries, and quest events are idempotent.

## Task 12: Complete Region, Cave, and Dungeon

**Files:**

- Modify: `src/game/data/areas.ts`
- Create: `src/game/world/PuzzleSystem.ts`
- Create: `src/game/world/BreakableSystem.ts`
- Create: area content modules under `src/game/data/areas/`
- Test: `tests/world/PuzzleSystem.test.ts`
- Test: `tests/data/worldGraph.test.ts`

**Interfaces:**

- `PuzzleSystem.apply(mechanismId, activation, worldState): PuzzleResult`

- [ ] Author Wren's Rest, Brackenreach Trail, Listening Arch, Singing Hollows,
      Reliquary Verge, Vestibule, Flooded Stacks, Resonance Gallery, and Hollow Choir.
- [ ] Place main routes, branches, shortcuts, ladders, one-way platforms,
      hazards, bramble dash gates, breakable walls, suspicious clues, keys, lenses,
      checkpoints, safe zones, encounter rests, and landmarks.
- [ ] Make every room discoverable on the map and persist solved state.
- [ ] Run a timed critical-path traversal and optional-route pass.

## Task 13: Multi-Phase Pallid Cantor Boss

**Files:**

- Create: `src/game/entities/bosses/PallidCantorController.ts`
- Create: `src/game/entities/bosses/PallidCantorView.ts`
- Create: `src/game/entities/bosses/pallidCantorAttacks.ts`
- Modify: `src/game/data/actors.ts`, `src/game/data/areas.ts`
- Test: `tests/bosses/PallidCantor.test.ts`
- Test: `tests/saves/BossPersistence.test.ts`

**Interfaces:**

- `PallidCantorController.update(frame): BossFrameResult`
- Boss events: `boss-intro`, `boss-phase`, `boss-health`, `boss-defeated`.

- [ ] Implement intro, arena lock, health bar, phase one attacks, crack
      transition, lens-exposure phase two, stagger openings, defeat, and reward.
- [ ] Add camera framing, telegraphs, music layers, sound cues, and reduced-motion
      variants.
- [ ] Persist defeat before the ending dialogue and protect checkpoint progress.
- [ ] Tune for learned mechanics rather than excessive health.

## Task 14: HUD, Map, Inventory, Journal, Pause, and Accessibility

**Files:**

- Create: `src/game/scenes/UIScene.ts`
- Create: `src/game/scenes/MenuScene.ts`
- Create: `src/game/ui/HudController.ts`
- Create: `src/game/ui/MenuController.ts`
- Create: DOM/CSS menu components under `src/game/ui/dom/`
- Test: `e2e/menus.spec.ts`
- Test: `e2e/settings.spec.ts`

**Interfaces:**

- Menu tabs: `map`, `inventory`, `equipment`, `journal`, `settings`.

- [ ] Implement health, mana, spell, currency, prompts, boss health,
      notifications, autosave indicator, and dialogue presentation.
- [ ] Implement discovered-room map, inventory/equipment, quest journal, pause,
      settings, death/respawn, save slots, and credits.
- [ ] Implement all specified accessibility settings and full keyboard/gamepad
      navigation with visible focus.
- [ ] Verify settings survive reload.

## Task 15: Original Production Art and Animation

**Files:**

- Create: `public/assets/atlases/` sprite sheets and atlas metadata
- Create: `public/assets/backgrounds/` parallax paintings
- Create: `public/assets/portraits/` NPC/dialogue portraits
- Create: `public/assets/ui/` logo, frames, icons, map symbols, menu art
- Create: `public/icons/` PWA and app icons
- Create: `docs/asset-provenance.md`

**Interfaces:**

- Asset keys are declared once in `src/game/data/assets.ts`.

- [ ] Generate or author the Mara animation set, six enemy sets, boss states,
      terrain/ruin/cave/building/dungeon kits, props, pickups, chests, doors,
      checkpoints, portraits, HUD/inventory/spell icons, three-plus background
      layers, logo, menu art, and icons.
- [ ] Trim, atlas, and annotate every gameplay asset at consistent scale.
- [ ] Replace all development art and audit scenes for debug primitives.
- [ ] Record tool, prompt summary, authorship, licence, and modifications.
- [ ] Compare representative captured frames against `docs/art-direction.md`.

## Task 16: Original Audio and Mix

**Files:**

- Create: `src/game/audio/AudioDirector.ts`
- Create: `src/game/data/audio.ts`
- Create: `public/assets/audio/music/`, `ambience/`, `sfx/`
- Modify: `docs/asset-provenance.md`
- Test: `tests/audio/AudioDirector.test.ts`

**Interfaces:**

- `AudioDirector.transitionMusic(cueId, options): void`
- Channels: `master`, `music`, `sfx`, `ambience`.

- [ ] Produce main menu, outdoor, dungeon, and boss loops plus required
      ambience/SFX using original synthesis or properly licensed sources.
- [ ] Add clean loop points, variations, pitch jitter, concurrency limits,
      focus mute, and channel settings.
- [ ] Add subtitles/captions for semantically important non-speech cues.
- [ ] Verify unlock-on-input and Safari/WebView-safe playback.

## Task 17: PWA and Tauri 2 Packaging

**Files:**

- Modify: `vite.config.ts`
- Create: `public/manifest.webmanifest`
- Create: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`
- Create: `src-tauri/src/lib.rs`, `src-tauri/src/main.rs`
- Create: `src/game/saves/TauriSaveRepository.ts`
- Test: `e2e/pwa.spec.ts`

**Interfaces:**

- Runtime repository selection checks Tauri capability without importing native
  code in the browser path.

- [ ] Configure installable manifest, icons, cached application shell, update
      prompt, and offline reload.
- [ ] Configure Tauri 2 with persistent application-data storage and no
      development-directory dependency.
- [ ] Add native save adapter parity tests.
- [ ] Run browser PWA checks.
- [ ] Install/use Rust if available, then run `npm run tauri dev` and
      `npm run tauri build`; otherwise record the precise external blocker.

## Task 18: Full Verification, Polish, and Handoff

**Files:**

- Create: `playwright.config.ts`
- Create: `e2e/full-path.spec.ts`
- Create: `docs/known-issues.md`
- Create/modify: `README.md`
- Modify: `docs/progress.md`

**Interfaces:**

- `window.__RIVENBLOOM_TEST__` exposes read-only state and gated semantic actions
  in development/test builds.

- [ ] Run Prettier, ESLint, strict type checking, all unit tests, production
      build, and Playwright smoke tests.
- [ ] Launch the built game and test keyboard, detected gamepad, save/reload,
      import/export, desktop resolution, 1024-pixel viewport, high DPI, fullscreen,
      focus loss, reduced motion, and audio.
- [ ] Complete a manual start-to-credits playthrough and boss rematch
      persistence check.
- [ ] Inspect console, network, memory across scene transitions, object counts,
      collision/debug overlay, and service-worker offline behaviour.
- [ ] Fix all severe and obvious issues; document only verified residual
      limitations.
- [ ] Finalise README setup, prerequisites, controls, development, web/PWA,
      save behaviour, testing, and macOS packaging instructions.

## Plan Self-Review

- Every section of the source specification maps to at least one numbered task.
- Stable interface names are defined before consuming tasks.
- Platform persistence is isolated before content work.
- Art and audio are treated as production milestones, not completion-time
  decoration.
- The plan contains no unresolved implementation decisions.
- Native verification is explicitly conditional only on the missing Rust/Cargo
  environment, while the complete Tauri source remains required.
