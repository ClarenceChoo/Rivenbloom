# Known Issues and Verification Limits

Last checked: 2026-10-07

The October 7 polish includes a fresh production opening-to-ending journey using ordinary controls and earned items. Credits, continued exploration, boss/ending reload and exactly one sigil were verified in the same fresh save lineage. The run included pauses, resumed automation commands and one checkpoint death/recovery; it was not an uninterrupted or first-time-player run. See the [polish verification](polish-verification.md) for evidence and the older [release report](release-report.md) for prior checks.

## October 7 polish pass

Continuous area-coloured terrain now follows authored collision bounds, including thin one-way ledges and bounded coral briars. Original impact/danger/resonance cues replace the uniform beep. Regression coverage fixes returning to a fading track, retrying rejected playback, visibility before interaction and non-looping ending replay. Format, lint, typecheck, 693 unit tests, seven IndexedDB browser tests and the production build passed in the cloud environment.

The installed system Chromium is used because the pinned Playwright browser download is denied by the environment. The final 70/70 development run passed with one worker and Canvas, including the long traversal after the lens-range fix. These integration tests include prepared fixtures and developer enemy-defeat actions where documented. The separate fresh production journey used neither imported saves nor developer mutation; its observer only read rendered frames and durable saves.

Three unchanged normal-stat boss runs passed with Canvas. Software-WebGL automation remains inconsistent: the original timing script and an experimental simulation-window rewrite exhausted healing items in separate runs. The unproven rewrite was removed; combat rules and assertions were not weakened. A sequential renderer comparison below isolates cloud software rendering as the main performance constraint.

A fresh keyboard direction or quick tap immediately after Resume could previously be swallowed by the neutral gate. The fix accepts demonstrably fresh keyboard edges while retaining the stale-held-control and gamepad gates. Unit regressions and a same-task browser regression cover it. The final development matrix passed 70/70 and the production matrix passed 3/3. Full results are recorded in [polish verification](polish-verification.md).

## Qualification still required

- Two first-time testers and timing/balance review. Fresh production progression through the ending is now verified. The known-route run recorded about 11.4 active minutes, excluding pauses and reload downtime; it does not establish the intended 20–40 minute first-play duration.
- Physical gamepad, disconnect/reconnect, speaker/headphone listening, supported Safari/Firefox versions and 200% browser zoom. Maximum game-text scale passed at 1280×720, 1024×768 and 844×390, with a separate portrait 390×844 Resume check. Playwright Firefox/WebKit executables are absent locally.
- Browser playback of the opening/village soundtrack, channel gain changes, pause/resume and muted restoration passed a real Chromium audio-element test on October 7. The ten-track soundtrack remains packaged. Subjective speaker/headphone listening across every area and transition is still required.
- Target MacBook Air frame-time profiling and a 30-minute soak. A sequential baseline/polished comparison measured 75.39/77.06 ms mean under SwiftShader WebGL and 16.76/16.67 ms under the existing Canvas fallback. The cloud software-WebGL renderer dominates the slow sample; these results do not establish target Mac performance or long-run stability.
- Final normal-scale gameplay presentation and exact terrain edges. All eight boss attack families have inspected warning/active fixtures; the all-room overview demonstrates loaded assets and general alignment, not a measured 2-pixel tolerance across every edge/pose.
- Actual HTTPS deployment, installability and update flow. No host or public URL has been selected or deployed.

## Native prerequisites

`npm run tauri -- info` ran on the Linux cloud host on October 5. Rust/Cargo/rustup, WebKitGTK 4.1 and librsvg are missing. Native development, compilation, clean installation, native save I/O and packaging were not run. macOS execution requires a Mac with full Xcode and the Rust toolchain; the earlier September 23 Mac probe found Command Line Tools but no full Xcode or Rust toolchain. The existing Tauri source and adapter unit tests remain available. Install the appropriate platform prerequisites before `npm run tauri dev` / `npm run tauri build`; signing and public distribution need a separate decision.

## Browser distribution constraints

The current artifact assumes a dedicated origin at `/`. Subpath hosting requires URL/config changes and new offline/update checks. Saves belong to that browser profile and origin, with no cloud sync; export before clearing site data or changing origin. Session-only storage is clearly disclosed when IndexedDB cannot persist.

The production main bundle is approximately 1.68 MB (445 KB gzip), and Vite emits its chunk-size advisory. This is not a compile failure; network/loading performance still needs measurement on the intended delivery origin.
