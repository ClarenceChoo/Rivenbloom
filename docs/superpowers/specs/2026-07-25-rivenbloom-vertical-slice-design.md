# Rivenbloom Vertical Slice Design

## Decision Summary

Rivenbloom will be a cohesive, data-driven Phaser vertical slice rather than a
collection of disconnected demonstrations. The requirements attachment is the
approved product brief, and its explicit instruction to continue after planning
removes the need for a separate approval pause.

## Approaches Considered

### A. Single-scene content-first prototype

One large Phaser scene could deliver movement and combat quickly, but it would
entangle saves, UI, world scripting, and encounter logic. It would be difficult
to test, expand, or unload cleanly and would almost certainly become a god
class. Rejected.

### B. Modular area runner with typed content definitions

Reusable systems run typed area definitions that describe platforms, hazards,
spawns, triggers, transitions, props, parallax, music, and room discovery. Pure
rules stay outside Phaser, while scenes coordinate lifecycle. This produces a
complete route now and makes later regions configuration-led. Selected.

### C. Full Tiled production pipeline before gameplay

Tiled maps and external atlases are excellent for a larger team, but building a
complete custom editor pipeline before validating feel would delay the playable
slice. The chosen schema remains Tiled-compatible in concepts and can receive
an importer later. Deferred.

## Player Promise

The player is Mara Vey, a young wayfinder returning to Brackenreach after the
wood's navigation chimes fall silent. She discovers that the abandoned
Rootglass Reliquary is drawing memories out of living roots. By listening to
resonant traces, opening old traversal routes, and learning the observatory's
defensive arts, Mara restores the route to Wren's Rest and releases its damaged
guardian, the Pallid Cantor.

The tone is hopeful, uncanny, and intimate. The story concerns listening,
stewardship, and repairing a system whose original custodians valued records
over living memory.

## Core Loop

1. Read the terrain and enemy telegraphs.
2. Traverse with forgiving movement and short ability chains.
3. Fight compact encounters with sword, block/parry, dash, and one selected
   spell.
4. Explore a branch for currency, lore, a charm, or permanent growth.
5. Activate a mechanism or shortcut using Resonant Pulse.
6. Return to Wren's Rest to upgrade and advance the quest.
7. Enter the reliquary, combine learned mechanics, defeat the guardian, and
   restore the region's song.

## World Graph

```text
Wren's Rest
  |-- herb loft discovery
  |-- Orin's forge/shop
  |
Brackenreach Trail -- split cedar hidden room
  |
Listening Arch -- locked shortcut back to Wren's Rest
  |
Singing Hollows
  |-- echo pool health shard
  |-- dash trial
  |
Reliquary Verge -- Thorn Sentinel
  |
Rootglass Vestibule
  |-- west archive key
  |-- east lens puzzle / mana shard
  |
Flooded Stacks -- breakable wall / Cartographer's folio
  |
Resonance Gallery -- three-lens mechanism
  |
Hollow Choir -- Pallid Cantor
```

The critical path includes two village conversations, six normal encounters, an
elite gate, a cave ability trial, three dungeon mechanisms, a checkpoint, and
the boss. Optional paths provide two discoveries, health and mana upgrades, a
charm, lore, and a persistent shortcut.

## Progression

- Start: three-hit blade combo, air slash, block/parry, Lumen Bolt.
- Cave reward: Wayfinder Dash, usable in combat and across short bramble gaps.
- Village quest reward: Aegis Veil, a mana barrier that turns one blocked
  projectile into charge.
- Dungeon unlock: Resonant Pulse, which awakens amber mechanisms and briefly
  staggers rootglass enemies.
- Weapon upgrade 1: Orin reforges the Surveyor Edge for currency and a briar
  core.
- Weapon upgrade 2: activating the reliquary forge adds a Rootglass edge before
  the boss.
- Permanent pickups: Heart Petals and Wellspring Seeds.
- Charms: Quiet Step, Resin Heart, and Echo Thorn provide small build changes.

## Quest and NPCs

- **Main quest – The Silent Bloom:** Sela asks Mara to restore the listening
  arch; Piri decodes a root-memory; Orin repairs the blade; the Cantor's defeat
  restores Brackenreach's chimes.
- **Sela Quill:** cartographer, save/map tutorial, tracks discovered rooms.
- **Orin Fen:** smith and shopkeeper, weapon upgrades and charms.
- **Piri Moss:** herbalist, ability quest and recovery supplies.
- **Optional discovery – Lost Folio:** recover Sela's archive pages.
- **Optional discovery – Lanterns for the Absent:** relight three memorial seed
  lanterns for a permanent mana increase.

Dialogue changes at quest milestones and after the boss.

## Movement and Combat Feel

Movement runs at a fixed simulation step where practical. Tunable rules include
acceleration, braking, friction, coyote time, jump buffer, variable jump cut,
fall cap, landing lock, climb speed, dash duration, and platform drop-through.
Input intents are buffered independently of device bindings.

Attacks have anticipation, active, and recovery windows. Explicit hitbox
definitions carry damage, poise, knockback, hit-stop, and tags. Hurt resolution
is deterministic and shared by player, enemies, hazards, and spells. Parry
success creates a wider punish window; normal blocking reduces damage and
consumes mana. Assist settings alter incoming damage, parry window, and fall
recovery without changing enemy readability.

## Enemy and Boss Design

Five standard archetypes exercise a different skill: grounded spacing, aerial
tracking, projectile timing, guard breaking, and ambush tells. Encounters cap
simultaneous attackers and keep ranged enemies inside camera-safe boundaries.
The Thorn Sentinel combines shield pressure with a delayed sweep but drops a
required briar core.

The Pallid Cantor has four phase-one attacks, a cinematic crack transition, and
four phase-two variants. Damage alone cannot end phase two: Mara must awaken two
arena lenses with Resonant Pulse to expose the heart. The mechanic reuses the
dungeon lesson and guarantees a readable opening. Defeat persists immediately,
unlocks the exit, grants the Cantor Sigil, and autosaves before the ending
conversation.

## Scene and Service Architecture

```text
Bootstrap
  -> service registry
  -> typed event bus
  -> settings + save repository
  -> scene flow

WorldScene
  -> AreaLoader -> AreaDefinition
  -> PlayerController -> PlayerStateMachine
  -> EncounterDirector -> EnemyFactory -> EnemyStateMachine
  -> CombatSystem -> Hitbox/Hurtbox + DamageResolver
  -> TriggerSystem -> quests/checkpoints/transitions/puzzles
  -> CameraDirector

UIScene / MenuScene / DialogueScene
  -> read typed game events
  -> issue semantic commands
  -> never manipulate world entities directly
```

Systems are disposed through an explicit scene scope. Area changes serialize a
small transition payload rather than retaining scene objects.

## Data Model

`AreaDefinition` contains stable room IDs, bounds, layers, collision surfaces,
one-way platforms, climb zones, water/hazards, spawn definitions, triggers,
doors, mechanisms, shortcuts, checkpoint, background set, ambient profile, and
music cue.

`ActorDefinition` contains stats, movement, perception, attack references,
resistances, drop table, animation set, audio set, and AI profile.

`AttackDefinition` contains timing frames, hitbox keyframes, damage packet,
movement impulse, cancel windows, sound/effect cues, and cooldown.

Display names are never persistence keys.

## Save Format

Schema version 1 stores three envelopes keyed by slot. Each envelope includes a
validated save payload, checksum, write timestamp, and previous valid payload.
The payload stores:

- slot metadata, playtime, timestamp, region, checkpoint, safe position;
- player base stats, health/mana upgrades, XP, currency, weapon/spell levels;
- inventory, equipped charms, unlocked abilities, bindings, and settings;
- quest stages and flags;
- boss, chest, shortcut, puzzle, discovery, and map-room ID sets.

Writes use one IndexedDB transaction to rotate current to backup and write the
new current record. Invalid current data falls back to backup; invalid optional
fields migrate to defaults. Import parses into an isolated candidate, validates
and previews it, then writes only after confirmation.

## UI and Accessibility

The HUD stays quiet outside combat. Pause tabs cover map, inventory/equipment,
journal, and settings. Save slots show playtime, current area, upgrades, and
timestamp. All menus work with keyboard and gamepad.

Accessibility includes remapping, reduced motion, shake/flash sliders, text
scales, subtitles, high-contrast prompts, damage-number toggle, separate audio
channels, mute when unfocused, hold/toggle behaviour, and three difficulty
profiles. The chosen values persist independently and in save exports.

## Audio

Music uses original short adaptive loops: plucked glass and low wooden
percussion for Brackenreach; breathy drones and water drops for the Hollows;
measured copper pulses for the Reliquary; layered chimes and bowed textures for
the Cantor. Web Audio synthesis and authored recordings are rendered to static
assets so loops remain deterministic. SFX groups have variation and pitch
jitter with concurrency limits.

## Error Handling

- Asset-load failure presents a retry screen and identifies the failing group.
- IndexedDB failure falls back to an in-memory session with a persistent warning
  and export option.
- Corrupt saves fall back to backup and preserve the corrupt JSON for export.
- Unknown content IDs log once, skip safely where optional, and stop with a
  readable development error where critical.
- Area transitions autosave only after a safe spawn is established.
- Focus loss clears transient input to prevent stuck controls.

## Testing

Vitest covers every pure rule, save validation/migration/recovery, input intent
mapping, quest transitions, checkpoint restore, and boss persistence. Playwright
drives semantic test hooks to verify menu start, movement, jump, attack, pause,
settings, save creation, reload/load, and absence of uncaught console errors.

Manual browser verification covers keyboard feel, a full critical-path
playthrough, secrets, gamepad where hardware is visible, fullscreen/resizing,
1024-pixel laptop width, high DPI, PWA offline reload, audio mix, and
accessibility settings. Tauri is configured in-project; native compilation
requires Rust/Cargo, which are not present in the initial environment. Apple
Command Line Tools are installed and are sufficient for ordinary unsigned
desktop development; distribution signing/notarisation remains a separate
developer-account workflow.

## Design Self-Review

- No placeholders or unresolved design decisions remain in this specification.
- The world graph supports every required area and required progression gate.
- The selected modular approach matches the scene, save, test, and expansion
  architecture.
- Stable IDs, platform boundaries, error paths, and boss persistence are
  explicit.
- Scope is large but forms one vertical slice; milestones keep every phase
  independently playable.
