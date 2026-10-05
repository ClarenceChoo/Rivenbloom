# Known Issues and Verification Limits

Last checked: 2026-09-24

The reviewed implementation gaps have been addressed in the current candidate. The current Chromium development matrix passed 67/67 scenarios, and the current production build passed its fresh route through live Sentinel contact and offline/update checks. Release qualification is still open; see [release report](release-report.md). Automated fixtures are integration evidence, not first-time-player or hardware evidence.

## Qualification still required

- A fresh production playthrough from the opening through the ending without prepared saves or developer actions, plus two first-time testers. The corrected no-hook production route retains the first optional cache reward, survives Briar contact and accepted spell input, recovers the root-memory, opens the Listening Arch homeward shortcut, delivers the memory to Piri, solves the timed Dash Trial with ordinary controls, crosses the unlocked east exit, reloads at the Reliquary Verge checkpoint, and takes a live Sentinel hit while surviving. Three repeated fresh development runs defeated both Briars with ordinary controls, no defeat action, and no death reload; one continued through the Root Knot and memorial lantern into Split Cedar. The production route has not verified defeating both Briars, defeating the Thorn Sentinel, claiming a briar core, the dungeon, boss or ending. The corrected imported-save boss script passed three consecutive normal-stat runs, but it does not dodge individual telegraphs or establish first-time balance. The full route and 20–40 minute target remain unmeasured.
- Physical gamepad, disconnect/reconnect, speaker/headphone listening, supported Safari/Firefox versions and 200% browser zoom. Maximum game-text scale passed at 1280×720, 1024×768 and 844×390, with a separate portrait 390×844 Resume check. Playwright Firefox/WebKit executables are absent locally.
- The new soundtrack's ten MP3 files decode and are packaged, but subjective listening and in-game browser playback have not been verified in this session. Browser automation blocked the local `file://` listening page under its URL security policy.
- Target MacBook Air frame-time profiling and a 30-minute soak. No hardware performance claim is supported by headless tests.
- Final normal-scale gameplay presentation and exact terrain edges. All eight boss families have inspected warning/active fixtures; the all-room overview demonstrates loaded assets and general alignment, not a measured 2-pixel tolerance across every edge/pose.
- Actual HTTPS deployment, installability and update flow. No host or public URL has been selected or deployed.

## Native macOS prerequisites

`npm run tauri -- info` ran on September 23. Command Line Tools are installed; full Xcode, `rustc`, Cargo and rustup are missing. Native development, compilation, clean installation, native save I/O and packaging were not run. The existing Tauri source and adapter unit tests remain available. Install the missing tools before `npm run tauri dev` / `npm run tauri build`; signing and public distribution need a separate decision.

## Browser distribution constraints

The current artifact assumes a dedicated origin at `/`. Subpath hosting requires URL/config changes and new offline/update checks. Saves belong to that browser profile and origin, with no cloud sync; export before clearing site data or changing origin. Session-only storage is clearly disclosed when IndexedDB cannot persist.

The production main bundle is approximately 1.68 MB (445 KB gzip), and Vite emits its chunk-size advisory. This is not a compile failure; network/loading performance still needs measurement on the intended delivery origin.
