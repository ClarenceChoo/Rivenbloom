# Rivenbloom Asset Provenance

Last updated: 2026-09-23

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
