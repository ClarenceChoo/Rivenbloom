import { describe, expect, it } from 'vitest';
import { ARTICLES, DISCOVERIES } from '../content';
import { plainText, resolveRoute, searchGuide } from '../navigation';

describe('wiki navigation and search', () => {
  it('resolves shareable chapter and section links without server routes', () => {
    const route = resolveRoute('#dungeon/choir-seal');
    expect(route.article.id).toBe('dungeon');
    expect(route.sectionId).toBe('choir-seal');
    expect(route.found).toBe(true);
  });

  it('handles unknown routes and malformed escapes safely', () => {
    expect(resolveRoute('#missing').article.id).toBe('welcome');
    expect(resolveRoute('#%E0%A4%A').article.id).toBe('welcome');
    expect(resolveRoute('#world/missing').sectionId).toBeNull();
  });

  it('matches terms throughout articles and ranks matching headings first', () => {
    expect(searchGuide('Index Seal')[0].href).toBe('#dungeon/index-seal');
    expect(searchGuide('50 resin').some((result) => result.href === '#walkthrough/reforge')).toBe(
      true,
    );
    expect(searchGuide("wren's rest").length).toBeGreaterThan(0);
    expect(searchGuide('xyzzy-missing')).toEqual([]);
  });

  it('marks solution search hits so the UI can suppress spoiler excerpts', () => {
    expect(
      searchGuide('Root Rain Bloom').some(
        (result) => result.href === '#dungeon/threefold-lens' && result.spoiler,
      ),
    ).toBe(true);
  });

  it('has unique IDs and no broken authored chapter or section links', () => {
    expect(new Set(ARTICLES.map((article) => article.id)).size).toBe(ARTICLES.length);
    expect(new Set(DISCOVERIES.map((entry) => entry.id)).size).toBe(DISCOVERIES.length);
    for (const article of ARTICLES) {
      expect(new Set(article.sections.map((section) => section.id)).size).toBe(
        article.sections.length,
      );
      for (const section of article.sections) {
        for (const [, href] of section.html.matchAll(/href="(#[^"]+)"/g)) {
          const route = resolveRoute(href);
          expect(route.found, href).toBe(true);
          if (href.includes('/')) expect(route.sectionId, href).not.toBeNull();
        }
      }
    }
  });

  it('turns markup into readable search text', () => {
    expect(plainText('<p>Root &amp; <strong>rain</strong>.</p>')).toBe('Root & rain .');
    expect(searchGuide(' ').length).toBe(ARTICLES.length);
  });
});
