import type { Lang } from './i18n';
import { applyStyle } from './cover/styles';
import { findTrim } from './kdp/specs';
import { findPreset, instantiateSections, matchPreset, normalize, PRESETS } from './interior/presets';
import { cleanKeywordLine } from './marketing/keywords';
import { defaultCover, defaultInterior, defaultMetadata, uid, type Book, type BookFormat, type Idea } from './model';

const DEFAULT_FORMAT: BookFormat = { binding: 'paperback', trimId: '6x9', ink: 'bw-white', bleed: false, finish: 'matte', spineOverride: null, coverSizeOverride: null };

export function createBook(opts: { lang?: Lang; presetId?: string; title?: string; styleId?: string } = {}): Book {
  const lang = opts.lang ?? 'fr';
  const preset = findPreset(opts.presetId ?? 'notebook-lined') ?? PRESETS[0];
  const now = new Date().toISOString();
  const book: Book = {
    id: uid('b'),
    createdAt: now,
    updatedAt: now,
    status: 'en-cours',
    ideaId: null,
    presetId: preset.id,
    metadata: { ...defaultMetadata(lang), title: opts.title ?? '' },
    format: { ...DEFAULT_FORMAT, ...preset.format },
    interior: { ...defaultInterior(), sections: instantiateSections(preset, lang) },
    cover: defaultCover(),
  };
  // Grand format : viser le seuil des 60 % de redevance
  book.metadata.price = findTrim(book.format.trimId).large ? 9.99 : 7.99;
  book.cover = applyStyle(book.cover, opts.styleId ?? suggestStyle(preset.id));
  return book;
}

function suggestStyle(presetId: string): string {
  if (['inventory', 'cash-book', 'income-expense', 'staff-register', 'gun-inventory'].includes(presetId)) return 'leather';
  if (['drug-register', 'cse-register'].includes(presetId)) return 'register';
  if (['comic-blank', 'primary-composition'].includes(presetId)) return 'kids';
  if (['baby-log', 'bucket-list', 'nanny-liaison', 'love-coupons', 'baby-firsts'].includes(presetId)) return 'pastel';
  if (['herbarium', 'recipe-book', 'diy-recipes'].includes(presetId)) return 'floral';
  if (['sketchbook', 'code-notebook', 'guitar-tab'].includes(presetId)) return 'minimal';
  if (['password-book', 'checklists-survival'].includes(presetId)) return 'maze';
  return 'classic-label';
}

export function guessLang(idea: Idea): Lang {
  const l = normalize(idea.language || '');
  if (['fr', 'en', 'de', 'es', 'it'].includes(l)) return l as Lang;
  const text = ` ${normalize([idea.niche, ...idea.titles, idea.subtitle].join(' '))} `;
  const frHits = (text.match(/ (de|du|des|le|la|les|mon|ma|mes|pour|et|carnet|cahier|livre|registre) /g) ?? []).length;
  const enHits = (text.match(/ (the|my|of|for|and|your|book|journal|log|notebook|our) /g) ?? []).length;
  return frHits >= enHits ? 'fr' : 'en';
}

export function bookFromIdea(idea: Idea, opts: { titleIndex?: number; presetId?: string } = {}): Book {
  const lang = guessLang(idea);
  const preset = (opts.presetId && findPreset(opts.presetId)) || matchPreset(idea.niche, ...idea.titles, idea.subtitle, idea.category) || PRESETS[0];
  const book = createBook({ lang, presetId: preset.id });
  const m = book.metadata;
  const title = idea.titles[opts.titleIndex ?? 0] ?? idea.titles[0] ?? idea.niche;
  m.title = (title || '').trim();
  m.niche = [idea.category, idea.niche].filter(Boolean).join(' › ');
  m.subtitle = idea.subtitle.trim();
  const cats = idea.categories.filter((c) => c.includes('>'));
  if (!m.subtitle) {
    const fallback = idea.categories.find((c) => !c.includes('>') && c.length > 25 && !/^a+$/.test(c));
    if (fallback) m.subtitle = fallback.trim();
  }
  m.categories = [...cats.slice(0, 3), '', '', ''].slice(0, 3);
  m.keywords = [...idea.keywords.map(cleanKeywordLine), '', '', '', '', '', '', ''].slice(0, 7);
  m.descriptionHtml = idea.description.trim();
  if (idea.author) m.author = idea.author;
  m.notes = [...idea.notes, ...idea.links].join('\n\n');
  book.ideaId = idea.id;
  book.status = 'en-cours';
  return book;
}
