# Rivenbloom Asset Provenance

Every image, animation, font, audio file, texture, icon, and source pack used by
the game must appear here before release. Originality review is required even
for generated work.

## Concept References

| Asset | Date | Source / tool | Rights and use | Prompt summary / modifications |
| --- | --- | --- | --- | --- |
| `docs/concepts/rivenbloom-gameplay-concept.png` | 2026-07-25 | OpenAI built-in image generation | Original project concept; design-reference use only | Full 16:9 Brackenreach combat screen using the project art bible, Mara, Briar Scrapper, Duskwing, Listening Arch, four-plus depth planes, and botanical HUD. No input image or copyrighted game reference was used. Copied unchanged from generated output. |
| `docs/concepts/rivenbloom-title-concept.png` | 2026-07-25 | OpenAI built-in image generation | Original project concept; design-reference use only | Full 16:9 Wren's Rest title/save-slot state using the same palette and materials, exact Rivenbloom/menu copy, split-seed mark, open menu rail, and three-row save drawer. No input image or copyrighted game reference was used. Copied unchanged from generated output. |

## Production Assets

| Asset | Date | Source / tool | Rights and use | Prompt summary / modifications |
| --- | --- | --- | --- | --- |
| `public/assets/atlases/source/mara-sheet.png` | 2026-07-25 | OpenAI built-in image generation + local chroma removal | Original project production source | Image 1 was the approved gameplay concept as an identity/style reference. Generated 16 side-view Mara key poses on uniform magenta, then removed the sampled `#fb02f9` border with the installed soft-matte/despill helper. Alpha and silhouette were visually inspected. |
| `public/assets/atlases/source/briar-scrapper-sheet.png` | 2026-07-25 | OpenAI built-in image generation + local chroma removal | Original project production source | Image 1 was the approved gameplay concept as an enemy/style reference. Generated 12 dormant/walk/telegraph/attack/hurt/death poses on uniform magenta; removed sampled `#fa03f9` with soft matte/despill. Alpha, mask continuity, and twig silhouettes were visually inspected. |
| `public/assets/atlases/source/duskwing-sheet.png` | 2026-07-25 | OpenAI built-in image generation + local chroma removal | Original project production source | Image 1 was the approved gameplay concept as a style/identity reference. Generated 12 hover/dive/projectile/hurt/death poses with fixed face plate and seed hooks; removed sampled `#fa03f9` with soft matte/despill. Alpha and wing edges were visually inspected. |
| `public/assets/atlases/source/spore-scribe-sheet.png` | 2026-07-25 | OpenAI built-in image generation + local chroma removal | Original project production source | Image 1 was the approved gameplay concept as a style reference. Generated 12 fungal idle/walk/cast/retreat/hurt/death poses on uniform magenta; removed sampled `#fa03f8` with soft matte/despill. Alpha, cap layering, and reed continuity were visually inspected. |
| `public/assets/atlases/source/barkbound-sheet.png` | 2026-07-25 | OpenAI built-in image generation + local chroma removal | Original project production source | Image 1 was the approved gameplay concept as a style reference. Generated 12 shield/walk/telegraph/slam/stagger/death poses with fixed bark-door shield and rootglass core; removed sampled `#f603f7` with soft matte/despill. Alpha and shield/core readability were visually inspected. |
| `public/assets/atlases/source/rootlurker-sheet.png` | 2026-07-25 | OpenAI built-in image generation + local chroma removal | Original project production source | Image 1 was the approved gameplay concept as a style reference. Generated 12 concealed/emerge/bite/sweep/hurt/death poses for the root-burrowing ambusher on uniform magenta, then applied soft matte/despill. Alpha, ground line, mouth, and root silhouettes were visually inspected. |
| `public/assets/atlases/source/thorn-sentinel-sheet.png` | 2026-07-25 | OpenAI built-in image generation + local chroma removal | Original project production source | Image 1 was the approved gameplay concept as a style reference. Generated 12 idle/guard/thrust/sweep/stagger/shatter poses for the rootglass elite on uniform magenta, then applied soft matte/despill. Alpha, weapon clearance, core readability, and silhouette progression were visually inspected. |
| `public/assets/atlases/source/pallid-cantor-sheet.png` | 2026-07-25 | OpenAI built-in image generation + local chroma removal | Original project production source | Image 1 was the approved gameplay concept as a style reference. Generated 16 cocoon/flight/telegraph/attack/cracked/lens/defeat boss poses on uniform magenta, then applied soft matte/despill. Alpha, porcelain mask continuity, wing states, and phase readability were visually inspected. |
| `public/assets/atlases/source/brackenreach-terrain.png` | 2026-07-25 | OpenAI built-in image generation + local chroma removal | Original project production source | Image 1 was the approved gameplay concept as a material/style reference. Generated 12 separated side-view moss, stone, woven-root, settlement-brass, rootglass, and checkpoint platform pieces; removed sampled `#f903f9` with soft matte/despill. Alpha and walkable-edge readability were visually inspected. |
| `public/assets/backgrounds/brackenreach-far.png` | 2026-07-25 | OpenAI built-in image generation + image edit | Original project production asset | Generated a dedicated distant Brackenreach forest/reliquary-dome painting from the approved visual system. A second image-edit pass precisely removed baked-in rain so motion can be rendered separately and disabled by accessibility settings. Gameplay-plane contrast and absence of rain threads were visually inspected. |
| `public/assets/backgrounds/brackenreach-mid.png` | 2026-07-25 | OpenAI built-in image generation + local chroma removal | Original project production asset | Generated a separated mid-depth layer of carved listening trees, survey apparatus, and ruined botanical architecture on uniform magenta, then applied soft matte/despill. Alpha, landmark separation, and open gameplay-space framing were visually inspected. |
| `public/assets/backgrounds/brackenreach-foreground.png` | 2026-07-25 | OpenAI built-in image generation + local chroma removal | Original project production asset | Generated a separated close-depth foliage and mossy-ledge frame on uniform magenta; removed sampled `#fa03f7` with soft matte/despill. Alpha, edge quality, and clear center gameplay sightline were visually inspected. |
| `public/assets/portraits/dialogue-portraits.png` | 2026-07-25 | OpenAI built-in image generation + local chroma removal | Original project production source | Images 1–2 were the approved gameplay concept and Mara source sheet as identity/style references. Generated eight original dialogue busts for Mara, Sela Quill, Orin Fen, and Piri Moss on uniform magenta; removed sampled `#fa02fa` with soft matte/despill. Identity continuity, expression, diversity, and alpha edges were visually inspected. |
| `public/assets/ui/ui-icons.png` | 2026-07-25 | OpenAI built-in image generation + local chroma removal | Original project production source | Image 1 was the approved gameplay concept as a material/style reference. Generated 20 original botanical-brass HUD, inventory, navigation, accessibility, input, and save icons on uniform magenta; removed sampled `#f303f5` with soft matte/despill. Grid separation, icon semantics, small-scale contrast, and alpha were visually inspected. |
| `public/assets/ui/title-wrens-rest-background.png` | 2026-07-25 | OpenAI built-in image generation | Original project production asset | Image 1 was the approved original title concept used only as a palette, material, mood, and world-identity reference. Generated a new full-bleed 16:9 Wren's Rest twilight vista with quiet menu-safe values, original timber/moss/copper architecture, amber seed-lanterns, and the distant Rootglass Reliquary. No concept pixels were cropped or reused. Copied unchanged from the generated output after inspection for accidental text, watermarking, baked UI, visible rain streaks, false ledges, and palette drift; none were found. |

## Code-Authored Runtime Visuals

| Asset | Date | Source / tool | Rights and use | Prompt summary / modifications |
| --- | --- | --- | --- | --- |
| Slash ribbon (`drawSlashRibbon`, `src/game/combat/CombatSceneAdapter.ts`) | 2026-07-26 | Hand-authored Phaser Graphics vector shape in repository code | Original project production visual | Amber crescent ribbon with cream edge line drawn from fixed polygon points for melee swings; scaled per combo stage and mirrored per facing. No external imagery or generation tool involved. |
| Impact leaf burst (`impactLeafShapes`, `src/game/effects/ParticleProfiles.ts`) | 2026-07-26 | Hand-authored deterministic triangle set in repository code | Original project production visual | Up to six cream/amber/coral leaf triangles rendered by `CombatSceneAdapter`; density follows the accessibility-scaled `particleCount` from `combatFeedbackFor`. No external imagery or generation tool involved. |
| Lumen Bolt projectile leaf (`drawLumenLeaf`, `src/game/combat/CombatSceneAdapter.ts`) | 2026-07-26 | Hand-authored Phaser Graphics vector shape in repository code | Original project production visual | Mint leaf-shaped polygon with cream midrib line used for the Lumen Bolt projectile. No external imagery or generation tool involved. |
| Botanical ability glyph (`drawBotanicalGlyph`, `src/game/combat/CombatSceneAdapter.ts`) | 2026-07-26 | Hand-authored Phaser Graphics vector shape in repository code | Original project production visual | Five-leaf radial glyph in translucent mint with cream outlines used for Aegis Veil and Resonant Pulse; rotation disabled under reduced motion. No external imagery or generation tool involved. |

Production entries record:

- repository path and stable asset key;
- creator or generation tool;
- prompt summary and reference-image roles;
- licence and source URL for third-party material;
- edits, atlas conversion, loop points, or other transformations;
- originality and quality review result.

No concept reference may be cropped into a production background, UI panel,
sprite, icon, or logo. Matching production assets require a dedicated,
separable asset pass.
