import { marketFromHost, type MarketId } from './markets';
import type { ProductCapture, RawCapture, SerpCapture, SerpItem } from './model';

// Analyse du texte capturé dans les pages Amazon (FR, EN, DE, ES, IT). Tout se fait sur le texte visible,
// pour résister aux changements de balisage : seul ce fichier est à corriger si Amazon modifie ses pages.
const SPACES = /[\s\u00a0\u202f\u2009]/g;

/** Entier écrit avec séparateurs de milliers (« 12 345 », « 12.345 », « 12,345 »), ou compact (« 1,2 k »). */
export function parseCount(s: string | null | undefined): number | null {
  if (!s) return null;
  const compact = s.match(/(\d+(?:[.,]\d+)?)\s*([kKM])\b/);
  if (compact) return Math.round(parseFloat(compact[1].replace(',', '.')) * (compact[2] === 'M' ? 1e6 : 1e3));
  const m = s.match(/\d[\d.,\u00a0\u202f\u2009 ]*/);
  if (!m) return null;
  const digits = m[0].replace(SPACES, '').replace(/[.,]/g, '');
  return digits ? Number(digits) : null;
}

/** Prix « 7,99 € », « $7.99 », « EUR 12,50 », « 1.299,00 € » → nombre. */
export function parsePrice(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/(?:[€$]|EUR|USD)[ \u00a0\u202f]*(\d[\d.,\u00a0\u202f ]*\d|\d)|(\d[\d.,\u00a0\u202f ]*\d|\d)[ \u00a0\u202f]*(?:€|EUR|\$)/);
  if (!m) return null;
  let raw = (m[1] ?? m[2]).replace(SPACES, '');
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  if (lastComma > lastDot) raw = raw.replace(/\./g, '').replace(',', '.');
  else raw = raw.replace(/,/g, '');
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : null;
}

/** Note « 4,6 sur 5 étoiles », « 4.6 out of 5 stars », « 4,6 von 5 Sternen », « 4,6 de 5 estrellas », « 4,6 su 5 stelle ». */
export function parseRating(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/(\d(?:[.,]\d)?)\s*(?:sur|out of|von|de|su)\s*5/i);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

const REVIEWS_RE = /(\d[\d.,\s\u00a0\u202f]*(?:\s*[kK])?)\s*(?:évaluations?|commentaires?|ratings?|reviews?|Sternebewertungen|Bewertungen|Rezensionen|valoraciones?|calificaciones?|voti|valutazioni|recensioni)/i;

export function parseReviews(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(REVIEWS_RE);
  return m ? parseCount(m[1]) : null;
}

const FORMATS = ['Broché', 'Relié', 'Paperback', 'Hardcover', 'Spiral-bound', 'Taschenbuch', 'Gebundene Ausgabe', 'Tapa blanda', 'Tapa dura', 'Copertina flessibile', 'Copertina rigida', 'Kindle'];
const SPONSORED_RE = /(?:^|[^\p{L}])(Sponsorisé|Sponsored|Gesponsert|Patrocinado|Sponsorizzato)(?!\p{L})/iu;

export function parseSerpCard(card: NonNullable<RawCapture['cards']>[number], position: number): SerpItem {
  const all = `${card.labels.join('\n')}\n${card.text}`;
  const format = FORMATS.find((f) => card.text.includes(f)) ?? null;
  // Prix du format imprimé si plusieurs formats sont listés
  let priceText = card.text;
  const printed = card.text.search(/Broché|Paperback|Taschenbuch|Tapa blanda|Copertina flessibile/);
  if (printed >= 0) priceText = card.text.slice(printed);
  return {
    asin: card.asin,
    position,
    title: card.title.trim(),
    price: parsePrice(priceText) ?? parsePrice(card.text),
    rating: parseRating(all),
    reviews: parseReviews(all) ?? parseCount(card.labels.find((l) => /^\s*[\d.,\s\u00a0\u202f]+[kK]?\s*$/.test(l)) ?? null),
    sponsored: card.sponsored || SPONSORED_RE.test(card.text.slice(0, 120)),
    format,
    image: card.img || null,
  };
}

/** « 1-48 sur plus de 5 000 résultats pour… », « 1-48 of over 10,000 results for… », « 1-48 von mehr als 3.000 Ergebnissen »… */
export function parseTotalResults(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/(?:sur|of|von|de|di|dei)\s+(?:plus de|over|mehr als|más de|oltre|più di)?\s*(\d[\d.,\s\u00a0\u202f]*)\s*(?:résultats|results|Ergebnis|resultados|risultati)/i)
    ?? s.match(/(\d[\d.,\s\u00a0\u202f]*)\s*(?:résultats|results|Ergebnis|resultados|risultati)/i);
  return m ? parseCount(m[1]) : null;
}

const BSR_LABEL = /(Classement des meilleures ventes d'Amazon|Best Sellers Rank|Amazon Bestseller-Rang|Clasificación en los más vendidos de Amazon|Posizione nella classifica Bestseller di Amazon)\s*:?/i;
const RANK_RE = /(?:n°|nº|n\.|Nr\.|#)?\s*(\d[\d.,\s\u00a0\u202f]*)\s+(?:en|in|dans)\s+([^(\n]+)/gi;

export function parseBsr(details: string): { bsr: number | null; bsrCategory: string | null; subRanks: { rank: number; category: string }[] } {
  const start = details.search(BSR_LABEL);
  if (start < 0) return { bsr: null, bsrCategory: null, subRanks: [] };
  // Les mentions « (Voir les 100 premiers en Livres) » ne sont pas des classements
  const block = details.slice(start).replace(BSR_LABEL, '').split(/\n\s*\n/)[0].slice(0, 600).replace(/\([^)]*\)/g, ' ');
  const ranks: { rank: number; category: string }[] = [];
  for (const m of block.matchAll(RANK_RE)) {
    const rank = parseCount(m[1]);
    const category = m[2].replace(/[:\s]+$/, '').trim();
    if (rank && category && !/^(Voir|See|Siehe|Ver|Visualizza)\b/i.test(category)) ranks.push({ rank, category });
  }
  const [first, ...rest] = ranks;
  return { bsr: first?.rank ?? null, bsrCategory: first?.category ?? null, subRanks: rest.slice(0, 5) };
}

const field = (details: string, labels: string): string | null => {
  // Amazon insère des marques de direction invisibles (U+200E, U+200F) autour des deux-points
  const m = details.match(new RegExp(`(?:${labels})[\\s:\\u200e\\u200f]*([^\\n]+)`, 'i'));
  return m ? m[1].replace(/[\u200e\u200f]/g, '').trim() : null;
};

export function parseProduct(raw: RawCapture): ProductCapture {
  const details = raw.details ?? '';
  const { bsr, bsrCategory, subRanks } = parseBsr(details);
  const pagesM = details.match(/(\d{2,4})\s*(?:pages|Seiten|páginas|pagine)\b/i);
  const publisher = field(details, 'Éditeur|Editeur|Publisher|Herausgeber|Verlag|Editorial|Editore');
  const dateM = publisher?.match(/\(([^)]+)\)/);
  return {
    asin: raw.asin ?? '',
    capturedAt: raw.capturedAt,
    title: (raw.title ?? '').trim(),
    bsr,
    bsrCategory,
    subRanks,
    price: parsePrice(raw.price),
    rating: parseRating(raw.rating),
    reviews: parseReviews(raw.reviews) ?? parseCount(raw.reviews),
    pages: pagesM ? Number(pagesM[1]) : null,
    publisher: publisher ? publisher.replace(/\s*\([^)]*\)\s*$/, '').replace(/;.*$/, '').trim() : null,
    publicationDate: field(details, 'Date de publication|Publication date|Erscheinungstermin|Fecha de publicación|Data di pubblicazione') ?? dateM?.[1] ?? null,
    dimensions: field(details, 'Dimensions|Product dimensions|Abmessungen|Dimensiones|Dimensioni'),
  };
}

export interface ParsedCapture {
  marketplace: MarketId;
  kind: 'serp' | 'product';
  keyword: string | null;
  serp: SerpCapture | null;
  product: ProductCapture | null;
}

export function parseCapture(raw: RawCapture): ParsedCapture {
  const market = marketFromHost(raw.host);
  if (!market) throw new Error(`Site non pris en charge : ${raw.host}`);
  if (raw.kind === 'serp') {
    const url = new URL(raw.url);
    const keyword = url.searchParams.get('k') ?? url.searchParams.get('field-keywords');
    const items = (raw.cards ?? []).filter((c) => /^[A-Z0-9]{10}$/.test(c.asin)).map((c, i) => parseSerpCard(c, i + 1));
    return { marketplace: market.id, kind: 'serp', keyword, serp: { capturedAt: raw.capturedAt, url: raw.url, totalResults: parseTotalResults(raw.resultInfo), items }, product: null };
  }
  return { marketplace: market.id, kind: 'product', keyword: null, serp: null, product: parseProduct(raw) };
}
