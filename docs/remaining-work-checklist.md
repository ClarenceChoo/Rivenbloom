# Rivenbloom Release Checklist

Last reviewed: 2026-10-07

This replaces the unsupported September 19 completion checklist. Checked entries mean implementation with focused evidence; they do not certify the entire release gate. Detailed requirements remain in the [share-ready plan](superpowers/plans/2026-09-23-share-ready-release.md).

## Implemented candidate

- [x] Terrain crop/anchor metadata, per-pose player feet and elapsed-time animation.
- [x] Pooled combat regions/projectiles/impact/damage-label presentation and boss-region damage regressions.
- [x] Stable HUD nodes, contained boss meter, reachable portrait Resume and preserved 200% text scaling, including essential portrait trial guidance and separated health/mana glyphs.
- [x] Generation-aware save status including failures and session-only fallback.
- [x] Controller form navigation and accepted live settings application.
- [x] Atomic recovery/equipment actions, equipped charm effects and difficulty damage policy.
- [x] Discovered-room graph, main objective/help, explicit shops/exit and save-flushed title return.
- [x] Distinct original area art, depth layers, actor poses and stateful props; provenance recorded.
- [x] Production precache/update behavior and local offline/update acceptance.
- [x] Honest setup, local-only save/export and root HTTPS hosting instructions.

## Release acceptance still open

- [x] Automated Chromium development-browser coverage: all 74 distinct scenarios have passing evidence across the 72/73 broad run, focused reruns and the additional 200% settings regression. This does not replace production or hardware qualification.
- [ ] All attack families, lifecycle/pool saturation and exact terrain-edge tolerance visually accepted at normal scale.
- [ ] Full viewport/200% browser-zoom matrix.
- [ ] Normal-stat fresh production run through dungeon/boss/ending/reload without developer actions. The current no-hook production route passed its focused rerun in 2.4 minutes. It accepts Sela's quest, retains the Wayfarer Cache reward, survives Briar contact and spell input, recovers the root-memory, opens the Listening Arch homeward shortcut, delivers the memory to Piri, solves the timed Dash Trial using ordinary controls, crosses the unlocked east exit, reloads at the Reliquary Verge checkpoint, and survives live Sentinel contact. Three repeated fresh development runs defeated both Briars using ordinary controls and no defeat action or death reload; one extended run broke the Root Knot, lit the memorial lantern, and entered Split Cedar. The production route still needs to prove both Briars defeated, defeat the Thorn Sentinel, claim a briar core, and continue through the dungeon and ending.
- [ ] Two first-time testers; record duration, deaths and confusion, then resolve demonstrated issues.
- [ ] Physical controller pass, disconnect/reconnect, real speakers/headphones listening.
- [x] Corrected 30-minute production lifecycle soak: 60 cycles, stable DOM/document counts and 0.92 MiB collected heap growth. This preceded the final HUD layout changes; the final artifact also passed 20 cycles with 507 DOM nodes at both endpoints.
- [ ] Target MacBook Air performance profile.
- [x] Chromium/Firefox/WebKit smoke coverage: all 54 distinct scenarios have passing evidence across broad and focused runs. Actual Safari version and browser zoom still need qualification.
- [ ] Authorized HTTPS destination and actual hosted install/offline/update/export verification.
- [x] Stop task-owned verification servers/workers. The pre-existing interactive server on 4173 was not stopped by this task; no listeners remained on 4173/4174/4176 at the final check.

## Optional native release

- [x] Recheck toolchain availability: full Xcode, Rust/Cargo and rustup absent in the October 7 environment probe; subsequent CLI discovery was interrupted.
- [ ] Install prerequisites, compile/run Tauri, verify native persistence and clean installation.
- [ ] Decide tester versus signed/notarized distribution and test on another Mac.
