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
