# Task 5 — Input Abstraction and Settings Report

## Implementation Summary

- Added stable semantic input actions, authoritative keyboard/gamepad defaults,
  a `0.25` axis deadzone, and a `120ms` intent buffer.
- Added `InputService` keyboard and browser-gamepad adapters, focus-safe
  transient clearing, rebind conflict detection, optional block toggle, typed
  input events, listener disposal, and best-effort gamepad haptics.
- Added validated binding serialisation/restoration plus accessibility/audio
  normalization and a pure `SaveV1` preference merge helper.
- Verified preference persistence through the existing `SaveService` and
  `MemorySaveRepository`; no storage API is accessed by input/settings code.
- Marked the Phase 2 input/settings milestone complete in `docs/progress.md`.

## Files Changed

- `src/game/input/InputActions.ts`
- `src/game/input/bindings.ts`
- `src/game/input/InputService.ts`
- `src/game/config/accessibility.ts`
- `tests/input/bindings.test.ts`
- `tests/input/InputService.test.ts`
- `tests/input/accessibility.test.ts`
- `docs/progress.md`

## RED Evidence

Each test below was added before its supporting production behavior and run
immediately. The failure was attributable to the absent contract/behavior:

```text
$ npm test -- tests/input/bindings.test.ts
FAIL Cannot find module '../../src/game/input/bindings'

$ npm test -- tests/input/bindings.test.ts
FAIL Cannot read properties of undefined (reading 'move-left')

$ npm test -- tests/input/InputService.test.ts
FAIL Cannot find module '../../src/game/input/InputService'

$ npm test -- tests/input/InputService.test.ts
FAIL expected gamepad movement -1 / gamepad; received 0 / keyboard

$ npm test -- tests/input/InputService.test.ts
FAIL expected [] to include 'jump'

$ npm test -- tests/input/InputService.test.ts
FAIL input.rebind is not a function

$ npm test -- tests/input/bindings.test.ts
FAIL applySerializedBindings is not a function

$ npm test -- tests/input/accessibility.test.ts
FAIL Cannot find module '../../src/game/config/accessibility'

$ npm test -- tests/input/InputService.test.ts
FAIL expected false to be true (hold-to-toggle)

$ npm test -- tests/input/accessibility.test.ts
FAIL input.serializeBindings is not a function

$ npm test -- tests/input/InputService.test.ts
FAIL input.pulseHaptics is not a function

$ npm test -- tests/input/InputService.test.ts
FAIL expected input binding event; received undefined
```

## GREEN Evidence

```text
$ npm test -- tests/input/bindings.test.ts
PASS 3 tests

$ npm test -- tests/input/InputService.test.ts
PASS 8 tests

$ npm test -- tests/input/accessibility.test.ts
PASS 2 tests

$ npm test -- tests/input/accessibility.test.ts tests/input/InputService.test.ts tests/input/bindings.test.ts
PASS 3 files, 13 tests
```

## Verification

```text
$ npm run typecheck
PASS

$ npm run lint
PASS

$ npm run format:check
PASS

$ npm run check
PASS: format, lint, typecheck, 13 Vitest files / 90 tests, production build

$ npm run test:e2e
PASS (no e2e tests collected; --pass-with-no-tests)
```

The production build completed successfully. Vite reported its existing
large-chunk advisory for the Phaser bundle (1,208.99 kB / 332.69 kB gzip).

## Self-Review

- Confirmed action IDs are stable lowercase kebab-case strings.
- Confirmed defaults use `KeyboardEvent.code` IDs and conventional common
  gamepad mappings, including stick/D-pad movement aliases.
- Confirmed input code contains no direct IndexedDB/Tauri calls and persistence
  integration uses `SaveService` plus `MemorySaveRepository`.
- Confirmed all added tests exercise observable behavior, including saved
  preference reload, rather than inspecting source constants.
- Ran `git diff --check`; no whitespace errors were reported.

## Concerns

- No browser playthrough exists yet because the gameplay scenes are a later
  milestone; the browser adapter is covered through injected device snapshots.
- Optional haptics correctly return `false` when absent or rejected. Actual
  controller actuator availability remains browser/device dependent.

## Commit SHA

`c235305` — `feat: add semantic input and settings`

## Fix Round 1

### Files Changed

- `src/game/input/InputService.ts`
- `src/game/input/bindings.ts`
- `tests/input/InputService.test.ts`
- `tests/input/bindings.test.ts`

### Regression Tests and RED Evidence

The tests name these production breaks: a device remap drops its other device
binding, a saved override bypasses the normal conflict gate, and an already-held
gamepad control survives a browser focus loss.

```text
$ npm test -- tests/input/InputService.test.ts
FAIL keeps the other device binding active when an action is remapped
expected false to be true after keyboard remap; default gamepad button was lost

$ npm test -- tests/input/bindings.test.ts
FAIL rejects a saved override that would collide with another action
received attack-light keyboard:KeyC instead of its default bindings

$ npm test -- tests/input/InputService.test.ts
FAIL requires a neutral gamepad sample after focus loss before accepting input again
received held.jump true and buffered actions immediately after blur

$ npm test -- tests/input/InputService.test.ts tests/input/bindings.test.ts
FAIL restored keyboard remap did not retain the default gamepad binding
FAIL saved keyboard override did not retain the default gamepad binding
```

### GREEN Evidence

```text
$ npm test -- tests/input/InputService.test.ts
PASS 9 tests

$ npm test -- tests/input/bindings.test.ts
PASS 4 tests

$ npm test -- tests/input/InputService.test.ts tests/input/bindings.test.ts
PASS 2 files, 13 tests
```

### Verification

```text
$ npm run lint
PASS

$ npm test -- tests/input/InputService.test.ts tests/input/bindings.test.ts tests/input/accessibility.test.ts
PASS 3 files, 15 tests

$ npm run typecheck
PASS

$ npm run format:check
PASS

$ git diff --check
PASS
```

### Self-Review

- Per-device remaps now replace only their own device binding and retain the
  other device's action binding, including after serialisation/restoration.
- Saved binding lists are resolved against defaults and rejected atomically if
  any saved binding conflicts with another action.
- A focus loss disables gamepad input until an observed neutral sample; a still
  held gamepad button cannot create a stuck intent, while a subsequent release
  and press works normally.

### Commit SHA

`9578b56` — `fix: preserve input device bindings`
