# October 7 polish verification

Source baseline: `13e99991d31358caea5309e70d2f1bceb89c94e1`.
Integration branch: `polish/cohesive-world-pass`, targeting `main` with user authorization. Commit and merge status are recorded in Git history and the pull request. No deployment was performed.

## Changes

- Five original area-specific terrain materials replace stretched atlas props. Tiled solid faces, surface rims and thin one-way ledges follow the authored collision bounds. Coral briars occupy the damaging bounds. Backgrounds, characters and original ten-track soundtrack retain the game's identity.
- Original synthesized impact, danger and resonance cues use bounded voices with cleanup. Audio retries blocked playback, cancels obsolete track retirement on a return transition, respects visibility before the first gesture, and avoids restarting completed ending music.
- Resonance Gallery accepts a pulse that reaches a lens from outside player-body overlap. The room runtime still validates pulse range; quest and ability requirements remain enforced. A failing unit regression reproduced this defect before the fix.
- Fresh keyboard movement and quick taps immediately after Resume are accepted without reopening stale held controls. Two failing input regressions reproduced the neutral-gate defect; three unit cases and a same-task browser regression cover it.
- Browser configuration optionally accepts `RIVENBLOOM_CHROMIUM_PATH` and `RIVENBLOOM_TEST_RENDERER=canvas`. Defaults remain unchanged. The production observation helper reads Canvas drawing calls and IndexedDB records without changing gameplay state or adding a production developer bridge.

## Verified

- Format, ESLint, TypeScript and 693 unit tests (106 files).
- Seven IndexedDB browser tests.
- Production build, with the existing bundle-size advisory.
- Final application code: 70/70 Chromium development browser scenarios, one worker, Canvas fallback. Includes movement/combat, death/respawn, checkpoint/save faults, repeated input, room boundaries and transitions, optional rooms, all-room collision-overlay art review, ending/reload, responsive UI, audio, and the long semantic integration route. The long route deliberately uses developer enemy-defeat actions; it is not a fresh unassisted playthrough.
- Three unchanged normal-stat boss runs passed under Canvas before the final input fix. These use an imported endgame fixture, normal stats and five earned-type healing items, not a fresh journey.
- Fresh production opening-to-ending journey completed with ordinary keyboard/DOM controls and earned items: caches, Briars, root knot, memorial lanterns, Heart Petal, root memory, timed Dash Trial, Sentinel/core/reforge, archive/index/forge/lenses, folio return, Gallery seal, both Cantor phases, credits, Continue exploring and durable reload. No imported save or developer mutation was used; the production bridge was absent. Canvas draw-call observation and IndexedDB reads were read-only. One checkpoint death/recovery occurred in Echo Pool; pauses, reloads and resumed automation commands were used. This was one continuous save lineage, not an uninterrupted speedrun or a first-time-player test.
- The Sentinel's earlier apparent blockage was automation: sleeping enemies were absent from paint observations and the approach left the encounter. Waiting for its visible telegraph, dashing past and attacking defeated it and durably awarded the core. No combat statistics were weakened. The fresh Cantor fight used normal earned 120 health, 56 mana and weapon level 2; one of three purchased healing items was used, with two remaining after victory.
- Boss reload left the arena unlocked with no living Cantor and exactly one sigil. Ending reload retained all three completed quests, exactly one sigil, and Sela's completed dialogue without replaying credits. The save's recorded active play time was approximately 11.4 minutes using a known route; this does not validate the 20–40 minute first-play target.
- Final production matrix: 3/3 passed in 4.6 minutes, including the fresh checkpoint journey, the older full opening-to-Sentinel route after the Resume fix, and service-worker offline/cache/update handling.
- Real browser music decoding/playback, mute gain, pause/resume and retained context were checked; subjective speaker/headphone listening was not.

## Earlier failed diagnostics

- The earlier software-WebGL development matrix passed 66/68. The two failures were the normal-stat boss automation and the Gallery pulse-range progression defect. The latter was reproduced and fixed; the final Canvas matrix and fresh production ending run pass. Software-WebGL combat automation remains an environment-specific qualification limit.
- An experimental software-WebGL boss timing rewrite had one failed run, one interrupted run and one not run. It was reverted. The unchanged Canvas boss scenario passed three repetitions and again in the final matrix.
- Before the input fix, the production matrix passed 2/3; the older route stalled after immediate Resume. Two failing input unit regressions established the neutral-gate defect. Earlier route attempts also exposed fixed-time Dash Trial driving and a withdrawn Sentinel strategy that left the encounter. These are preserved as historical diagnostics, not reported as successful tests.

## Cloud performance A/B

Measured sequentially in system Chromium 151, 1280×720, a fresh village journey, 180 animation frames with the first ten excluded. The baseline and polished app used the same browser and machine. No other browser test ran during this comparison.

| Renderer          | Baseline mean | Polished mean | Baseline / polished p95 |
| ----------------- | ------------: | ------------: | ----------------------: |
| SwiftShader WebGL |      75.39 ms |      77.06 ms |            100 / 100 ms |
| Canvas fallback   |      16.76 ms |      16.67 ms |          16.8 / 16.8 ms |

The renderer reported ANGLE Vulkan SwiftShader Device (Subzero). WebGL task time was about 14 seconds while script time was about 0.2 seconds across the sample. The comparison points to software rendering as the dominant cost, not a large new terrain-code regression. It does not establish target hardware performance, memory stability or a 30-minute soak result.

## Reproduction

```sh
npm ci
npm run check
npm run build
RIVENBLOOM_CHROMIUM_PATH=/usr/bin/chromium RIVENBLOOM_TEST_RENDERER=canvas npm run test:e2e -- --timeout 60000
RIVENBLOOM_CHROMIUM_PATH=/usr/bin/chromium RIVENBLOOM_TEST_RENDERER=canvas npm run test:pwa:production
```

Use a locally installed Playwright browser instead by omitting `RIVENBLOOM_CHROMIUM_PATH`. The pinned browser download was denied by this cloud environment. Canvas observation requires the Canvas option; ordinary WebGL production checks remain separate.

## Open qualification

First-time-player balance, physical gamepad/disconnect, Safari/Firefox, subjective audio listening, target MacBook Air profiling and a 30-minute soak remain open. Native compilation is blocked by missing Rust/Cargo/rustup, WebKitGTK 4.1 and librsvg. Public hosting, installability on an actual HTTPS origin, signing and distribution were not attempted.

No zero-bug or release-ready claim is made.
