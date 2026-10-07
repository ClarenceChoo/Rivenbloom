# The Wayfinder’s Companion

A standalone, static Rivenbloom wiki: eleven chapters, full-text search, shareable
chapter/section links, optional puzzle and boss solutions, a local discovery
checklist, and responsive storybook styling. The game itself is not deployed by
this site.

## Run and verify

Use the repository’s existing dependencies; the wiki adds no packages. Run these
from the repository root after the usual `npm install` (or `npm ci` in CI):

```bash
npm --prefix wiki run dev
npm --prefix wiki run test
npm --prefix wiki run build
npm --prefix wiki run test:e2e
npm --prefix wiki run preview
```

Development uses `http://127.0.0.1:4190`. The production preview and browser tests
use port 4191. Browser tests require the existing Playwright Chromium installation.
Build output is `wiki/dist/`, independent of the game’s `dist/` directory.

The wiki requires JavaScript. Search never sends queries to a server. Checklist
notes use `rivenbloom-wiki-discoveries-v1` in local storage and degrade to
session-only notes if storage is blocked. They do not access game saves. Print
includes the current chapter and any solutions the reader has expanded.

## Publish on GitHub Pages

The repository is public. GitHub Pages is configured to publish this wiki using
GitHub Actions at `https://clarencechoo.github.io/Rivenbloom/`.

1. Commit and push the wiki, its workflow, and these documentation changes when
   ready to publish.
2. In repository **Settings → Pages → Build and deployment**, choose
   **GitHub Actions** as the source.
3. In **Actions → Publish Rivenbloom wiki**, choose **Run workflow** on `main`.
   The workflow installs the repository dependencies, checks the wiki, builds it,
   runs Chromium browser tests, and deploys only `wiki/dist/`.
4. Open the URL reported by the deployment and check search, images, a refreshed
   chapter link, and phone layout. The public address is
   `https://clarencechoo.github.io/Rivenbloom/`.

Publishing is manual. Repeat the workflow after content updates. It does not
publish on a push. Relative asset URLs and hash routes support the project
subdirectory without server rewrites. Only one Pages site can occupy this
repository’s Pages address; this workflow is for the wiki, not the game.

Official references: [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
and [Pages availability and project addresses](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Edit the guide

`content.ts` contains editorial chapters and links to source material. Ability
costs, cooldowns, item descriptions, shop prices, base enemy stats, room lists,
and checkpoint lists import the game’s typed content during the wiki build.
Walkthrough prose and tactical explanations need review when mechanics change.
Search indexes the same chapters; solutions stay concealed in search excerpts.

`tokens.css` defines the palette and pixel-cut controls. `style.css` owns the book
layout, single-page mobile layout, and print view. Generated book and village
art live in `assets/`; source prompts and provenance are recorded in
[`docs/asset-provenance.md`](../docs/asset-provenance.md). All headings, navigation,
body copy, controls, and search results are selectable HTML text.
