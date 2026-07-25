# Task 6 Report — Boot, Loading, Title, Save Slots, and Credits

## Status

DONE_WITH_CONCERNS

Product commit: `95fe61d4812580c82323a22f5642c2968ea9ee1a`

## Delivered

- Added stable `SceneKeys` and four focused Phaser coordinators:
  - `BootScene` validates the renderer, registers input/save/accessibility
    services, probes IndexedDB, and falls back to an in-memory repository with
    a visible warning.
  - `PreloadScene` loads the production title group deterministically, exposes
    progress, identifies failed asset keys, and offers an in-surface retry.
  - `TitleScene` coordinates semantic input, save previews, command execution,
    import/export, confirmed destructive actions, settings, and credits.
  - `TransitionScene` owns the deterministic `WREN'S REST` destination card;
    Task 7 remains responsible for the actual world runner.
- Added a code-native, selectable DOM title shell with the locked initial copy,
  a left-side wordmark/open menu rail, and one right-side seed-pod drawer
  containing three inset horizontal rows.
- Integrated
  `public/assets/ui/title-wrens-rest-background.png` directly as the full-bleed
  title background. The concept image is not loaded at runtime and no colour
  wash is applied; only narrow edge fades support readability.
- Added visible focus, minimum 44 × 44 logical targets, native pointer/Tab
  support, and keyboard/common-gamepad semantic navigation through
  `InputService`.
- Added runtime text scaling, reduced-motion behavior, high-contrast prompts,
  settings controls, and custom non-browser-default control typography.
- Added `new-game`, `load-slot`, `delete-slot`, `open-settings`, and
  `open-credits` commands. New-game overwrite, deletion, and import all require
  explicit custom confirmation.
- Import uses `SaveService.import` for preview and
  `SaveService.confirmImport` for the confirmed write. Export uses
  `SaveService.export`.
- Added an input regression fix so a fast key press/release occurring between
  Phaser samples remains a semantic `pressed` action.
- Updated public milestone progress and retained the controller-provided asset
  provenance record.

## TDD Evidence

### Required Playwright RED

Command:

```text
npx playwright test e2e/title.spec.ts --reporter=line
```

The first sandboxed attempt stopped before assertions because Vite could not
bind localhost:

```text
Error: listen EPERM: operation not permitted 127.0.0.1:4173
```

After narrowly scoped localhost approval and moving to the free port `4186`,
the implementation-free test reached its intended RED state:

```text
1 failed
expect(locator).toBeVisible() failed
Locator: getByRole('heading', { name: 'RIVENBLOOM', level: 1 })
Error: element(s) not found
```

The production change required to make it pass was an accessible title surface
and scene flow, not a test selector bridge.

### Pure title model RED

The first collection run proved the desired module did not exist. A compiling
stub was then introduced so assertion-level RED could be observed:

```text
npm test -- tests/ui/TitleMenuModel.test.ts
3 failed
expected +0 to be 3
expected '' to be '00:00:00'
expected null to deeply equal { type: 'load-slot', slotId: 'slot-2' }
```

These failures cover wraparound navigation, hand-derived metadata formatting,
and the available/empty slot command branch.

GREEN:

```text
npm test -- tests/ui/TitleMenuModel.test.ts
Test Files 1 passed (1)
Tests 3 passed (3)
```

### Fast semantic key-tap regression RED

The first Playwright GREEN attempt failed because ArrowDown began and ended
between Phaser frames, leaving `NEW GAME` unfocused. A focused unit regression
was added before changing `InputService`:

```text
npm test -- tests/input/InputService.test.ts
1 failed, 9 passed
expected pressed: ['move-down']
received pressed: []
```

GREEN after queuing keyboard edge presses until the next sample:

```text
npm test -- tests/input/InputService.test.ts tests/ui/TitleMenuModel.test.ts
Test Files 2 passed (2)
Tests 13 passed (13)
```

### Playwright GREEN

```text
npm run test:e2e
1 passed
```

The test verifies title readiness, real accessible roles, the dedicated runtime
background (and absence of the concept path), initial focus, quick semantic
ArrowDown/Enter navigation, three empty slot rows, explicit New Game
confirmation, save creation, and the `wrens-rest` destination state without
page errors.

## Files Changed

### Scenes and services

- `src/game/core/GameServices.ts`
- `src/game/scenes/BootScene.ts`
- `src/game/scenes/PreloadScene.ts`
- `src/game/scenes/SceneKeys.ts`
- `src/game/scenes/TitleScene.ts`
- `src/game/scenes/TransitionScene.ts`
- `src/main.ts`

### DOM, rules, styling, and input

- `src/game/ui/dom/menuShell.ts`
- `src/game/ui/title/TitleMenuModel.ts`
- `src/game/input/InputService.ts`
- `src/styles/global.css`
- `src/styles/shell.css`

### Tests and configuration

- `e2e/title.spec.ts`
- `playwright.config.ts`
- `tests/ui/TitleMenuModel.test.ts`
- `tests/input/InputService.test.ts`

### Art and documentation

- `public/assets/ui/title-wrens-rest-background.png`
- `docs/asset-provenance.md`
- `docs/progress.md`

The controller-owned
`.superpowers/sdd/implementation-plan/progress.md` remains modified but
unstaged and was not edited or included in the product commit.

## Verification

Final commands and results:

```text
npm run format:check
PASS — all files matched Prettier

npm run lint
PASS — no ESLint errors or warnings

npm run typecheck
PASS — application and test TypeScript projects

npm test
PASS — 14 files, 96 tests

npm run test:e2e
PASS — 1 Playwright title flow

npm run build
PASS — Vite production build

npm run check
PASS — format, lint, typecheck, unit tests, and production build
```

No dependencies were added.

## Rendered QA

Temporary screenshots were captured from the real Vite runtime and visually
inspected:

- `/tmp/rivenbloom-title-1280.png` at 1280 × 720
- `/tmp/rivenbloom-title-1024.png` at 1024 × 720

At 1280 × 720:

- the background remains natural and full bleed;
- the original code-native seed/wordmark and open rail stay in the left half;
- one coherent seed-pod drawer occupies the right half;
- all three rows remain horizontal and inset;
- the mint selected leaf, cream/copper edge, slot typography, and copper footer
  line are legible;
- no browser-default controls, concept pixels, placeholder textures, emoji,
  fake metadata, or extra initial copy appear.

At 1024 × 720:

- the shell preserves 16:9 containment with expected top/bottom letterboxing;
- the title remains two-column rather than becoming a mobile product page;
- the narrower drawer, all three rows, menu labels, and footer prompts remain
  unclipped and readable.

## Self-Review

- Scene classes coordinate lifecycle and service calls; navigation/formatting
  rules live in a pure tested model and DOM construction lives in the shell.
- Title save access is restricted to `SaveService`/`SaveRepository`; scenes
  contain no direct IndexedDB or platform storage calls.
- Semantic keyboard/gamepad behavior is sampled through `InputService`. The
  shell's key listener only suppresses duplicate browser-native activation; it
  does not map keys to title behavior.
- Pointer and native Tab behavior coexist with semantic navigation. Drawer
  tools, modal actions, checkbox, and text-scale selection are included in the
  semantic focus traversal.
- Phaser loader listeners, scene shutdown listeners, input transient state, and
  DOM roots are disposed at shutdown. Game-lifetime input/save resources are
  disposed on Phaser game destruction.
- Search found no production mutation hook or runtime reference to the title
  concept.
- Stable slot and destination IDs remain lowercase kebab-case.
- Import and deletion cannot mutate data without a second explicit confirmation.

## Concerns

- Vite reports the existing Phaser entry bundle as larger than 500 kB
  (`~1,249 kB`, `~345 kB` gzip). The build succeeds; code splitting should be
  considered when later scenes materially increase the bundle.
- Browser automation exercises keyboard semantics but this environment has no
  physical gamepad hardware. Common-gamepad bindings and semantic sampling have
  existing unit coverage; physical-device feel remains a later manual QA item.
- PWA and Tauri checks are outside Task 6 because those projects are not yet
  implemented; the repository already records Rust/Cargo as unavailable for
  later native verification.
