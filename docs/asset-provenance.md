# Rivenbloom Asset Provenance

Last updated: 2026-10-07

All production assets below were created specifically for Rivenbloom. No screenshots, maps,
characters, UI, names, story material, sound, or other assets from Swordigo or another game were
used as references. Runtime interface copy remains selectable HTML text.

## Generated production art

| Project asset                                           | Source and authorship                                                       | Prompt summary                                                                                                                                                                                                                                                               | Modifications and runtime use                                                                                                          | Usage status                     |
| ------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `public/assets/art/rivenbloom-world-panorama.png`       | OpenAI built-in image generation, directed in this repository on 2026-08-29 | Original side-view panorama progressing from a seed-lantern village through wet forest, singing cave, ivory rootglass reliquary, and a dark choral sanctuary; parchment, ink-blue, moss, teal, and ember palette; no text, logo, watermark, or copyrighted-game resemblance. | Copied unchanged from the generated PNG. Scaled and cropped responsively as the world, title, menu, and ending backdrop.               | Project-original production art. |
| `public/assets/art/rivenbloom-character-lineup.png`     | OpenAI built-in image generation, directed in this repository on 2026-08-29 | Original transparent eleven-character side-view lineup: Mara, Sela Quill, Orin Fen, Piri Moss, six authored enemies/elites, and the Pallid Cantor; distinct readable silhouettes; no text or external character reference.                                                   | Copied unchanged. Phaser registers independent crop frames for NPC, enemy, elite, and boss views; hitboxes remain authored separately. | Project-original production art. |
| `public/assets/art/rivenbloom-mara-animation-sheet.png` | OpenAI built-in image generation, directed in this repository on 2026-08-29 | Original Mara atlas with 18 full-body poses in a 6×3 layout: idle, run, jump/fall/land, light/air/charged attacks, block, parry, cast, dash, climb, and hurt; true transparent alpha; no scenery or text.                                                                    | Copied unchanged. Phaser registers equal atlas cells and selects frames from the player FSM and animation intent.                      | Project-original production art. |
| `public/assets/art/rivenbloom-world-atlas.png`          | OpenAI built-in image generation, directed in this repository on 2026-08-29 | Original transparent 6×4 terrain/prop/effect atlas covering five environment floor profiles, ladder, checkpoint, chests, gates, doorway, hazards, breakables, mechanism, lens, pickups, projectile, and impact burst.                                                        | Copied unchanged. Phaser binds crops to typed surfaces, zones, checkpoints, chests, breakables, mechanisms, gates, and transitions.    | Project-original production art. |
| `public/assets/art/rivenbloom-ui-atlas.png`             | OpenAI built-in image generation, directed in this repository on 2026-08-29 | Original transparent 6×3 portrait/icon atlas for Mara, three NPCs, the Cantor, Silent Bloom, vitals, currency, abilities, map, inventory, journal, settings, autosave, and Cantor Sigil.                                                                                     | Copied unchanged. CSS crops the atlas for the selectable-text HUD; the source remains preloaded and validated.                         | Project-original production art. |

Rejected intermediate generations with opaque or painted sprite-sheet backgrounds were not copied
into the project and are not runtime assets.

## Authored and derived application art

| Project asset                      | Source and authorship                                                                                  | Modifications and runtime use                                                                         | Usage status                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `public/icons/rivenbloom-icon.svg` | Hand-authored SVG in this repository: an original seed-lantern mark using the Rivenbloom palette.      | Used by the web manifest and browser icon.                                                            | Project-original production art.         |
| `src-tauri/icons/**`               | Deterministically derived from `public/icons/rivenbloom-icon.svg` with `npx tauri icon` on 2026-08-29. | Tauri-generated PNG, ICNS, ICO, Windows, iOS, and Android application icon sizes. No visual redesign. | Derived project-original production art. |

## Audio and typography

- `src/game/audio/AudioDirector.ts` contains original procedural Web Audio synthesis and sequencing
  authored for Rivenbloom. Its effects, focus muting, music crossfades, separate volume controls,
  and semantic captions remain in use. Area and boss music is now supplied by the authored score below.
- Typography uses only the user's installed system fonts through CSS fallback stacks. No font files
  are bundled.

## Original Rivenbloom soundtrack, 2026-09-23

The ten compositions in `music/score-v1/` were newly authored for Rivenbloom in
`music/source/compose.py`. Their melodies, harmonies, arrangements, and MIDI are original; no
existing game soundtrack or recording was used as a source or generation reference. The recurring
seed-song is varied across the village, forest, cave, archive, Cantor encounter, and release.
`music/source/render-score.swift` performs the MIDI parts with the Apple General MIDI instrument
bank installed on this Mac (`gs_instruments.dls`). `music/source/render-all.py` renders, levels,
smooths loop seams, and encodes them as MP3. The game loads those files from
`public/assets/audio/rivenbloom/`; the MIDI and note-level scores remain under
`music/score-v1/` for editing. No Apple instrument samples or sound bank files are bundled.

| Cue                                | Placement                                         |
| ---------------------------------- | ------------------------------------------------- |
| `01-a-thread-of-amber.mp3`         | Title / menu                                      |
| `02-lanterns-above-the-rain.mp3`   | Wren's Rest                                       |
| `03-the-listening-wood.mp3`        | Brackenreach                                      |
| `04-what-the-roots-remember.mp3`   | Singing Hollows                                   |
| `05-an-archive-under-water.mp3`    | Rootglass Reliquary                               |
| `06-copper-and-briar.mp3`          | Thorn Sentinel room in Brackenreach               |
| `07-the-unanswered-note.mp3`       | Hollow Choir before the boss                      |
| `08-first-verse-of-the-hollow.mp3` | Pallid Cantor phase one                           |
| `09-the-throat-of-glass.mp3`       | Pallid Cantor phase two and subdued heart opening |
| `10-the-song-released.mp3`         | Cantor defeat / release                           |

## Original Lanterns theme and combat variation, 2026-10-07

`music/source/compose-lantern-theme.py` authors two new original arrangements for
Rivenbloom. It retains the game's six-note seed-song in a new melody with an
answer phrase, changing harmony, sparse openings, a fuller return, and a quiet
closing passage. No existing game soundtrack or recording is a reference.
Editable note and expression data are in `music/score-v2/`.

`music/source/render-score.swift` renders installed GarageBand flute and string
samples through Apple's native sampler. The flute uses the sustained solo
samples in `Flute Solo/Flute_LV_na_sus_mf` under the installed
`/Library/Application Support/GarageBand/Instrument Library/Sampler/Sampler Files/`.
The strings use the installed `String Ensemble.exs` patch under
`/Library/Application Support/Logic/Sampler Instruments/09 Orchestral/09 Strings/`.
CC11 expression data shape the phrases and string swells. The composer synthesizes
the plucked strings and glass chimes from original harmonic formulas. Percussion
uses the installed Apple General MIDI bank already documented above.

[GarageBand's license, section 2G](https://www.apple.com/legal/sla/docs/GarageBand.pdf)
permits original soundtracks made with its included digital materials. The project
distributes the completed compositions. No instrument samples, sound banks, or
Apple patches are bundled. `music/score-v2/manifest.json` records measured export
duration, loudness, true peak, decoded loop-boundary differences, and isolated
acoustic-part loudness. The generator rejects silent instrument parts.

| Asset                            | Runtime placement                                    |
| -------------------------------- | ---------------------------------------------------- |
| `11-where-the-lanterns-wake.mp3` | Title and Brackenreach. Replaces cues 01 and 03.     |
| `12-a-voice-through-glass.mp3`   | Cantor phase two and heart opening. Replaces cue 09. |

Both stereo MP3s are in `public/assets/audio/rivenbloom/`. They use exact 32-bar
loops with a prerendered warm-up cycle to carry native instrument and reverb
tails across the seam. The generator levels the exploration cue to -20 LUFS and
the combat cue to -17.5 LUFS, subject to true-peak headroom.

## Image-generation prompts retained for handoff

The final Mara prompt requested a genuine-alpha 6×3 production atlas of the same original heroine,
with the exact 18 state poses listed above, consistent scale and baseline, restrained forest palette,
and no scenery, text, labels, grid, watermark, or copyrighted resemblance.

The final world-atlas prompt requested a genuine-alpha 6×4 grid containing the exact 24 authored
terrain, checkpoint, chest, gate, hazard, mechanism, pickup, projectile, and impact assets listed
above, using pale parchment, ink-blue, moss, rootglass teal, and restrained ember.

The final UI-atlas prompt requested a genuine-alpha 6×3 grid containing the exact five portraits,
quest emblem, vitality/currency/ability icons, navigation icons, autosave lantern, and Cantor Sigil,
with silhouettes readable from 32–96 pixels and no baked text.

## 2026-09-23 combat illustrations and anchors

`public/assets/art/effect-{bolt,sigil,slash,impact}.svg`: original hand-authored vector contours by Codex for Rivenbloom; botanical thread bolt, carved danger seal, leaf arc, and impact bloom. No external references or copied game assets. Transparent backgrounds; runtime tint indicates allegiance/phase. `artFrames.ts` records measured source-cell surface/foot anchors for existing original atlases; no collision geometry changed.

## 2026-09-23 area, actor, and depth artwork

| Asset                                                                               | Authorship and reference                                                                                                                            | Prompt and runtime treatment                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `public/assets/art/rivenbloom-area-backgrounds.png`                                 | OpenAI built-in image generation; original prompt, no reference image. Generation `exec-d9617203-b03b-4586-8a46-baa785fbd393`.                      | Five horizontally arranged environment strips: warm woodland settlement, wet forest, violet mineral cave, mint ivory archive, dark choral sanctuary. Empty lower gameplay space, no text or foreground walkable platforms. PNG copied unchanged; Phaser crops five strips.                                                                                         |
| `public/assets/art/rivenbloom-enemy-poses.png`                                      | OpenAI built-in image generation referencing only this project's original character lineup. Generation `exec-fd5b111b-542f-4b58-a920-e8181e9042ba`. | Seven original enemies/boss, six poses each: idle, movement, anticipation, attack, hurt/recovery, defeat. Transparent isolated figures, no scenery or text. Copied unchanged; Measured row and per-row column bounds account for unequal generated spacing; display scale preserves pose proportions and authored facing. State and simulation time select frames. |
| `public/assets/art/rivenbloom-npc-sprites.png`                                      | OpenAI built-in image generation referencing only this project's original character lineup. Generation `exec-d9e960fb-c11c-4a4f-a88e-fd8aa399486f`. | Isolated full-body Sela Quill, Orin Fen, and Piri Moss; readable silhouettes, transparent background, no external character references. Copied unchanged; individually measured crop bounds remove adjacent figures and empty padding.                                                                                                                             |
| `public/assets/art/distant-roots.svg`, `hanging-vines.svg`, `foreground-boughs.svg` | Original SVG paths authored by Codex for this project; no external source.                                                                          | Curved botanical silhouettes, material gradients, and foreground framing. Runtime depth planes use restrained opacity and different scroll factors; reduced motion stops decorative parallax.                                                                                                                                                                      |

World-atlas crops now use measured per-object bounds rather than uniform grid guesses. The original PNG remains unchanged. Mara uses per-pose foot anchors and elapsed-time animation. The activated checkpoint seal represents the current saved respawn checkpoint; no new persistent checkpoint collection was added. The unused atlas-edit generation was not incorporated into runtime assets.

## 2026-10-07 gameplay trailer

`brag-output/` contains an authored Hyperframes trailer made from this repository's running
game. `capture.mjs` records the Phaser canvas and native Web Audio effects with ordinary keyboard
inputs in isolated browser sessions. Imported checkpoint saves provide area access, learned arts,
120 health, 48 mana, attack power 12, armour 3, and weapon level 2. Encounter rules and game code
are unchanged. The canvas capture omits the separate HTML HUD. Source recordings and capture
metadata are retained under `composition/assets/footage/`; no external gameplay is used.

The preserved first trailer, `brag-output/before-smoothing-brag.mp4`, uses the original
`09-the-throat-of-glass.mp3` composition listed above, starting at 13.333333 seconds,
with a short opening fade and closing fade. The revised `brag-output/brag.mp4` uses
the new original `12-a-voice-through-glass.mp3` composition, starting at 24.752375
seconds, with a 0.35-second opening fade and a 2.1-second closing fade. Its 36.2-second
edit uses four continuous takes instead of nine short gameplay clips. The forest
and boss takes have no internal source cuts, and gameplay has no added zooms.
The movement-fix revision re-records all four takes after the directional camera
look-ahead change. Capture uses the Apple M4 ANGLE Metal renderer, with raw
recordings averaging 29.96–30.12 FPS and a typical 33 ms frame interval.
`composition/assets/footage/movement-fix-capture-report.json` retains timestamps,
renderer details, measured frame gaps, and source hashes. The previous export and
footage are preserved in `brag-output/before-movement-fix/`. The fresh export is
`brag-output/brag-movement-fix.mp4`, also saved as `brag-output/brag.mp4`.
The new 30 FPS captures play at their original speed. Native combat sounds
come from the captured game. The title backdrop and seed-lantern mark are copies of this project's
original panorama and icon. Typography uses EB Garamond and Inter font files bundled by the
installed Hyperframes skill, licensed under SIL Open Font License 1.1; both license texts are
included in `composition/assets/fonts/`. The composition, title motion, edit, poster, and share
copy were authored by Codex for this request. No third-party game references were used.

## 2026-10-05 player guide screenshots

These documentation images are unedited 1280×720 PNG screenshots captured from
Rivenbloom in Chromium with Playwright. They show this project's original runtime
art and HTML interface. No external game images, image-generation references,
compositing, or developer overlays were used. They are used in the README only.

| Image                                 | Source and scene                                                                                                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/images/wrens-rest.png`          | Fresh development journey at Wren's Rest after accepting Sela's quest through ordinary controls.                                                                              |
| `docs/images/brackenreach-combat.png` | Fresh production playthrough artifact `production-briar-combat.png`; ordinary movement, melee, and Lumen Bolt input with live enemies. Copied unchanged.                      |
| `docs/images/singing-hollows.png`     | Fresh production playthrough artifact `production-root-memory-chamber.png`; arrival in the Root-Memory Chamber through ordinary controls. Copied unchanged.                   |
| `docs/images/wayfinder-ledger.png`    | Map opened through the pause menu on the saved October 5 normal-stat development journey. Rooms were discovered during ordinary play; no imported save or developer mutation. |

## 2026-10-07 continuous terrain and sound polish

This section records the upstream polish candidate. The merged game uses the later generated terrain strips/fill and actor/background art documented below, while retaining these SVG terrain sources, the bounded coral briar material and the synthesized sound cues. The screenshot refresh below depicts that upstream candidate's terrain.

- `public/assets/art/terrain/{wren-rest,brackenreach,singing-hollows,rootglass-reliquary,hollow-choir}.svg`: original SVG illustrations authored for Rivenbloom, with carved mineral faces, interrupted strata, root veins and area-specific moss/copper/lichen colours. No external source or purchased assets. The 256 × 320 sheets contain a repeating body, a 24px surface rim and a 40px ledge. Runtime crops preserve material scale and place the upper edge exactly on each authored collision plane. One-way ledges stay thin; solid faces fill their collision bounds.
- `public/assets/art/terrain/thorns.svg`: original interwoven briar illustration with coral tips and a restrained danger haze. Tiled horizontally within the authored hazard bounds; no decorative enlargement of the damaging region.
- `src/game/audio/SoundCue.ts`: original synthesized impact, descending danger and rising resonance motifs. No samples or third-party audio. Voices have short gain envelopes, a 16-voice cap and explicit cleanup. Existing ten-track music remains unchanged.

## 2026-10-07 guide screenshot refresh

The three gameplay screenshots in `docs/images/` were refreshed with unedited current-build Chromium captures. `wrens-rest.png` uses the October 7 desktop gameplay capture. `brackenreach-combat.png` and `singing-hollows.png` use the final passing production route's combat and Root-Memory Chamber captures respectively. The October 5 `wayfinder-ledger.png` remains a valid illustration of the unchanged discovered-room map UI. These show the new terrain and this project's original art/UI; no external images, compositing or developer overlays were used. Historical October 5 source descriptions above are retained as provenance history.

## 2026-10-07 illustrated wiki

All wiki artwork is original, generated with the built-in OpenAI image-generation
tool from this project's art direction, without external game references. It is
companion illustration, not a representation of exact gameplay geometry. All wiki
text and controls remain selectable HTML. No additional fonts are downloaded;
Georgia, Times New Roman, and Courier New use the reader's system fonts.

| Asset                                                                 | Source and authorship                                                                                             | Prompt and use                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wiki/assets/open-book.png`                                           | Built-in image generation, 7 October 2026. Copied unchanged from `exec-36ac77c2-5efd-4026-903a-aaf5e7727b0c.png`. | A blank top-down antique leather book with copper corners, quiet pale parchment, botanical margin details, a narrow left page (28%) and wide right page (72%). Remove all text, controls and illustrations from the original wiki design concept. Used as the desktop book background; the mobile layout uses code-native parchment styling.                                                                    |
| `wiki/assets/wayfarer-village.png`                                    | Built-in image generation, 7 October 2026. Copied unchanged from `exec-73cdd2dd-9b17-4827-8599-6cbdd5995c2c.png`. | Original fine pixel-art Wren's Rest: moss-roofed timber homes under an ancient tree, suspended amber seed-lanterns, copper gutters, winding path, fern woodland, waterfalls, lilac dusk, and a distant translucent rootglass botanical observatory. Wide panoramic scene, no characters, text, watermark, or existing-game references. Displayed as a responsive cropped illustration on the wiki welcome page. |
| `wiki/public/favicon.svg` and botanical ornament in `wiki/index.html` | Original pixel-aligned SVG paths authored by Codex, 7 October 2026.                                               | A small cream open-book favicon and a moss/copper botanical sprig, using the wiki's palette. No external icons or source imagery.                                                                                                                                                                                                                                                                               |

The design-only concept `exec-4e73f57c-3f99-458a-8bed-0f675bb9fa89.png`
was also generated with the built-in tool on 7 October 2026: a complete
Rivenbloom wiki in a brown leather book with parchment contents, moss-green
navigation, a pixel village panorama, welcome copy, search, and three open
link columns. It is a design reference only and is not shipped as interface art.

## 2026-10-07 gameplay readability improvements

The built-in OpenAI image-generation tool produced the following artwork using
only Rivenbloom's existing original art and art direction. Every selected PNG was
copied unchanged into `public/assets/art/`; source alpha was preserved. No external
game imagery or references were supplied. The exact final prompts and generation
IDs are retained in `docs/art-generation-prompts.json`.

Enemy frames use individual pose bounds to exclude neighbouring hooks, wings and
spear tips. Measured pivots and ground anchors preserve their body position as
frames change. Deep terrain uses full square material textures below the caps,
preserving texture proportions without thin repeated bands or stretched detail.

`public/assets/art/rivenbloom-terrain-fill.png`, generation
`exec-9cf3c8f5-8cb5-4a7d-9999-59367cacede4`, supplies five original painted material
interiors: aged timber, forest soil/slate, violet cave slate, ivory/mint rootglass,
and copper-veined sanctuary stone. The new terrain strip is its sole style
reference. It was generated as an opaque 1536 × 1024 grid, copied unchanged, and
cropped into five 512 × 512 runtime frames. The sixth spare stone cell is unused.

| Asset                                              | Generation                                  | Prompt brief and runtime treatment                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rivenbloom-npc-sprites-v2.png`                    | `exec-c0b9a6b5-1fb1-49fe-bbd1-7af6b05f7dc6` | Three isolated full-body NPCs matching the canonical UI portraits: silver-haired elderly Sela with spectacles, stocky red-bearded Orin with goggles, and dark-haired Piri with leafy hat and lantern. Measured crops preserve proportions at 92–118 logical pixels. Replaces the previous NPC sprite sheet in the loader.                                                       |
| `rivenbloom-mara-locomotion.png`                   | `exec-332aa1e2-f9df-43bc-a582-74c6471b48de` | Six distinct running strides, horizontal resting death, and reaching interaction, preserving Mara's original face, cloak, scarf, tunic, and blade. A second packing pass corrected overlapping poses. Measured per-pose crops and ground anchors use one body scale, including the shorter death pose. The original combat/jump/climb/hurt art remains in use.                  |
| `rivenbloom-enemy-poses-v2.png`                    | `exec-51785bb0-e48a-42fd-8912-78a37b292287` | Seven original enemy/boss identities and six poses each, with broad quiet colour groups, clearer faces/cores/weapons and less tangled foliage. Measured source rows/columns retain consistent display scale and facing. Replaces the previous enemy sheet in the loader.                                                                                                        |
| `rivenbloom-terrain-strips.png`                    | `exec-f6aa4e3e-ce9c-4af5-85ac-37d38cd26e5b` | Five continuous side-view timber, moss/soil, cave slate, rootglass, and sanctuary stone bands. Crisp walkable upper edges, sparse material accents, transparent lower contours, no repeated banners or hazards. Runtime uses separately registered end caps, repeating middle material, and an interior material fill for deep solid surfaces. Collision geometry is unchanged. |
| `rivenbloom-background-wren-rest.png`              | `exec-96456901-37df-4122-bec4-5607758af1d9` | Widescreen seed-lantern woodland hamlet, moss-roofed timber homes, copper gutters, and quiet teal mist behind actors.                                                                                                                                                                                                                                                           |
| `rivenbloom-background-brackenreach.png`           | `exec-4a741576-4fac-4001-a833-01239c5cdb21` | Widescreen wet forest, split cedar, listening arch, waystones, distant rootglass dome, and quiet storm-teal foliage.                                                                                                                                                                                                                                                            |
| `rivenbloom-background-singing-hollows.png`        | `exec-6dc0b29a-ed3e-4e8b-a7ce-77edb31892fc` | Widescreen violet mineral cavern, pale ribs, hanging sound-carrying roots, mint lichen, and soft water haze.                                                                                                                                                                                                                                                                    |
| `rivenbloom-background-rootglass-reliquary.png`    | `exec-28fc5127-bb6a-4307-a561-087c0450af93` | Widescreen flooded botanical archive, ivory/mint rootglass, oxidised copper lenses, suspended tags, and subdued lower water atmosphere.                                                                                                                                                                                                                                         |
| `rivenbloom-background-hollow-choir.png`           | `exec-4da73e34-a935-4fab-afe3-4129fb60dfd2` | Widescreen dark acoustic sanctuary, broken copper resonators, rootglass ribs, chimes, and pale botanical window, with quiet plum shadows behind combat.                                                                                                                                                                                                                         |
| `hud-health.svg`, `hud-mana.svg`, `hud-cantor.svg` | Hand-authored SVG paths by Codex            | Original illustrated heart-petal, rootglass drop, and porcelain Cantor mask. Restrained material gradients, broad silhouettes and cream edges at 28 logical pixels replace the tiny detailed HUD atlas crops. All labels remain selectable HTML text.                                                                                                                           |

All five new backgrounds are 1672 × 941 pixels and cover the 1280 × 720 stage with
a single uniform scale. The previous five-strip background, NPC sheet and enemy
sheet remain as source artwork, but are no longer loaded for gameplay. The
original world atlas remains in use for props; its isolated platforms are replaced
by the continuous terrain bands. The first uncorrected Mara supplement
`exec-33c7aba0-b71d-4aad-98ab-6a50c9f94aa0` is an intermediate only and is not bundled.
