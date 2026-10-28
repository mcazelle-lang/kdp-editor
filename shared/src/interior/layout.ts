import type { Book, Params, Section } from '../model';
import { interiorPageGeometry, type PageGeometry } from '../kdp/geometry';
import { group, line, rect, text, type Prim } from '../prims';
import { seeded } from '../rng';
import { defaultParams, type PageCtx, type PageStyle } from './kit';
import { findTemplate } from './templates';

export interface PageRef {
  pageNumber: number;
  sectionIndex: number;
  sectionPage: number;
  sectionPages: number;
  templateId: string;
  params: Params;
  /** Page blanche ajoutée pour obtenir un nombre de pages pair */
  padding?: boolean;
}

export function contentPages(book: Book): number {
  return book.interior.sections.reduce((s, sec) => s + Math.max(0, Math.round(sec.pages)), 0);
}

/** Nombre de pages final (KDP arrondit au nombre pair supérieur). */
export function totalPages(book: Book): number {
  const n = contentPages(book);
  return book.interior.padToEven && n % 2 === 1 ? n + 1 : n;
}

function resolveParams(book: Book, templateId: string, params: Params): Params {
  return { ...defaultParams(findTemplate(templateId), book.metadata.language), ...params };
}

export function expandPages(book: Book): PageRef[] {
  const out: PageRef[] = [];
  book.interior.sections.forEach((sec: Section, sectionIndex) => {
    const n = Math.max(0, Math.round(sec.pages));
    for (let i = 0; i < n; i++) {
      const pageNumber = out.length + 1;
      const useAlt = !!sec.alt && pageNumber % 2 === 0;
      const templateId = useAlt ? sec.alt!.templateId : sec.templateId;
      out.push({
        pageNumber,
        sectionIndex,
        sectionPage: i,
        sectionPages: n,
        templateId,
        params: resolveParams(book, templateId, useAlt ? sec.alt!.params : sec.params),
      });
    }
  });
  if (book.interior.padToEven && out.length % 2 === 1) {
    out.push({ pageNumber: out.length + 1, sectionIndex: -1, sectionPage: 0, sectionPages: 1, templateId: 'blank', params: {}, padding: true });
  }
  return out;
}

export function pageStyle(book: Book): PageStyle {
  return {
    line: book.interior.lineColor || '#8a8a8a',
    lineWidth: Math.max(0.75, book.interior.lineWidth || 0.75),
    font: book.interior.font || 'Open Sans',
    ink: '#2b2b2b',
    muted: '#555555',
    fill: '#e3e3e3',
    fillStrong: '#d0d0d0',
  };
}

export interface RenderedPage {
  geo: PageGeometry;
  prims: Prim[];
  ref: PageRef;
}

export function renderInteriorPage(book: Book, ref: PageRef, total: number, opts: { guides?: boolean } = {}): RenderedPage {
  const geo = interiorPageGeometry(book.format, book.interior, total, ref.pageNumber);
  const prims: Prim[] = [];
  if (!ref.padding) {
    const sec = book.interior.sections[ref.sectionIndex];
    const ctx: PageCtx = {
      content: geo.content,
      trim: geo.trim,
      page: geo.page,
      isRecto: geo.isRecto,
      pageNumber: ref.pageNumber,
      totalPages: total,
      sectionPage: ref.sectionPage,
      sectionPages: ref.sectionPages,
      params: ref.params,
      lang: book.metadata.language,
      style: pageStyle(book),
      rng: seeded(book.id, sec?.id ?? 'x', ref.sectionPage),
    };
    prims.push(...findTemplate(ref.templateId).render(ctx));
    if (book.interior.pageNumbers) {
      const contentBottom = geo.content.y + geo.content.h;
      const y = contentBottom + (geo.trim.y + geo.trim.h - contentBottom) / 2 - 6;
      prims.push(text({ x: geo.content.x, y, w: geo.content.w, h: 12 }, String(ref.pageNumber), {
        font: ctx.style.font, size: 8, color: ctx.style.muted, align: geo.isRecto ? 'right' : 'left', valign: 'middle',
      }));
    }
  }
  if (opts.guides) prims.push(interiorGuides(geo));
  return { geo, prims, ref };
}

function interiorGuides(geo: PageGeometry): Prim {
  const g: Prim[] = [];
  const { trim, page, content } = geo;
  if (trim.w < page.w || trim.h < page.h) {
    // Zone de fond perdu (coupée à l'impression)
    const zones = [
      { x: 0, y: 0, w: page.w, h: trim.y },
      { x: 0, y: trim.y + trim.h, w: page.w, h: page.h - trim.y - trim.h },
      geo.isRecto ? { x: trim.x + trim.w, y: 0, w: page.w - trim.w, h: page.h } : { x: 0, y: 0, w: trim.x, h: page.h },
    ];
    for (const z of zones) g.push(rect(z, { fill: '#ff4d4d', opacity: 0.12 }));
    g.push(rect(trim, { stroke: '#e03131', width: 0.6 }));
  }
  g.push(rect(content, { stroke: '#4c6ef5', width: 0.6, dash: [3, 3] }));
  const gx = geo.isRecto ? trim.x : trim.x + trim.w;
  g.push(line(gx, trim.y, gx, trim.y + trim.h, '#868e96', 2, { opacity: 0.6 }));
  return group(g, { guide: true });
}
