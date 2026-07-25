# Rivenbloom Project Guide

## Product

Rivenbloom is an original side-view fantasy action-adventure built with Phaser 3
and strict TypeScript. Its world, characters, maps, story, mechanics, names,
visuals, UI, animation, audio, and code must remain recognisably original.

The playable vertical slice follows this route:

`Wren's Rest -> Brackenreach -> Singing Hollows -> Rootglass Reliquary -> Hollow Choir`

The target experience is a polished 20–40 minute first playthrough with a
complete quest, optional discoveries, persistent progression, a dungeon, and a
multi-phase boss.

## Originality and Asset Rules

- Never copy, trace, import, or recreate Swordigo assets, maps, rooms,
  characters, enemies, story beats, dialogue, sound, UI composition, or names.
- Never use copyrighted game screenshots as image-generation references.
- All generated, authored, or licensed assets need an entry in
  `docs/asset-provenance.md`.
- Runtime UI copy remains selectable real text. Do not bake essential text into
  images.
- Debug shapes are allowed only behind `import.meta.env.DEV` overlays. Finished
  gameplay must not expose coloured rectangles, circles, emoji, default Phaser
  textures, or placeholder art.
- Follow `docs/art-direction.md` for silhouettes, palette, rendering, scale,
  animation, effects, and UI.

## Architecture

- TypeScript uses `strict: true`; unchecked `any` is forbidden.
- Prefer composition and small focused services over inheritance.
- Phaser scene classes coordinate lifecycle only. Gameplay rules belong in pure
  modules that can be unit-tested without a canvas.
- Player, enemy, and boss behaviour use explicit finite-state machines.
- Hitboxes and hurtboxes are authored separately from render bounds.
- Game content is data-driven through typed definitions in `src/game/data/`.
- Cross-system communication uses the typed event bus in
  `src/game/core/GameEvents.ts`.
- Input is consumed through `InputService`; entities never bind keys directly.
- Persistence is consumed through `SaveRepository`; scenes never access
  IndexedDB or Tauri APIs directly.
- All repeated projectiles, damage labels, particles, and impact effects use
  pools.
- Every Phaser scene cleans up listeners, timers, colliders, and pooled objects
  during shutdown.
- Do not introduce a god scene, unexplained constants, duplicated combat
  formulas, or platform-specific storage calls in gameplay code.

## Scene Responsibilities

- `BootScene`: renderer checks, settings preload, service registration.
- `PreloadScene`: deterministic asset loading and progress/error presentation.
- `TitleScene`: title, continue/new game, save slots, credits.
- `WorldScene`: loads one typed area definition and coordinates systems.
- `UIScene`: HUD, prompts, boss health, autosave state, notifications.
- `MenuScene`: pause, map, inventory, equipment, journal, settings.
- `DialogueScene`: modal dialogue and choice presentation.
- `TransitionScene`: area fades, death, respawn, and cinematic cards.

## State Machines

Player states:

`idle`, `run`, `jump`, `fall`, `land`, `attackLight`, `attackHeavy`, `airAttack`,
`block`, `parry`, `dash`, `cast`, `climb`, `interact`, `hurt`, `dead`

Enemy states:

`sleep`, `idle`, `patrol`, `suspect`, `chase`, `telegraph`, `attack`, `recover`,
`retreat`, `hurt`, `stagger`, `dead`

Boss states:

`intro`, `phaseOne`, `transition`, `phaseTwo`, `stagger`, `defeat`

State transitions are requested through the owning state machine. Avoid mutating
state names from unrelated systems.

## Data and Save Contracts

- All stable IDs are lowercase kebab-case and never depend on display text.
- Save schema version 1 is defined in `src/game/saves/SaveSchema.ts`.
- Save writes are validated, debounced, transactional, and preserve the previous
  valid record as a backup.
- Persistent sets include opened chests, activated shortcuts, solved puzzles,
  discovered rooms, defeated bosses, claimed discoveries, and quest flags.
- Browser storage uses IndexedDB. Desktop storage uses a Tauri adapter selected
  at runtime. Tests use an in-memory adapter.
- Changes to saved fields require a migration and migration tests.

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
npm run typecheck
npm run lint
npm run format
npm run format:check
npm run test
npm run test:watch
npm run test:e2e
npm run check
npm run tauri dev
npm run tauri build
```

## Testing Requirements

- Pure rules receive deterministic Vitest coverage.
- Tests must cover damage, stats, cooldowns, inventory, quests, save
  serialisation/migration/recovery, input mapping, checkpoints, and boss
  persistence.
- Playwright smoke tests use development-only semantic hooks exposed through
  `window.__RIVENBLOOM_TEST__`; production builds must omit mutation hooks.
- Every bug fix begins with a failing regression test where practical.
- Do not claim a command or platform works unless it was run in the current
  environment.
- Before completion run format check, lint, type check, unit tests, Playwright,
  production build, browser playthrough checks, PWA checks, and available Tauri
  checks.

## Performance and Accessibility

- Logical resolution: 1280 × 720 with contain scaling and letterboxing.
- Target 60 FPS on an Apple-silicon MacBook Air.
- Sleep offscreen enemies and cap particles per effect.
- Support keyboard, common gamepads, rebinding, reduced motion, shake/flash
  intensity, subtitles, scalable text, high-contrast prompts, damage-number
  toggle, hold/toggle settings, and separate audio channels.
- Important motion and flashes must respect accessibility settings.

## Workflow

1. Update `docs/progress.md` when a milestone changes.
2. Write or update the focused test first for pure gameplay rules.
3. Make the smallest complete implementation for that milestone.
4. Run the focused test, then relevant broader checks.
5. Keep docs, controls, save schema, and content data synchronised.
6. Record environmental blockers honestly in `docs/known-issues.md`.

## Definition of Done

The slice is done only when the critical path, dungeon, boss, progression,
secrets, saving, menus, audio, keyboard/controller input, PWA, and documented
browser build are playable; automated checks pass; no production placeholders
remain; and macOS packaging is either verified or precisely documented with the
missing external prerequisite and an otherwise complete Tauri project.
