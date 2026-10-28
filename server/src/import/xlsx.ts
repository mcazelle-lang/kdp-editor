import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { cleanKeywordLine, normalize, type Idea } from '@shared';

// Import des fichiers d'idées : une feuille = une catégorie, une colonne = une niche (ou une variante de la niche à sa gauche).
// Lignes reconnues en colonne A : Niche, Contenu, Langue, Titre 1..N, Sous titre, Description, Catégorie 1/2,
// Keywords 1..7, Auteur, format, it/es/de. Les cellules sans libellé (HTML, listes de mots, liens concurrents) deviennent des notes.

type Kind = 'niche' | 'content' | 'lang' | 'title' | 'subtitle' | 'subtitle2' | 'description' | 'category' | 'keyword' | 'author' | 'format' | 'translation';

function classify(label: string): { kind: Kind; lang?: string } | null {
  const l = normalize(label).trim();
  if (!l) return null;
  if (l === 'niche') return { kind: 'niche' };
  if (l === 'contenu') return { kind: 'content' };
  if (l === 'langue') return { kind: 'lang' };
  if (/^titre\s*\d+$/.test(l)) return { kind: 'title' };
  if (l === 'sous titre' || l === 'sous-titre') return { kind: 'subtitle' };
  if (/^sous[ -]titre\s*2$/.test(l)) return { kind: 'subtitle2' };
  if (l.startsWith('description')) return { kind: 'description' };
  if (/^categorie/.test(l)) return { kind: 'category' };
  if (/^keywords?\b/.test(l)) return { kind: 'keyword' };
  if (l === 'auteur') return { kind: 'author' };
  if (l === 'format') return { kind: 'format' };
  if (['it', 'es', 'de', 'en', 'fr'].includes(l)) return { kind: 'translation', lang: l };
  return null;
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value as unknown;
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const o = v as { richText?: { text: string }[]; text?: string; result?: unknown; hyperlink?: string };
  if (o.richText) return o.richText.map((r) => r.text).join('');
  if (o.text) return String(o.text);
  if (o.result != null) return String(o.result);
  if (o.hyperlink) return o.hyperlink;
  return cell.text ?? '';
}

const isRuler = (s: string) => /^a{10,}$/i.test(s.trim());
const isHtml = (s: string) => /<(p|h\d|ul|li|b|strong|br)\b/i.test(s);
const colName = (i: number) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

export async function parseIdeasWorkbook(data: Buffer | ArrayBuffer, fileName: string): Promise<Idea[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as never);
  const ideas: Idea[] = [];
  const now = new Date().toISOString();

  wb.eachSheet((ws) => {
    const grid: string[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, r) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, c) => {
        cells[c - 1] = cellText(cell).replace(/\r\n/g, '\n');
      });
      grid[r - 1] = cells;
    });
    const rows = grid.map((r) => r ?? []);
    const width = Math.max(0, ...rows.map((r) => r.length));
    const labels = rows.map((r) => classify(r[0] ?? ''));
    const structured = labels.some((l) => l?.kind === 'title' || l?.kind === 'keyword');
    const id = (col: string) => 'i' + createHash('sha1').update(`${fileName}|${ws.name}|${col}`).digest('hex').slice(0, 12);
    const base = (col: string): Idea => ({
      id: id(col), source: { file: fileName, sheet: ws.name, column: col }, category: ws.name.trim(), niche: '', language: '', titles: [], subtitle: '',
      description: '', categories: [], keywords: [], translations: {}, format: '', author: '', notes: [], links: [], importedAt: now,
    });

    if (!structured) {
      const cells = rows.flatMap((r) => r.map((v) => (v ?? '').trim()).filter(Boolean));
      if (!cells.length) return;
      const idea = base('*');
      idea.niche = cells.length === 1 ? cells[0] : ws.name.trim();
      idea.notes = cells.length === 1 ? [] : rows.map((r) => r.map((v) => (v ?? '').trim()).filter(Boolean).join(' | ')).filter(Boolean);
      ideas.push(idea);
      return;
    }

    // Ligne « Niche » (ou première ligne si le libellé est absent / erroné)
    const nicheRow = labels.findIndex((l) => l?.kind === 'niche');
    const nr = nicheRow >= 0 ? nicheRow : 0;
    let lastNiche = '';
    for (let c = 1; c < width; c++) {
      const values = rows.map((r) => (r[c] ?? '').trim());
      if (!values.some((v) => v && !isRuler(v))) continue;
      const idea = base(colName(c));
      const ownNiche = values[nr];
      idea.niche = ownNiche || (lastNiche ? `${lastNiche} (variante)` : `${ws.name} ${colName(c)}`);
      if (ownNiche) lastNiche = ownNiche;
      rows.forEach((_, r) => {
        const v = values[r];
        if (!v || isRuler(v) || r === nr) return;
        const lab = labels[r];
        switch (lab?.kind) {
          case 'title': idea.titles.push(v); break;
          case 'subtitle': idea.subtitle = v; break;
          case 'subtitle2': if (v !== idea.subtitle) idea.notes.push(v); break;
          case 'description': if (!idea.description || (isHtml(v) && !isHtml(idea.description))) idea.description = v; break;
          case 'category': idea.categories.push(v); break;
          case 'keyword': idea.keywords.push(cleanKeywordLine(v)); break;
          case 'lang': if (v.length <= 5) idea.language = v.toLowerCase(); else idea.notes.push(v); break;
          case 'author': idea.author = v; break;
          case 'format': idea.format = v; break;
          case 'translation': idea.translations[lab.lang!] = v; break;
          default:
            if (/^https?:\/\//i.test(v)) idea.links.push(v);
            else if (isHtml(v) && !idea.description) idea.description = v;
            else idea.notes.push(v);
        }
      });
      ideas.push(idea);
    }
  });
  return ideas;
}
