import { LANGS } from '../i18n';
import { findInk, findTrim, MARKETPLACES } from '../kdp/specs';
import { totalPages } from '../interior/layout';
import { lintBook } from '../marketing/lint';
import type { Book } from '../model';
import type { KdpFillPayload } from './model';

/** Sépare « Prénom Nom » ; une marque d'un seul mot va dans le nom. */
export function splitAuthor(author: string): { first: string; last: string } {
  const parts = author.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: '', last: parts[0] ?? '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

/** Paquet transmis au favori sur le formulaire KDP ; « blocking » liste les erreurs qui empêchent de publier. */
export function buildFillPayload(book: Book, urls: { interior: string; cover: string }): KdpFillPayload {
  const m = book.metadata;
  const trim = findTrim(book.format.trimId);
  const market = MARKETPLACES.find((x) => x.id === m.marketplace) ?? MARKETPLACES[0];
  const { first, last } = splitAuthor(m.author);
  return {
    bookId: book.id,
    language: m.language,
    languageLabel: LANGS.find((l) => l.value === m.language)?.label ?? m.language,
    marketplace: market.label,
    title: m.title.trim(),
    subtitle: m.subtitle.trim(),
    authorFirst: first,
    authorLast: last,
    descriptionHtml: m.descriptionHtml,
    keywords: m.keywords.map((k) => k.trim()),
    categories: m.categories.filter((c) => c.trim()),
    lowContent: m.lowContent,
    price: m.price,
    currency: market.currency,
    print: { trim: `${trim.label} (${trim.cm})`, ink: book.format.ink, inkLabel: findInk(book.format.ink).label, bleed: book.format.bleed, finish: book.format.finish, pages: totalPages(book) },
    aiGenerated: { ...m.aiGenerated },
    files: urls,
    blocking: lintBook(book).filter((i) => i.level === 'error').map((i) => i.message),
  };
}
