# Known Issues and Verification Limits

Last checked: 2026-10-07

Release qualification remains open. The current fixes address discarded Pause input, a required reforge blocked by spent Resin, missing trial feedback, HUD overlap, inconsistent 200% text settings, WebKit keyboard focus and music resource growth. Verified results and earlier candidate history are in the [release report](release-report.md).

The upstream October 7 polish records a fresh production save through the ending, continued exploration and durable reload with ordinary controls, earned upgrades, read-only Canvas/IndexedDB observations and one checkpoint death/recovery. See [polish verification](polish-verification.md) and [route evidence](fresh-production-route.md). That result belongs to the upstream candidate; the combined implementation still needs its own full-route revalidation.

## Qualification still required

- Revalidation of a fresh normal-stat production journey on the merged build through the Sentinel, dungeon, boss, ending and reload with ordinary controls and no prepared saves or developer actions. The current no-hook route passes through the trial and checkpoint reload to live Sentinel contact. A separate continuation did not establish a win and ended after its temporary export driver failed. The local full integration traversal uses semantic enemy resolution; its boss/credits scenarios use imported saves. Upstream's separate ordinary-input ending evidence is retained above.
- Two first-time testers, with duration, deaths and confusion recorded against the 20–40 minute target.
- Physical gamepad, disconnect/reconnect, speakers/headphones listening, target MacBook Air frame times and exact terrain-edge tolerance. Automated controller and screenshot fixtures do not certify those observations.
- Chromium, Firefox and WebKit smoke scenarios have passing evidence, including corrected title keyboard focus. Full browser-zoom acceptance and actual Safari version qualification remain open.
- An authorized dedicated HTTPS origin, host cache headers, installation and hosted offline/update/export checks. No host or public URL has been selected or deployed.

The local pre-merge candidate's corrected 30-minute production lifecycle soak passed 60 cycles with stable DOM/document counts and 0.92 MiB collected heap growth. It preceded that candidate's final 200% HUD layout changes; its final artifact passed a separate 20-cycle measurement with 507 DOM nodes at both endpoints. These checks do not certify the combined build's long-run behavior or target-hardware performance.

## Native prerequisites

The environment section of `npm run tauri -- info` was checked on October 7. Command Line Tools are installed; full Xcode, `rustc`, Cargo and rustup are missing. The CLI was stopped after environment reporting while subsequent discovery remained pending. Native development, compilation, clean installation, native save I/O and packaging were not run. The Tauri source and adapter unit tests remain available. Install the missing tools before `npm run tauri dev` / `npm run tauri build`; signing and public distribution need a separate decision.

## Browser distribution constraints

The current artifact assumes a dedicated origin at `/`. Subpath hosting requires URL/config changes and new offline/update checks. Saves belong to that browser profile and origin, with no cloud sync; export before clearing site data or changing origin. Session-only storage is clearly disclosed when IndexedDB cannot persist.

The production main bundle is approximately 1.70 MB (449 KB gzip), and Vite emits its chunk-size advisory. This is not a compile failure; network/loading performance still needs measurement on the intended delivery origin.
