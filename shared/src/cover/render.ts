import { mix } from '../color';
import { findFont } from '../fonts';
import { coverGeometry, type CoverGeometry } from '../kdp/geometry';
import { COVER } from '../kdp/specs';
import type { Book, BookFormat, TextStyle } from '../model';
import { group, line, rect, text, type Prim, type TextPrim } from '../prims';
import { seeded } from '../rng';
import { inToPt, round, type Rect } from '../units';
import { patternPrims } from './patterns';

export interface CoverTexts {
  title: string;
  subtitle: string;
  author: string;
  back: string;
  spine: string;
}

export function coverTexts(book: Book): CoverTexts {
  const c = book.cover;
  const m = book.metadata;
  const title = c.texts.title.trim() || m.title.trim() || 'Titre du carnet';
  const author = c.texts.author.trim() || m.author.trim();
  return {
    title,
    subtitle: c.texts.subtitle.trim() || m.subtitle.trim(),
    author,
    back: c.texts.back,
    spine: c.spine.text.trim() || [title, author].filter(Boolean).join('   •   '),
  };
}

const KIND_FACTOR: Record<string, number> = { sans: 0.57, serif: 0.55, display: 0.5, script: 0.47, hand: 0.44 };

/** Estimation du nombre de lignes d'un texte dans une largeur donnée. */
export function estimateLines(value: string, s: TextStyle, width: number): number {
  if (!value.trim()) return 0;
  const f = findFont(s.font);
  let factor = KIND_FACTOR[f.kind] ?? 0.55;
  if (f.family === 'Bebas Neue') factor = 0.4;
  if (s.uppercase) factor *= 1.15;
  const charW = s.size * factor + (s.letterSpacing ?? 0);
  const perLine = Math.max(1, Math.floor(width / charW));
  let lines = 0;
  for (const para of value.split('\n')) {
    let cur = 0;
    let n = 1;
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const len = word.length;
      if (cur === 0) cur = len;
      else if (cur + 1 + len <= perLine) cur += 1 + len;
      else {
        n++;
        cur = len;
      }
      while (cur > perLine) {
        n++;
        cur -= perLine;
      }
    }
    lines += n;
  }
  return lines;
}

const styleToText = (s: TextStyle, extra: Partial<TextPrim> = {}): Omit<TextPrim, 'k' | 'x' | 'y' | 'w' | 'h' | 'text'> => ({
  font: s.font, size: s.size, weight: s.weight, italic: s.italic, color: s.color, uppercase: s.uppercase, letterSpacing: s.letterSpacing, align: 'center', valign: 'middle', lineHeight: 1.15, ...extra,
});

function flattenOpacity(prims: Prim[], bg: string, op: number): Prim[] {
  return prims.map((p) => {
    if (p.k === 'group' || p.k === 'text' || p.k === 'image') return p;
    const o = (p.opacity ?? 1) * op;
    return { ...p, opacity: undefined, fill: typeof p.fill === 'string' ? mix(bg, p.fill, o) : p.fill, stroke: p.stroke ? mix(bg, p.stroke, o) : p.stroke };
  });
}

export interface RenderedCover {
  geo: CoverGeometry;
  prims: Prim[];
}

export function renderCover(book: Book, pages: number, opts: { guides?: boolean; overlay?: boolean } = {}): RenderedCover {
  const geo = coverGeometry(book.format, pages);
  const d = book.cover;
  const tx = coverTexts(book);
  const full: Rect = { x: 0, y: 0, w: geo.width, h: geo.height };
  const prims: Prim[] = [];

  // 1. Fond
  const bg = d.background;
  if (bg.type === 'image' && bg.imageId) {
    prims.push(rect(full, { fill: bg.color }));
    prims.push({ k: 'image', ...full, src: bg.imageId, fit: 'cover' });
  } else if (bg.type === 'gradient') {
    prims.push(rect(full, { fill: { type: 'linear', angle: bg.gradientAngle, stops: [{ offset: 0, color: bg.color }, { offset: 1, color: bg.color2 }] } }));
  } else {
    prims.push(rect(full, { fill: bg.color }));
  }

  // 2. Motif (aplati sur fond uni pour éviter la transparence dans le PDF)
  if (d.pattern.id !== 'none') {
    const region: Rect = d.pattern.frontOnly ? { x: geo.front.x, y: 0, w: geo.width - geo.front.x, h: geo.height } : full;
    const pp = patternPrims(d.pattern.id, region, d.pattern.color, d.pattern.scale, seeded(book.id, 'pattern', d.pattern.id));
    if (bg.type === 'solid') prims.push(group(flattenOpacity(pp, bg.color, d.pattern.opacity), { clip: region }));
    else prims.push(group(pp, { clip: region, opacity: d.pattern.opacity }));
  }

  // 3. Surpiqûre
  if (d.stitch.show) {
    const i = inToPt(geo.binding === 'hardcover' ? 0.45 : 0.3);
    for (const p of [geo.back, geo.front]) {
      prims.push(rect({ x: p.x + i, y: p.y + i, w: p.w - i * 2 - (geo.hinge && p === geo.back ? geo.hinge : 0), h: p.h - i * 2 }, { stroke: d.stitch.color, width: 1.3, dash: [6, 4], r: 6 }));
    }
  }

  // 4. Illustration de 1re de couverture
  const fi = d.frontImage;
  if (fi.imageId) {
    prims.push({ k: 'image', x: geo.front.x + fi.x * geo.front.w, y: geo.front.y + fi.y * geo.front.h, w: fi.w * geo.front.w, h: fi.h * geo.front.h, src: fi.imageId, fit: fi.fit });
  }

  // 5. Bloc titre
  const sf = geo.safeFront;
  const tb = d.titleBlock;
  const style = tb.style;
  const blockW = style === 'band' ? sf.w : Math.min(sf.w, tb.width * geo.front.w);
  const pad = style === 'plain' ? 0 : 16;
  let innerW = blockW - pad * 2;
  if (style === 'circle') innerW = blockW * 0.68;
  const tLines = estimateLines(tx.title, d.title, innerW);
  const titleH = tLines * d.title.size * 1.15;
  const showSub = d.subtitle.show && !!tx.subtitle;
  const subLines = showSub ? estimateLines(tx.subtitle, d.subtitle, innerW) : 0;
  const subH = subLines * d.subtitle.size * 1.3;
  const gap = showSub ? Math.max(6, d.subtitle.size * 0.7) : 0;
  const contentH = titleH + gap + subH;
  let blockH = contentH + pad * 2;
  if (style === 'circle') blockH = blockW;
  const cy = Math.min(Math.max(geo.front.y + tb.position * geo.front.h, sf.y + blockH / 2), sf.y + sf.h - blockH / 2);
  const bx = sf.x + (sf.w - blockW) / 2;
  const by = cy - blockH / 2;
  if (style === 'label') {
    prims.push(rect({ x: bx, y: by, w: blockW, h: blockH }, { fill: tb.fill, stroke: tb.border, width: 2, r: 10 }));
    prims.push(rect({ x: bx + 5, y: by + 5, w: blockW - 10, h: blockH - 10 }, { stroke: tb.border, width: 0.9, r: 7 }));
  } else if (style === 'band') {
    prims.push(rect({ x: geo.front.x, y: by, w: geo.width - geo.front.x, h: blockH }, { fill: tb.fill }));
  } else if (style === 'frame') {
    prims.push(rect({ x: bx, y: by, w: blockW, h: blockH }, { stroke: d.title.color, width: 1.6 }));
    prims.push(rect({ x: bx + 5, y: by + 5, w: blockW - 10, h: blockH - 10 }, { stroke: d.title.color, width: 0.8 }));
  } else if (style === 'circle') {
    prims.push({ k: 'circle', cx: bx + blockW / 2, cy, r: blockW / 2, fill: tb.fill, stroke: tb.border, width: 2 });
  }
  const textX = bx + (blockW - innerW) / 2;
  const textTop = cy - contentH / 2;
  prims.push(text({ x: textX, y: textTop, w: innerW, h: titleH }, tx.title, styleToText(d.title)));
  if (showSub) prims.push(text({ x: textX, y: textTop + titleH + gap, w: innerW, h: subH }, tx.subtitle, styleToText(d.subtitle, { lineHeight: 1.3 })));

  // 6. Auteur
  if (d.author.show && tx.author) {
    const h = d.author.size * 1.6;
    const y = d.author.position === 'bottom' ? sf.y + sf.h - h : sf.y;
    prims.push(text({ x: sf.x, y, w: sf.w, h }, tx.author, styleToText(d.author)));
  }

  // 7. Dos
  if (d.spine.background) prims.push(rect({ x: geo.spine.x, y: 0, w: geo.spine.w, h: geo.height }, { fill: d.spine.background }));
  if (d.spine.show && geo.spineTextAllowed && tx.spine) {
    const ss = geo.safeSpine;
    const cx = geo.spine.x + geo.spine.w / 2;
    const scy = geo.spine.y + geo.spine.h / 2;
    const size = Math.max(6, Math.min(d.spine.size, ss.w * 0.72));
    const L = ss.h;
    const T = ss.w;
    prims.push(group([
      text({ x: cx - L / 2, y: scy - T / 2, w: L, h: T }, tx.spine, { font: d.spine.font, size, weight: 600, color: d.spine.color, align: 'center', valign: 'middle', lineHeight: 1 }),
    ], { rotate: { angle: d.spine.direction === 'top-bottom' ? 90 : -90, cx, cy: scy } }));
  }

  // 8. 4e de couverture
  if (d.back.show && tx.back.trim()) {
    const sb = geo.safeBack;
    const top = sb.y + inToPt(0.25);
    prims.push(text({ x: sb.x + inToPt(0.1), y: top, w: sb.w - inToPt(0.2), h: geo.barcode.y - top - inToPt(0.3) }, tx.back, styleToText(d.back, { align: d.back.align, valign: 'top', lineHeight: 1.4 })));
  }

  // 9. Gabarit KDP importé (calque de contrôle, jamais imprimé)
  if (opts.overlay && d.overlay.show && d.overlay.imageId) {
    prims.push(group([{ k: 'image', ...full, src: d.overlay.imageId, fit: 'stretch', opacity: d.overlay.opacity }], { guide: true }));
  }

  if (opts.guides) prims.push(coverGuides(geo, true));
  return { geo, prims };
}

/** Repères de gabarit : fond perdu, coupe, dos, zones de sécurité, code-barres. */
export function coverGuides(geo: CoverGeometry, asGuide: boolean): Prim {
  const g: Prim[] = [];
  const red = '#e03131';
  const blue = '#4c6ef5';
  const b = geo.bleed;
  const trim: Rect = { x: b, y: b, w: geo.width - b * 2, h: geo.height - b * 2 };
  for (const z of [
    { x: 0, y: 0, w: geo.width, h: b },
    { x: 0, y: geo.height - b, w: geo.width, h: b },
    { x: 0, y: b, w: b, h: geo.height - b * 2 },
    { x: geo.width - b, y: b, w: b, h: geo.height - b * 2 },
  ]) g.push(rect(z, { fill: '#ff6b6b', opacity: 0.28 }));
  g.push(rect(trim, { stroke: red, width: 0.8 }));
  g.push(line(geo.spine.x, 0, geo.spine.x, geo.height, red, 0.8, { dash: [4, 3] }));
  g.push(line(geo.spine.x + geo.spine.w, 0, geo.spine.x + geo.spine.w, geo.height, red, 0.8, { dash: [4, 3] }));
  if (geo.hinge) {
    g.push(rect({ x: geo.spine.x - geo.hinge, y: b, w: geo.hinge, h: trim.h }, { fill: '#fab005', opacity: 0.25 }));
    g.push(rect({ x: geo.spine.x + geo.spine.w, y: b, w: geo.hinge, h: trim.h }, { fill: '#fab005', opacity: 0.25 }));
  }
  g.push(rect(geo.safeBack, { stroke: blue, width: 0.8, dash: [5, 3] }));
  g.push(rect(geo.safeFront, { stroke: blue, width: 0.8, dash: [5, 3] }));
  if (geo.spineTextAllowed && geo.safeSpine.w > 0) g.push(rect(geo.safeSpine, { stroke: blue, width: 0.6, dash: [3, 2] }));
  g.push(rect(geo.barcode, { fill: '#ffffff', opacity: 0.92, stroke: '#e8590c', width: 1 }));
  g.push(text(geo.barcode, `Zone code-barres KDP\n${COVER.barcode.w} × ${COVER.barcode.h} in`, { font: 'Montserrat', size: 8, weight: 600, color: '#e8590c', align: 'center', valign: 'middle' }));
  const lab = (r: Rect, s: string) => g.push(text({ x: r.x, y: r.y + 4, w: r.w, h: 14 }, s, { font: 'Montserrat', size: 8, weight: 700, color: red, align: 'center', valign: 'top' }));
  lab(geo.safeBack, '4e DE COUVERTURE');
  lab(geo.safeFront, '1re DE COUVERTURE');
  const cx = geo.spine.x + geo.spine.w / 2;
  const cy = geo.height / 2;
  g.push(group([
    text({ x: cx - 150, y: cy - 6, w: 300, h: 12 }, `DOS ${round(geo.spineIn, 3)} in${geo.spineTextAllowed ? '' : ' — pas de texte (< 80 p.)'}`, { font: 'Montserrat', size: 6.5, weight: 700, color: red, align: 'center', valign: 'middle' }),
  ], { rotate: { angle: 90, cx, cy } }));
  return group(g, { guide: asGuide });
}

/** Gabarit vierge téléchargeable (équivalent du modèle du calculateur KDP). */
export function renderCoverTemplate(format: BookFormat, pages: number): RenderedCover {
  const geo = coverGeometry(format, pages);
  const prims: Prim[] = [rect({ x: 0, y: 0, w: geo.width, h: geo.height }, { fill: '#ffffff' }), coverGuides(geo, false)];
  const info = [
    `Couverture complète : ${round(geo.widthIn, 3)} × ${round(geo.heightIn, 3)} in (${round(geo.widthIn * 25.4, 1)} × ${round(geo.heightIn * 25.4, 1)} mm)`,
    `${pages} pages · dos ${round(geo.spineIn, 4)} in · ${format.binding === 'hardcover' ? 'rabat' : 'fond perdu'} ${round(geo.bleed / 72, 3)} in`,
    geo.estimated ? 'ATTENTION : dimensions de couverture rigide estimées — vérifiez avec le calculateur KDP.' : 'Zone bleue = zone de sécurité du texte. Zone rouge = coupée au massicot.',
  ].join('\n');
  prims.push(text({ x: geo.safeBack.x, y: geo.safeBack.y + 30, w: geo.safeBack.w, h: 60 }, info, { font: 'Open Sans', size: 8, color: '#333333', align: 'left', valign: 'top', lineHeight: 1.4 }));
  return { geo, prims };
}
