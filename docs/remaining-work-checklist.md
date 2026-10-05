# Rivenbloom Release Checklist

Last reviewed: 2026-10-05

This replaces the unsupported September 19 completion checklist. Checked entries mean implementation with focused evidence; they do not certify the entire release gate. Detailed requirements remain in the [share-ready plan](superpowers/plans/2026-09-23-share-ready-release.md).

## Implemented candidate

- [x] Terrain crop/anchor metadata, per-pose player feet and elapsed-time animation.
- [x] Pooled combat regions/projectiles/impact/damage-label presentation and boss-region damage regressions.
- [x] Stable HUD nodes, contained boss meter, reachable portrait Resume and live text scaling.
- [x] Generation-aware save status including failures and session-only fallback.
- [x] Controller form navigation and accepted live settings application.
- [x] Atomic recovery/equipment actions, equipped charm effects and difficulty damage policy.
- [x] Discovered-room graph, main objective/help, explicit shops/exit and save-flushed title return.
- [x] Distinct original area art, depth layers, actor poses and stateful props; provenance recorded.
- [x] Production precache/update behavior and local offline/update acceptance.
- [x] Honest setup, local-only save/export and root HTTPS hosting instructions.

## Release acceptance still open

- [x] Automated Chromium development-browser matrix on the current build: 67/67 passed in one run. This does not replace production or hardware qualification.
- [x] Fresh-origin development journey through the Sentinel, dungeon, both Cantor phases, optional quests, ending and durable reload using ordinary input and read-only state observations. No save imports or developer mutations; checkpoint recovery and resumed sessions included.
- [x] Buffered pause input regression and ending layout/keyboard checks at desktop and short landscape sizes.
- [ ] All attack families, lifecycle/pool saturation and exact terrain-edge tolerance visually accepted at normal scale.
- [ ] Full viewport/200% browser-zoom matrix.
- [ ] Normal-stat fresh production run through dungeon/boss/ending/reload without developer actions. The corrected no-hook route accepts Sela's quest, retains the Wayfarer Cache reward, survives Briar contact and spell input, recovers the root-memory, opens the Listening Arch homeward shortcut, delivers the memory to Piri, solves the timed Dash Trial using ordinary controls, crosses the unlocked east exit, reloads at the Reliquary Verge checkpoint, and survives live Sentinel contact. Three repeated fresh development runs defeated both Briars using ordinary controls and no defeat action or death reload; one extended run broke the Root Knot, lit the memorial lantern, and entered Split Cedar. The production route still needs to prove both Briars defeated, defeat the Thorn Sentinel, claim a briar core, and continue through the dungeon and ending.
- [ ] Two first-time testers; record duration, deaths and confusion, then resolve demonstrated issues.
- [ ] Physical controller pass, disconnect/reconnect, real speakers/headphones listening.
- [ ] Target MacBook Air performance profile and 30-minute memory/lifecycle soak.
- [ ] Supported Safari/Firefox smoke checks.
- [ ] Authorized HTTPS destination and actual hosted install/offline/update/export verification.
- [x] September QA test servers and workers were stopped. Cloud setup keeps the development server available; browser test workers and production preview servers are temporary.

## Optional native release

- [x] Recheck toolchain availability: October 5 Linux diagnostics found Rust/Cargo/rustup, WebKitGTK 4.1 and librsvg absent. macOS still requires a Mac with full Xcode and Rust.
- [ ] Install prerequisites, compile/run Tauri, verify native persistence and clean installation.
- [ ] Decide tester versus signed/notarized distribution and test on another Mac.
