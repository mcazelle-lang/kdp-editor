import { createBook } from '../book';
import type { Lang } from '../i18n';
import { matchPreset } from '../interior/presets';
import { MARKETPLACES } from '../kdp/specs';
import type { Book, BookStatus } from '../model';
import type { KdpTitle } from './model';
import { amazonUrl } from './royalty-report';
import { themeOf } from './themes';

// Mots courants des titres, par langue (texte sans accents)
const LANG_WORDS: [Lang, RegExp][] = [
  ['fr', /\b(le|la|les|des|du|pour|mon|ma|mes|et|au|carnet|cahier|livre|registre|generations|remplir|suivi|recettes|ancetres)\b/g],
  ['en', /\b(the|my|for|and|to|of|your|with|our|journal|notebook|book|generation|tree|things|family)\b/g],
  ['de', /\b(der|die|das|und|zum|fur|mein|meine|generationen|ausfullen|familie|geht|eigenen)\b/g],
  ['es', /\b(mi|mis|para|el|los|las|generaciones|rellenar|familiar|busca|encuentro|arbol)\b/g],
  ['it', /\b(il|mio|miei|per|della|generazioni|compilare|famiglia|trovo|albero|propria)\b/g],
];

const marketLang = (marketplace?: string | null): Lang => {
  const d = (marketplace ?? '').toLowerCase();
  if (/\.(fr|com\.be)$/.test(d)) return 'fr';
  if (d.endsWith('.de')) return 'de';
  if (d.endsWith('.es')) return 'es';
  if (d.endsWith('.it')) return 'it';
  return 'en';
};

/** Langue d'un titre publié : mots du titre, sinon langue de la place de marché principale. */
export function guessTitleLang(title: string, marketplace?: string | null): Lang {
  const t = title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const scores = LANG_WORDS.map(([lang, re]) => [lang, (t.match(re) ?? []).length] as const).sort((a, b) => b[1] - a[1]);
  return scores[0][1] > 0 && scores[0][1] > scores[1][1] ? scores[0][0] : marketLang(marketplace);
}

/**
 * Fiche de l'app pour un titre déjà publié sur KDP. L'intérieur et la couverture publiés ne sont pas récupérables :
 * ils sont recréés à partir du préréglage le plus proche, à titre indicatif.
 */
export function bookFromKdpTitle(t: KdpTitle, status?: BookStatus): Book {
  const [main, ...rest] = t.title.split(':');
  const lang = guessTitleLang(t.title, t.marketplace);
  const book = createBook({ lang, presetId: matchPreset(t.title)?.id, title: main.trim() });
  const m = book.metadata;
  m.subtitle = rest.join(':').trim();
  m.author = t.author ?? '';
  const market = MARKETPLACES.find((x) => x.id === t.marketplace);
  if (market) m.marketplace = market.id;
  const currency = MARKETPLACES.find((x) => x.id === m.marketplace)?.currency;
  const priced = !!t.price && t.currency === currency;
  if (priced) m.price = t.price!;
  m.niche = themeOf(t.title)?.label ?? '';
  const ids = [t.asin && `ASIN ${t.asin}`, t.isbn && `ISBN ${t.isbn}`].filter(Boolean).join(', ');
  m.notes = `Importé de KDP (${ids || 'sans identifiant'}). Intérieur et couverture recréés par préréglage : ce ne sont pas les fichiers publiés.`
    + (priced || !t.price ? '' : ` Prix KDP : ${t.price} ${t.currency} sur ${t.marketplace} (place de marché non gérée par l'app).`);
  if (t.format === 'hardcover') book.format.binding = 'hardcover';
  book.status = status ?? (t.status === 'live' ? 'publie' : t.status === 'draft' ? 'en-cours' : 'pret');
  book.kdp = {
    titleId: t.id,
    asin: t.asin,
    status: t.status,
    linkedAt: new Date().toISOString(),
    url: amazonUrl(t.asin, t.marketplace ?? (t.currency === 'USD' ? 'amazon.com' : 'amazon.fr')),
  };
  return book;
}
