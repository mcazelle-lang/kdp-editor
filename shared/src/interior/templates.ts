import { DAYS, t } from '../i18n';
import { rect, text, type Prim } from '../prims';
import { inset, type Rect } from '../units';
import {
  arr, bool, estimateWidth, fieldLine, header, headerParam, hline, label, letterFor, mm, num, pageTitle, starPath, str, tokens, vline,
  type ColumnDef, type FieldDef, type PageCtx, type TemplateDef,
} from './kit';

const circlePrim = (cx: number, cy: number, r: number, paint: Partial<Omit<Extract<Prim, { k: 'circle' }>, 'k'>>): Prim => ({ k: 'circle', cx, cy, r, ...paint });

// ---------------------------------------------------------------- Base
const blank: TemplateDef = {
  id: 'blank',
  name: 'Page vierge',
  category: 'base',
  description: 'Page blanche, avec cadre et texte centré optionnels (sketchbook, herbier, livre d\'or, page photo).',
  params: [
    { key: 'title', label: 'Titre en haut de page', type: 'text', default: '' },
    { key: 'frame', label: 'Cadre', type: 'select', default: 'none', options: [
      { value: 'none', label: 'Aucun' }, { value: 'solid', label: 'Trait plein' }, { value: 'dashed', label: 'Pointillés' }, { value: 'rounded', label: 'Coins arrondis' },
    ] },
    { key: 'label', label: 'Texte centré discret', type: 'text', default: '', help: 'Ex. « Collez votre spécimen ici »' },
  ],
  render(c) {
    const out: Prim[] = [];
    const area = pageTitle(c, out, str(c, 'title'));
    const f = str(c, 'frame', 'none');
    if (f !== 'none') {
      out.push(rect(area, { stroke: c.style.line, width: Math.max(c.style.lineWidth, 1), dash: f === 'dashed' ? [5, 4] : undefined, r: f === 'rounded' ? mm(5) : 0 }));
    }
    const lab = str(c, 'label');
    if (lab) out.push(text(area, tokens(c, lab), { font: c.style.font, size: 10, italic: true, color: c.style.muted, align: 'center', valign: 'middle' }));
    return out;
  },
};

const lined: TemplateDef = {
  id: 'lined',
  name: 'Ligné',
  category: 'base',
  description: 'Lignes horizontales : carnet de notes, journal, cahier de code (lignes numérotées).',
  params: [
    { key: 'spacing', label: 'Interligne', type: 'number', min: 5, max: 15, step: 0.05, unit: 'mm', default: 7.1, help: 'College ruled 7,1 mm · Wide ruled 8,7 mm · Narrow ruled 6,35 mm' },
    headerParam('none'),
    { key: 'marginLine', label: 'Ligne de marge verticale', type: 'boolean', default: false },
    { key: 'numbered', label: 'Lignes numérotées', type: 'boolean', default: false },
  ],
  render(c) {
    const out: Prim[] = [];
    const area = header(c, out);
    const s = mm(num(c, 'spacing', 7.1));
    const numbered = bool(c, 'numbered');
    const numW = numbered ? mm(7) : 0;
    let n = 0;
    for (let y = area.y + s; y <= area.y + area.h + 0.01; y += s) {
      n++;
      if (numbered) out.push(text({ x: area.x, y: y - s, w: numW - mm(1.5), h: s - 1.5 }, String(n), { font: c.style.font, size: 7, color: c.style.muted, align: 'right', valign: 'bottom' }));
      out.push(hline(c, area.x + numW, area.x + area.w, y));
    }
    if (bool(c, 'marginLine')) out.push(vline(c, area.x + numW + mm(14), area.y, area.y + area.h));
    return out;
  },
};

const dotted: TemplateDef = {
  id: 'dotted',
  name: 'Pointillé (dot grid)',
  category: 'base',
  description: 'Grille de points pour bullet journal.',
  params: [
    { key: 'spacing', label: 'Espacement', type: 'number', min: 3, max: 10, step: 0.5, unit: 'mm', default: 5 },
    { key: 'dot', label: 'Diamètre des points', type: 'number', min: 0.8, max: 4, step: 0.1, unit: 'pt', default: 1.6 },
    headerParam('none'),
  ],
  render(c) {
    const out: Prim[] = [];
    const area = header(c, out);
    const s = mm(num(c, 'spacing', 5));
    const r = Math.max(num(c, 'dot', 1.6), 0.8) / 2;
    const cols = Math.floor(area.w / s);
    const rows = Math.floor(area.h / s);
    const x0 = area.x + (area.w - cols * s) / 2;
    const y0 = area.y + (area.h - rows * s) / 2;
    for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) out.push(circlePrim(x0 + i * s, y0 + j * s, r, { fill: c.style.line }));
    return out;
  },
};

const grid: TemplateDef = {
  id: 'grid',
  name: 'Quadrillé',
  category: 'base',
  description: 'Petits carreaux (5 mm), papier millimétré, plans.',
  params: [
    { key: 'spacing', label: 'Taille des carreaux', type: 'number', min: 2, max: 15, step: 0.5, unit: 'mm', default: 5 },
    { key: 'major', label: 'Trait renforcé toutes les N lignes', type: 'number', min: 0, max: 20, step: 1, default: 0 },
    headerParam('none'),
  ],
  render(c) {
    const out: Prim[] = [];
    const area = header(c, out);
    const s = mm(num(c, 'spacing', 5));
    const major = num(c, 'major', 0);
    const cols = Math.floor(area.w / s);
    const rows = Math.floor(area.h / s);
    const x0 = area.x + (area.w - cols * s) / 2;
    const y0 = area.y + (area.h - rows * s) / 2;
    const strong = (i: number) => (major > 0 && i % major === 0 ? { color: c.style.ink, width: 1 } : {});
    for (let i = 0; i <= cols; i++) out.push(vline(c, x0 + i * s, y0, y0 + rows * s, strong(i)));
    for (let j = 0; j <= rows; j++) out.push(hline(c, x0, x0 + cols * s, y0 + j * s, strong(j)));
    return out;
  },
};

const seyes: TemplateDef = {
  id: 'seyes',
  name: 'Seyès (grands carreaux)',
  category: 'ecriture',
  description: 'Réglure française : carreaux de 8 mm divisés en 4 interlignes, marge à gauche.',
  params: [
    { key: 'sub', label: 'Interligne', type: 'select', default: '2', options: [
      { value: '2', label: '2 mm (classique, carreaux de 8 mm)' }, { value: '2.5', label: '2,5 mm (carreaux de 10 mm)' }, { value: '3', label: '3 mm (CP, carreaux de 12 mm)' },
    ] },
    { key: 'margin', label: 'Marge à gauche', type: 'boolean', default: true },
  ],
  render(c) {
    const out: Prim[] = [];
    const area = c.content;
    const sub = mm(Number(str(c, 'sub', '2')) || 2);
    const big = sub * 4;
    const cols = Math.floor(area.w / big);
    const rows = Math.floor(area.h / sub);
    const x0 = area.x + (area.w - cols * big) / 2;
    const y0 = area.y + (area.h - rows * sub) / 2;
    const fine = '#b4b4b4';
    for (let j = 0; j <= rows; j++) {
      const main = j % 4 === 0;
      out.push(hline(c, x0, x0 + cols * big, y0 + j * sub, main ? { color: c.style.line } : { color: fine }));
    }
    for (let i = 0; i <= cols; i++) out.push(vline(c, x0 + i * big, y0, y0 + rows * sub, { color: c.style.line }));
    if (bool(c, 'margin')) {
      const mx = x0 + Math.max(1, Math.round(mm(40) / big)) * big;
      out.push(vline(c, mx, area.y, area.y + area.h, { color: '#555555', width: 1 }));
    }
    return out;
  },
};

// ---------------------------------------------------------------- Écriture
const handwriting: TemplateDef = {
  id: 'handwriting',
  name: 'Écriture primaire (draw & write)',
  category: 'ecriture',
  description: 'Cadre à dessin + lignes d\'écriture avec ligne médiane pointillée (primary composition, K-2).',
  params: [
    { key: 'drawBox', label: 'Cadre de dessin', type: 'boolean', default: true },
    { key: 'drawRatio', label: 'Hauteur du cadre (part de la page)', type: 'number', min: 0.2, max: 0.7, step: 0.05, default: 0.45 },
    { key: 'rowHeight', label: 'Hauteur d\'une ligne d\'écriture', type: 'number', min: 8, max: 30, step: 1, unit: 'mm', default: 16 },
    { key: 'nameLine', label: 'Ligne « Nom / Date »', type: 'boolean', default: false },
  ],
  render(c) {
    const out: Prim[] = [];
    let area = c.content;
    if (bool(c, 'nameLine')) {
      const y = area.y + mm(7);
      const half = area.w / 2 - mm(4);
      out.push(...fieldLine(c, area.x, y, half, c.lang === 'fr' ? 'Nom' : 'Name'));
      out.push(...fieldLine(c, area.x + area.w - half, y, half, t('date', c.lang)));
      area = { ...area, y: area.y + mm(11), h: area.h - mm(11) };
    }
    if (bool(c, 'drawBox')) {
      const h = area.h * num(c, 'drawRatio', 0.45);
      out.push(rect({ x: area.x, y: area.y, w: area.w, h }, { stroke: c.style.ink, width: 1.2, r: mm(2) }));
      area = { ...area, y: area.y + h + mm(6), h: area.h - h - mm(6) };
    }
    const rh = mm(num(c, 'rowHeight', 16));
    const gap = rh * 0.35;
    const n = Math.max(1, Math.floor((area.h + gap) / (rh + gap)));
    for (let i = 0; i < n; i++) {
      const y = area.y + i * (rh + gap);
      out.push(hline(c, area.x, area.x + area.w, y));
      out.push(hline(c, area.x, area.x + area.w, y + rh / 2, { dash: [4, 3] }));
      out.push(hline(c, area.x, area.x + area.w, y + rh, { color: c.style.ink, width: 1 }));
    }
    return out;
  },
};

// ---------------------------------------------------------------- Musique
const music: TemplateDef = {
  id: 'music',
  name: 'Portées musicales',
  category: 'musique',
  description: 'Papier à musique : portées de 5 lignes, ligne de paroles optionnelle.',
  params: [
    { key: 'staves', label: 'Nombre de portées (0 = auto)', type: 'number', min: 0, max: 16, step: 1, default: 0 },
    { key: 'staffSpace', label: 'Écart entre les lignes', type: 'number', min: 1.5, max: 3.5, step: 0.1, unit: 'mm', default: 2 },
    { key: 'lyrics', label: 'Ligne de paroles sous chaque portée', type: 'boolean', default: false },
    headerParam('none'),
  ],
  render(c) {
    const out: Prim[] = [];
    const area = header(c, out);
    const sp = mm(num(c, 'staffSpace', 2));
    const staffH = sp * 4;
    const lyrics = bool(c, 'lyrics');
    const lyricsH = lyrics ? mm(7) : 0;
    let n = num(c, 'staves', 0);
    if (n <= 0) n = Math.max(1, Math.floor(area.h / (staffH * 2.4 + lyricsH)));
    const block = area.h / n;
    for (let i = 0; i < n; i++) {
      const top = area.y + i * block + (block - staffH - lyricsH) / 2;
      for (let l = 0; l < 5; l++) out.push(hline(c, area.x, area.x + area.w, top + l * sp, { color: c.style.ink, width: 0.75 }));
      out.push(vline(c, area.x, top, top + staffH, { color: c.style.ink }));
      out.push(vline(c, area.x + area.w, top, top + staffH, { color: c.style.ink }));
      if (lyrics) out.push(hline(c, area.x, area.x + area.w, top + staffH + lyricsH - mm(1), { dash: [3, 3] }));
    }
    return out;
  },
};

const tablature: TemplateDef = {
  id: 'tablature',
  name: 'Tablature guitare',
  category: 'musique',
  description: 'Portées de tablature à 6 cordes, avec diagrammes d\'accords en haut de page.',
  params: [
    { key: 'staves', label: 'Nombre de tablatures (0 = auto)', type: 'number', min: 0, max: 14, step: 1, default: 0 },
    { key: 'lineSpace', label: 'Écart entre les cordes', type: 'number', min: 1.8, max: 4, step: 0.1, unit: 'mm', default: 2.5 },
    { key: 'chords', label: 'Rangée de diagrammes d\'accords', type: 'boolean', default: true },
  ],
  render(c) {
    const out: Prim[] = [];
    let area = c.content;
    if (bool(c, 'chords')) {
      const bw = mm(13), bh = mm(16), gap = mm(6);
      const n = Math.max(1, Math.floor((area.w + gap) / (bw + gap)));
      const x0 = area.x + (area.w - (n * bw + (n - 1) * gap)) / 2;
      const top = area.y + mm(6);
      for (let i = 0; i < n; i++) {
        const x = x0 + i * (bw + gap);
        out.push(hline(c, x, x + bw, top - mm(2), { dash: [2, 2] }));
        for (let s = 0; s < 6; s++) out.push(vline(c, x + (s * bw) / 5, top, top + bh, { color: c.style.ink }));
        for (let f = 0; f <= 5; f++) out.push(hline(c, x, x + bw, top + (f * bh) / 5, { color: c.style.ink, width: f === 0 ? 2.2 : 0.75 }));
      }
      area = { ...area, y: area.y + bh + mm(12), h: area.h - bh - mm(12) };
    }
    const ls = mm(num(c, 'lineSpace', 2.5));
    const tabH = ls * 5;
    let n = num(c, 'staves', 0);
    if (n <= 0) n = Math.max(1, Math.floor(area.h / (tabH * 2)));
    const block = area.h / n;
    for (let i = 0; i < n; i++) {
      const top = area.y + i * block + (block - tabH) / 2;
      for (let l = 0; l < 6; l++) out.push(hline(c, area.x, area.x + area.w, top + l * ls, { color: c.style.ink, width: 0.75 }));
      out.push(vline(c, area.x, top, top + tabH, { color: c.style.ink, width: 1.2 }));
      out.push(vline(c, area.x + area.w, top, top + tabH, { color: c.style.ink, width: 1.2 }));
      'TAB'.split('').forEach((ch, k) => {
        out.push(text({ x: area.x + mm(1), y: top + (k * tabH) / 3, w: mm(4), h: tabH / 3 }, ch, { font: c.style.font, size: 7.5, weight: 700, color: c.style.ink, align: 'center', valign: 'middle' }));
      });
    }
    return out;
  },
};

// ---------------------------------------------------------------- Créatif
const comic: TemplateDef = {
  id: 'comic',
  name: 'Planche de BD',
  category: 'creatif',
  description: 'Cases de bande dessinée. Mode « varié » : chaque planche est différente (graine déterministe).',
  params: [
    { key: 'layout', label: 'Disposition', type: 'select', default: 'varie', options: [
      { value: 'varie', label: 'Variée (toutes les planches différentes)' }, { value: '1', label: '1 grande case' }, { value: '2', label: '2 bandes' },
      { value: '3', label: '3 bandes' }, { value: '4', label: '4 cases (2×2)' }, { value: '6', label: '6 cases (3×2)' }, { value: '9', label: '9 cases (3×3)' },
    ] },
    { key: 'gutter', label: 'Gouttière entre les cases', type: 'number', min: 2, max: 10, step: 0.5, unit: 'mm', default: 4 },
    { key: 'border', label: 'Épaisseur du contour', type: 'number', min: 0.75, max: 4, step: 0.25, unit: 'pt', default: 1.5 },
  ],
  render(c) {
    const area = c.content;
    const g = mm(num(c, 'gutter', 4));
    const layout = str(c, 'layout', 'varie');
    const fixed: Record<string, number[]> = { '1': [1], '2': [1, 1], '3': [1, 1, 1], '4': [2, 2], '6': [2, 2, 2], '9': [3, 3, 3] };
    const pick = <T>(items: [T, number][]): T => {
      const total = items.reduce((s, [, w]) => s + w, 0);
      let r = c.rng() * total;
      for (const [v, w] of items) if ((r -= w) <= 0) return v;
      return items[items.length - 1][0];
    };
    const rows: { h: number; cols: number[] }[] = [];
    if (layout === 'varie') {
      const n = pick<number>([[2, 2], [3, 5], [4, 2]]);
      for (let i = 0; i < n; i++) {
        const cols = pick<number>([[1, 2], [2, 5], [3, 3]]);
        rows.push({ h: 0.7 + c.rng() * 0.6, cols: Array.from({ length: cols }, () => 0.6 + c.rng() * 0.8) });
      }
    } else {
      for (const cols of fixed[layout] ?? [2, 2, 2]) rows.push({ h: 1, cols: Array(cols).fill(1) });
    }
    const out: Prim[] = [];
    const totalH = rows.reduce((s, r) => s + r.h, 0);
    const availH = area.h - g * (rows.length - 1);
    let y = area.y;
    for (const row of rows) {
      const h = (row.h / totalH) * availH;
      const totalW = row.cols.reduce((s, v) => s + v, 0);
      const availW = area.w - g * (row.cols.length - 1);
      let x = area.x;
      for (const cw of row.cols) {
        const w = (cw / totalW) * availW;
        out.push(rect({ x, y, w, h }, { stroke: '#1a1a1a', width: Math.max(num(c, 'border', 1.5), 0.75) }));
        x += w + g;
      }
      y += h + g;
    }
    return out;
  },
};

// ---------------------------------------------------------------- Registres
const table: TemplateDef = {
  id: 'table',
  name: 'Tableau / registre',
  category: 'registre',
  description: 'Tableau à colonnes personnalisables : inventaire, livre de caisse, recettes-dépenses, reading log, suivi.',
  params: [
    { key: 'title', label: 'Titre de page', type: 'text', default: '', help: 'Jetons : {n} = n° de page de la section, {letter} = lettre A-Z' },
    { key: 'headerFields', label: 'Champs au-dessus du tableau (séparés par ;)', type: 'text', default: '' },
    { key: 'columns', label: 'Colonnes', type: 'columns', default: [
      { label: 'Date', width: 1 }, { label: 'Libellé', width: 3 }, { label: 'Quantité', width: 1 }, { label: 'Notes', width: 2 },
    ], defaultEn: [{ label: 'Date', width: 1 }, { label: 'Description', width: 3 }, { label: 'Qty', width: 1 }, { label: 'Notes', width: 2 }] },
    { key: 'rows', label: 'Nombre de lignes', type: 'number', min: 5, max: 60, step: 1, default: 25 },
    { key: 'rowLabels', label: 'Valeurs préremplies de la 1re colonne (séparées par ;)', type: 'text', default: '', help: 'Ex. créneaux « 08:00;08:30;09:00 » ou mois « Janvier;Février »' },
    { key: 'zebra', label: 'Lignes alternées grisées', type: 'boolean', default: true },
    { key: 'footer', label: 'Lignes de synthèse', type: 'select', default: 'none', options: [
      { value: 'none', label: 'Aucune' }, { value: 'total', label: 'Total en bas' }, { value: 'report-total', label: 'Report en haut + Total en bas' },
    ] },
    { key: 'fontSize', label: 'Taille du texte d\'en-tête', type: 'number', min: 7, max: 12, step: 0.5, unit: 'pt', default: 8 },
  ],
  render(c) {
    const out: Prim[] = [];
    let area = pageTitle(c, out, str(c, 'title'));
    const fields = str(c, 'headerFields').split(';').map((s) => s.trim()).filter(Boolean);
    if (fields.length) {
      const gap = mm(5);
      const fw = (area.w - gap * (fields.length - 1)) / fields.length;
      fields.forEach((f, i) => out.push(...fieldLine(c, area.x + i * (fw + gap), area.y + mm(7), fw, tokens(c, f))));
      area = { ...area, y: area.y + mm(10), h: area.h - mm(10) };
    }
    const cols = arr<ColumnDef>(c, 'columns').filter((col) => col && Number(col.width) > 0);
    if (!cols.length) return out;
    const footer = str(c, 'footer', 'none');
    const report = footer === 'report-total' ? 1 : 0;
    const total = footer === 'none' ? 0 : 1;
    const rowLabels = str(c, 'rowLabels').split(';').map((v) => v.trim());
    const nRows = Math.max(1, num(c, 'rows', 25), rowLabels.filter(Boolean).length);
    const rowH = area.h / (nRows + report + total + 1.4);
    const headH = rowH * 1.4;
    const totalW = cols.reduce((s, col) => s + Number(col.width), 0);
    const xs: number[] = [area.x];
    for (const col of cols) xs.push(xs[xs.length - 1] + (Number(col.width) / totalW) * area.w);
    const fs = Math.max(7, num(c, 'fontSize', 8));
    const bodyTop = area.y + headH;
    const tableBottom = bodyTop + rowH * (nRows + report + total);
    out.push(rect({ x: area.x, y: area.y, w: area.w, h: headH }, { fill: c.style.fillStrong }));
    if (bool(c, 'zebra')) {
      for (let i = 0; i < nRows; i++) if (i % 2 === 1) out.push(rect({ x: area.x, y: bodyTop + (report + i) * rowH, w: area.w, h: rowH }, { fill: c.style.fill }));
    }
    const summaryRow = (y: number, lab: string) => {
      out.push(rect({ x: area.x, y, w: area.w, h: rowH }, { fill: c.style.fill }));
      out.push(text({ x: xs[0] + 3, y, w: xs[1] - xs[0] - 6, h: rowH }, lab, { font: c.style.font, size: fs, weight: 700, color: c.style.ink, valign: 'middle' }));
    };
    if (report) summaryRow(bodyTop, t('carried', c.lang));
    if (total) summaryRow(tableBottom - rowH, t('total', c.lang));
    cols.forEach((col, i) => {
      out.push(text({ x: xs[i] + 2, y: area.y, w: xs[i + 1] - xs[i] - 4, h: headH }, tokens(c, col.label), { font: c.style.font, size: fs, weight: 700, color: c.style.ink, align: 'center', valign: 'middle', lineHeight: 1.1 }));
    });
    rowLabels.forEach((v, i) => {
      if (v && i < nRows) out.push(text({ x: xs[0] + 3, y: bodyTop + (report + i) * rowH, w: xs[1] - xs[0] - 6, h: rowH }, v, { font: c.style.font, size: fs, color: c.style.ink, align: 'center', valign: 'middle' }));
    });
    for (let i = 1; i <= nRows + report + total; i++) out.push(hline(c, area.x, area.x + area.w, bodyTop + i * rowH));
    out.push(hline(c, area.x, area.x + area.w, bodyTop, { color: c.style.ink, width: 1 }));
    if (report) out.push(hline(c, area.x, area.x + area.w, bodyTop + rowH, { color: c.style.ink, width: 1 }));
    if (total) out.push(hline(c, area.x, area.x + area.w, tableBottom - rowH, { color: c.style.ink, width: 1 }));
    for (let i = 1; i < xs.length - 1; i++) out.push(vline(c, xs[i], area.y, tableBottom));
    out.push(rect({ x: area.x, y: area.y, w: area.w, h: tableBottom - area.y }, { stroke: c.style.ink, width: 1 }));
    return out;
  },
};

function fieldUnits(f: FieldDef): { units: number; flex: number } {
  const n = Math.max(1, Number(f.lines) || 1);
  if (f.type === 'lines') return { units: 0.8 + n, flex: n };
  if (f.type === 'box') return { units: 0.8 + n, flex: n };
  return { units: 1, flex: 0 };
}

function renderFields(c: PageCtx, area: Rect, fields: FieldDef[], out: Prim[]) {
  const rows: FieldDef[][] = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.half && fields[i + 1]?.half) {
      rows.push([f, fields[i + 1]]);
      i++;
    } else rows.push([f]);
  }
  const metrics = rows.map((r) => r.map(fieldUnits).reduce((a, b) => ({ units: Math.max(a.units, b.units), flex: Math.max(a.flex, b.flex) })));
  const totalUnits = metrics.reduce((s, m) => s + m.units, 0);
  const totalFlex = metrics.reduce((s, m) => s + m.flex, 0);
  const u = Math.min(mm(8.5), area.h / Math.max(1, totalUnits));
  const leftover = area.h - totalUnits * u;
  const fs = 8.5;
  let y = area.y;
  rows.forEach((row, ri) => {
    const m = metrics[ri];
    const rh = m.units * u + (totalFlex > 0 ? (leftover * m.flex) / totalFlex : 0);
    const gap = mm(5);
    const w = row.length === 2 ? (area.w - gap) / 2 : area.w;
    row.forEach((f, fi) => {
      const x = area.x + fi * (w + gap);
      const lab = tokens(c, f.label ?? '');
      switch (f.type) {
        case 'lines': {
          out.push(label(c, { x, y, w, h: u * 0.8 }, lab, { weight: 700, color: c.style.ink, size: fs }));
          const top = y + u * 0.8;
          const count = Math.max(1, Math.floor((rh - u * 0.8) / u + 0.001));
          for (let k = 1; k <= count; k++) out.push(hline(c, x, x + w, top + k * u - u * 0.15));
          break;
        }
        case 'box': {
          out.push(label(c, { x, y, w, h: u * 0.8 }, lab, { weight: 700, color: c.style.ink, size: fs }));
          out.push(rect({ x, y: y + u * 0.8 + 2, w, h: rh - u * 0.8 - 6 }, { stroke: c.style.line, width: Math.max(c.style.lineWidth, 0.75), r: mm(1.5) }));
          break;
        }
        case 'rating': {
          const lw = estimateWidth(lab + ' :', fs) + 8;
          out.push(label(c, { x, y, w: lw + 10, h: u * 0.75 }, `${lab} :`, { size: fs, color: c.style.ink, weight: 700 }));
          const r = Math.min(u * 0.32, mm(3));
          for (let k = 0; k < 5; k++) out.push({ k: 'path', d: starPath(x + lw + r + k * r * 2.6, y + u * 0.5, r), stroke: c.style.ink, width: 0.75 });
          break;
        }
        case 'checks': {
          const lw = estimateWidth(lab + ' :', fs) + 8;
          out.push(label(c, { x, y, w: lw + 10, h: u * 0.75 }, `${lab} :`, { size: fs, color: c.style.ink, weight: 700 }));
          let ox = x + lw;
          const box = Math.min(u * 0.38, mm(3));
          for (const opt of String(f.options ?? '').split(/[|,]/).map((s) => s.trim()).filter(Boolean)) {
            out.push(rect({ x: ox, y: y + u * 0.5 - box / 2 - 1, w: box, h: box }, { stroke: c.style.ink, width: 0.75 }));
            const ow = estimateWidth(opt, fs) + 6;
            out.push(label(c, { x: ox + box + 3, y, w: ow + 4, h: u * 0.75 }, opt, { size: fs }));
            ox += box + ow + mm(4);
          }
          break;
        }
        default:
          out.push(...fieldLine(c, x, y + rh - u * 0.25, w, lab, fs));
      }
    });
    y += rh;
  });
}

const form: TemplateDef = {
  id: 'form',
  name: 'Fiche / formulaire',
  category: 'registre',
  description: 'Fiches à champs (mots de passe, recettes, dégustation, lecture, fiche salarié...). 1 à 4 fiches par page, onglets A-Z.',
  params: [
    { key: 'title', label: 'Titre de page', type: 'text', default: '' },
    { key: 'fields', label: 'Champs', type: 'fields', default: [
      { label: 'Nom', type: 'line' }, { label: 'Date', type: 'line', half: true }, { label: 'Lieu', type: 'line', half: true }, { label: 'Notes', type: 'lines', lines: 6 },
    ], defaultEn: [{ label: 'Name', type: 'line' }, { label: 'Date', type: 'line', half: true }, { label: 'Place', type: 'line', half: true }, { label: 'Notes', type: 'lines', lines: 6 }] },
    { key: 'perPage', label: 'Fiches par page', type: 'number', min: 1, max: 4, step: 1, default: 1 },
    { key: 'boxed', label: 'Encadrer chaque fiche', type: 'boolean', default: false },
    { key: 'alphabet', label: 'Onglet alphabétique (A-Z réparti sur la section)', type: 'boolean', default: false },
  ],
  render(c) {
    const out: Prim[] = [];
    let area = c.content;
    if (bool(c, 'alphabet')) {
      const s = mm(11);
      const x = c.isRecto ? area.x + area.w - s : area.x;
      out.push(rect({ x, y: area.y, w: s, h: s }, { fill: c.style.fillStrong, r: mm(2) }));
      out.push(text({ x, y: area.y, w: s, h: s }, letterFor(c), { font: c.style.font, size: 16, weight: 700, color: c.style.ink, align: 'center', valign: 'middle' }));
      if (!str(c, 'title').trim()) area = { ...area, y: area.y + s + mm(3), h: area.h - s - mm(3) };
    }
    area = pageTitle(c, out, str(c, 'title'), area);
    const n = Math.min(4, Math.max(1, Math.round(num(c, 'perPage', 1))));
    const gap = mm(5);
    const rh = (area.h - gap * (n - 1)) / n;
    const fields = arr<FieldDef>(c, 'fields');
    for (let i = 0; i < n; i++) {
      const r: Rect = { x: area.x, y: area.y + i * (rh + gap), w: area.w, h: rh };
      if (bool(c, 'boxed')) {
        out.push(rect(r, { stroke: c.style.ink, width: 1, r: mm(2.5) }));
        renderFields(c, inset(r, mm(3), mm(4)), fields, out);
      } else {
        renderFields(c, r, fields, out);
        if (i < n - 1) out.push(hline(c, area.x, area.x + area.w, r.y + rh + gap / 2, { color: c.style.ink, dash: [2, 3] }));
      }
    }
    return out;
  },
};

// ---------------------------------------------------------------- Organisation
const checklist: TemplateDef = {
  id: 'checklist',
  name: 'Checklist / bucket list',
  category: 'organisation',
  description: 'Liste de cases à cocher, numérotation continue sur toute la section (ex. « 100 choses à faire »).',
  params: [
    { key: 'title', label: 'Titre de page', type: 'text', default: '' },
    { key: 'spacing', label: 'Hauteur d\'un élément', type: 'number', min: 6, max: 20, step: 0.5, unit: 'mm', default: 9 },
    { key: 'numbered', label: 'Numérotation continue', type: 'boolean', default: true },
    { key: 'box', label: 'Case', type: 'select', default: 'square', options: [{ value: 'square', label: 'Carrée' }, { value: 'circle', label: 'Ronde' }] },
    { key: 'columns', label: 'Colonnes', type: 'select', default: '1', options: [{ value: '1', label: '1' }, { value: '2', label: '2' }] },
    { key: 'maxItems', label: 'Nombre max d\'éléments (0 = illimité)', type: 'number', min: 0, max: 1000, step: 1, default: 0 },
  ],
  render(c) {
    const out: Prim[] = [];
    const area = pageTitle(c, out, str(c, 'title'));
    const s = mm(num(c, 'spacing', 9));
    const cols = str(c, 'columns', '1') === '2' ? 2 : 1;
    const gap = mm(8);
    const cw = (area.w - gap * (cols - 1)) / cols;
    const perCol = Math.max(1, Math.floor(area.h / s));
    const perPage = perCol * cols;
    const max = num(c, 'maxItems', 0);
    const numbered = bool(c, 'numbered');
    const box = Math.min(s * 0.45, mm(4.2));
    for (let col = 0; col < cols; col++) {
      for (let i = 0; i < perCol; i++) {
        const n = c.sectionPage * perPage + col * perCol + i + 1;
        if (max > 0 && n > max) return out;
        const x = area.x + col * (cw + gap);
        const yBase = area.y + (i + 1) * s - s * 0.22;
        let ox = x;
        if (numbered) {
          out.push(text({ x, y: yBase - s * 0.7, w: mm(8), h: s * 0.7 }, String(n), { font: c.style.font, size: 8, color: c.style.muted, align: 'right', valign: 'bottom' }));
          ox += mm(10);
        }
        const by = yBase - box;
        if (str(c, 'box', 'square') === 'circle') out.push(circlePrim(ox + box / 2, by + box / 2, box / 2, { stroke: c.style.ink, width: 0.9 }));
        else out.push(rect({ x: ox, y: by, w: box, h: box }, { stroke: c.style.ink, width: 0.9, r: 1 }));
        out.push(hline(c, ox + box + mm(2.5), x + cw, yBase));
      }
    }
    return out;
  },
};

const weekly: TemplateDef = {
  id: 'weekly',
  name: 'Semainier',
  category: 'organisation',
  description: 'Une semaine par page (non daté) : carnet de liaison, planner, suivi d\'habitudes.',
  params: [
    { key: 'layout', label: 'Disposition', type: 'select', default: 'list', options: [{ value: 'list', label: '7 bandes empilées' }, { value: 'grid', label: 'Grille 2 colonnes + notes' }] },
    { key: 'lines', label: 'Lignes d\'écriture dans les cases', type: 'boolean', default: true },
    { key: 'notes', label: 'Case « Notes »', type: 'boolean', default: true },
  ],
  render(c) {
    const out: Prim[] = [];
    out.push(...fieldLine(c, c.content.x, c.content.y + mm(7), c.content.w * 0.6, t('weekOf', c.lang), 9));
    const area: Rect = { ...c.content, y: c.content.y + mm(11), h: c.content.h - mm(11) };
    const labels = [...DAYS[c.lang]];
    if (bool(c, 'notes')) labels.push(t('notes', c.lang));
    const boxes: Rect[] = [];
    const gap = mm(2.5);
    if (str(c, 'layout', 'list') === 'grid') {
      const rows = Math.ceil(labels.length / 2);
      const bw = (area.w - gap) / 2;
      const bh = (area.h - gap * (rows - 1)) / rows;
      labels.forEach((_, i) => boxes.push({ x: area.x + (i % 2) * (bw + gap), y: area.y + Math.floor(i / 2) * (bh + gap), w: bw, h: bh }));
    } else {
      const bh = (area.h - gap * (labels.length - 1)) / labels.length;
      labels.forEach((_, i) => boxes.push({ x: area.x, y: area.y + i * (bh + gap), w: area.w, h: bh }));
    }
    boxes.forEach((b, i) => {
      out.push(rect(b, { stroke: c.style.ink, width: 0.9, r: mm(1.5) }));
      out.push(rect({ x: b.x, y: b.y, w: b.w, h: mm(6) }, { fill: c.style.fill, r: mm(1.5) }));
      out.push(text({ x: b.x + mm(2), y: b.y, w: b.w - mm(4), h: mm(6) }, labels[i], { font: c.style.font, size: 8.5, weight: 700, color: c.style.ink, valign: 'middle' }));
      if (bool(c, 'lines')) for (let y = b.y + mm(6) + mm(6.5); y < b.y + b.h - mm(1.5); y += mm(6.5)) out.push(hline(c, b.x + mm(2), b.x + b.w - mm(2), y));
    });
    return out;
  },
};

const monthly: TemplateDef = {
  id: 'monthly',
  name: 'Calendrier mensuel',
  category: 'organisation',
  description: 'Mois non daté sur une page : budget planner, suivi mensuel, agenda perpétuel.',
  params: [{ key: 'notes', label: 'Zone de notes en bas', type: 'boolean', default: true }],
  render(c) {
    const out: Prim[] = [];
    const a = c.content;
    const half = a.w / 2 - mm(4);
    out.push(...fieldLine(c, a.x, a.y + mm(7), half, t('month', c.lang), 9));
    out.push(...fieldLine(c, a.x + a.w - half, a.y + mm(7), half, t('year', c.lang), 9));
    let top = a.y + mm(12);
    const notesH = bool(c, 'notes') ? a.h * 0.22 : 0;
    const dayH = mm(6);
    const cw = a.w / 7;
    DAYS[c.lang].forEach((d, i) => {
      out.push(rect({ x: a.x + i * cw, y: top, w: cw, h: dayH }, { fill: c.style.fillStrong }));
      out.push(text({ x: a.x + i * cw, y: top, w: cw, h: dayH }, d.slice(0, 3), { font: c.style.font, size: 8, weight: 700, color: c.style.ink, align: 'center', valign: 'middle' }));
    });
    top += dayH;
    const gh = a.y + a.h - notesH - top - (notesH ? mm(4) : 0);
    const rh = gh / 6;
    for (let r = 0; r <= 6; r++) out.push(hline(c, a.x, a.x + a.w, top + r * rh, { color: c.style.ink, width: 0.75 }));
    for (let i = 0; i <= 7; i++) out.push(vline(c, a.x + i * cw, top - dayH, top + gh, { color: c.style.ink, width: 0.75 }));
    if (notesH) {
      const ny = a.y + a.h - notesH;
      out.push(label(c, { x: a.x, y: ny, w: a.w, h: mm(5) }, t('notes', c.lang), { weight: 700, color: c.style.ink, valign: 'top' }));
      for (let y = ny + mm(5) + mm(7); y <= a.y + a.h; y += mm(7)) out.push(hline(c, a.x, a.x + a.w, y));
    }
    return out;
  },
};

const coupons: TemplateDef = {
  id: 'coupons',
  name: 'Bons / coupons à découper',
  category: 'creatif',
  description: 'Bons à découper (« bon pour », chèques cadeaux, love coupons) avec lignes de découpe en pointillés.',
  params: [
    { key: 'heading', label: 'Intitulé', type: 'text', default: 'BON POUR', defaultEn: 'THIS COUPON IS GOOD FOR' },
    { key: 'rows', label: 'Bons par colonne', type: 'number', min: 1, max: 6, step: 1, default: 4 },
    { key: 'cols', label: 'Colonnes', type: 'select', default: '1', options: [{ value: '1', label: '1' }, { value: '2', label: '2' }] },
    { key: 'fields', label: 'Lignes du bas (séparées par ;)', type: 'text', default: 'De la part de;Valable jusqu\'au', defaultEn: 'From;Valid until' },
    { key: 'numbered', label: 'Numéroter les bons', type: 'boolean', default: true },
  ],
  render(c) {
    const out: Prim[] = [];
    const a = c.content;
    const rows = Math.max(1, Math.round(num(c, 'rows', 4)));
    const cols = str(c, 'cols', '1') === '2' ? 2 : 1;
    const cw = a.w / cols;
    const rh = a.h / rows;
    const fields = str(c, 'fields').split(';').map((s) => s.trim()).filter(Boolean);
    // Lignes de découpe
    for (let i = 1; i < rows; i++) out.push(hline(c, a.x, a.x + a.w, a.y + i * rh, { dash: [4, 3], color: c.style.ink }));
    for (let j = 1; j < cols; j++) out.push(vline(c, a.x + j * cw, a.y, a.y + a.h, { dash: [4, 3], color: c.style.ink }));
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const r = inset({ x: a.x + j * cw, y: a.y + i * rh, w: cw, h: rh }, mm(3.5));
        out.push(rect(r, { stroke: c.style.ink, width: 1.2, r: mm(3) }));
        const inner = inset(r, mm(3), mm(4));
        const n = c.sectionPage * rows * cols + i * cols + j + 1;
        const headH = Math.min(mm(9), inner.h * 0.3);
        out.push(text({ x: inner.x, y: inner.y, w: inner.w, h: headH }, tokens(c, str(c, 'heading')), { font: c.style.font, size: 12, weight: 700, color: c.style.ink, align: 'center', valign: 'middle', letterSpacing: 1 }));
        if (bool(c, 'numbered')) out.push(text({ x: inner.x, y: inner.y, w: inner.w, h: mm(4) }, `N° ${n}`, { font: c.style.font, size: 7, color: c.style.muted, align: 'right', valign: 'top' }));
        const lines = Math.max(1, Math.floor((inner.h - headH - fields.length * mm(7)) / mm(7)));
        for (let k = 1; k <= lines; k++) out.push(hline(c, inner.x + mm(4), inner.x + inner.w - mm(4), inner.y + headH + k * mm(7) - mm(1)));
        fields.forEach((f, k) => out.push(...fieldLine(c, inner.x, inner.y + inner.h - (fields.length - 1 - k) * mm(7) - mm(1), inner.w, f, 8)));
      }
    }
    return out;
  },
};

// ---------------------------------------------------------------- Pages spéciales
const titlePage: TemplateDef = {
  id: 'title-page',
  name: 'Page « Ce carnet appartient à »',
  category: 'speciale',
  description: 'Page d\'ouverture avec titre et lignes de coordonnées.',
  params: [
    { key: 'heading', label: 'Titre', type: 'text', default: 'Ce carnet appartient à', defaultEn: 'This notebook belongs to' },
    { key: 'fields', label: 'Lignes (séparées par ;)', type: 'text', default: 'Nom;Téléphone;E-mail', defaultEn: 'Name;Phone;Email' },
    { key: 'footer', label: 'Texte en bas', type: 'text', default: '', help: 'Ex. « Si vous trouvez ce carnet, merci de me contacter »' },
    { key: 'frame', label: 'Cadre', type: 'select', default: 'double', options: [{ value: 'none', label: 'Aucun' }, { value: 'solid', label: 'Simple' }, { value: 'double', label: 'Double' }] },
    { key: 'headingFont', label: 'Police du titre', type: 'select', default: 'Playfair Display', options: [
      { value: 'Playfair Display', label: 'Playfair Display' }, { value: 'Dancing Script', label: 'Dancing Script' }, { value: 'Montserrat', label: 'Montserrat' }, { value: 'Caveat', label: 'Caveat' }, { value: 'Lora', label: 'Lora' },
    ] },
  ],
  render(c) {
    const out: Prim[] = [];
    const a = c.content;
    const frame = str(c, 'frame', 'double');
    if (frame !== 'none') {
      out.push(rect(a, { stroke: c.style.ink, width: 1.2 }));
      if (frame === 'double') out.push(rect(inset(a, mm(2.5)), { stroke: c.style.ink, width: 0.75 }));
    }
    const inner = inset(a, mm(14), mm(14));
    const hy = inner.y + inner.h * 0.18;
    out.push(text({ x: inner.x, y: hy, w: inner.w, h: mm(22) }, tokens(c, str(c, 'heading')), { font: str(c, 'headingFont', 'Playfair Display'), size: 22, weight: 700, color: c.style.ink, align: 'center', valign: 'middle' }));
    out.push(hline(c, inner.x + inner.w * 0.3, inner.x + inner.w * 0.7, hy + mm(26), { color: c.style.ink }));
    const fields = str(c, 'fields').split(';').map((s) => s.trim()).filter(Boolean);
    fields.forEach((f, i) => out.push(...fieldLine(c, inner.x, hy + mm(48) + i * mm(14), inner.w, f, 10)));
    const foot = str(c, 'footer');
    if (foot) out.push(text({ x: inner.x, y: inner.y + inner.h - mm(18), w: inner.w, h: mm(16) }, foot, { font: c.style.font, size: 9, italic: true, color: c.style.muted, align: 'center', valign: 'bottom' }));
    return out;
  },
};

export const TEMPLATES: TemplateDef[] = [titlePage, blank, lined, dotted, grid, seyes, handwriting, music, tablature, comic, coupons, table, form, checklist, weekly, monthly];

export const findTemplate = (id: string): TemplateDef => TEMPLATES.find((tpl) => tpl.id === id) ?? blank;

