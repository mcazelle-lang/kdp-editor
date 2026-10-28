import type { Lang } from '../i18n';
import { t } from '../i18n';
import type { Params, ParamValue } from '../model';
import { line, text, type Prim, type TextPrim } from '../prims';
import { mmToPt, type Rect } from '../units';

export interface ColumnDef {
  label: string;
  width: number;
}

export type FieldType = 'line' | 'lines' | 'box' | 'rating' | 'checks';

export interface FieldDef {
  label: string;
  type: FieldType;
  lines?: number;
  options?: string;
  half?: boolean;
}

interface BaseParam {
  key: string;
  label: string;
  help?: string;
}

export type ParamDef =
  | (BaseParam & { type: 'number'; min?: number; max?: number; step?: number; unit?: string; default: number })
  | (BaseParam & { type: 'boolean'; default: boolean })
  | (BaseParam & { type: 'select'; options: { value: string; label: string }[]; default: string })
  | (BaseParam & { type: 'text'; default: string; defaultEn?: string; multiline?: boolean })
  | (BaseParam & { type: 'columns'; default: ColumnDef[]; defaultEn?: ColumnDef[] })
  | (BaseParam & { type: 'fields'; default: FieldDef[]; defaultEn?: FieldDef[] });

export type TemplateCategory = 'base' | 'ecriture' | 'registre' | 'creatif' | 'musique' | 'organisation' | 'speciale';

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  base: 'Pages de base',
  ecriture: 'Écriture',
  registre: 'Registres & tableaux',
  creatif: 'Créatif',
  musique: 'Musique',
  organisation: 'Organisation',
  speciale: 'Pages spéciales',
};

export interface PageStyle {
  line: string;
  lineWidth: number;
  font: string;
  ink: string;
  muted: string;
  fill: string;
  fillStrong: string;
}

export interface PageCtx {
  content: Rect;
  trim: Rect;
  page: Rect;
  isRecto: boolean;
  pageNumber: number;
  totalPages: number;
  sectionPage: number;
  sectionPages: number;
  params: Params;
  lang: Lang;
  style: PageStyle;
  rng: () => number;
}

export interface TemplateDef {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  params: ParamDef[];
  render(ctx: PageCtx): Prim[];
}

export function defaultParams(def: TemplateDef, lang: Lang): Params {
  const out: Params = {};
  for (const p of def.params) {
    const v = lang !== 'fr' && 'defaultEn' in p && p.defaultEn !== undefined ? p.defaultEn : p.default;
    out[p.key] = structuredClone(v) as ParamValue;
  }
  return out;
}

export const num = (c: PageCtx, k: string, d = 0): number => {
  const v = Number(c.params[k]);
  return Number.isFinite(v) ? v : d;
};
export const bool = (c: PageCtx, k: string): boolean => c.params[k] === true || c.params[k] === 'true';
export const str = (c: PageCtx, k: string, d = ''): string => (typeof c.params[k] === 'string' ? (c.params[k] as string) : d);
export const arr = <T>(c: PageCtx, k: string): T[] => (Array.isArray(c.params[k]) ? (c.params[k] as T[]) : []);
export const mm = mmToPt;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function letterFor(c: PageCtx): string {
  return ALPHABET[Math.min(25, Math.floor((c.sectionPage * 26) / Math.max(1, c.sectionPages)))];
}

/** Remplace les jetons {n} (page dans la section), {page} (numéro global) et {letter}. */
export function tokens(c: PageCtx, s: string): string {
  return s
    .replace(/\{n\}/g, String(c.sectionPage + 1))
    .replace(/\{page\}/g, String(c.pageNumber))
    .replace(/\{letter\}/g, letterFor(c));
}

/** Estimation de la largeur d'un texte (les métriques exactes diffèrent entre navigateur et pdfkit). */
export function estimateWidth(s: string, size: number, factor = 0.47): number {
  return s.length * size * factor;
}

export function label(c: PageCtx, r: Rect, value: string, opts: Partial<TextPrim> = {}): TextPrim {
  return text(r, value, { font: c.style.font, size: 8.5, color: c.style.muted, valign: 'bottom', ...opts });
}

export function hline(c: PageCtx, x1: number, x2: number, y: number, extra: { dash?: [number, number]; color?: string; width?: number } = {}): Prim {
  return line(x1, y, x2, y, extra.color ?? c.style.line, Math.max(extra.width ?? c.style.lineWidth, 0.75), extra.dash ? { dash: extra.dash } : {});
}

export function vline(c: PageCtx, x: number, y1: number, y2: number, extra: { dash?: [number, number]; color?: string; width?: number } = {}): Prim {
  return line(x, y1, x, y2, extra.color ?? c.style.line, Math.max(extra.width ?? c.style.lineWidth, 0.75), extra.dash ? { dash: extra.dash } : {});
}

/** Champ « Libellé : ______ » sur une ligne. */
export function fieldLine(c: PageCtx, x: number, y: number, w: number, lab: string, size = 8.5): Prim[] {
  const lw = lab ? estimateWidth(lab + ' :', size) + 4 : 0;
  const out: Prim[] = [];
  if (lab) out.push(label(c, { x, y: y - size * 1.6, w: lw + 10, h: size * 1.5 }, `${lab} :`, { size }));
  out.push(hline(c, x + lw, x + w, y));
  return out;
}

export const HEADER_OPTIONS = [
  { value: 'none', label: 'Aucun' },
  { value: 'date', label: 'Date' },
  { value: 'title', label: 'Titre' },
  { value: 'title-date', label: 'Titre + date' },
];

export const headerParam = (def = 'none'): ParamDef => ({ key: 'header', label: 'En-tête', type: 'select', options: HEADER_OPTIONS, default: def });

/** Dessine l'en-tête de page choisi et renvoie la zone restante. */
export function header(c: PageCtx, out: Prim[], area: Rect = c.content): Rect {
  const mode = str(c, 'header', 'none');
  if (mode === 'none') return area;
  const h = mm(10);
  const y = area.y + h - mm(2);
  const dateLabel = t('date', c.lang);
  if (mode === 'date') {
    const w = area.w * 0.4;
    out.push(...fieldLine(c, area.x + area.w - w, y, w, dateLabel));
  } else if (mode === 'title') {
    out.push(...fieldLine(c, area.x, y, area.w, t('title', c.lang)));
  } else {
    const dw = area.w * 0.32;
    out.push(...fieldLine(c, area.x, y, area.w - dw - mm(6), t('title', c.lang)));
    out.push(...fieldLine(c, area.x + area.w - dw, y, dw, dateLabel));
  }
  return { x: area.x, y: area.y + h + mm(2), w: area.w, h: area.h - h - mm(2) };
}

/** Titre de page centré (ex. registre, recette). */
export function pageTitle(c: PageCtx, out: Prim[], value: string, area: Rect = c.content, size = 13): Rect {
  if (!value.trim()) return area;
  const h = size * 1.9;
  out.push(text({ x: area.x, y: area.y, w: area.w, h }, tokens(c, value), { font: c.style.font, size, weight: 700, color: c.style.ink, align: 'center', valign: 'middle' }));
  return { x: area.x, y: area.y + h + mm(1.5), w: area.w, h: area.h - h - mm(1.5) };
}

export function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}
