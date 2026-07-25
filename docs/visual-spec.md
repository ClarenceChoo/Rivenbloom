# Rivenbloom Visual Implementation Specification

## Source of Truth

| State | Reference | Native size | Purpose |
| --- | --- | --- | --- |
| Gameplay | `docs/concepts/rivenbloom-gameplay-concept.png` | 1672 × 941 | World composition, scale, HUD, combat |
| Title / slots | `docs/concepts/rivenbloom-title-concept.png` | 1672 × 941 | Menu hierarchy, panels, focus, typography |

Both references use an approximately 16:9 frame and must be compared against
the final 1280 × 720 render using contain scaling. They are concept references,
not assets to crop into production.

## Locked Visual Idea

Rivenbloom is a rainy hand-painted folktale assembled from layered vellum,
weathered silk, carved wood, translucent rootglass, and aged copper. Broad
paper-cut silhouettes carry gameplay readability; small botanical linework and
material texture reward inspection. Amber resonance is the consistent focal
accent against storm teal and plum shadow.

## Gameplay Composition

- Camera is exact side-on; no perspective tilt, isometric staging, or 3D floor.
- Mara occupies roughly 12–15% of frame height.
- Walkable slate shelves form a visually continuous light-value band across the
  lower-middle third.
- Far forest, reliquary dome, middle trees/architecture, gameplay plane, and
  foreground foliage are separate depth layers.
- False ledges are prohibited in background and foreground paintings.
- The central combat zone retains at least one character-width of negative
  space around each active actor.
- Interactive mechanisms use amber; hazards and anticipation use coral;
  optional secrets use orchid; player magic uses moon mint.
- Foreground framing can occlude empty margins but never Mara, enemies, landing
  zones, prompts, or incoming projectiles.

## HUD Contract

- Upper-left health and mana are two long asymmetric leaf-vein meters, stacked
  with generous separation. Health uses fern/sage and warm cream; mana uses
  storm teal/moon mint.
- A compact circular seed sigil identifies the selected spell.
- Currency is a restrained row of amber resin beads, not a large numeric panel.
- Ability shortcuts use a radial botanical arrangement only where a controller
  hint is useful; keyboard play may collapse this to the selected spell plus
  contextual input glyphs.
- Boss health is a wide carved-root line near the bottom with a name in real
  text and does not reuse the player meter geometry.
- HUD frames use aged copper with dark vellum interiors and no stone slabs,
  generic rectangles, or glassmorphism.

## Title and Save-Slot Contract

- Background is a full-bleed rainy twilight painting of Wren's Rest looking
  toward the Rootglass Reliquary dome. It receives no colour overlay; text
  readability comes from naturally quiet values and a narrow edge fade.
- The original split-seed mark and `RIVENBLOOM` wordmark sit in the left
  half. Menu items form one open vertical rail below.
- The selected menu row uses a moon-mint filled leaf shape with a cream/copper
  edge. Unselected rows remain unboxed real text on the open background.
- The save drawer occupies the right half only when Continue/New Game is
  active. It uses one carved seed-pod outer frame and three inset horizontal
  rows; it is not a grid of independent cards.
- Footer prompts sit on one thin copper baseline, centered within safe margins.
- At 1024-pixel width the drawer may narrow and text may reduce within the
  approved scale; below the minimum playable width the shell letterboxes rather
  than rearranging the title into a mobile product page.

## Visible Copy Lock

Allowed title-screen copy:

- `RIVENBLOOM`
- `CONTINUE`
- `NEW GAME`
- `SETTINGS`
- `CREDITS`
- `WREN'S REST`
- `EMPTY SLOT`
- `Select`
- `Back`

Slot metadata may additionally show a real playtime, last-played date, current
region, and completion sprout. No marketing tagline, eyebrow, badge, fake
metric, subtitle, or unrequested navigation belongs above the fold.

Gameplay UI may show real state-driven values, item/ability names, interaction
prompts, dialogue, boss name, quest updates, and accessibility notices. These
are code-native and are not baked into raster assets.

## Typography

- Display/title: high-contrast humanist fantasy serif with carved, slightly
  irregular terminals; uppercase tracking approximately `0.08em`.
- Headings/dialogue names: readable semibold serif, restrained contrast.
- Body/dialogue: humanist serif with open counters and comfortable x-height.
- Controls, metadata, currency, input glyph labels: compact sans serif with
  deliberate `13–16px` equivalent at 1280 × 720.
- Main menu labels: `24–30px` equivalent at 1280 × 720.
- Minimum normal gameplay text: `18px` equivalent before accessibility scaling.
- Text scale options multiply body/control sizes by `1`, `1.15`, and `1.3`.
- Browser-default control typography is prohibited.

## Design Tokens

```text
shadow-deep       #171325
shadow-cave       #27213A
forest-distant    #244C50
moss-body         #47705C
foliage-live      #79A06B
parchment-light   #F0E3C0
metal-copper      #B96F45
resonance-amber   #F5C96A
magic-mint        #9EE7D7
danger-coral      #EE765F
secret-orchid     #BC8AE8
```

Spacing at the logical resolution uses an 8-pixel base with primary increments
of 8, 12, 16, 24, 32, 48, and 64. Interactive targets are at least 44 × 44
logical pixels. Menu frame curves derive from pointed leaf ends rather than
generic rounded rectangles.

## Icon Inventory

| Meaning | Metaphor | Treatment |
| --- | --- | --- |
| Health | paired living leaves | filled botanical silhouette, cream vein |
| Mana | suspended water seed | filled drop/seed, moon-mint inner line |
| Lumen Bolt | opening lantern flower | amber painted glyph |
| Aegis Veil | overlapping rootglass leaves | moon-mint/copper glyph |
| Resonant Pulse | concentric split seed | amber rings with leaf interruption |
| Dash | bent wayfinder reed | cream directional silhouette |
| Currency | resin bead | small faceted amber droplet |
| Save completion | two-leaf sprout | simple sage fill |
| Map room | inked seed chamber | cream line with discovered fill |
| Secret | three converging motes | orchid triangular rhythm |
| Select | four-petal input flower | moon-mint outline |
| Back | nested seed ring | coral/copper outline |

All custom SVG icons require a clean `viewBox`, consistent optical stroke,
balanced negative space, and explicit selected/disabled states. Text glyphs and
emoji are not icon substitutes.

## Asset Treatment

- Background paintings use full-frame 16:9 or wider crops and are delivered in
  separable depth planes.
- Characters and interactables use transparent sprites with a consistent ground
  line and sufficient padding for trails/anticipation.
- Menu/background paintings contain no interactive text.
- Rootglass stays translucent but never lowers collision readability.
- Ambient rain, mist, leaves, dust, and motes are separate capped particle
  layers and honour reduced motion.
- Image-generated output must be inspected for accidental text, watermarks,
  false platforms, malformed silhouettes, palette drift, and resemblance to
  existing games before integration.

## Motion Cues

- Menu focus glides 120–160 ms with a leaf-tip extension; reduced motion uses an
  immediate state change.
- Player scarf trails one beat behind locomotion and visually channels magic.
- Slash trails are tapered amber leaf ribbons that complete inside the attack
  recovery.
- Interactable mechanisms breathe in value, not size.
- Title rain and lantern sway stop or reduce under reduced-motion settings.

## Fidelity Checklist

Final browser comparison must inspect at least:

1. side-on composition, character scale, and clear gameplay plane;
2. palette temperature and unchanged amber/mint/coral semantic accents;
3. four-plus depth planes and correct parallax direction;
4. Mara, Briar Scrapper, and Duskwing silhouette fidelity;
5. leaf-vein HUD geometry and code-native text;
6. title/menu/save-drawer hierarchy and container model;
7. display/control typography scale and focus state;
8. background blending without a colour wash;
9. icon metaphor, optical weight, and selected states;
10. 1280 × 720, 1024-pixel viewport, and high-DPI behaviour.
