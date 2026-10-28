// Toutes les géométries sont exprimées en points PDF (1/72 de pouce), origine en haut à gauche.
export const PT_PER_IN = 72;
export const MM_PER_IN = 25.4;

export const inToPt = (inches: number) => inches * PT_PER_IN;
export const mmToPt = (mm: number) => (mm / MM_PER_IN) * PT_PER_IN;
export const ptToIn = (pt: number) => pt / PT_PER_IN;
export const ptToMm = (pt: number) => (pt / PT_PER_IN) * MM_PER_IN;
export const inToMm = (inches: number) => inches * MM_PER_IN;
export const inToCm = (inches: number) => (inches * MM_PER_IN) / 10;

export const round = (v: number, decimals = 3) => {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const inset = (r: Rect, top: number, right = top, bottom = top, left = right): Rect => ({
  x: r.x + left,
  y: r.y + top,
  w: Math.max(0, r.w - left - right),
  h: Math.max(0, r.h - top - bottom),
});

export const splitTop = (r: Rect, h: number): [Rect, Rect] => [
  { x: r.x, y: r.y, w: r.w, h },
  { x: r.x, y: r.y + h, w: r.w, h: Math.max(0, r.h - h) },
];
