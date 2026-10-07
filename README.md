# Rivenbloom

Rivenbloom is an original side-view fantasy action-adventure built with Phaser 3 and strict
TypeScript. The vertical slice follows Mara from Wren's Rest through Brackenreach, the Singing
Hollows, and the Rootglass Reliquary to a multi-phase confrontation in the Hollow Choir.

## Run the browser build

Verified environment: Node.js 24.3.0 and npm 11.4.2. Dependencies must support your installed Node version.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Production commands:

```bash
npm run build
npm run preview
```

This candidate is being qualified in desktop Chromium. Safari, Firefox, physical gamepads, and a normal-stat first-time playthrough still need qualification. The intended first journey is 20–40 minutes; that duration is not yet measured. Phone touch gameplay is not supported. Narrow windows show a keyboard/gamepad notice and retain scrollable menus.

## Controls

| Action                 | Keyboard           | Common gamepad                     |
| ---------------------- | ------------------ | ---------------------------------- |
| Move / menu navigation | Arrow keys or WASD | Left stick / D-pad                 |
| Jump                   | Space              | South face button                  |
| Light attack           | J                  | West face button                   |
| Heavy attack           | K                  | North face button                  |
| Block / parry          | L                  | Left shoulder                      |
| Wayfinder Dash         | Left Shift         | East face button                   |
| Cast selected art      | Q                  | Right trigger/button 7             |
| Cycle cast art         | R                  | Left trigger/button 6              |
| Interact / confirm     | E / Enter          | Right shoulder / south face button |
| Pause / cancel         | Escape / Backspace | Menu / east face button            |

Keyboard gameplay bindings, including all four movement directions, can be changed from Pause → Settings and are stored per journey. Hold Up near a ladder to catch and align with it; the HUD shows an Up prompt when a climb is available.
Settings include difficulty, reduced motion, shake and flash intensity, subtitles, scalable text,
high-contrast prompts, damage numbers, hold/toggle behavior, separate audio channels, and focus mute.

## Saves and offline play

The browser build stores three transactional save slots in IndexedDB, preserving the last valid
record as a recovery copy. Autosaves are debounced during ordinary play; boss defeat, area travel,
death restoration, and the ending use explicit durable ordering. Export, import preview, recovery,
and deletion are available from the title screen. Saves are local to this browser profile and origin; they do not sync between devices. Export a backup before clearing browser data or moving to another origin. If durable storage fails, the HUD reports failure or session-only storage instead of Saved.

The production browser build registers an application-shell service worker and web manifest. It
supports standalone installation, offline reload, safe cache replacement, and a visible reload
button when an update is waiting. Accepting an update pauses interaction and flushes saves before reload; a failed flush keeps the current game open.

For hosting, upload the complete `dist/` directory to a dedicated HTTPS origin at `/`. Serve `index.html` and `sw.js` with revalidation (`Cache-Control: no-cache`); fingerprinted `/assets/` files may use `public, max-age=31536000, immutable`. Keep `/assets/art/` and other unhashed public files revalidated. Do not mix files from different builds or use a subpath without changing and retesting all root URLs. No public deployment has been performed. Verify the actual HTTPS origin, installation, offline return, and update flow before distributing its link.

## Desktop build

The Tauri 2 shell uses the same bundled frontend and selects `TauriSaveRepository` at runtime. Its
Rust commands store transactional records under the platform application-data directory rather than
the development checkout.

```bash
npm run tauri -- info
npm run tauri dev
npm run tauri build
```

Native builds require the stable Rust toolchain, Cargo, full Xcode, and the Apple Command Line Tools.
See `docs/known-issues.md` for the prerequisites detected on the current host.

## Architecture

- Phaser scenes coordinate lifecycle only; pure modules own movement, combat, puzzles, progression,
  saving, boss rules, and transition ordering.
- Player, enemy, and boss behavior use explicit finite-state machines.
- Typed area data defines all rooms, surfaces, zones, triggers, encounters, mechanisms, checkpoints,
  rewards, and transitions.
- `InputService`, `SaveRepository`, and the typed event bus isolate platform and cross-system work.
- Repeated combat feedback uses pools, and every scene owns cleanup through scoped disposers.
- Production UI is selectable, accessible HTML layered over a fixed 1280×720 Phaser world.

## Verification

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:saves:browser
npm run test:e2e
npm run test:browsers:smoke
npm run build
npm run test:pwa:production
npm run test:soak:production
```

The production PWA test requires a fresh build and tests the built artifact on localhost. It is separate from development integration tests. Some route/boss tests use explicit fixtures or semantic enemy resolution; they do not establish normal combat balance.

Development acceptance runs use a separate server on port 4176 with hot reload disabled, leaving the interactive development server on 4173 available. Chromium uses the full browser's hardware renderer when available. Install the pinned browser runtimes with `npx playwright install chromium firefox webkit` before the three-engine smoke suite. The opt-in production soak runs 60 menu/title/save cycles over 30 minutes and measures collected heap and DOM resources in Chromium; it does not certify target-hardware frame rate.

The required Surveyor Edge reforge consumes the earned briar core and costs no Resin, so spending on optional supplies cannot block the main quest.

Asset authorship, generation summaries, derivations, and runtime use are recorded in
`docs/asset-provenance.md`.

## Illustrated wiki

The Wayfinder’s Companion is a separate storybook wiki with walkthroughs, a world
atlas, dungeon and boss guides, search, and a discovery checklist. Start it with
`npm --prefix wiki run dev`, or build its static site with
`npm --prefix wiki run build`. See [wiki setup and GitHub Pages publishing](wiki/README.md).
Its Pages workflow publishes only the wiki, not the game.
