# SDD ledger — plan: docs/implementation-plan.md

Setup: isolated worktree `feature/rivenbloom-vertical-slice` created from `dd6c04e`.
Pre-flight: plan scanned; no task/global-constraint conflicts found.
Task 1: minor (deferred): progress checklist does not yet mark the required-script/check milestone complete.
Task 1: minor (deferred): npm is range-constrained by engines but not exactly pinned through packageManager.
Task 1: fix round 1/5 (2 addressed, 0 open — browser-only TypeScript boundary; dependency advisory triage and remediation; commits 425ea1c..21afff7).
Task 1: complete (commits dd6c04e..21afff7, review clean).
Task 2: minor (deferred): initial tests omitted the default event-map contract and cleanup-continuation behavior; covering tests are expected as part of the important fixes.
Task 2: fix round 1/5 (2 addressed, 0 open — closed typed event contract; aggregate cleanup continuation; commits 708f16f..d47dac1).
Task 2: complete (commits c6f6454..d47dac1, review clean).
Task 3: minor (deferred): equipment bonus keys are arbitrary strings rather than a closed stat-key type.
Task 3: minor (deferred): critical-hit tests do not directly assert block-based critical exclusion.
Task 3: fix round 1/5 (1 addressed, 2 carried forward — validated stable IDs; deterministic numeric boundaries and duplicate prerequisite validation remained open).
Task 3: fix round 2/5 (1 addressed, 1 carried forward — duplicate prerequisite validation; floating-point overflow boundary remained open).
Task 3: fix round 3/5 (1 addressed, 0 open — post-operation saturation closes the IEEE-754 overflow boundary).
Task 3: complete (commits d47dac1..9609202, review clean).
Task 3: fix round 3/5 (1 addressed, 0 open — computed-product saturation closes IEEE-754 rounding overflow; review pending).
Task 4: fix round 1/5 (3 addressed, 0 open — serialized autosave durability,
slot-bound recovery, and presence-aware V0 migration; commit d610cff).
Task 4: minor (deferred): `SaveService.dispose()` clears pending timers without
settling the promise returned by `scheduleAutosave()`.
Task 4: complete (commits 32c8053..a7de6a8, review clean).
Task 5: fix round 1/5 (3 addressed, 0 open — per-device rebind preservation,
saved-binding conflict validation, and neutral-gamepad focus recovery; commits
fc82764..05861e1).
Task 5: complete (commits a7de6a8..05861e1, review clean).
Task 6: minor (deferred to Task 15): rendered save drawer needs richer carved
seed-pod material articulation to reach the accepted concept.
Task 6: fix round 1/5 (3 addressed, 0 open — fresh-key confirmation edges,
shared persisted accessibility state, and modal focus containment/restoration;
commit 5de6930).
Task 6: complete (commits 05861e1..5de6930, review clean).
Task 7: minor (deferred): stable-ID validation does not yet traverse every
material, encounter, render, animation, audio, AI, sound/effect, and ambience
cue field typed as `StableId`.
Task 7: fix round 1/5 (4 addressed, 0 open — boss-mechanism resolution,
discriminated trigger targets, quest-local dialogue stages, and scoped nested
identity uniqueness; commit b984a6c).
Task 7: complete (commits 5de6930..b984a6c, review clean).
Task 8: minor (deferred): parallax tiling coverage tests only zero-origin tile
starts and the corrected far-edge strip was not visually rechecked after the
fix.
Task 8: fix round 1/5 (2 addressed, 1 open — fresh contact/collision per fixed
substep and hurt-lock retention addressed; complete diagonal solid swept-AABB
handling remains; commit 3ac78a0).
Task 8: fix round 2/5 (1 addressed, 0 open — continuous solid swept-AABB with
earliest time of impact, correct normals, and one-way separation; commit
0ed3eb4).
Task 8: complete (commits b984a6c..0ed3eb4, review clean).
Task 9: minor (deferred): reduced-motion particle density is computed but the
runtime impact adapter still spawns a fixed three-leaf burst.
Task 9: minor (deferred): melee actions emit effect cues but not their authored
typed sound-cue requests.
Task 9: minor (deferred): code-authored slash, impact, projectile, and glyph
visuals need repository-authorship entries in asset provenance.
Task 9: fix round 1/5 (3 addressed, 0 open — accessibility-scaled impact leaf
density through pure impactLeafShapes, authored melee effect+sound cue
emission, and code-authored runtime visual provenance entries; dash e2e now
unlocks Wayfinder Dash through the development-only window.__RIVENBLOOM_TEST__
bridge because a fresh save correctly starts with lumen-bolt only).
Task 9: complete (commits 0ed3eb4..f337b76, full check + all e2e + browser
save spec green).
