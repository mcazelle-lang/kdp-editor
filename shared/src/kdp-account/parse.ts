import { parseCount, parsePrice } from '../niches/parse';
import type { KdpFormat, KdpRawCapture, KdpSalesRow, KdpSalesSnapshot, KdpTitle, KdpTitleStatus } from './model';

// Analyse du texte visible des pages KDP (Bibliothèque, Rapports). La structure HTML de KDP n'est pas documentée :
// on raisonne sur le texte autour de chaque ASIN/ISBN. En cas d'échec, le texte brut est conservé (KdpCaptureLog).

export const ID_RE = /\b(B0[A-Z0-9]{8}|97[89][\d-]{10,14}|\d{9}[\dX])\b/g;

export function kdpPage(url: string): 'bookshelf' | 'reports' | 'autre' {
  const p = new URL(url).pathname.toLowerCase();
  if (p.includes('bookshelf')) return 'bookshelf';
  if (p.includes('report') || p.includes('dashboard')) return 'reports';
  return 'autre';
}

/** Mot entier, y compris quand il commence ou finit par une lettre accentuée (\b est limité à l'ASCII). */
const W = (alts: string, flags = 'i') => new RegExp(`(?<!\\p{L})(?:${alts})(?!\\p{L})`, `${flags}u`);

const PAPERBACK = W('Broché|Paperback|Taschenbuch|Tapa blanda|Copertina flessibile');
const HARDCOVER = W('Relié|Hardcover|Gebundene Ausgabe|Tapa dura|Copertina rigida');
const EBOOK = W('e-?book|Kindle');

export function detectFormat(s: string): KdpFormat {
  if (PAPERBACK.test(s)) return 'paperback';
  if (HARDCOVER.test(s)) return 'hardcover';
  if (EBOOK.test(s)) return 'ebook';
  return 'unknown';
}

const STATUS: [KdpTitleStatus, RegExp][] = [
  ['unpublished', W('NON PUBLIÉ|UNPUBLISHED|NICHT VERÖFFENTLICHT|NO PUBLICADO|NON PUBBLICATO')],
  ['blocked', W('BLOQUÉ|BLOCKED|GESPERRT|BLOQUEADO|BLOCCATO')],
  ['review', W("EN COURS DE (?:VÉRIFICATION|RÉVISION|VALIDATION)|IN REVIEW|IN PRÜFUNG|EN REVISIÓN|IN REVISIONE")],
  ['publishing', W('PUBLICATION EN COURS|PUBLISHING|WIRD VERÖFFENTLICHT|PUBLICANDO|IN PUBBLICAZIONE')],
  ['draft', W('BROUILLON|DRAFT|ENTWURF|BORRADOR|BOZZA')],
  ['live', W('EN VENTE|LIVE|ACTIF|VERFÜGBAR|DISPONIBLE|IN VENDITA|PUBLIÉ|PUBLISHED', '')],
];

export function detectStatus(s: string): KdpTitleStatus {
  return STATUS.find(([, re]) => re.test(s))?.[0] ?? 'unknown';
}

const NOISE = new RegExp(
  [
    '^(ASIN|ISBN|Prix|Price|Preis|Precio|Prezzo|Redevance|Royalt|Lizenz|Regal|Publié|Published|Soumis|Submitted|Veröffentlicht|Publicado|Pubblicato)',
    '^(Broché|Paperback|Taschenbuch|Tapa blanda|Copertina|Relié|Hardcover|Gebundene|Tapa dura|eBook|Kindle|e-book)',
    '^(EN VENTE|LIVE|BROUILLON|DRAFT|EN COURS|IN REVIEW|PUBLISHING|BLOQUÉ|BLOCKED|NON PUBLIÉ|UNPUBLISHED|ACTIF)',
    '^(Actions|Modifier|Edit|Promouvoir|Promote|Voir|See|View|Créer|Create|Ajouter|Add|Copier|Copy|Détails|Details|Contenu|Content|Tarification|Pricing|Marketing|\\+|…|\\.\\.\\.)',
    '^(Unités|Units|Exemplaires|Commandes|Orders|Pages lues|KENP|Total|Place de marché|Marketplace|Marché|Format|Titre|Title|Auteur|Author)\\b',
  ].join('|'),
  'i',
);

const lines = (s: string) => s.split(/[\n\t]+/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);

/** Première ligne qui ressemble à un titre (ni libellé, ni statut, ni prix, ni identifiant). */
export function guessTitle(s: string): string | null {
  for (const l of lines(s)) {
    if (l.length < 3 || l.length > 220) continue;
    if (NOISE.test(l)) continue;
    if (ID_RE.test(l)) {
      ID_RE.lastIndex = 0;
      continue;
    }
    if (/^[\d\s.,:/€$£%()+-]+$/.test(l)) continue;
    if (/^(par|by|von|de|di)\s/i.test(l)) continue;
    return l;
  }
  return null;
}

const authorOf = (s: string) => lines(s).map((l) => l.match(/^(?:par|by|von|de|di)\s+(.{2,80})$/i)?.[1]).find(Boolean) ?? null;
const dateOf = (s: string) => s.match(/(?:Publié le|Published(?: on)?|Soumis le|Submitted(?: on)?|Veröffentlicht am|Publicado el|Pubblicato il|Date de publication)\s*:?\s*([^\n]{4,40})/i)?.[1].trim() ?? null;

/**
 * Pour chaque identifiant : bloc propre (sans autre identifiant) et bloc parent (pour le titre).
 * sameIdSplits : une nouvelle occurrence du même identifiant marque un autre bloc (Rapports : une ligne par
 * place de marché) ; sinon elle est tolérée (Bibliothèque : l'ASIN peut être affiché deux fois pour un format).
 */
function blocks(raw: KdpRawCapture, sameIdSplits = false): { id: string; own: string; parent: string }[] {
  const allIds = new Set(raw.ladders.map((l) => l.id));
  const out: { id: string; own: string; parent: string }[] = [];
  const seen = new Set<string>();
  for (const { id, texts } of raw.ladders) {
    const ids = (t: string) => [...t.matchAll(ID_RE)].map((m) => m[1]).filter((x) => allIds.has(x));
    const base = ids(texts[0] ?? '').length;
    // own = plus grand bloc sans autre identifiant ; parent = premier bloc qui en contient un autre (le livre)
    let own = texts[0] ?? '';
    let parent: string | null = null;
    for (const t of texts) {
      const found = ids(t);
      const others = found.filter((x) => x !== id).length;
      const repeats = found.length - others - base;
      if (others === 0 && (!sameIdSplits || repeats <= 0)) own = t;
      else {
        parent = t;
        break;
      }
    }
    if (seen.has(`${id}\u0001${own}`)) continue;
    seen.add(`${id}\u0001${own}`);
    out.push({ id, own, parent: parent ?? own });
  }
  return out;
}

/** Lignes de tableau capturées : chacune est son propre bloc (cas normal des Rapports). */
function rowBlocks(raw: KdpRawCapture): { id: string; own: string; parent: string }[] {
  return [...new Set(raw.rows ?? [])].flatMap((r) => {
    const id = r.match(new RegExp(ID_RE.source))?.[1];
    return id ? [{ id, own: r, parent: r }] : [];
  });
}

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function parseKdpBookshelf(raw: KdpRawCapture): KdpTitle[] {
  const now = raw.capturedAt;
  const titles = new Map<string, KdpTitle>();
  for (const b of blocks(raw)) {
    const isAsin = b.id.startsWith('B0');
    const title = guessTitle(b.own) ?? guessTitle(b.parent);
    if (!title || titles.has(b.id)) continue;
    const format = detectFormat(b.own) !== 'unknown' ? detectFormat(b.own) : isAsin ? 'unknown' : 'paperback';
    const isbn = isAsin ? (b.own.match(/ISBN[^\d]{0,5}([\d-]{10,17})/)?.[1] ?? null) : b.id;
    const asin = isAsin ? b.id : null;
    const id = asin ?? isbn ?? `${slug(title)}-${format}`;
    const price = parsePrice(b.own);
    titles.set(id, {
      id, asin, isbn, title, author: authorOf(b.own) ?? authorOf(b.parent), format, status: detectStatus(b.own),
      price, currency: price === null ? null : /\$/.test(b.own) ? 'USD' : /£/.test(b.own) ? 'GBP' : 'EUR',
      date: dateOf(b.own), firstSeenAt: now, lastSeenAt: now, bookId: null,
    });
  }
  return [...titles.values()];
}

const MARKET_RE = /\bAmazon\.(com\.au|com\.br|com\.mx|co\.uk|co\.jp|com|fr|de|es|it|nl|pl|se|ca|in)\b/i;
const MONEY_RE = /(?:[€$£¥]|EUR|USD|GBP)[ \u00a0\u202f]*-?\d[\d.,\u00a0\u202f ]*\d|-?\d[\d.,\u00a0\u202f ]*\d[ \u00a0\u202f]*(?:€|EUR|USD|GBP|\$)|(?:[€$£])[ \u00a0\u202f]*\d/g;

export function parseKdpReports(raw: KdpRawCapture): KdpSalesSnapshot {
  const rows: KdpSalesRow[] = [];
  const byRow = rowBlocks(raw);
  for (const b of byRow.length ? byRow : blocks(raw, true)) {
    const text = b.own;
    const money = [...text.matchAll(MONEY_RE)].map((m) => m[0]);
    const royalty = money.length ? parsePrice(money[money.length - 1]) : null;
    const currency = money.length ? (/\$|USD/.test(money[money.length - 1]) ? 'USD' : /£|GBP/.test(money[money.length - 1]) ? 'GBP' : 'EUR') : null;
    const labeled = text.match(/(?:Unités vendues nettes|Unités nettes|Net units(?: sold)?|Unités vendues|Units sold|Verkaufte Einheiten|Unidades vendidas|Unità vendute)\s*:?\s*(\d[\d\s.,]*)/i);
    const kenpM = text.match(/(\d[\d\s.,]*)\s*(?:pages lues|pages read|KENP|gelesene Seiten|páginas leídas|pagine lette)/i) ?? text.match(/(?:KENP|Pages lues|Pages read)\s*:?\s*(\d[\d\s.,]*)/i);
    let units = labeled ? parseCount(labeled[1]) : null;
    if (units === null) {
      // Premier entier isolé une fois retirés montants, identifiants, dates et pages lues
      const cleaned = text.replace(MONEY_RE, ' ').replace(ID_RE, ' ').replace(/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\b(19|20)\d{2}\b/g, ' ').replace(kenpM?.[0] ?? '\u0000', ' ');
      const ints = [...cleaned.matchAll(/(?:^|[\s:])(\d{1,6})(?=$|[\s\n])/g)].map((m) => Number(m[1]));
      units = ints.length ? ints[0] : null;
    }
    if (units === null && royalty === null) continue;
    rows.push({
      title: guessTitle(text) ?? guessTitle(b.parent) ?? b.id,
      asin: b.id.startsWith('B0') ? b.id : null,
      marketplace: text.match(MARKET_RE)?.[0] ?? null,
      format: detectFormat(text),
      units: units ?? 0,
      royalty,
      currency,
      kenp: kenpM ? parseCount(kenpM[1]) : null,
    });
  }
  const period = raw.period?.trim()
    || raw.text.match(/\d{1,2}\s+[a-zéû]+\.?\s+\d{4}\s*[-–]\s*\d{1,2}\s+[a-zéû]+\.?\s+\d{4}/i)?.[0]
    || raw.text.match(/[A-Z][a-z]{2,8}\.? \d{1,2}, \d{4}\s*[-–]\s*[A-Z][a-z]{2,8}\.? \d{1,2}, \d{4}/)?.[0]
    || `capture du ${raw.capturedAt.slice(0, 10)}`;
  return { id: `s${raw.capturedAt.replace(/\D/g, '')}`, capturedAt: raw.capturedAt, period, rows };
}

/** Fusionne une capture de la Bibliothèque dans le catalogue existant (les liens vers les livres de l'app sont conservés). */
export function mergeTitles(existing: KdpTitle[], incoming: KdpTitle[]): { titles: KdpTitle[]; added: number; updated: number } {
  const map = new Map(existing.map((t) => [t.id, t]));
  let added = 0;
  let updated = 0;
  for (const t of incoming) {
    const prev = map.get(t.id);
    if (prev) {
      map.set(t.id, { ...prev, ...t, firstSeenAt: prev.firstSeenAt, bookId: prev.bookId, author: t.author ?? prev.author, date: t.date ?? prev.date });
      updated++;
    } else {
      map.set(t.id, t);
      added++;
    }
  }
  return { titles: [...map.values()], added, updated };
}
