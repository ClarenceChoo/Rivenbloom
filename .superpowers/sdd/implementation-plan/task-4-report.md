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
