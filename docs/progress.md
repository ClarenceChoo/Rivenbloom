# Rivenbloom Progress

Last updated: 2026-07-25

## Status Legend

- `[x]` complete and inspected
- `[~]` in progress
- `[ ]` not yet complete
- `[!]` blocked by an external prerequisite

## Phase 0 — Discovery and Design

- [x] Read the complete product specification.
- [x] Inspect repository and confirm greenfield state.
- [x] Audit Node/npm, Rust, Xcode, and host environment.
- [x] Establish the original Rivenbloom identity and world graph.
- [x] Compare architectural approaches and select the typed area-runner design.
- [x] Define scenes, services, FSMs, save schema, asset requirements, testing,
  and development milestones.
- [x] Create `AGENTS.md`.
- [x] Create `docs/implementation-plan.md`.
- [x] Create `docs/art-direction.md`.
- [x] Create the reviewed vertical-slice design specification.
- [x] Generate and inspect approved gameplay and title/save-slot visual
  concepts.
- [x] Extract the visual system, copy lock, icon inventory, and fidelity
  checklist.

## Phase 1 — Foundation

- [x] Scaffold strict Phaser 3 + TypeScript + Vite.
- [ ] Configure ESLint, Prettier, Vitest, and Playwright.
- [ ] Add deterministic core state machine, event bus, lifecycle scope, and
  service registry.
- [x] Add required npm scripts and baseline CI-style check.

## Phase 2 — Pure Systems and Persistence

- [ ] Damage and player-stat rules.
- [ ] Cooldowns and ability resource rules.
- [ ] Inventory, equipment, currency, XP, and upgrades.
- [ ] Quest transition store.
- [ ] Versioned save schema and migrations.
- [ ] IndexedDB transactional repository and backup recovery.
- [ ] Three slots, previews, autosave, import/export, and deletion confirmation.
- [ ] Input abstraction, gamepad support, rebinding, and persisted settings.

## Phase 3 — Playable Core

- [ ] Boot, preload, title, save-slot, and transition scenes.
- [ ] Data-driven area runner and content validation.
- [ ] Responsive player movement and camera.
- [ ] Sword combo, air/heavy attacks, block/parry, dash, and spells.
- [ ] Hitboxes/hurtboxes, stagger, knockback, invulnerability, and hazards.
- [ ] Feedback pools, particles, trails, hit-stop, shake, and flashes.

## Phase 4 — World and Content

- [ ] Wren's Rest settlement and three NPCs.
- [ ] Brackenreach outdoor route and hidden room.
- [ ] Singing Hollows cave and dash trial.
- [ ] Rootglass Reliquary dungeon and puzzles.
- [ ] Five standard enemy archetypes.
- [ ] Thorn Sentinel elite.
- [ ] The Silent Bloom main quest.
- [ ] Lost Folio and Lanterns for the Absent optional objectives.
- [ ] Shop, two blade upgrades, spells, charms, health/mana upgrades.
- [ ] Checkpoint, death, respawn, shortcuts, discoveries, and map persistence.

## Phase 5 — Boss and Completion

- [ ] Pallid Cantor intro and arena framing.
- [ ] Four readable phase-one attacks.
- [ ] Porcelain crack phase transition.
- [ ] Lens-based phase two with four variants.
- [ ] Defeat, reward, autosave, ending dialogue, and credits.
- [ ] Boss defeat/checkpoint persistence tests.

## Phase 6 — Presentation

- [ ] Final original Mara sprite/animation set.
- [ ] Final original enemy and boss sprite/animation sets.
- [ ] Terrain, settlement, cave, dungeon, props, doors, chests, checkpoint, and
  collectible art.
- [ ] Three-plus parallax layers per major visual profile.
- [ ] NPC/dialogue portraits, HUD/inventory/spell/map icons, logo, menu art, and
  app icons.
- [ ] Final HUD, dialogue, map, inventory/equipment, journal, pause, settings,
  death, saves, and credits UI.
- [ ] Original/licensed menu, outdoor, dungeon, and boss music.
- [ ] Ambience and full gameplay/UI SFX set.
- [ ] Complete asset provenance record and placeholder audit.

## Phase 7 — Platform

- [ ] Installable PWA manifest, icons, caching, update flow, and offline reload.
- [ ] Tauri 2 source, config, application-data save adapter, and README setup.
- [!] Tauri dev/build verification — Rust/Cargo are not currently installed;
  Apple Command Line Tools are available.

## Phase 8 — Verification

- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] Keyboard playthrough.
- [ ] Gamepad test where detectable.
- [ ] Save/reload, backup recovery, import/export, and delete flow.
- [ ] 16:9, 1024-pixel laptop, browser resize, fullscreen, and high-DPI checks.
- [ ] Reduced-motion, shake/flash, text, prompts, audio, and assist checks.
- [ ] PWA installation/offline check.
- [ ] Tauri development and macOS application build when prerequisites exist.
- [ ] Performance/memory and scene-cleanup pass.
- [ ] `docs/known-issues.md` records only verified limitations.
- [ ] README and final handoff are complete.
