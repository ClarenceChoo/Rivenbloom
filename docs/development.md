# Rivenbloom developer guide

For controls, exploration, combat, and saves from a player's perspective, see the
[player guide](../README.md).

## Browser development

Rivenbloom uses Phaser 3 and strict TypeScript. The October 7 cloud checks used
Node.js 24.19.0 and npm 11.9.0.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. Build and preview the production artifact with:

```bash
npm run build
npm run preview
```

The fixed logical game world is 1280×720 with contain scaling and letterboxing.
Phone touch gameplay is not supported. Narrow windows show a keyboard/gamepad
notice and retain scrollable menus.

## Browser persistence and offline updates

The browser build stores three transactional save slots in IndexedDB, preserving
the last valid record as a recovery copy. Autosaves are debounced during ordinary
play; boss defeat, area travel, death restoration, and the ending use explicit
durable ordering. Export, import preview, recovery, and deletion are available
from the title screen.

Saves belong to their browser profile and origin, with no cross-device sync.
Storage failures must remain visible as failures or session-only storage rather
than being reported as Saved.

The production build registers an application-shell service worker and web
manifest. It supports standalone installation, offline reload, safe cache
replacement, and a visible reload button when an update is waiting. Accepting
an update pauses interaction and flushes saves before reloading; a failed flush
keeps the current game open.

## Hosting the browser build

Upload the complete `dist/` directory to a dedicated HTTPS origin at `/`.

- Serve `index.html` and `sw.js` with revalidation
  (`Cache-Control: no-cache`).
- Fingerprinted `/assets/` files may use
  `public, max-age=31536000, immutable`.
- Keep `/assets/art/` and other unhashed public files revalidated.
- Keep each build's files together. Subpath hosting requires changing and retesting
  the root URLs.

No public deployment has been performed. Verify the actual HTTPS origin,
installation, offline return, and update flow before distributing its link.

## Desktop build

The Tauri 2 shell uses the same bundled frontend and selects `TauriSaveRepository` at runtime. Its
Rust commands store transactional records under the platform application-data directory rather than
the development checkout.

```bash
npm run tauri -- info
npm run tauri dev
npm run tauri build
```

Native builds require the stable Rust toolchain and Cargo, plus the platform's
Tauri prerequisites. On macOS, install full Xcode and the Apple Command Line Tools.
The Linux cloud host still lacks Rust/Cargo, WebKitGTK 4.1, and librsvg; native
development and packaging have not been verified here.
See [known issues](known-issues.md#native-prerequisites) for detected prerequisites.

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
npm run build
npm run test:pwa:production
```

The production PWA test requires a fresh build and tests the built artifact on localhost. It is separate from development integration tests. Some route/boss tests use explicit fixtures or semantic enemy resolution; they do not establish normal combat balance.

Asset authorship, generation summaries, derivations, and runtime use are recorded in
[asset provenance](asset-provenance.md).

Browser tests use Playwright Chromium. On a host without its browser executable,
install it before the browser suites:

```bash
npx playwright install chromium
```

When the pinned Playwright download is unavailable, the end-to-end configuration can use an installed Chromium. On this cloud host:

```bash
RIVENBLOOM_CHROMIUM_PATH=/usr/bin/chromium RIVENBLOOM_TEST_RENDERER=canvas npm run test:e2e -- --timeout 60000
npm run build
RIVENBLOOM_CHROMIUM_PATH=/usr/bin/chromium RIVENBLOOM_TEST_RENDERER=canvas npm run test:pwa:production
```

Both environment variables are optional; omitting them retains the normal Playwright browser and renderer defaults. The production paint-observation journey requires Canvas and is explicitly skipped without that option; the ordinary production PWA checks still run. Canvas selects Phaser's existing fallback, without changing the shipped renderer preference. The separate IndexedDB Vitest browser suite uses its own Playwright configuration and installed browser.

The October 7 cloud matrix passed 693 unit tests, seven IndexedDB browser tests, 70 development end-to-end scenarios and three production scenarios. The cloud's software WebGL renderer was slow on both baseline and polished builds; this does not establish target-hardware performance.

A fresh production journey reached the ending, continued exploration and reloaded durable progress using ordinary controls and earned upgrades. It used read-only render/save observations, no imported fixture or developer mutation, and included checkpoint recovery and resumed sessions. First-time-player balance, physical controllers, Safari/Firefox, target Mac performance and native packaging still need qualification. The intended 20–40 minute first journey remains a target rather than a measured first-play duration. See [polish verification](polish-verification.md), the [checked route](fresh-production-route.md) and [known issues](known-issues.md).
