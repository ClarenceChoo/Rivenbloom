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
- Use the progressive verification policy below during implementation. For a
  completed slice, release milestone, or materially changed shared
  infrastructure, run format check, lint, type check, unit tests, Playwright,
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

# Agent Operating Policy

Follow project contracts first, then the requested outcome, then speed. Stop
when the requested outcome is verified; do not keep improving adjacent code.

## Scope and Autonomy

- Execute clear, reversible work without asking for confirmation. Ask only when
  a missing choice would materially change the result or expand authority.
- Make the smallest complete change. No speculative features, abstractions,
  refactors, dependencies, or docs.
- Preserve unrelated user changes. Never reset or discard them.
- Diagnose and report without mutating unless the user also requests a fix.
- Do not use subagents unless the user explicitly requests delegation.

## Lean Task Loop

1. Inspect once: check the current diff, then use one shallow, targeted search
   for the relevant symbols and files.
2. Read only the files needed to choose and implement the change. Reuse that
   context; do not reread unchanged files.
3. Edit related files in one coherent batch, following existing patterns.
4. Run the smallest check that can disprove the change.
5. Expand verification only when the risk table below requires it or focused
   evidence reveals broader risk.
6. Review the final diff for touched paths, report results, and stop.

For a small, clear task, skip a written plan. For multi-step work, use one short
actionable plan and update it only when scope changes. Do not create design or
planning documents unless requested. Update `docs/progress.md` only when a real
milestone changes.

## Command and Context Budget

- Every command must answer a specific unresolved question. Batch independent
  read-only checks and filter output to relevant lines.
- Prefer `rg`/`rg --files` with focused paths. Avoid broad scans and ignored or
  generated paths: `node_modules`, `dist`, `build`, `.git`, `.vite`, `coverage`,
  `src-tauri/target`, caches, lockfiles, asset binaries, and generated assets.
- Do not inspect git history, reread `package.json` or configs, or enumerate the
  whole repository unless the task requires it.
- Do not run equivalent checks or repeat a successful command after no relevant
  change. On failure, form one hypothesis, make one focused fix, and rerun only
  the proving check before broadening.
- Do not run `npm install` unless dependencies are missing or changed. Reuse an
  existing dev server and browser session; do not start either for non-visual
  work.
- Summarise large files and command output internally. Never paste routine logs
  or full files to the user.

## Editing Rules

- Prefer targeted patches and existing utilities. Keep modules focused, but do
  not split files merely to reduce line count.
- Add comments only for non-obvious invariants, decisions, or workarounds.
- Add a dependency only when required and no existing capability suffices. Do
  not upgrade unrelated packages or regenerate a lockfile without a dependency
  change.
- Update user-facing docs only when behaviour, setup, controls, architecture, or
  save/content contracts change. Record genuine environment blockers in
  `docs/known-issues.md`.
- Do not create branches, commits, pushes, or pull requests unless requested.

## Proportional Verification

Use the minimum row that fully covers the change:

| Change | Required evidence |
| --- | --- |
| Docs only | Review rendered/relevant text and final diff; no app suite. |
| Pure rule or bug fix | Failing regression test where practical, then nearest focused test. |
| TypeScript implementation | Focused test plus targeted typecheck/lint when applicable. |
| UI or scene | Focused automated check plus affected-flow visual/browser check; reuse the session. |
| Asset only | Load/render check, art-direction review, and provenance entry. |
| Save schema | Migration, migration tests, recovery/serialization tests, and relevant broader checks. |
| Shared infrastructure, dependencies, or config | Format check, lint, typecheck, unit tests, build, relevant Playwright/browser/PWA checks, and available Tauri checks. |
| Completed slice or release milestone | Full release matrix: format, lint, typecheck, unit, Playwright, production build, browser playthrough, PWA, and available Tauri checks. |

Never claim a command, browser flow, or platform works unless verified in the
current environment. After code changes, confirm no temporary logs, debug code,
screenshots, generated test files, or placeholders remain.

## Communication Budget

- Give progress updates only for meaningful findings, blockers, milestones, or
  long-running verification. Do not narrate routine reads and edits.
- Do not restate the request or repeat completed work. Discuss alternatives only
  when a real trade-off needs user input.
- Final response: concise outcome, changed files, checks actually run, and any
  remaining blocker or limitation. Do not suggest optional follow-up work unless
  it is required to finish the request.

## Definition of Done

The slice is done only when the critical path, dungeon, boss, progression,
secrets, saving, menus, audio, keyboard/controller input, PWA, and documented
browser build are playable; automated checks pass; no production placeholders
remain; and macOS packaging is either verified or precisely documented with the
missing external prerequisite and an otherwise complete Tauri project.
