import { ARTICLES, type Article } from './content';

export type Route = Readonly<{ article: Article; sectionId: string | null; found: boolean }>;

export function resolveRoute(hash: string): Route {
  let route: string;
  try {
    route = decodeURIComponent(hash.replace(/^#/, ''));
  } catch {
    route = '';
  }
  const [articleId = 'welcome', sectionId] = route.split('/');
  const article = ARTICLES.find((entry) => entry.id === (articleId || 'welcome'));
  return {
    article: article ?? ARTICLES[0],
    sectionId: article?.sections.some((section) => section.id === sectionId)
      ? (sectionId ?? null)
      : null,
    found: article !== undefined,
  };
}

export function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export type SearchResult = Readonly<{
  title: string;
  chapter: string;
  href: string;
  excerpt: string;
  spoiler: boolean;
}>;

const entries = ARTICLES.flatMap((article) => [
  {
    title: article.title,
    chapter: 'Chapter',
    href: `#${article.id}`,
    excerpt: article.description,
    spoiler: false,
  },
  ...article.sections.map((section) => ({
    title: section.title,
    chapter: article.title,
    href: `#${article.id}/${section.id}`,
    excerpt: plainText(section.html),
    spoiler: section.spoiler ?? false,
  })),
]);

export function searchGuide(query: string): readonly SearchResult[] {
  const terms = normalize(query).split(' ').filter(Boolean);
  if (terms.length === 0) return entries.filter((entry) => entry.chapter === 'Chapter');
  return entries
    .map((entry, index) => ({
      entry,
      index,
      haystack: normalize(`${entry.title} ${entry.chapter} ${entry.excerpt}`),
      title: normalize(entry.title),
    }))
    .filter(({ haystack }) => terms.every((term) => haystack.includes(term)))
    .sort(
      (a, b) =>
        terms.filter((term) => b.title.includes(term)).length -
          terms.filter((term) => a.title.includes(term)).length || a.index - b.index,
    )
    .slice(0, 15)
    .map(({ entry }) => entry);
}
