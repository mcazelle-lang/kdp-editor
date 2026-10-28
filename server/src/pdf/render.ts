import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import type PDFKit from 'pdfkit';
import { findFont, fontFile, type Fill, type Prim, type TextPrim } from '@shared';
import { FONTSOURCE_DIR, UPLOADS_DIR } from '../config';

type Doc = PDFKit.PDFDocument;

const registered = new WeakMap<Doc, Set<string>>();

/** Enregistre (une seule fois par document) et sélectionne une police embarquée. */
export function useFont(doc: Doc, family: string, weight = 400, italic = false): string {
  const file = fontFile(family, weight, italic);
  const [pkg, name] = file.split('/');
  const key = name.replace(/\.woff$/, '');
  let set = registered.get(doc);
  if (!set) registered.set(doc, (set = new Set()));
  if (!set.has(key)) {
    const path = join(FONTSOURCE_DIR, pkg, 'files', name);
    if (!existsSync(path)) throw new Error(`Police introuvable : ${path}`);
    doc.registerFont(key, path);
    set.add(key);
  }
  doc.font(key);
  return key;
}

export function assetPath(id: string): string {
  return join(UPLOADS_DIR, basename(id));
}

function toFill(doc: Doc, fill: Fill, bounds: { x: number; y: number; w: number; h: number }): string | PDFKit.PDFGradient {
  if (typeof fill === 'string') return fill;
  const a = (fill.angle * Math.PI) / 180;
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  const hx = (Math.cos(a) * bounds.w) / 2;
  const hy = (Math.sin(a) * bounds.h) / 2;
  const g = doc.linearGradient(cx - hx, cy - hy, cx + hx, cy + hy);
  for (const s of fill.stops) g.stop(s.offset, s.color);
  return g;
}

// L'opacité n'est écrite que si elle est < 1 : les intérieurs restent sans transparence (exigence KDP).
function paint(doc: Doc, p: { fill?: Fill; stroke?: string; width?: number; dash?: [number, number]; opacity?: number }, bounds: { x: number; y: number; w: number; h: number }, op: number) {
  const o = (p.opacity ?? 1) * op;
  if (p.stroke) {
    doc.lineWidth(p.width ?? 1).strokeColor(p.stroke);
    if (o < 1) doc.strokeOpacity(o);
    if (p.dash) doc.dash(p.dash[0], { space: p.dash[1] });
  }
  if (p.fill) {
    const f = toFill(doc, p.fill, bounds);
    if (o < 1) doc.fillOpacity(o);
    if (p.stroke) doc.fillAndStroke(f as never, p.stroke);
    else doc.fill(f as never);
  } else if (p.stroke) {
    doc.stroke();
  }
}

function drawText(doc: Doc, t: TextPrim, op: number) {
  if (!t.text) return;
  const f = findFont(t.font);
  useFont(doc, f.family, t.weight ?? 400, !!t.italic);
  doc.fontSize(t.size);
  const value = t.uppercase ? t.text.toUpperCase() : t.text;
  const lh = t.lineHeight ?? 1.2;
  const lineGap = lh * t.size - doc.currentLineHeight(true);
  const base = { width: Math.max(1, t.w), align: t.align ?? 'left', lineGap, characterSpacing: t.letterSpacing ?? 0, lineBreak: true } as const;
  const h = doc.heightOfString(value, base);
  let y = t.y;
  if (t.valign === 'middle' || t.valign === undefined) y = t.y + (t.h - h) / 2 + Math.max(0, lineGap) / 2;
  if (t.valign === 'top') y = t.y;
  if (t.valign === 'bottom') y = t.y + t.h - h + Math.max(0, lineGap);
  // « height » empêche pdfkit d'ajouter une page si le texte déborde
  doc.fillColor(t.color);
  const o = (t.opacity ?? 1) * op;
  if (o < 1) doc.fillOpacity(o);
  doc.text(value, t.x, y, { ...base, height: h + t.size });
}

export function renderPrims(doc: Doc, prims: Prim[], opts: { guides?: boolean } = {}, op = 1) {
  for (const p of prims) {
    if (p.k === 'group') {
      if (p.guide && !opts.guides) continue;
      doc.save();
      if (p.clip) doc.rect(p.clip.x, p.clip.y, p.clip.w, p.clip.h).clip();
      if (p.rotate) doc.rotate(p.rotate.angle, { origin: [p.rotate.cx, p.rotate.cy] });
      renderPrims(doc, p.children, opts, op * (p.opacity ?? 1));
      doc.restore();
      continue;
    }
    doc.save();
    switch (p.k) {
      case 'line':
        doc.moveTo(p.x1, p.y1).lineTo(p.x2, p.y2).lineCap(p.cap ?? 'butt');
        paint(doc, { ...p, fill: undefined }, { x: p.x1, y: p.y1, w: p.x2 - p.x1, h: p.y2 - p.y1 }, op);
        break;
      case 'rect':
        if (p.r) doc.roundedRect(p.x, p.y, p.w, p.h, p.r);
        else doc.rect(p.x, p.y, p.w, p.h);
        paint(doc, p, p, op);
        break;
      case 'circle':
        doc.circle(p.cx, p.cy, p.r);
        paint(doc, p, { x: p.cx - p.r, y: p.cy - p.r, w: p.r * 2, h: p.r * 2 }, op);
        break;
      case 'path':
        doc.path(p.d).lineCap('round').lineJoin('round');
        paint(doc, p, { x: 0, y: 0, w: 1, h: 1 }, op);
        break;
      case 'text':
        drawText(doc, p, op);
        break;
      case 'image': {
        const file = assetPath(p.src);
        if (!existsSync(file)) break;
        if (p.fit === 'stretch') doc.image(file, p.x, p.y, { width: p.w, height: p.h });
        else if (p.fit === 'contain') doc.image(file, p.x, p.y, { fit: [p.w, p.h], align: 'center', valign: 'center' });
        else {
          doc.rect(p.x, p.y, p.w, p.h).clip();
          doc.image(file, p.x, p.y, { cover: [p.w, p.h], align: 'center', valign: 'center' });
        }
        break;
      }
    }
    doc.restore();
  }
}
