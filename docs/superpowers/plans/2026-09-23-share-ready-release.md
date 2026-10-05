# Rivenbloom Share-Ready Release Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task by task in the current workspace. Follow AGENTS.md: no subagents, branches, commits, pushes, or publication unless the user requests them. Implementation authorized by the user on 2026-09-23; publication remains a separate authorized action.

**Goal:** Deliver an original, understandable, reliable 20–40 minute desktop-browser adventure that a new player can open from an HTTPS link and finish without developer assistance.

**Architecture:** Preserve the Phaser scene lifecycle, pure gameplay rules, typed content, event bus, InputService, and SaveRepository. Add focused presentation and menu-action modules where a responsibility is missing; do not rebuild the working world, combat, or persistence foundations. Derive visuals and UI from authoritative runtime state, with deterministic lifecycle cleanup.

**Tech Stack:** Existing Phaser 3, strict TypeScript, Vite, Vitest, Playwright, IndexedDB, and PWA shell. Tauri 2 remains a separately qualified distribution target. No new dependencies are planned.

**Spec:** `AGENTS.md`, `docs/art-direction.md`, `docs/superpowers/specs/2026-07-25-rivenbloom-vertical-slice-design.md`, and the September 20 review validated in this task. Current user instructions override historical execution instructions inside older documents.

## Scope and evidence

Default first delivery: desktop browser link, keyboard and common gamepads, optional PWA installation. Narrow portrait windows must provide reachable menus and an accessible orientation/input notice; touch gameplay is not part of this release. A downloadable Mac app requires its own packaging, signing/distribution decision, and real-device checks.

September 23 inspection confirms the reviewed implementation gaps remain in the relevant source. September 20 checks passed 635 unit tests, format, lint, typecheck, and the existing menu smoke test. Those are historical evidence, not certification of the eventual release. The candidate verification results are recorded in the execution ledger and release report; incomplete acceptance criteria remain unchecked.

The existing release report and completion checklist overstate readiness. In particular, the menu smoke test checks stored selections, while the traversal helper directly defeats enemies. Keep these tests for integration coverage, but do not use them as evidence of visual accessibility, normal combat balance, or an unassisted playthrough.

## Global constraints

- TypeScript uses `strict: true`; unchecked `any` is forbidden.
- Logical resolution: 1280 × 720 with contain scaling and letterboxing.
- Target 60 FPS on an Apple-silicon MacBook Air.
- Original assets only; record generated, authored, and licensed assets in `docs/asset-provenance.md`.
- Essential interface text stays selectable real text; no production debug primitives or placeholders.
- Pure gameplay rules stay outside scenes. Input and persistence use their existing services.
- Repeated projectiles, particles, impacts, and damage labels use bounded pools.
- Every scene cleans up listeners, timers, colliders, and pooled objects on shutdown.
- Preserve save IDs and existing version-1 saves. Any saved-field change requires a migration and migration/recovery tests.
- No adjacent refactors, dependency upgrades, new areas, new enemies, or new account/backend systems.
- Run focused checks while implementing; run the full matrix at the release candidate gate.
- Stop temporary servers, test workers, and agent-created browser sessions after verification.

## Review focus

1. A late save completion must not label a newer unsaved revision as saved: covered by Task 5.
2. Repeated Use/Equip input, stale menu data, or a rejected save must not duplicate benefits or consume resources incorrectly: covered by Task 7.
3. Pause, focus loss, and controller disconnection while guard is toggled must not leave a stuck action: covered by Task 6.
4. Room changes, death, and pool saturation must not leave invisible damaging attacks or stale effects: covered by Task 3.
5. A service-worker update must preserve the journey, load a consistent build, and avoid deleting unrelated caches: covered by Task 13.

## Execution order and release gates

Implement Tasks 1–8 first, then Tasks 9–11. Run Task 12 against the resulting production candidate, then Task 13 against the actual hosted candidate. Task 14 is required only for a native distribution promise.

| Gate               | Required result                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| A — Playable       | Attacks and terrain are readable; items, equipment, difficulty, settings, and saving behave as shown. Tasks 2–8 pass.                            |
| B — Understandable | New players can navigate, recognize progress, and finish without external instructions. Tasks 9–11 pass.                                         |
| C — Shareable      | Full release checks, normal-stat production playthroughs, accessibility/controller checks, and target-hardware performance pass. Task 12 passes. |
| D — Distributable  | Hosted HTTPS loading, offline/update behavior, save export, credits, and support instructions pass. Task 13 passes.                              |

Do not claim a gate has passed from unit tests alone. Any missing manual or physical-device evidence remains explicitly unverified.

### Task 1: Establish a truthful release checklist

**Files:** Modify `docs/remaining-work-checklist.md`, `docs/known-issues.md`, `docs/release-report.md`, and `docs/progress.md` during execution.

**Deliverable:** A dated candidate status with the 15 review findings mapped to this plan, distinguishing implementation, automated evidence, visual evidence, and external prerequisites.

- [x] Reopen unsupported completion claims. Preserve dated historical test results without presenting them as current approval.
- [x] Record portrait clipping as requiring reproduction, not as an already reverified failure.
- [x] Use the mapping at the end of this plan to track each fix and its evidence.
- [x] Review the documentation diff; no application suite is needed for this task alone.

### Task 2: Align terrain and character artwork with gameplay surfaces

**Files:** Modify `src/game/entities/WorldActorView.ts`, `src/game/entities/player/PlayerView.ts`, `src/game/scenes/PreloadScene.ts`, relevant assets under `public/assets/art/`, and `docs/asset-provenance.md`. Create `src/game/data/artFrames.ts` and `tests/data/artFrames.test.ts` for authored anchor metadata and alignment math.

**Boundary:** Collision bounds remain authoritative. `artFrames.ts` contains source-frame bounds, visible ground/surface anchors, and display scale; views consume that metadata rather than guessing from transparent image padding.

- [x] Record current player feet and platform-top alignment in the opening room, cave ledges, dungeon platforms, and boss floor.
- [x] Author explicit surface anchors and sprite ground lines; remove false walkable ledges from background art. Correct the artwork rather than moving collision geometry merely to match an illustration.
- [x] Use anchor placement consistently. For a tile whose source surface starts at `sourceSurfaceY`, the image top is `collisionTop - sourceSurfaceY * scaleY`; character visible feet use the equivalent ground-anchor calculation.
- [x] Cover anchor math with a deterministic example: collision top 540, source surface 64, scale 0.5 produces image top 508 and rendered surface 540. Include different frame sizes and one-way platforms.
- [ ] Inspect all 18 rooms with development collision overlays, then inspect again with overlays disabled. Require surface alignment within 2 logical pixels and readable landing edges.

**Check:** `npm run test -- tests/data/artFrames.test.ts`, typecheck, touched-file lint, and the room visual checklist. Visual artifacts remain outside committed source.

### Task 3: Render every damaging attack and its feedback

**Files:** Create `src/game/effects/CombatPresentation.ts` and `src/game/effects/CombatPresentationView.ts`; modify `src/game/effects/CombatFeedback.ts`, `src/game/effects/EffectPool.ts` only if required, `src/game/combat/ProjectileSystem.ts`, `src/game/entities/player/PlayerCombatRuntime.ts`, relevant boss presentation commands in `src/game/entities/bosses/`, `src/game/world/WorldCombatRuntime.ts`, and `src/game/scenes/WorldScene.ts`. Create `tests/effects/CombatPresentation.test.ts` and `e2e/combat-presentation.spec.ts`.

**Boundary:** Pure projection maps authoritative attack instances into render descriptions; the Phaser view owns sprites and pools. Render identity includes owner and instance, so player/boss IDs cannot collide. Proposed render contract:

```ts
export type CombatVisual = Readonly<{
  key: string;
  textureKey: string;
  frame: string;
  x: number;
  y: number;
  width: number;
  height: number;
  phase: 'warning' | 'active' | 'impact';
}>;
```

- [ ] Enumerate player spells, enemy attacks, planted ordnance, environmental hazards, and every boss phase attack. For each, record warning, active region, contact effect, and cleanup condition.
- [x] Add failing projection tests for a moving bolt, delayed ground hazard, boss fan, and phase transition. Expired or consumed attacks must disappear on the same simulation update.
- [x] Expose any missing render positions/phase bounds through immutable runtime projections. Do not use development-only hooks as the production renderer’s data source.
- [x] Add pooled original bolt, warning, impact, trail, and damage-number visuals. Consume shake/flash/particle commands with current accessibility settings, avoiding duplicate audio cues.
- [x] Reserve capacity for all simultaneously active damaging instances. Decorative effects may be dropped at their cap; gameplay threats must never silently lose their rendering. Test authored maximum concurrency against pool capacity.
- [ ] Test pause/resume, death, room rebind, boss phase changes, repeated casts, and shutdown for zero stale sprites/listeners/leases.
- [x] Capture actual rendered frames of every attack family in both boss phases. State-count assertions supplement visual inspection; they do not prove visibility.

**Check:** Focused effects/combat tests, typecheck, touched-file lint, and affected-flow browser checks with reduced motion, zero flash, and muted audio.

### Task 4: Stabilize the HUD and make menus fit their viewport

**Files:** Modify `src/game/scenes/UIScene.ts`, `src/game/scenes/MenuScene.ts`, `src/game/world/WorldUiProjection.ts`, `src/game/scenes/WorldScene.ts`, and `src/styles/shell.css`. Create `e2e/ui-layout.spec.ts` and `e2e/hud-updates.spec.ts`.

- [x] Retain HUD nodes and update only changed values. Stop publishing identical display projections every frame; exclude sequence/revision counters from display equality.
- [x] Preserve text selection and focused controls across unrelated world updates. Clear the boss panel explicitly when leaving its encounter.
- [x] Fix the `.seed-panel`/`.hud-boss` positioning conflict with an explicit component rule. Keep label, meter, and numerical value inside the stage.
- [x] Size pause contents against the contained game stage; allow tabs/content to wrap or scroll while keeping Resume reachable.
- [ ] Reproduce the 390×844 report. Also check 1280×720, 1024×768, short landscape, maximum supported text scale, and browser zoom at 200%. Browser zoom and the game’s text-scale setting are separate checks.
- [x] At idle after settling, observe 120 animation frames with no input: zero complete HUD-root child-list replacements. Confirm health/mana/boss updates still appear immediately.

**Concrete browser assertion pattern:**

```ts
const stage = await page.locator('.game-stage').boundingBox();
const boss = await page.locator('.hud-boss').boundingBox();
expect(stage).not.toBeNull();
expect(boss).not.toBeNull();
expect(boss!.x).toBeGreaterThanOrEqual(stage!.x);
expect(boss!.x + boss!.width).toBeLessThanOrEqual(stage!.x + stage!.width);
```

**Check:** New UI tests plus `e2e/menu.spec.ts`, typecheck, touched-file lint, and actual resized-window inspection.

### Task 5: Connect autosave status to durable completion

**Files:** Modify `src/game/saves/SaveService.ts`, `src/game/world/RuntimeSaveCoordinator.ts`, `src/game/core/AppServices.ts`, `src/game/scenes/WorldScene.ts`, and `src/game/scenes/UIScene.ts`; extend their existing save/coordinator tests.

**Boundary:** SaveService reports completion/failure by slot and queued generation. RuntimeSaveCoordinator correlates that generation with its runtime revision; UIScene displays only coordinator state.

- [x] Add a typed completion subscription or event to SaveService. Correlate each queued write with an opaque monotonically increasing generation; unsubscribe on scene shutdown.
- [x] Cover queued → saving → saved, write failure → visible failure → successful retry, and debounced/coalesced writes.
- [x] Add the race test: queue A, queue B, finish A; status stays pending for B. Finish B; status becomes saved. An event for another slot never clears this slot.
- [x] Retain previous valid backup behavior and durable ordering for boss defeat, ending, area transitions, and death.
- [x] Verify ordinary purchases, quest changes, and mana changes visibly settle to Saved, survive reload, and report genuine storage failures.

**Check:** SaveService/RuntimeSaveCoordinator focused tests, browser IndexedDB tests, and a HUD save-status browser regression. This shared-service change also requires the full shared-infrastructure verification row before its milestone closes.

### Task 6: Apply settings live and support all controller form controls

**Files:** Modify `src/game/input/InputPreferences.ts`, `src/game/input/GamepadUiNavigation.ts`, `src/game/scenes/MenuScene.ts`, `src/game/scenes/WorldScene.ts`, `src/game/entities/player/PlayerCombatRuntime.ts`, and DOM settings consumers. Create `src/game/ui/dom/applyGameSettings.ts` to share root styles/attributes, and `src/game/ui/dom/GamepadFormNavigation.ts` for control-specific behavior. Extend `tests/input/InputPreferences.test.ts`, `tests/input/GamepadUiNavigation.test.ts`, and `e2e/menu.spec.ts`; create `e2e/accessibility.spec.ts`.

- [x] Apply the accepted settings through one live path at startup, load, and Apply: InputService sustained mode, combat feedback settings, camera, audio, HUD, active menu, dialogue, and transitions.
- [x] Update text scale and contrast on mounted roots without discarding focused controls. Keep maximum game text scale at the current supported 150% unless changing the save contract deliberately.
- [x] Implement Confirm for buttons and checkboxes; left/right changes range values by their step and selects by one option; up/down changes focus. Clamp values, skip disabled controls, and use 350 ms initial/100 ms held-repeat intervals.
- [x] Make focus visible and prevent menu input from leaking into gameplay. Restore focus on close; handle disconnect/focus loss and clear unsafe latched actions.
- [x] Test actual outcomes: computed text size increases by 1.5×, guard remains active after release in Toggle, a second tap releases it, sliders/selects respond to a simulated controller, and changes survive reload.
- [ ] Inspect reduced motion, zero shake/flash, subtitles, damage-number toggle, channel volumes, and focus mute in the running game. Do not merely assert saved values.
- [ ] Complete a physical-controller pass for title, dialogue, shops, inventory, settings, pause/resume, disconnect, and reconnect.

**Browser assertion pattern:**

```ts
const menu = page.getByRole('dialog', { name: 'Wayfinder Ledger' });
const before = await menu.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
await menu.getByLabel('Text scale').press('End'); // Current range maximum: 1.5.
await menu.getByRole('button', { name: 'Apply settings' }).click();
const after = await menu.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
expect(after / before).toBeCloseTo(1.5, 2);
```

**Check:** Input/feedback tests, menu/accessibility browser tests, typecheck/lint, physical-controller and visual evidence.

### Task 7: Make recovery items and equipment functional

**Files:** Modify `src/game/data/types.ts`, `src/game/data/items.ts`, `src/game/world/WorldProgression.ts`, `src/game/inventory/EquipmentStore.ts` as needed, `src/game/scenes/MenuScene.ts`, `src/game/world/WorldUiProjection.ts`, and live player rules. Create `src/game/world/PlayerItemActions.ts`, `tests/world/PlayerItemActions.test.ts`, and `e2e/inventory.spec.ts`.

**Boundary:** A pure action evaluates the authoritative save plus live vitals, returns a validated candidate and feedback, then the existing coordinator installs it and updates the player. Menu requests include the projection revision; reject stale requests and refresh the menu. Do not use checkpoint restoration to apply healing because that also resets unrelated combat state.

```ts
// Extend MenuCommand using the existing branded ItemId and EquipmentSlotId types.
type PlayerItemCommand =
  | Readonly<{ kind: 'use-item'; itemId: ItemId; revision: number }>
  | Readonly<{ kind: 'equip-item'; itemId: ItemId; slot: EquipmentSlotId; revision: number }>
  | Readonly<{ kind: 'unequip-item'; slot: EquipmentSlotId; revision: number }>;
```

- [x] Add typed content effects for recovery items and charms; current item definitions have descriptions and slots but no recovery amounts or charm benefits.
- [x] Proposed initial tuning: Sunmoss restores 30 health; Wellspring restores 20 mana; clamp at maximum and reject use at full resource without consuming the item. These are starting values for Task 12 playtesting.
- [x] Define modest, testable charm behavior consistent with copy: Quiet Step reduces authored briar-hazard damage by 20%; Resin Heart grants 300 ms post-hit protection (implementation inspection found no existing general post-hit invulnerability); Echo Thorn restores 2 mana per successful parry, capped at maximum. Update descriptions to disclose exact effects. Never grant a benefit from inventory ownership alone.
- [x] Use the existing equipment ownership/slot/duplicate validation. Present Use, Equip, Replace, and Unequip actions with a clear result or rejection reason.
- [x] Test 86/100 health + one Sunmoss → 100/100 and zero remaining; full health → unchanged quantity; no ownership → rejected; duplicate/stale request → no second effect; equipment reload → identical benefits; removal → benefits stop.
- [ ] Test invalid slot, occupied-slot replacement, three charm slots, rapid activation, and save rejection. Candidate rejection must leave both live player and inventory unchanged. Later asynchronous storage failure must remain visible and retryable.
- [x] Reuse existing inventory/equipment save fields. If additional persistent state proves necessary, stop treating this as schema-neutral and add a versioned migration with recovery tests before continuing.

**Check:** Item/equipment/progression tests, relevant live-combat tests, purchase→use/equip→reload browser flow, typecheck/lint.

### Task 8: Give difficulty a documented gameplay effect

**Files:** Create `src/game/combat/DifficultyRules.ts` and `tests/combat/DifficultyRules.test.ts`; integrate at the single authoritative player damage boundary in `src/game/entities/player/PlayerCombatRuntime.ts`, auditing boss, projectile, ordnance, and environment call sites. Modify title/pause difficulty help text.

**Policy proposal:** Story receives 75% normal health damage, Standard 100%, Challenging 125%. Apply once to resolved positive player health damage; preserve zero damage for parries/invulnerability, preserve poise rules, and exclude explicitly lethal out-of-world recovery. Use integer rounding and minimum 1 for a positive hit. Enemy health, rewards, traversal timings, and puzzles remain identical initially.

```ts
export function difficultyHealthDamage(
  resolvedDamage: number,
  difficulty: 'story' | 'standard' | 'challenging',
): number {
  if (resolvedDamage === 0) return 0;
  const multiplier = { story: 0.75, standard: 1, challenging: 1.25 }[difficulty];
  return Math.max(1, Math.round(resolvedDamage * multiplier));
}
```

- [x] Write the failing table test: 20 damage → 15/20/25; zero → zero; positive one remains at least one. Preserve existing damage input validation.
- [x] Test equivalent enemy melee, projectile, boss, and nonlethal hazard hits and ensure no path double-applies scaling.
- [x] Apply difficulty changes to the next incoming hit without resetting health, enemies, or rewards.
- [ ] Confirm title and pause descriptions match measured behavior. Revisit values only after normal-play evidence in Task 12.

**Check:** Difficulty/damage/guard/boss tests and one controlled browser damage comparison per option.

### Task 9: Make objectives, shops, and routes understandable

**Files:** Modify `src/game/scenes/MenuScene.ts`, `src/game/scenes/UIScene.ts`, `src/game/scenes/DialogueScene.ts`, `src/game/world/WorldModalController.ts`, `src/game/world/WorldUiProjection.ts`, `src/game/data/dialogue.ts`, and relevant typed room data. Create `src/game/ui/RoomMapProjection.ts`, `tests/ui/RoomMapProjection.test.ts`, and `e2e/onboarding.spec.ts`.

- [x] Build the map from authored room transitions, not display-name order. Show discovered room connections, current room, known checkpoint, locked/open exits, and known objective destination; do not reveal secret rooms prematurely.
- [x] Use selectable HTML room labels with decorative SVG connections. For transitions to unknown rooms, show an unexplored exit only if its entrance is discoverable.
- [x] Add concise contextual opening guidance for movement, jump, attack, interact, cast, and pause/journal. Derive key/button labels from current bindings and active device; update after rebinding.
- [x] Show an unobtrusive current-objective reminder and readable ability/checkpoint names. Keep tutorials recoverable from a Controls/Help section; use session-local dismissal unless persistence is explicitly needed.
- [x] Add explicit Browse wares/Forge choices. “Until next time” and Close must end dialogue. Use “Resin” throughout HUD, shop prices, descriptions, and dialogue.
- [x] Add Return to title with a save flush; on failure, stay in the current session and offer retry rather than silently discarding pending progress.
- [ ] Test graph connectivity, secret filtering, changed bindings, completed objectives, merchant close/browse behavior, and return-to-title failure recovery.

**Check:** Map/modal/projection tests and a fresh-player opening flow with no README instructions.

### Task 10: Make world progress visible and areas distinct

**Files:** Modify `src/game/entities/WorldActorView.ts`, `src/game/entities/player/PlayerView.ts`, `src/game/world/WorldObjectRuntime.ts` projections only where needed, `src/game/data/artFrames.ts`, relevant area definitions, `src/game/scenes/PreloadScene.ts`, `public/assets/art/`, and `docs/asset-provenance.md`. Add presentation tests under `tests/world/` and `e2e/world-presentation.spec.ts`.

- [x] Index props by stable object ID and synchronize opened chests, activated checkpoints/lenses, solved mechanisms, destroyed breakables, and released boss gates from authoritative state, including immediately after reload.
- [x] Use distinct illustrated state variants plus restrained activation effects. Do not rely on disappearing prompts or color alone.
- [x] Replace the common panorama with five area-specific compositions: warm settlement, wet forest, mineral cave, flooded archive, and resonator boss chamber.
- [x] Supply at least three parallax planes plus foreground framing per art direction, reserve the gameplay plane, and stop nonessential drift in reduced-motion mode.
- [x] Give enemies and the boss readable state poses for idle/movement, warning, attack, recovery, hurt, and defeat. Drive animation by elapsed simulation time, not render-frame count; correct Mara's frame-rate-dependent pose stepping too.
- [ ] Review visual readability at normal game scale across all rooms and attack states. Record provenance for every new or edited asset and include assets in deterministic preload and offline coverage.

**Check:** Object persistence/presentation tests, animation timing at different render rates, all-room visual inspection, art-direction and provenance review.

### Task 11: Verify audio and finishing feedback

**Files:** Modify `src/game/audio/AudioDirector.ts`, audio event consumers, and `docs/asset-provenance.md` only where listening exposes a defect; extend `tests/audio/AudioDirector.test.ts` as needed.

- [ ] Listen to title, each area, normal combat, both boss phases, death, and ending on speakers and headphones. Check clipping, abrupt loops, overlapping cues, missing attacks, and fatigue across a full run.
- [ ] Correct only demonstrated defects. Provide distinct readable warning cues and restrained area identity consistent with the existing original synthesis/composition.
- [ ] Verify separate channels, master mute, focus mute, first-gesture audio unlock, subtitles, and restoration after returning to the tab.
- [ ] Play a combat segment muted: all damaging warnings and important quest feedback must remain visually readable.

**Check:** Audio unit tests, actual listening evidence, and mute/focus browser flows. Passing code tests does not substitute for listening.

### Task 12: Qualify the production release candidate

**Files:** Extend relevant tests under `e2e/` and `tests/`; update `docs/release-report.md`, `docs/known-issues.md`, `docs/progress.md`, and `docs/remaining-work-checklist.md` with measured results.

- [x] Keep seeded/semantic integration tests clearly labeled. Add behavioral regressions for the repaired issues rather than weakening assertions or raising timeouts to hide failures.
- [ ] Run the release matrix once against a fixed candidate after focused checks pass:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:saves:browser
npm run test:e2e
npm run build
npm run tauri -- info
```

- [x] Check production output omits developer mutation hooks and fixture routes. Run browser/PWA acceptance against the built output, not only Vite development mode.
- [ ] Complete a fresh production-save keyboard run through all mandatory areas, dungeon, normal-stat boss, ending, and reload. No debug actions, inflated health, teleports, or developer coaching.
- [ ] Cover all optional rooms, both side quests, upgrades, shortcuts, secrets, death/respawn, save slots, export/import, malformed-file rejection, and backup recovery. These may be separate runs with explicit coverage records.
- [ ] Have at least two first-time testers play without instructions beyond those in the game. Record completion time, deaths, confusion, and blocking points; target 20–40 minutes for the mandatory first journey, recording optional detours separately. Tune only issues supported by those observations.
- [ ] Complete physical-controller play and maximum text-scale/reduced-motion checks. Smoke test supported Chromium, Safari, and Firefox builds; identify browser/version-specific limitations instead of claiming universal support.
- [ ] Profile on an Apple-silicon MacBook Air with hardware acceleration. Proposed budget: median gameplay FPS at least 58, p95 frame time at most 20 ms in traversal and the busiest boss phase, with load transitions measured separately. Record device, browser, resolution, and profiler overhead.
- [ ] Run a 30-minute soak and repeated area/death/menu cycles. Require no crashes or steady post-cleanup growth in active sprites, pools, listeners, or heap. Confirm unchanged HUD content causes no per-frame DOM replacement.
- [ ] Reject the candidate for progress loss, softlocks, invisible damage, unusable controls, severe clipping, or broken critical-path behavior. After a fix, rerun its proving test and affected flows; repeat the broader matrix only when the changed scope requires it.

**Exit:** Gates A–C are supported by recorded evidence. Physical input, first-time testers, listening, and target-hardware measurements are explicit external activities when the execution environment cannot supply them.

### Task 13: Package and verify the shareable browser link

**Files:** Modify `public/sw.js`, `public/manifest.webmanifest`, `vite.config.ts` only if deployment requires it, `e2e/pwa.spec.ts`, `README.md`, and release documents. Add host configuration only for the selected host.

- [ ] Choose a stable, dedicated HTTPS origin when preparing deployment. The current manifest, asset URLs, and cache shell use root paths; default to root hosting. Subpath hosting requires a consistent base-path change and its own tests.
- [x] Update offline asset coverage for all new art. Version the candidate cache and delete only obsolete `rivenbloom-` caches, never arbitrary caches on the origin.
- [ ] Cache successful eligible responses only; protect offline availability from cached error pages and test old-build → new-build update behavior. Use suitable revalidation for HTML/service worker and immutable caching for fingerprinted assets.
- [ ] Present updates at a safe point. Flush pending save writes before accepting reload; preserve exports and journey data across updates. Verify first visit, reload, offline return, interrupted network, and waiting-update acceptance on the hosted candidate.
- [x] Document desktop keyboard/gamepad requirements, browser support actually tested, local-only saves, export backup, playtime, credits/provenance, and known limitations. Do not advertise phone touch controls.
- [ ] Prepare the built artifact and concrete hosting configuration for review. The planning request does not authorize publishing, selecting a paid service, or buying a domain; obtain deployment authorization when the candidate and destination are ready.
- [ ] After authorized deployment, verify the actual HTTPS URL in a clean profile and PWA installation on supported platforms. Share the tested URL and version, not a temporary localhost address. Retain the previous artifact for rollback, and verify save compatibility before any rollback.
- [x] Shut down task-started servers/workers and temporary browser sessions; verify their PIDs and listeners have exited.

**Exit:** Gate D passes, the stable URL is playable, and the release report lists verified evidence and remaining nonblocking limitations accurately.

### Task 14: Native macOS distribution, if requested

**Files:** `src-tauri/`, `README.md`, and native verification sections in release documents; change only what real native testing requires.

- [x] Recheck Rust/Cargo/full-Xcode availability; the missing-toolchain report is historical and must not be assumed current.
- [ ] Once prerequisites are available, run `npm run tauri dev` and `npm run tauri build`; validate native save location, import/export, recovery, controller/audio behavior, and clean installation on the intended Mac architecture.
- [ ] Decide signed/notarized public distribution versus an explicitly labeled tester build. Signing identity, Apple account access, paid enrollment, and public upload require user-provided authorization/resources.
- [ ] Test the actual distributable on another Mac and document install/update/uninstall behavior and save retention.

Native prerequisites do not block the browser link, but an untested native package must not be advertised as ready.

## Review finding coverage

| Review finding                      | Owning task                   |
| ----------------------------------- | ----------------------------- |
| 1. Invisible attacks/effects        | 3                             |
| 2. Terrain/collision mismatch       | 2                             |
| 3. Unusable items/equipment         | 7                             |
| 4. Settings not applied             | 6                             |
| 5. Controller settings inaccessible | 6                             |
| 6. Difficulty ineffective           | 8                             |
| 7. Boss HUD overflow                | 4                             |
| 8. Portrait menu clipping           | 4, with reproduction required |
| 9. Static prop state                | 10                            |
| 10. Map lacks routes                | 9                             |
| 11. Guidance/internal names         | 9                             |
| 12. Shop/currency copy              | 9                             |
| 13. Autosave queued forever         | 5                             |
| 14. Repeated environments           | 10                            |
| 15. Per-frame HUD replacement       | 4                             |

Additional readiness work: truthful documentation (1), listening/feedback (11), normal-play balance and hardware qualification (12), hosted delivery/offline updates (13), optional native distribution (14).

## Stop condition

The browser release is ready to share when Gates A–D pass, all 15 findings are fixed or disproved by recorded evidence, the critical path and optional coverage are complete, no release-blocking defect remains, and the actual hosted build has been verified. A green test count alone is insufficient. Stop at that point; do not expand the slice while qualifying it.

## Execution record — 2026-09-23

- Task 1 complete: historical readiness claims explicitly superseded; checklist reopened.
- Ruling: execute in the current workspace, no delegation or commits — explicit project/user constraints supersede skill defaults.
- Ruling: this execution record serves as the persistent ledger; avoid extra workspace machinery and git mutations.
- Preflight: Tasks 3/6 share current settings; presentation reads live settings. Tasks 4/5 share save state; HUD must retain nodes when status changes. Tasks 7/8 share player damage/vitals; item benefits and difficulty must each apply exactly once. Tasks 2/10 share authored anchors; new art retains the same geometry contract.
- External gates pending: physical controller, first-time testers, target-hardware profiling/listening, authorized hosted deployment. No claim of share readiness until these are recorded.

### Implementation evidence

- Tasks 2/10: `artFrames.ts`, `WorldActorView`, `PlayerView`, original area/pose/NPC assets and three authored depth layers. All 18 room overview captures inspected with and without collision overlays. Tight atlas crops fixed adjacent-character fragments and obvious terrain gaps. A strict 2-logical-pixel edge criterion across every pose/edge remains a separate normal-scale acceptance check.
- Task 3: pure `CombatPresentation` and pooled `CombatPresentationView` render threats, warnings, slashes, impacts and DOM damage numbers. New boss-region regressions exposed and fixed missing spear and inversion damage. Warning and active captures for all eight boss families inspected; normal-stat gameplay acceptance remains open.
- Tasks 4/5: retained HUD and display equality, styled meters, portrait scrolling; 120-frame no-root-replacement, 1.5× text scale, contained boss and 390×844 Resume checks. SaveService subscriptions correlate generations and slots; late-write race, retry and session-only fallback tests.
- Tasks 6–8: simulated controller forms and pause guard reset; pure atomic item actions plus reload flow; live equipped charms; single difficulty boundary. Echo Thorn regression caught and fixed a stale maximum after permanent mana upgrades. No schema migration required because saved fields are unchanged.
- Task 9: discovered graph/secret filtering/known objective, binding-aware recoverable help, main quest priority, merchant exit regression, Resin copy and flush-before-title with interaction lock.
- Task 11: existing audio policy tests are available. No speakers/headphones listening evidence is claimed and no speculative mix changes were made.
- Task 13: build-derived complete precache and content-based cache version; only own obsolete caches removed; explicit update acceptance pauses interaction and flushes saves. Production test exposed a `Vary: Origin` cache-match failure, fixed for known public shell assets; offline Continue and updated-build save retention now pass locally. Hosted installation remains unverified.
- Task 14: `npm run tauri -- info` executed; Command Line Tools present, full Xcode/Rust/Cargo/rustup absent. Native compile/run intentionally not claimed.
- Browser regressions use descriptive consolidated files (`release-ui.spec.ts`, `release-gameplay.spec.ts`, `world-presentation.spec.ts`, `pwa-production.spec.ts`) rather than one file for each provisional filename in the plan.
- Original traversal helper assumed a 45-pixel distance to a prompt center even when the authoritative prompt was available. It now waits for neutral movement and the exact interaction prompt; downstream interaction/progression assertions are unchanged. Boss HUD assertion uses an exact name because the current objective also mentions the Cantor.

### Additional qualification checks

- Pure presentation tests run both boss phases, assert all eight families produce presentation, confirm phase-transition/disposal cleanup, and conservatively bound authored maximum threats below the 128-slot pool. A renderer-port test saturates decorative pools and verifies threats remain visible, zero-shake settings, complete clear/rebind and destruction.
- Added explicit Resonant Pulse and Aegis presentation plus bounded projectile trails/impact particles. Flash intensity zero now produces no bright impact flash; threat outlines remain visible.
- Difficulty delivery tests cover melee, projectile, radial and environmental hits through the same boundary. Live charm tests cover upgraded parry-mana caps, equipment removal and timed post-hit protection.
- Maximum text-scale/Resume bounds pass at 1280×720, 1024×768 and 844×390; portrait 390×844 remains covered separately. These are not a claim of 200% browser zoom.
- Generated music drafts appeared in the shared workspace; their source/output content was preserved. Prettier ignores only generator-owned `music/score-v1/` exports instead of rewriting them.

- Final presentation corrections: measured each enemy-sheet column per row, preserved aspect ratio and corrected the Cantor’s authored facing. All 16 boss warning/active captures were inspected. Quiet Step now matches the actual `bramble-thorn-contact` hazard ID, with a regression.
- Return-to-title flush-failure/retry browser regression passes. An IndexedDB outage deliberately switches to disclosed session-only storage; the retry regression injects failure at the flush boundary.
- The timed-circuit traversal now climbs before starting the clock and activates Rib → Dew → Song; the 9-second game window is unchanged. Repeated Threefold Lens labels require the helper to reach the requested dial before matching its prompt.
- Item-action qualification adds all three charm slots, occupied-slot replacement, invalid slot, unowned consumable and repeated request checks. All 5 item-action tests and 6 save-coordinator tests pass. The coordinator preserves the prior snapshot on synchronous queue rejection.
- Lantern traversal assertions now require the authoritative `fact-set` event for the specific lantern. A transient hidden interaction prompt is no longer treated as completion. No quest rules were changed.

### Final automated disposition

- Format, lint and strict TypeScript passed, with focused checks after final test edits. Full unit run: 103 files / 667 tests; subsequent player/art regressions: 49 passed; item/save-coordinator checks: 11 passed, including two new item cases. Browser IndexedDB: 7 passed.
- Development matrix: 59/60 initially; all affected combat/gameplay/encounter cases passed on rerun, and the corrected canonical traversal passed standalone in 6.9 minutes. Including the new flush-failure case, 61 distinct development-browser scenarios passed across these runs. No unresolved automated failure remains; this is not one clean 61-test final run.
- Production build passed (1,685.54 KB main JS, 445.14 KB gzip). Final production offline/update test passed; developer-bridge/fixture identifier scan clean.
- Qualification remains incomplete: normal-stat production journey, first-time testers, physical input/listening, 200% browser zoom, normal-scale exact edge acceptance, target-hardware performance/soak, Safari/Firefox and actual HTTPS deployment. Native tools remain absent.
- Cleanup verified: final Playwright/browser/server workers exited; no project dev/test commands remain and ports 4173/4174 have no listeners. Unrelated applications and Codex control workers were preserved.
