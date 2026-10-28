import { MARKETPLACES } from '../kdp/specs';
import type { KdpFormat, KdpSalesRow, KdpSalesSnapshot, KdpTitle } from './model';

// Rapports de redevances exportés depuis KDP (« Prior Month Royalties », .xlsx) : une feuille par format,
// ligne 1 = période, ligne 2 = en-têtes. La lecture du fichier se fait côté serveur (exceljs) ; ici, des lignes brutes.

export interface SheetRows {
  name: string;
  rows: unknown[][];
}

const norm = (s: unknown) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

// En-têtes normalisés (français, anglais)
const COLS = {
  title: /^(titre|title)$/,
  author: /^(auteur|author|author name)$/,
  asin: /^asin$/,
  isbn: /^isbn$/,
  marketplace: /^(marche|marketplace)$/,
  sold: /^(exemplaires vendus|units sold)$/,
  refunded: /^(exemplaires rembourses|units refunded)$/,
  net: /^(nombre net d'exemplaires vendus|net units sold)$/,
  rate: /^(type de droits d'auteur|royalty type)$/,
  currency: /^(devise|currency)$/,
  listPrice: /^(prix catalogue moyen ht|avg\.? list price without tax)/,
  cost: /^(cout de fabrication moyen|cout de livraison moyen|avg\.? (manufacturing|delivery) cost)/,
  royalty: /^(redevance|royalty)$/,
  kenp: /kenp/,
} as const;

type Col = keyof typeof COLS;

const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function sheetFormat(name: string): KdpFormat | 'kenp' | null {
  const n = norm(name);
  if (/total|combined|summary/.test(n)) return null;
  if (/kenp/.test(n)) return 'kenp';
  if (/reli|hardcover/.test(n)) return 'hardcover';
  if (/broch|paperback/.test(n)) return 'paperback';
  if (/ebook|kindle/.test(n)) return 'ebook';
  return null;
}

const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v ?? '').replace(/[\s  ]/g, '').replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
};
const str = (v: unknown) => String(v ?? '').trim();
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Prix public estimé à partir du prix hors taxes du rapport, arrondi au « ,99 » le plus proche s'il est à 2 centimes près. */
export function publicPrice(exVat: number, vat: number) {
  const p = exVat * (1 + vat);
  const nice = Math.round(p + 0.01) - 0.01;
  return round2(Math.abs(nice - p) <= 0.02 ? nice : p);
}

/** « juillet 2026 » → « 2026-07 » ; à défaut, la date du nom de fichier (KDP_…-2026-07-01-…). */
export function reportMonth(periodLabel: string, fileName = ''): string | null {
  const m = norm(periodLabel).match(/([a-z]+)\.? (\d{4})/);
  if (m && MONTHS[m[1]]) return `${m[2]}-${String(MONTHS[m[1]]).padStart(2, '0')}`;
  const f = fileName.match(/(\d{4})-(\d{2})-\d{2}/);
  return f ? `${f[1]}-${f[2]}` : null;
}

export function parseRoyaltyReport(sheets: SheetRows[], fileName = '', importedAt = new Date().toISOString()): KdpSalesSnapshot {
  let period = '';
  const rows: KdpSalesRow[] = [];
  for (const sheet of sheets) {
    const kind = sheetFormat(sheet.name);
    const headerAt = sheet.rows.findIndex((r) => r.some((c) => COLS.title.test(norm(c))));
    if (!period) {
      const first = sheet.rows[0] ?? [];
      if (/periode|period/.test(norm(first[0]))) period = str(first[1]);
    }
    if (!kind || headerAt < 0) continue;
    const header = sheet.rows[headerAt].map(norm);
    const at = (c: Col) => header.findIndex((h) => COLS[c].test(h));
    const idx = Object.fromEntries((Object.keys(COLS) as Col[]).map((c) => [c, at(c)])) as Record<Col, number>;
    const cell = (r: unknown[], c: Col) => (idx[c] >= 0 ? r[idx[c]] : undefined);
    for (const r of sheet.rows.slice(headerAt + 1)) {
      const title = str(cell(r, 'title'));
      if (!title) continue;
      const asin = str(cell(r, 'asin')) || null;
      const isbn = str(cell(r, 'isbn')) || null;
      if (kind === 'kenp') {
        rows.push({ title, asin, isbn, author: str(cell(r, 'author')) || null, marketplace: str(cell(r, 'marketplace')) || null, format: 'ebook', units: 0, royalty: null, currency: null, kenp: num(cell(r, 'kenp')) ?? 0 });
        continue;
      }
      const sold = num(cell(r, 'sold')) ?? 0;
      const refunds = num(cell(r, 'refunded')) ?? 0;
      const rate = num(str(cell(r, 'rate')).replace('%', ''));
      rows.push({
        title, asin, isbn,
        author: str(cell(r, 'author')) || null,
        marketplace: str(cell(r, 'marketplace')) || null,
        format: kind,
        units: num(cell(r, 'net')) ?? sold - refunds,
        refunds,
        royalty: num(cell(r, 'royalty')),
        currency: str(cell(r, 'currency')) || null,
        kenp: null,
        listPrice: num(cell(r, 'listPrice')),
        printCost: num(cell(r, 'cost')),
        rate: rate === null ? null : rate / 100,
      });
    }
  }
  const month = reportMonth(period, fileName);
  return { id: `r${month ?? importedAt.replace(/\D/g, '')}`, capturedAt: importedAt, period: period || month || fileName, month, source: 'rapport', file: fileName || undefined, rows };
}

// ---------------------------------------------------------------- Catalogue déduit des rapports

/** « Amazon.fr » → « amazon.fr » (domaine utilisé pour le lien vers la fiche). */
export const marketDomain = (marketplace: string | null | undefined) => (marketplace ? marketplace.trim().toLowerCase() : null);

export const amazonUrl = (asin: string | null, marketplace: string | null | undefined) =>
  asin && marketplace ? `https://www.${marketDomain(marketplace)}/dp/${encodeURIComponent(asin)}` : null;

/**
 * Place de marché principale : celle qui vend le plus parmi celles que l'app gère (prix, TVA, redevance),
 * sinon celle qui vend le plus tout court.
 */
export function mainMarket(unitsByMarket: Map<string, number>): string | null {
  const sorted = [...unitsByMarket.entries()].filter(([m]) => m).sort((a, b) => b[1] - a[1]);
  return (sorted.find(([m]) => MARKETPLACES.some((x) => x.id === marketDomain(m))) ?? sorted[0])?.[0] ?? null;
}

export const titleKey = (r: { asin?: string | null; isbn?: string | null; title: string }) => r.asin || r.isbn || norm(r.title);

/** Rapports mensuels importés, du plus ancien au plus récent. */
export const reportSnapshots = (snapshots: KdpSalesSnapshot[]) =>
  snapshots.filter((s) => s.month).sort((a, b) => a.month!.localeCompare(b.month!));

/**
 * Un titre par ASIN (ou ISBN) vendu dans les rapports. « En vente » si le titre a vendu dans le dernier mois importé ;
 * sinon le statut reste inconnu (un titre qui ne vend pas n'apparaît pas dans les rapports).
 */
export function titlesFromReports(snapshots: KdpSalesSnapshot[]): KdpTitle[] {
  const reports = reportSnapshots(snapshots);
  const last = reports[reports.length - 1]?.month;
  const map = new Map<string, { rows: { r: KdpSalesRow; month: string }[] }>();
  for (const s of reports) {
    for (const r of s.rows) {
      if (r.format === 'ebook' && r.kenp && !r.units) continue;
      const k = titleKey(r);
      const e = map.get(k) ?? { rows: [] };
      e.rows.push({ r, month: s.month! });
      map.set(k, e);
    }
  }
  return [...map.entries()].map(([id, { rows }]) => {
    const byMarket = new Map<string, number>();
    for (const { r } of rows) byMarket.set(r.marketplace ?? '', (byMarket.get(r.marketplace ?? '') ?? 0) + r.units);
    const main = mainMarket(byMarket);
    const latest = [...rows].reverse().find((x) => x.r.marketplace === main) ?? rows[rows.length - 1];
    const vat = MARKETPLACES.find((m) => m.id === marketDomain(main))?.vat ?? 0;
    const months = rows.map((x) => x.month).sort();
    return {
      id,
      asin: latest.r.asin ?? null,
      isbn: latest.r.isbn ?? null,
      title: latest.r.title,
      author: latest.r.author ?? null,
      format: latest.r.format,
      status: months[months.length - 1] === last ? 'live' : 'unknown',
      price: latest.r.listPrice ? publicPrice(latest.r.listPrice, vat) : null,
      currency: latest.r.currency,
      date: null,
      firstSeenAt: `${months[0]}-01T00:00:00.000Z`,
      lastSeenAt: `${months[months.length - 1]}-01T00:00:00.000Z`,
      bookId: null,
      marketplace: marketDomain(main),
    } satisfies KdpTitle;
  });
}
