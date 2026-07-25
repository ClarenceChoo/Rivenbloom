# Task 4 report — versioned save system

## Status

Implemented the version-one save boundary, migration path, recovery-aware
repositories, autosave service, safe import preview/confirmation, export, and
deletion. All non-browser save code is framework-independent; only
`IndexedDbSaveRepository` uses browser storage APIs.

## Files

- Created `src/game/saves/SaveSchema.ts`
- Created `src/game/saves/SaveRepository.ts`
- Created `src/game/saves/MemorySaveRepository.ts`
- Created `src/game/saves/IndexedDbSaveRepository.ts`
- Created `src/game/saves/SaveService.ts`
- Created `src/game/saves/migrations.ts`
- Created `tests/saves/SaveSchema.test.ts`
- Created `tests/saves/SaveMigrations.test.ts`
- Created `tests/saves/SaveRecovery.test.ts`
- Created the Chromium-only IndexedDB harness and test under
  `tests/saves/browser/`, plus `playwright.saves.config.ts`.
- Updated `docs/progress.md` to mark schema/migration and repository recovery
  complete, while accurately leaving UI delete confirmation for the later menu
  milestone.

## Implementation decisions

- The stable slot contract is closed to `slot-1`, `slot-2`, and `slot-3`.
- `SaveV1` holds metadata/checkpoint/position, player progression, inventory,
  equipment/abilities, bindings/settings, quests, and each persistent-ID set.
  Missing optional state defaults safely; malformed required state is rejected
  with path-specific validation errors.
- Envelopes checksum a canonical, recursively key-sorted JSON representation
  with FNV-1a. Equivalent object key order therefore yields the same checksum.
- Migration returns a discriminated success/failure result. The supplied V0
  shape upgrades into a V1 payload; future versions are rejected rather than
  guessed at.
- Repositories preserve a validated prior current envelope as backup. Reads
  recover from a valid backup when current data is corrupt, otherwise report a
  corrupt slot without coercing it into a new save.
- IndexedDB rotates backup and current in one read-write transaction. The
  dedicated Chromium test writes two saves, tampers the raw current record,
  verifies recovery, and verifies the second slot remains independent.
- Import parses and migrates an isolated candidate then returns a preview; it
  writes only through `confirmImport`. Autosave is per-slot debounced and can
  be flushed/disposed by its owner.

## RED/GREEN evidence

The initial focused save suite was added before implementation and failed as
expected because the save modules were absent. After implementing the minimum
schema, migration, repository, and service contracts, all 12 focused Vitest
tests passed. The browser adapter test was also authored before its adapter;
after implementation it passed against Chromium's real IndexedDB.

## Tests and command results

- `npm test -- tests/saves/SaveSchema.test.ts tests/saves/SaveMigrations.test.ts tests/saves/SaveRecovery.test.ts`: passed, 12 tests.
- `npm run typecheck`: passed.
- `npm run format:check`: passed.
- `npm run lint`: passed.
- `npm run check`: passed: format, lint, TypeScript, 58 Vitest tests, and the
  production build.
- `npm run test:e2e`: passed. The project-wide E2E command intentionally has
  no application E2E tests at this milestone.
- `npx playwright test --config=playwright.saves.config.ts`: passed, 1
  Chromium test using real IndexedDB.

## Concerns

- The later title/menu UI must ask the player for delete confirmation before
  calling `SaveService.delete`; this task intentionally supplies the safe
  storage operation but has no UI surface.
- Boot-time repository selection and browser-storage-failure fallback wiring
  belong to the boot/title milestone. `MemorySaveRepository` is ready for that
  fallback.
- Vite retains its existing 1.2 MB production-chunk advisory; it does not
  originate from this task and does not fail the build.

## Commit

Implementation commit: `5bfcb44 feat: add versioned save system`.

## Fix Round 1

Addressed all three Important persistence risks from the fresh review.

- `SaveService` now serializes per-slot writes, tracks the active operation,
  returns a promise from `scheduleAutosave`, and attaches an internal rejection
  handler so ignored scheduled saves do not create an unhandled rejection.
  `flushAutosaves` starts pending saves then waits for every active operation;
  it also rethrows a completed write failure until a later operation replaces
  it. Confirmed imports and deletions cancel pending autosaves and await a
  started one before their own serialized operation begins.
- Slot record resolution now receives the requested slot ID and requires both
  current and backup validated envelopes to contain that same slot in their
  payload. A wrong-slot current may only fall back to a valid same-slot backup;
  wrong-slot current and backup records are corrupt.
- V0 migration now defaults only fields that are absent. Any present malformed
  legacy timestamp, playtime, currency, position, health, mana, area, or
  checkpoint produces `invalid-save` with a source-field error and cannot
  become an import preview.
- The Chromium IndexedDB harness now also writes wrong-slot current and backup
  envelopes and verifies the repository reports the slot corrupt.

### RED/GREEN evidence

- The new migration cases were RED because V0 conversion silently changed
  invalid values into defaults. They are GREEN after explicit presence-aware V0
  validation.
- The wrong-slot memory recovery cases were RED because `slot-1` read a
  checksum-valid `slot-2` envelope. They are GREEN after expected-slot checks
  for both current and backup.
- The stale-autosave/import race was RED because import queued immediately;
  the observed second write proved that stale work could finish after import.
  It is GREEN after waiting for the existing slot operation. The failure test
  was RED because `scheduleAutosave` returned `undefined` and the rejected
  background write was unhandled; it now returns a rejecting promise and
  `flushAutosaves` observes the rejection.
- The Chromium expectation first failed while the harness lacked the
  wrong-slot assertion; the completed harness is GREEN against real IndexedDB.

### Fix validation

- Focused save suite: 27 tests passed.
- `npm run typecheck`: passed.
- `npm run check`: passed: format, lint, typecheck, 77 Vitest tests, and the
  production build.
- `npm run test:e2e`: passed.
- `npx playwright test --config=playwright.saves.config.ts`: passed, 1 real
  Chromium IndexedDB test.

Fix commit: `d610cff fix: serialize save persistence operations`.

The existing Vite production chunk-size advisory remains the only concern.
