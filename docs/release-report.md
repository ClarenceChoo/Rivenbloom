# Rivenbloom Browser/PWA Candidate Report

Date: 2026-10-07

**Status: implementation candidate; release qualification remains open. No public deployment.**
The reviewed gameplay and presentation gaps now have implementations and focused regressions. This is not a claim that Gates A–D of the [share-ready plan](superpowers/plans/2026-09-23-share-ready-release.md) have passed. Human playtesting, physical controls, listening, performance, and hosted delivery remain separate evidence.

## October 7 release fixes

The Dash Trial now exposes its authored instructions, plate count and simulation-time countdown as selectable HUD text. Expired plate lights reset in the projection; the nine-second puzzle rule and saved fields are unchanged. Captions, interaction prompts, boss health and essential trial help share a bottom stack. Portrait layout uses compact selectable trial help and health/mana meters while retaining both numeric values and save status. Regressions caught vertical guidance overlap and overlapping health/mana glyphs at the actual 200% setting; both pass after the layout changes, with screenshot review at 390×844.

Pause Settings previously clamped the title screen's 200% text preference to 150%. The shared supported maximum is now 200%, and opening and applying Pause Settings preserves it. The title-to-Pause regression failed at 1.5 before the change and passes at 2 afterward. Fifteen settings/maximum-scale menu checks and six portrait guidance/HUD-retention checks passed across Chromium, Firefox and WebKit on the current implementation. Browser zoom and actual Safari qualification remain separate.

Orin’s mandatory Surveyor Edge reforge now consumes the briar core without charging Resin. Previously, spending the finite pre-dungeon cache rewards on optional supplies could leave the main quest permanently blocked. A zero-currency purchase regression failed before the change and passes after it, including core consumption, the weapon upgrade and the one-time ledger after reload.

Repeated title/world transitions retained two Chromium DOM nodes per cycle even after retired audio elements were disconnected and reloaded. Music now reuses a bounded cache keyed by authored file and cancels retirement when a track returns during its crossfade. Disposal releases every cached media source. Rapid-return and disposal regressions pass. The earlier cleanup attempt grew by 40 nodes over 20 title returns; the bounded-cache measurements stayed stable. A strict production soak completed 60 title/world/save/menu cycles over 1,804,457 ms, with 500 DOM nodes and 10 documents at both endpoints, no page errors, and collected heap growth from 9,157,712 to 10,124,068 bytes (0.92 MiB). That soak preceded the final 200% layout changes. The final production artifact then passed 20 cycles with 507 DOM nodes at both endpoints. Neither measurement establishes target MacBook Air frame rate.

Development acceptance uses port 4176 with HMR disabled only under `RIVENBLOOM_TEST=1`. Earlier traversal traces showed Vite reconnecting and booting the game into the title screen during concurrent workspace edits. The task did not stop the pre-existing interactive server on 4173. Boss driving observes accepted combo frames and simulation time; Chromium acceptance uses the full browser renderer. These changes do not alter combat damage, puzzle duration or encounter balance.

A short Pause press could also disappear when a render frame advanced no simulation steps. Pause now uses the existing InputService buffer, consumed at the next gameplay step. The deterministic regression failed before the change and passes after it.

Formatting, ESLint, strict TypeScript and **105 files / 692 unit tests** pass in this environment. The final production build passes with a 1,696.67 KB main JavaScript bundle (448.61 KB gzip) and Vite's chunk-size advisory. The 73-scenario Chromium run passed 72 scenarios; the remaining canonical traversal passed its focused rerun in 5.1 minutes after movement was changed to wait for an observed prompt or position. The related ladder, Sentinel flank, first-pair checkpoint and fresh Briar/Root-Knot route then passed 4/4. With the additional title-to-Pause text-scale regression, all 74 distinct development scenarios have passing evidence across broad and focused runs, not a single clean 74/74 run. Both boss scenarios and durable ending/credits passed in the broad run, and the normal-stat boss passed 3/3 additional repeats after the Pause fix. Those boss runs use imported saves.

All 54 distinct Chromium/Firefox/WebKit smoke scenarios have passing evidence across the initial 50/54 run, 35/36 title checks and a 3/3 focused outline check. WebKit title Tab navigation now uses the existing focus model, and setting changes restore focus to the changed control. Native checkbox shadows differ by engine; screenshot review and assertions verify the visible three-pixel focus outline. The additional 21 current maximum-scale/layout checks described above also pass across the three engines. The final production suite passed all four short scenarios in one run, with the separately completed long soak skipped by default. Every one of the 12 MP3 files decoded, village playback advanced, and offline/update acceptance passed. A final regular-profile Chromium audit reported no manifest or installability errors, no page errors, no exposed developer bridge and no developer-route markers in the main production JavaScript. The initial incognito audit reported only Chromium's incognito installation restriction. This local audit does not qualify a hosted HTTPS origin. The fresh route passed in 2.4 minutes after neutral frames were added at room boundaries; it reaches live Sentinel contact, not an ending. Prior dated results below describe their original candidate.

A separate ordinary-control continuation died in Singing Hollows, respawned with quest progress intact, solved the trial and rested at Reliquary Verge. It did not establish a Sentinel win. Its temporary driver then failed while attempting save export because its Manage-button locator was incorrect and its pending download wait was not handled. That is a driver failure, not evidence of a game export failure. No fresh full-route or balance claim comes from this attempt.

Task-owned browser workers and the production preview were stopped after verification. No listeners remained on 4173, 4174 or 4176 at the final check; the pre-existing 4173 process was not stopped by this task. Temporary drivers, logs and screenshots stayed outside the repository.

## September 23–24 follow-up QA

The no-hook production journey accepts Sela's first quest through real movement and dialogue, saves and reloads it, crosses into Brackenreach with the objective intact, activates the trailhead lantern, opens the optional Wayfarer Cache, and retains its 20 Resin after another reload. Screenshot review caught a false positive in the initial combat check: the player was still beside the cache, and the Lumen Bolt spent mana in empty space. The corrected route moves into the first Briar, checks that contact changes health, retries the spell until its mana cost is accepted, and verifies survival; this encounter check passed two repeated runs. It continues with real movement and jumps through Listening Arch, Hollows Mouth and Echo Pool into the Root-Memory Chamber. It activates all three route checkpoints, recovers the memory through normal interaction, and reloads with the Piri objective and map marker. The return journey crosses Echo Pool and Hollows Mouth, opens the Listening Arch shortcut, reaches Wren's Rest, delivers the memory through Piri's dialogue, and reloads with guidance to the required Dash Trial. It then takes the named shortcut back to Listening Arch, enters the trial through normal interaction, climbs the rib and crosses all three plates inside the nine-second window. The objective changes to the Thorn Sentinel. Mara returns to the Root-Memory lantern, crosses the Dash-gated east exit, activates the Reliquary Verge checkpoint, and reloads there with the sentinel objective. The extended route reaches the live Sentinel and takes damage while remaining alive; the inspected contact screenshot shows 80/100 health and a visible shield telegraph. This establishes the quest turn-in, trial reward, access to the sentinel room, and active encounter; it does not prove both Briars or the sentinel were defeated.

The extension exposed two guidance failures. Interact-only room and area transitions had no prompt, so the Listening Arch return doorway was invisible to keyboard users; repeated E presses entered the adjacent Herb Loft instead. Available transitions now show a real-text passage or named destination prompt, while locked travel remains hidden. The regression failed before the fix and passes after it; the production route waits for “Travel to Listening Arch” and reaches the correct area. The quest also directed the player to the Thorn Sentinel before the mandatory Wayfinder Dash was learned, although the Verge exit requires that ability and its completion flag. Until the Dash Trial is solved, the HUD now directs players beneath the Root-Memory Chamber and the discovered trial receives the map marker; afterward guidance returns to the sentinel. Projection regressions failed before the fix and pass now. The current fresh production route passes **1/1**, including the circuit, Verge checkpoint and reload. The offline/update scenario also passes **1/1** on the current build. The sentinel fight remains to be verified on a fresh run.

Three repeated fresh development-browser runs defeated both Briars with ordinary movement and melee attacks, no semantic defeat action, and no death reload. A further real-input run broke the Root Knot with a charged heavy attack, lit the memorial lantern, and entered Split Cedar Sanctuary. The Brackenreach screenshot also exposed a raw checkpoint ID in the interaction prompt (`Rest at brackenreach-trailhead`). `WorldInteractionRuntime` had a special case for the village lantern and formatted every other checkpoint from its ID. Prompts now use each checkpoint's authored display name. The production regression failed before the fix and passes after it; a unit test checks every authored checkpoint across all areas. Briar-core acquisition, dungeon, boss, and ending remain outside the fresh production run.

The fresh production route exposed misleading main-quest guidance at Listening Arch. Tracing the arch changed the objective to “Bring the recovered root-memory to Piri” before the player had recovered it in Singing Hollows; the map also marked Wren's Rest as the destination. The objective now directs the player to recover the memory in Singing Hollows until `root-memory-recovered` is set, and the map points to the Root-Memory Chamber once discovered. Existing saves use the same saved stage and resolve the guidance from their quest flags. Both projection regressions failed before the fix and pass now; the rebuilt production route verifies the objective before and after checkpoint reload and verifies that the map no longer marks Wren's Rest prematurely.

Fresh production browser inspection found that the current room name in the pause map inherited dark text while the room-map layout forced a dark green background. Its measured contrast was **1.31:1**. The room status line also measured **9.4 px**. The room-map text now uses a pale foreground and the status line has a 12 px minimum; failing-then-passing browser regressions enforce both requirements. The no-hook production test checks the map, contrast, text size and absence of the developer bridge on its way to Brackenreach. Both local production browser scenarios pass, including offline/update preservation.

The current complete Chromium development-browser matrix passed **67/67** scenarios in one run, including the canonical traversal and both boss scenarios. An earlier run passed 61/67: three scenarios exhausted their 15-second budgets after reaching expected UI states, while three helpers assumed instantaneous frame state or stopped outside a usable interaction prompt. The corrected six cases passed focused reruns before the clean matrix. These changes affect test timing and real-input driving, not game rules. The long route initially missed the Reliquary Verge checkpoint because its test helper kept moving after the prompt appeared; it passed after the helper was changed to settle at the authored checkpoint position. Title Settings initially scrolled to its footer because Cancel received focus; it now opens at the first control. Default journey details and button labels measured 9.95 px; they now have a 12 px minimum. Both changes have failing-then-passing regressions, and all 12 title browser tests passed after the typography change, including gamepad navigation and saved 200% text scale.

The normal-stat, real-keyboard Cantor scenario passed **3/3** repeated runs after its scripted fighter used the authored light combo in both phases and stopped waiting 3.6 seconds beside the east lens after the west-to-east traversal had already exceeded the Resonant Pulse cooldown. Before that correction, runs had mixed results; one died in phase two after using five Sunmoss Draughts with 55 boss health remaining. A periodic dash experiment failed all three repeats and was removed. The lens helper retries a cast only when no mana was spent; activating both lenses correctly moves the boss into `stagger`. This scripted player does not respond to individual telegraphs, and the prepared save bypasses the full route. The passing repeat is focused encounter evidence, not first-time-player balance or release qualification.

The current `npm run check` passed formatting, lint, strict TypeScript and **104 files / 680 unit tests**. The production build passed with Vite's chunk-size advisory; the main JavaScript is 1,690.62 KB / 446.62 KB gzip. Browser IndexedDB previously passed **7/7**. The fresh route through Sentinel contact and offline/update scenario each passed **1/1** on the current build. The earlier production JavaScript scan found no developer bridge or debug-route markers. Chromium and local browser automation do not establish target-hardware frame rate, physical controller behavior, subjective audio, first-time-player understanding, or hosted PWA behavior.

## September 23 QA corrective pass

Pause now focuses Resume and orders Return to title after it. Settings exposes all four movement bindings. Unexplored map exits show their position along the known room, and essential HUD text is larger with wrapped opening controls. Nearby ladders catch a player who overshoots and align them while climbing; an Up prompt appears at the base.

Saved attack power and weapon level now strengthen physical hits. A damaging hit grants 900 ms of protection; Resin Heart extends it by 300 ms. The Cantor publishes a new health state when its heart opens so the HUD can explain the vulnerable phase. Focused browser checks passed for Pause, movement rebinding, map labels, HUD readability, the Dash Trial ladder, and a real-input boss fight at normal endgame stats using an imported prepared save and Sunmoss. This does not establish a fresh full-route production win or first-time balance.

## Implemented in this pass

| Review finding           | Implementation and evidence                                                                                                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invisible combat         | Authoritative projectile/ordnance/boss-region projection, pooled illustrated warnings, slashes, impacts and selectable damage numbers. Spearfall/cascade and inversion fan now actually apply their scheduled region damage, covered by regressions. |
| Terrain mismatch         | Measured atlas crops, platform surface anchors, per-pose Mara feet; collision geometry unchanged. All 18 rooms captured with and without collision overlays.                                                                                         |
| Unusable items/equipment | Atomic, revision-checked Use/Equip/Replace/Unequip actions; recovery clamps at maximum; equipped charms affect live combat; persistence browser flow.                                                                                                |
| Settings inactive        | Accepted settings reach input, combat, camera, audio and mounted DOM; measured 1.5× text-size change.                                                                                                                                                |
| Controller forms         | Simulated standard-pad range/select/checkbox navigation, held-repeat behavior and guard reset on pause. Physical hardware remains unverified.                                                                                                        |
| Difficulty ineffective   | One incoming-damage boundary applies Story 75%, Standard 100%, Challenging 125%; positive damage minimum 1, zero preserved.                                                                                                                          |
| Boss HUD overflow        | Explicit positioning and styled numerical meters; screenshot and contained-stage bounds check.                                                                                                                                                       |
| Portrait clipping        | 390×844 pause/Resume regression passes; scrollable menu and keyboard/gamepad notice. Maximum text-scale checks also pass at 1280×720, 1024×768 and 844×390; browser zoom remains separate and unverified.                                            |
| Static prop states       | Open chests, broken props, rotated mechanisms/lenses, current checkpoint seal and released boss gates derive from runtime/persistent state.                                                                                                          |
| Map routes               | Discovered-room graph, connections, known checkpoints, locked exits and known main-objective marker; hidden destinations stay hidden.                                                                                                                |
| Guidance/internal names  | Main quest prioritized, live binding/device help, readable art/checkpoint names.                                                                                                                                                                     |
| Shops/currency           | Explicit Browse wares and exit choices; Resin terminology.                                                                                                                                                                                           |
| Autosave stuck           | Generation-aware queued/saving/saved/failed/session-only state; stale completion cannot acknowledge a newer write; HUD and reload regression.                                                                                                        |
| Repeated environments    | Five original area compositions, three botanical depth layers, original enemy/boss pose sheet and isolated NPC sprites.                                                                                                                              |
| HUD replacement          | Retained DOM nodes; unchanged display projections suppressed; 120-frame test observes zero HUD-root replacement.                                                                                                                                     |

Return to title flushes saves while menu interaction is locked, and remains in the session on failure. PWA updates pause all active scenes, flush saves, preserve unrelated caches, precache the complete build, and reload only after explicit acceptance. Existing version-1 save fields are unchanged.

Tuning decisions in the earlier pass: Sunmoss restores 30 health; Wellspring restores 20 mana. Quiet Step reduces briar damage by 20%; Echo Thorn restores 2 mana on parry, including after permanent mana upgrades. The corrective pass adds general post-hit protection and makes Resin Heart extend it by 300 ms. Checkpoint activation art represents the current saved respawn checkpoint, avoiding a new save field.

## Earlier corrective-pass evidence

The earlier `npm run check` passed formatting, ESLint, strict TypeScript and the full unit suite: **104 files / 675 tests**. The 64-scenario development-browser run initially passed 59 scenarios. The five affected failures were addressed; focused reruns passed 10 scenarios, and the long canonical traversal passed separately in 7.4 minutes. All 64 distinct scenarios had passing evidence across those runs; the later complete matrix passed 66/66 in one run. The corrected real-input Cantor fight passed three repeated normal-stat runs and both boss scenarios passed together in a focused suite, each using a prepared imported save.

Generated music score exports under `music/score-v1/` are excluded from Prettier because `music/source/compose.py` owns their JSON serialization. The separate music sources and outputs were preserved and are not integrated into this runtime audio pass.

- Fresh production build passed; main JS 1,689.41 KB / 446.30 KB gzip, with Vite's non-failing chunk-size advisory.
- Production browser tests passed 2/2: fresh first-room movement and readable map text; offline Continue, unrelated-cache preservation, old-cache cleanup, explicit update acceptance and retained difficulty/save.
- Final production JavaScript scan found no developer bridge, debug boss/encounter route, semantic enemy-resolution action, room-preview harness or boss fixture identifiers.
- Browser IndexedDB suite passed: 7 tests.
- The long traversal uses semantic enemy resolution and ends at the boss threshold after side-quest turn-ins, upgrades and reload. The normal-stat real-input boss/ending test starts from a prepared imported save. Neither establishes a fresh normal-stat production playthrough.
- Room screenshots were inspected for atlas contamination, feet placement, readable ledges and area identity. Overview captures fit the whole room and are not normal-scale performance evidence; a strict measured 2-pixel edge tolerance is not certified.
- All eight boss attack families have separately inspected warning/active captures with reduced motion, flash and audio disabled. Crops preserve pose proportions and exclude adjacent figures. These fixtures do not establish normal-stat combat balance.
- Return-to-title regression injects a save-flush rejection, verifies the session/menu remain available, then retries successfully. An IndexedDB outage is a distinct session-only fallback condition, disclosed by the game.
- Chromium ran locally. Playwright Firefox and WebKit executables are absent; Safari/Firefox support is not claimed.
- Cleanup verified: task-started test/server PIDs exited; no listeners remain on 4173/4174.
- Native prerequisite probe ran this session: Command Line Tools installed; Rust, Cargo, rustup and full Xcode absent. No native compile or package claim.

## Remaining release gates

- Fresh production journey at normal stats, all mandatory content, ending/reload, with no debug actions; two first-time testers, measured duration/deaths/confusion, and tuning based on their observations.
- Physical gamepad play/disconnect/reconnect; speakers/headphones listening across all areas and boss phases; Safari/Firefox qualification; browser 200% zoom. Maximum game-text scale and short landscape have automated bounds coverage.
- Hardware-accelerated Apple-silicon MacBook Air profiling. The October 7 lifecycle/heap soak passed, but headless browser timing does not establish the 60 FPS target.
- Final normal-scale visual acceptance and strict terrain-edge tolerance; boss warning/active fixtures are captured separately from normal-input gameplay.
- Authorized dedicated HTTPS destination, host cache headers, installation and update verification on the actual public origin. The artifact is local `dist/`.
- Optional native distribution requires toolchain installation and independent signed/tester packaging decisions.

The September 23–24 candidate was rated **6/10 — Not Ready**. The most important remaining work is a fresh normal-stat Sentinel win, the dungeon and boss continuation through ending/reload, first-time player testing, target-hardware performance and physical controls, and hosted PWA qualification. This rating does not certify public distribution. See [known issues](known-issues.md) and [remaining checklist](remaining-work-checklist.md).

## Historical evidence — superseded September 19 assessment

The following is retained only to preserve dated test history. Its automated traversal uses semantic enemy resolution and does not prove normal combat balance or a first-time playthrough.

Date: 2026-09-19

### Outcome

The September 19 report described the slice as complete; that readiness conclusion was withdrawn on September 23. One continuous
automated playthrough starts a new journey, completes the main and optional routes, solves the
dungeon, defeats the Pallid Cantor, reaches credits, reloads the save, and confirms that durable
rewards do not replay.

The complete Tauri 2 source project is included. Native macOS execution and packaging were not run
because this host lacks Rust/Cargo and full Xcode.

### Release evidence

| Check                                 | Result                                                            |
| ------------------------------------- | ----------------------------------------------------------------- |
| Formatting, ESLint, strict TypeScript | Passed via `npm run check`                                        |
| Unit tests                            | 94 files / 635 tests passed                                       |
| Browser IndexedDB tests               | 1 file / 7 tests passed in Chromium                               |
| Browser and PWA acceptance            | 25/25 Playwright tests passed in one serial run                   |
| Canonical traversal                   | Passed standalone and inside the full suite                       |
| Production build                      | Passed with only Vite's non-failing large-chunk advisory          |
| Production debug scan                 | No developer bridge, debug-route, or encounter mutation strings   |
| Production visual check               | Title rendered correctly; visible keyboard focus; selectable text |
| Production network/console            | Authored art returned 200; zero errors and zero warnings          |
| Offline PWA reload                    | Passed with browser networking disabled                           |
| Native adapter                        | Unit-tested; native compile blocked by external toolchain         |

### Final fixes in the release pass

- Added a development-only semantic enemy-resolution action for the long traversal test while
  retaining normal enemy death, encounter, reward, journal, render, and save behavior.
- Hardened route movement against dropped frames and corrected interaction targets to use authored
  zone centers.
- Covered respawned encounters on both homeward routes so the canonical run exercises valid combat
  progression rather than relying on stale room state.
- Increased the pre-unlock Wayfinder Circuit window from seven to nine seconds; all six activation
  orders remain deterministic at the inclusive boundary, and expiry restarts at 9001 ms.

### Deliverables

- Browser/PWA setup, controls, saves, architecture, verification, and desktop commands:
  `README.md`
- Asset authorship and runtime use: `docs/asset-provenance.md`
- Current completion state: `docs/progress.md`
- Verified external limits: `docs/known-issues.md`
