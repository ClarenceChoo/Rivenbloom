# Rivenbloom Art Direction

## Visual Thesis

Rivenbloom looks like a hand-painted folktale assembled from layered vellum,
weathered silk, carved wood, and luminous stained glass. Broad shapes remain
readable during combat while fine botanical linework rewards quiet exploration.
The world is inviting at a distance and strange at its edges.

This direction intentionally avoids the visual language of Swordigo. It uses no
matching character silhouette, costume, weapon, landscape, architecture,
colour scheme, interface composition, enemy design, or iconography.

## Identity

- **Title:** Rivenbloom
- **Region:** Brackenreach, a rain-fed woodland grown through an abandoned
  acoustic observatory.
- **Settlement:** Wren's Rest, a hamlet built around suspended seed-lanterns.
- **Cave:** Singing Hollows, a mineral cavern where roots carry distant sound.
- **Dungeon:** Rootglass Reliquary, a flooded botanical archive of brass lenses
  and translucent roots.
- **Boss arena:** Hollow Choir, a circular chamber whose broken resonators awaken
  the Pallid Cantor.
- **Hero:** Mara Vey, a compact wayfinder in an asymmetrical moss cloak, cream
  tunic, copper bracers, and a long luminous thread-scarf. Her leaf-shaped
  crescent blade folds from a surveyor's tool.

## Rendering Pillars

1. **Readable silhouettes:** characters read at 96–160 logical pixels tall.
2. **Layered depth:** every area uses at least three parallax planes plus
   foreground framing.
3. **Restrained richness:** large quiet colour masses are interrupted by small,
   high-value resonance accents.
4. **Material specificity:** moss is soft and fibrous; rootglass is translucent;
   copper is warm and oxidised; stone is damp and chalky.
5. **Purposeful motion:** cloth, leaves, dust, motes, water, and light move with
   different rhythms. Reduced-motion mode removes nonessential drift.

## Palette

| Role             | Colour        | Hex       |
| ---------------- | ------------- | --------- |
| Deepest shadow   | Midnight plum | `#171325` |
| Cave shadow      | Ink violet    | `#27213A` |
| Distant forest   | Storm teal    | `#244C50` |
| Moss body        | Fern green    | `#47705C` |
| Living foliage   | Sage          | `#79A06B` |
| Parchment light  | Warm cream    | `#F0E3C0` |
| Metal            | Aged copper   | `#B96F45` |
| Resonance        | Lantern amber | `#F5C96A` |
| Magic highlight  | Moon mint     | `#9EE7D7` |
| Danger telegraph | Coral ember   | `#EE765F` |
| Rare secret      | Orchid        | `#BC8AE8` |

Area grading changes value and saturation but keeps resonance amber and danger
coral stable for gameplay readability.

## Character Language

### Mara Vey

- Triangular cloak and trailing thread-scarf create a fast forward-pointing
  silhouette.
- Face is visible and expressive; no helmet, blue tunic, or Swordigo-like
  proportions.
- Crescent blade attacks draw leaf-shaped amber arcs.
- Cast poses pull light through the scarf into the leading hand.
- Required animation clips: idle, run, jump, fall, land, light combo 1–3, air
  attack, charged attack, block, parry, cast, dash, climb, interact, hurt, death.

### Enemies

- **Briar Scrapper:** low quadruped made from woven twigs and a ceramic mask;
  lunges and recoils.
- **Duskwing:** broad moth-bat with translucent plum wings and dangling seed
  hooks; dives in shallow arcs.
- **Spore Scribe:** walking shelf fungus carrying a crooked reed focus; plants
  delayed pollen bolts.
- **Barkbound:** tall defensive husk with a door-like bark shield; exposes a
  moon-mint core after blocking.
- **Rootlurker:** ribbon root with a bell-shaped jaw; ground tell precedes its
  ambush.
- **Thorn Sentinel:** elite copper-and-vine guardian with a rotating halo of
  thorns and a two-stage spear sweep.

### Boss: The Pallid Cantor

A towering rootglass avian effigy with a long porcelain throat, four suspended
copper chimes, and wing-like root fans. It is not a dragon, knight, humanoid
warrior, or boss silhouette from the reference games.

- Phase one is grounded and stately: chime slam, fan sweep, note projectiles,
  and falling glass-root spears.
- Transition cracks the porcelain throat and releases an inner moon-mint
  resonance form.
- Phase two hovers in short arcs, reverses safe zones, chains resonant notes, and
  exposes its heart only after the player activates arena lenses.
- Telegraphs use coral pulses, anticipatory poses, and distinct sound motifs.

## Environment Kits

### Brackenreach

Layered wet forest, slate shelves, leaning waystones, ferns, foxglove, rope
bridges, old survey instruments, drifting leaves, rain threads, and amber
seed-lanterns. Landmarks use silhouette first: the split cedar, listening arch,
and distant reliquary dome.

### Wren's Rest

Rounded timber homes with moss roofs, carved shutters, drying herbs, woven
awnings, copper gutters, and suspended lantern clusters. Warm values and quiet
particles communicate safety.

### Singing Hollows

Dark violet rock, pale mineral ribs, hanging roots, shallow water, echo ripples,
glow lichen, and resonant stone plates. Traversal readability comes from warm
cream ledges and moon-mint climb marks.

### Rootglass Reliquary

Flooded slate chambers, oxidised copper mechanisms, botanical mosaics,
translucent rootglass columns, lens arrays, hanging archive tags, and dust motes.
Amber denotes usable machinery; orchid denotes optional secrets.

## UI

- Framing resembles carved seed pods and thin copper inlay rather than stone
  slabs or familiar fantasy-game UI.
- Body text uses a highly legible humanist serif; controls and numbers use a
  compact sans serif.
- HUD anchors health and mana as two curved leaf veins at upper left, current
  spell as a circular seed sigil, and currency as small amber resin beads.
- Map is a hand-inked room graph with discovered silhouettes, not a copied
  minimap layout.
- Focus rings and interaction prompts use moon-mint plus a high-contrast cream
  edge.

## Effects and Animation

- Impacts: 45–80 ms hit-stop, narrow directional shake, cream core flash, amber
  leaf shards, and a tapered slash ribbon.
- Magic: flowing thread lines and slowly rotating botanical glyphs.
- Secrets: orchid motes converge on the discovery before a short bell flourish.
- Checkpoints: dormant seed-lantern opens in three layered petals and remains
  visibly lit.
- Frame animation targets 10–14 authored poses per second with interpolation or
  held key poses where appropriate.

## Asset Production Rules

- Generated concept art must use only this document as reference.
- Sprite sheets require transparent backgrounds, consistent ground line, fixed
  character scale, padding, and labelled animation metadata outside the image.
- Background paintings must reserve the gameplay plane and avoid false ledges.
- Texture atlases use power-of-two pages where practical.
- SVG gameplay assets are acceptable only when they are deliberately illustrated
  with authored contours, material shading, and animation variants; debug
  primitives are not shippable art.
- Audio is original synthesis/composition or properly licensed and is recorded
  in `docs/asset-provenance.md`.

## October 7 terrain and sound implementation

Solid faces use continuous area-coloured SVG materials at a fixed tile scale, with a narrow surface rim exactly on the collision plane. One-way platforms use thin ledges within their authored bounds. Coral briars and a restrained hazard haze fill the damaging region without extending it. The existing original scene backgrounds and actor artwork remain unchanged; decorative background shapes are not additional colliders.

Short original synthesized impact, descending-danger and rising-resonance motifs complement the ten-track soundtrack. SFX voices are bounded and cleaned up; music transitions retain a returning track, retry blocked playback after input and respect the existing volume/visibility settings. See [provenance](asset-provenance.md) for asset sources and [verification](polish-verification.md) for visual/audio coverage and limits.
