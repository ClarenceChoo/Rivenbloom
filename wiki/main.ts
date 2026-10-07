import './style.css';
import villageArt from './assets/wayfarer-village.png';
import { ARTICLES, DISCOVERIES, escapeHtml, type Article } from './content';
import { resolveRoute, searchGuide } from './navigation';

function element<T extends HTMLElement>(selector: string): T {
  const match = document.querySelector<T>(selector);
  if (!match) throw new Error(`Missing wiki element: ${selector}`);
  return match;
}

const main = element<HTMLElement>('#article');
const reading = element<HTMLElement>('#reading');
const navigation = element<HTMLElement>('#chapters');
const toggle = element<HTMLButtonElement>('.contents-toggle');
const dialog = element<HTMLDialogElement>('#search-dialog');
const input = element<HTMLInputElement>('#search-input');
const storageKey = 'rivenbloom-wiki-discoveries-v1';
const checked = new Set<string>();
let storageAvailable = true;

try {
  const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
  if (Array.isArray(saved)) {
    for (const id of saved) {
      if (typeof id === 'string' && DISCOVERIES.some((entry) => entry.id === id)) checked.add(id);
    }
  }
} catch {
  storageAvailable = false;
}

navigation.innerHTML = ARTICLES.filter((article) => !article.parent)
  .map(
    (article, index) =>
      `<a href="#${article.id}" data-chapter="${article.id}"><span class="chapter-number">${String(index + 1).padStart(2, '0')}</span><span>${escapeHtml(article.title)}</span><span class="active-leaf" aria-hidden="true">❧</span></a>`,
  )
  .join('');

function home(): string {
  return `<div class="welcome"><h1 tabindex="-1">Every great journey begins<br class="wide-break" /> with a little wonder.</h1><p class="welcome-intro">${ARTICLES[0].description}</p><div class="illustration-frame"><img class="hero-art" src="${villageArt}" alt="Pixel-art companion illustration: moss-roofed homes under an ancient tree, amber seed-lanterns, and a distant rootglass observatory." width="1536" height="512" fetchpriority="high" /></div><div class="welcome-actions"><a class="button" href="#getting-started">Begin your journey</a><a href="#walkthrough">Follow the main quest</a></div><section class="wayfinding"><div class="ornament" aria-hidden="true"><span>❧</span></div><h2>Find your way</h2><div class="wayfinding-columns"><div><h3>The world</h3><a href="#world">Explore the realms</a><a href="#world/people">Meet the people</a></div><div><h3>The wayfinder</h3><a href="#getting-started">Learn the basics</a><a href="#combat">Master your abilities</a></div><div><h3>The mysteries</h3><a href="#dungeon">Uncover hidden truths</a><a href="#secrets">Find side quests</a></div></div></section></div>`;
}

function articleHtml(article: Article): string {
  const parent = ARTICLES.find((entry) => entry.id === article.parent);
  return `${parent ? `<a class="back-link" href="#${parent.id}">← ${escapeHtml(parent.title)}</a>` : ''}<header class="article-heading"><h1 tabindex="-1">${escapeHtml(article.title)}</h1><p class="article-intro">${escapeHtml(article.description)}</p></header><nav class="on-this-page" aria-label="On this page"><span>In this chapter</span>${article.sections.map((section) => `<a href="#${article.id}/${section.id}">${escapeHtml(section.title)}</a>`).join('')}</nav><div class="article-body">${article.sections.map((section) => (section.spoiler ? `<section id="section-${section.id}"><details><summary><span>${escapeHtml(section.title)}</span><small>Reveal guide</small></summary><div class="solution-body">${section.html}</div></details></section>` : `<section id="section-${section.id}"><h2>${escapeHtml(section.title)}</h2>${section.html}</section>`)).join('')}</div><details class="source-notes"><summary>About these field notes</summary><p>Written against the repository’s current playable content on 7 October 2026. Values in the reference tables come from the game data at build time. Strategy notes describe those mechanics; they do not certify game balance. Repository links require access while the source is private.</p><ul>${article.sources.map((path) => `<li><a href="https://github.com/ClarenceChoo/Rivenbloom/blob/main/${path}" target="_blank" rel="noreferrer">${escapeHtml(path)}<span class="sr-only"> (opens in a new tab)</span></a></li>`).join('')}</ul></details><nav class="chapter-footer" aria-label="More chapters"><a href="#welcome">← Back to the contents</a><button type="button" class="print-page">Print this chapter</button></nav>`;
}

function updateChecklistStatus(): void {
  const status = document.querySelector('#checklist-status');
  if (status)
    status.textContent = `${checked.size} of ${DISCOVERIES.length} discoveries marked. ${storageAvailable ? 'Notes saved in this browser.' : 'Browser storage unavailable; notes last for this visit only.'}`;
}

function mountChecklist(): void {
  const list = document.querySelector('#discovery-checklist');
  if (!list) return;
  list.innerHTML = DISCOVERIES.map(
    (entry) =>
      `<label class="checklist-row"><input type="checkbox" value="${entry.id}" ${checked.has(entry.id) ? 'checked' : ''} /><span><strong>${escapeHtml(entry.label)}</strong><small>${escapeHtml(entry.location)}</small></span></label>`,
  ).join('');
  list.addEventListener('change', (event) => {
    if (!(event.target instanceof HTMLInputElement)) return;
    if (event.target.checked) checked.add(event.target.value);
    else checked.delete(event.target.value);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...checked]));
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }
    updateChecklistStatus();
  });
  updateChecklistStatus();
}

function closeContents(): void {
  toggle.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('is-open');
}

let currentArticleId: string | null = null;
function render(focus = true): void {
  if (location.hash === '#reading') {
    reading.focus();
    if (currentArticleId !== null) return;
  }
  const { article, sectionId, found } = resolveRoute(
    location.hash === '#reading' ? '#welcome' : location.hash,
  );
  if (currentArticleId !== article.id) {
    main.innerHTML = article.id === 'welcome' ? home() : articleHtml(article);
    currentArticleId = article.id;
    mountChecklist();
    document.querySelector('.print-page')?.addEventListener('click', () => window.print());
  }
  document.title = `${article.title} · Rivenbloom Wiki`;
  element('#page-number').textContent = String(ARTICLES.indexOf(article) + 1).padStart(2, '0');
  navigation.querySelectorAll<HTMLAnchorElement>('a').forEach((link) => {
    if (link.dataset.chapter === (article.parent ?? article.id))
      link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  closeContents();
  if (!found) history.replaceState(null, '', '#welcome');
  if (sectionId) {
    const section = document.getElementById(`section-${sectionId}`);
    // Following a contents or search link must not reveal an unopened solution.
    section?.scrollIntoView({ block: 'start' });
    const destination = section?.querySelector<HTMLElement>('summary, h2');
    if (focus && destination) {
      destination.setAttribute('tabindex', '-1');
      destination.focus({ preventScroll: true });
    }
  } else {
    reading.scrollTop = 0;
    window.scrollTo(0, 0);
    if (focus) main.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  }
}

function updateSearch(): void {
  const results = searchGuide(input.value);
  element('#search-count').textContent = input.value.trim()
    ? `${results.length} ${results.length === 1 ? 'result' : 'results'}`
    : 'Browse all chapters';
  element('#search-results').innerHTML = results.length
    ? results
        .map(
          (result) =>
            `<a class="search-result" href="${result.href}"><span class="entry-meta">${escapeHtml(result.chapter)}${result.spoiler ? ' · solution inside' : ''}</span><strong>${escapeHtml(result.title)}</strong><span>${result.spoiler ? 'Open this entry, then reveal the guide when you are ready.' : escapeHtml(result.excerpt.slice(0, 145)) + (result.excerpt.length > 145 ? '…' : '')}</span></a>`,
        )
        .join('')
    : '<div class="empty-search"><h3>No page found in these notes.</h3><p>Try a place, an item, or a shorter word, such as “lens” or “mana”.</p></div>';
}

function openSearch(): void {
  if (dialog.open) return;
  dialog.showModal();
  updateSearch();
  input.focus();
}

element('.search-trigger').addEventListener('click', openSearch);
element('.close-search').addEventListener('click', () => dialog.close());
input.addEventListener('input', updateSearch);
dialog.addEventListener('click', (event) => {
  if (event.target instanceof Element && event.target.closest('a')) {
    const link = event.target.closest('a');
    dialog.close();
    if (link?.hash === location.hash) render();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && dialog.open) {
    // Search inputs consume the first Escape to clear text in Chromium.
    event.preventDefault();
    dialog.close();
    return;
  }
  const typing =
    event.target instanceof HTMLElement &&
    (event.target.matches('input, textarea, select') || event.target.isContentEditable);
  if (
    (!typing && event.key === '/') ||
    ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')
  ) {
    event.preventDefault();
    openSearch();
  }
});
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('is-open', open);
});
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest<HTMLAnchorElement>('a[href^="#"]');
  if (link && link.hash === location.hash) {
    event.preventDefault();
    render();
  }
});
window.addEventListener('hashchange', () => render());
render(false);
