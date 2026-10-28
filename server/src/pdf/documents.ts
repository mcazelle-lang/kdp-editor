import PDFDocument from 'pdfkit';
import { expandPages, renderCover, renderCoverTemplate, renderInteriorPage, totalPages, type Book, type BookFormat } from '@shared';
import { renderPrims } from './render';

type Doc = PDFKit.PDFDocument;

const info = (book: Book, suffix: string) => ({
  Title: `${book.metadata.title || 'Sans titre'} — ${suffix}`,
  Author: book.metadata.author || '',
  Creator: 'Book Creator KDP',
  Producer: 'Book Creator KDP (pdfkit)',
});

/** PDF intérieur prêt pour KDP : pages simples, polices embarquées, format = coupe (+ fond perdu). */
export function buildInteriorPdf(book: Book, opts: { guides?: boolean; from?: number; to?: number } = {}): Doc {
  const pages = expandPages(book);
  const total = totalPages(book);
  const doc = new PDFDocument({ autoFirstPage: false, margin: 0, info: info(book, 'intérieur'), compress: true });
  const from = Math.max(1, opts.from ?? 1);
  const to = Math.min(pages.length, opts.to ?? pages.length);
  for (const ref of pages.slice(from - 1, to)) {
    const r = renderInteriorPage(book, ref, total, { guides: opts.guides });
    doc.addPage({ size: [r.geo.width, r.geo.height], margin: 0 });
    renderPrims(doc, r.prims, { guides: opts.guides });
  }
  doc.end();
  return doc;
}

/** Couverture complète (4e + dos + 1re) en une seule page. */
export function buildCoverPdf(book: Book, opts: { guides?: boolean } = {}): Doc {
  const pages = totalPages(book);
  const r = renderCover(book, pages, { guides: opts.guides, overlay: opts.guides });
  const doc = new PDFDocument({ autoFirstPage: false, margin: 0, info: info(book, 'couverture'), compress: true });
  doc.addPage({ size: [r.geo.width, r.geo.height], margin: 0 });
  renderPrims(doc, r.prims, { guides: opts.guides });
  doc.end();
  return doc;
}

export function buildCoverTemplatePdf(format: BookFormat, pages: number): Doc {
  const r = renderCoverTemplate(format, pages);
  const doc = new PDFDocument({ autoFirstPage: false, margin: 0, info: { Title: `Gabarit couverture ${format.trimId} ${pages} p.`, Creator: 'Book Creator KDP' } });
  doc.addPage({ size: [r.geo.width, r.geo.height], margin: 0 });
  renderPrims(doc, r.prims, { guides: true });
  doc.end();
  return doc;
}
