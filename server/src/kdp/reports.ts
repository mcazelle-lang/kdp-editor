import ExcelJS from 'exceljs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { amazonUrl, bookFromKdpTitle, mergeTitles, parseRoyaltyReport, titlesFromReports, type KdpSalesSnapshot, type SheetRows } from '@shared';
import { IDEAS_DIR } from '../config';
import { db } from '../db';

// Rapports de redevances exportés depuis KDP (Rapports › Redevances du mois précédent, .xlsx).
export const REPORT_FILE = /^KDP_.*\.xlsx$/i;
const MAX_SNAPSHOTS = 240;

function cellValue(v: ExcelJS.CellValue): unknown {
  if (v instanceof Date) return v.toISOString();
  if (v && typeof v === 'object') {
    const o = v as { richText?: { text: string }[]; text?: string; result?: unknown };
    if (o.richText) return o.richText.map((r) => r.text).join('');
    if (o.result !== undefined) return o.result;
    if (o.text !== undefined) return o.text;
  }
  return v;
}

export async function readRoyaltyWorkbook(data: Buffer | ArrayBuffer, fileName: string): Promise<KdpSalesSnapshot> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as never);
  const sheets: SheetRows[] = wb.worksheets.map((ws) => {
    const rows: unknown[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      rows[n - 1] = (row.values as ExcelJS.CellValue[]).slice(1).map(cellValue);
    });
    return { name: ws.name, rows: Array.from(rows, (r) => r ?? []) };
  });
  return parseRoyaltyReport(sheets, fileName);
}

export interface ReportImportResult {
  files: { file: string; period: string; rows: number; error?: string }[];
  months: string[];
  titles: { added: number; updated: number; total: number };
  books: number;
}

/** Importe des rapports mensuels : ventes par mois, catalogue déduit, et (option) un livre « publié » par titre. */
export async function importRoyaltyReports(files: { name: string; data: Buffer }[], opts: { createBooks?: boolean } = {}): Promise<ReportImportResult> {
  const k = db.data.kdp;
  const report: ReportImportResult['files'] = [];
  for (const f of files) {
    try {
      const snap = await readRoyaltyWorkbook(f.data, f.name);
      if (!snap.month || !snap.rows.length) {
        report.push({ file: f.name, period: snap.period, rows: 0, error: 'Aucune ligne de vente reconnue : attendu un rapport KDP de redevances mensuelles (.xlsx).' });
        continue;
      }
      // Un mois réimporté remplace le précédent
      k.snapshots = [snap, ...k.snapshots.filter((s) => !(s.source === 'rapport' && s.month === snap.month))].slice(0, MAX_SNAPSHOTS);
      report.push({ file: f.name, period: snap.period, rows: snap.rows.length });
    } catch (e) {
      report.push({ file: f.name, period: '', rows: 0, error: `Fichier illisible : ${(e as Error).message}` });
    }
  }

  // Catalogue : les statuts et dates déjà connus (Bibliothèque capturée) sont conservés
  const fromReports = titlesFromReports(k.snapshots);
  const prev = new Map(k.titles.map((t) => [t.id, t]));
  const merged = mergeTitles(k.titles, fromReports.map((t) => {
    const p = prev.get(t.id);
    return p ? { ...t, status: t.status === 'unknown' ? p.status : t.status, price: t.price ?? p.price, firstSeenAt: p.firstSeenAt < t.firstSeenAt ? p.firstSeenAt : t.firstSeenAt } : t;
  }));
  k.titles = merged.titles;

  let books = 0;
  const reported = new Set(fromReports.map((t) => t.id));
  for (const t of k.titles) {
    if (!reported.has(t.id)) continue;
    const linked = t.bookId ? db.data.books.find((b) => b.id === t.bookId) : undefined;
    if (linked) {
      linked.kdp = { titleId: t.id, asin: t.asin, status: t.status, linkedAt: linked.kdp?.linkedAt ?? new Date().toISOString(), url: linked.kdp?.url ?? amazonUrl(t.asin, t.marketplace) };
    } else if (opts.createBooks) {
      const book = bookFromKdpTitle(t, 'publie');
      t.bookId = book.id;
      db.data.books.push(book);
      books++;
    }
  }
  await db.save();
  return {
    files: report,
    months: [...new Set(k.snapshots.filter((s) => s.source === 'rapport' && s.month).map((s) => s.month!))].sort(),
    titles: { added: merged.added, updated: merged.updated, total: fromReports.length },
    books,
  };
}

export async function localReportFiles(dir = IDEAS_DIR): Promise<string[]> {
  return (await readdir(dir)).filter((f) => REPORT_FILE.test(f)).sort();
}

export async function importLocalReports(opts: { createBooks?: boolean } = {}, dir = IDEAS_DIR) {
  const names = await localReportFiles(dir);
  const files = await Promise.all(names.map(async (name) => ({ name, data: await readFile(join(dir, name)) })));
  return importRoyaltyReports(files, opts);
}
