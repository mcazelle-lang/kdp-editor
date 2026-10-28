import type { BookFormat, InteriorSettings } from '../model';
import { inToPt, type Rect } from '../units';
import { COVER, findInk, findTrim, INTERIOR, minGutter } from './specs';

export interface PageGeometry {
  width: number;
  height: number;
  page: Rect;
  trim: Rect;
  content: Rect;
  isRecto: boolean;
  margins: { top: number; bottom: number; inside: number; outside: number };
}

/** Géométrie d'une page intérieure (pt). Page 1 = belle page (recto, à droite). */
export function interiorPageGeometry(format: BookFormat, interior: InteriorSettings, totalPages: number, pageNumber: number): PageGeometry {
  const t = findTrim(format.trimId);
  const bleed = format.bleed ? INTERIOR.bleed : 0;
  const isRecto = pageNumber % 2 === 1;
  const minOut = format.bleed ? INTERIOR.minOutsideBleed : INTERIOR.minOutsideNoBleed;
  const m = interior.margins;
  const margins = {
    top: Math.max(m.top, minOut),
    bottom: Math.max(m.bottom, minOut),
    outside: Math.max(m.outside, minOut),
    inside: Math.max(m.inside, minGutter(totalPages)),
  };
  const width = inToPt(t.w + bleed);
  const height = inToPt(t.h + bleed * 2);
  // Le fond perdu n'existe que sur le bord extérieur : à droite pour un recto, à gauche pour un verso.
  const trim: Rect = { x: isRecto ? 0 : inToPt(bleed), y: inToPt(bleed), w: inToPt(t.w), h: inToPt(t.h) };
  const left = isRecto ? margins.inside : margins.outside;
  const right = isRecto ? margins.outside : margins.inside;
  const content: Rect = {
    x: trim.x + inToPt(left),
    y: trim.y + inToPt(margins.top),
    w: trim.w - inToPt(left + right),
    h: trim.h - inToPt(margins.top + margins.bottom),
  };
  return { width, height, page: { x: 0, y: 0, w: width, h: height }, trim, content, isRecto, margins };
}

export interface CoverGeometry {
  binding: BookFormat['binding'];
  pages: number;
  /** Dimensions en pouces (affichage) */
  widthIn: number;
  heightIn: number;
  spineIn: number;
  /** Dimensions en points */
  width: number;
  height: number;
  /** Fond perdu (broché) ou rabat (rigide), en points */
  bleed: number;
  back: Rect;
  spine: Rect;
  front: Rect;
  safeBack: Rect;
  safeFront: Rect;
  safeSpine: Rect;
  barcode: Rect;
  hinge: number;
  spineTextAllowed: boolean;
  /** Vrai si une partie des dimensions est estimée (rigide sans valeurs du calculateur KDP) */
  estimated: boolean;
}

export function spineWidthIn(format: BookFormat, pages: number): { value: number; estimated: boolean } {
  if (format.spineOverride && format.spineOverride > 0) return { value: format.spineOverride, estimated: false };
  const perPage = findInk(format.ink).spinePerPage;
  if (format.binding === 'hardcover') return { value: COVER.hardcover.spineEstimate(pages, perPage), estimated: true };
  return { value: pages * perPage, estimated: false };
}

export function coverGeometry(format: BookFormat, pages: number): CoverGeometry {
  const t = findTrim(format.trimId);
  const hard = format.binding === 'hardcover';
  let wrapIn = hard ? COVER.hardcover.wrap : COVER.bleed;
  let { value: spineIn, estimated } = spineWidthIn(format, pages);
  let widthIn = wrapIn * 2 + t.w * 2 + spineIn;
  let heightIn = t.h + wrapIn * 2;
  if (format.coverSizeOverride && format.coverSizeOverride.w > 0 && format.coverSizeOverride.h > 0) {
    widthIn = format.coverSizeOverride.w;
    heightIn = format.coverSizeOverride.h;
    wrapIn = (heightIn - t.h) / 2;
    spineIn = widthIn - wrapIn * 2 - t.w * 2;
    estimated = false;
  }
  const bleed = inToPt(wrapIn);
  const W = inToPt(t.w);
  const H = inToPt(t.h);
  const S = inToPt(spineIn);
  const hinge = hard ? inToPt(COVER.hardcover.hinge) : 0;
  const back: Rect = { x: bleed, y: bleed, w: W, h: H };
  const spine: Rect = { x: bleed + W, y: bleed, w: S, h: H };
  const front: Rect = { x: bleed + W + S, y: bleed, w: W, h: H };
  const safe = inToPt(COVER.safe);
  const safeBack: Rect = { x: back.x + safe, y: back.y + safe, w: W - safe * 2 - hinge, h: H - safe * 2 };
  const safeFront: Rect = { x: front.x + safe + hinge, y: front.y + safe, w: W - safe * 2 - hinge, h: H - safe * 2 };
  const sm = inToPt(COVER.spineMargin);
  const safeSpine: Rect = { x: spine.x + sm, y: spine.y + safe, w: Math.max(0, S - sm * 2), h: H - safe * 2 };
  const bc = COVER.barcode;
  const fromBottom = hard ? inToPt(COVER.hardcover.barcodeFromBottom) - bleed : inToPt(bc.fromBottom);
  const barcode: Rect = {
    x: back.x + W - hinge - inToPt(bc.fromSpine) - inToPt(bc.w),
    y: back.y + H - fromBottom - inToPt(bc.h),
    w: inToPt(bc.w),
    h: inToPt(bc.h),
  };
  return {
    binding: format.binding,
    pages,
    widthIn,
    heightIn,
    spineIn,
    width: inToPt(widthIn),
    height: inToPt(heightIn),
    bleed,
    back,
    spine,
    front,
    safeBack,
    safeFront,
    safeSpine,
    barcode,
    hinge,
    spineTextAllowed: pages >= COVER.spineTextMinPages,
    estimated: hard && estimated,
  };
}
