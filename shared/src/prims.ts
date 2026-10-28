import type { Rect } from './units';

// Primitives graphiques communes : rendues en SVG (aperçu Angular) et en PDF (pdfkit côté Node).
export interface GradientFill {
  type: 'linear';
  /** Angle en degrés : 0 = gauche→droite, 90 = haut→bas */
  angle: number;
  stops: { offset: number; color: string }[];
}

export type Fill = string | GradientFill;

interface Paint {
  fill?: Fill;
  stroke?: string;
  /** Épaisseur du trait en pt */
  width?: number;
  dash?: [number, number];
  opacity?: number;
}

export interface LinePrim extends Paint {
  k: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cap?: 'butt' | 'round';
}

export interface RectPrim extends Paint {
  k: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
}

export interface CirclePrim extends Paint {
  k: 'circle';
  cx: number;
  cy: number;
  r: number;
}

export interface PathPrim extends Paint {
  k: 'path';
  /** Données de chemin au format SVG (M, L, C, Q, Z...) */
  d: string;
}

export interface TextPrim {
  k: 'text';
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  font: string;
  weight?: number;
  italic?: boolean;
  size: number;
  color: string;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  lineHeight?: number;
  letterSpacing?: number;
  uppercase?: boolean;
  opacity?: number;
}

export interface ImagePrim {
  k: 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  /** Identifiant d'asset (fichier dans data/uploads) */
  src: string;
  fit?: 'cover' | 'contain' | 'stretch';
  opacity?: number;
}

export interface GroupPrim {
  k: 'group';
  children: Prim[];
  clip?: Rect;
  rotate?: { angle: number; cx: number; cy: number };
  opacity?: number;
  /** Les guides ne sont jamais exportés dans les PDF destinés à l'impression */
  guide?: boolean;
}

export type Prim = LinePrim | RectPrim | CirclePrim | PathPrim | TextPrim | ImagePrim | GroupPrim;

export const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, width = 0.5, extra: Partial<LinePrim> = {}): LinePrim => ({
  k: 'line', x1, y1, x2, y2, stroke, width, ...extra,
});

export const rect = (r: Rect, paint: Partial<RectPrim> = {}): RectPrim => ({ k: 'rect', ...r, ...paint });

export const text = (r: Rect, value: string, style: Omit<TextPrim, 'k' | 'x' | 'y' | 'w' | 'h' | 'text'>): TextPrim => ({
  k: 'text', ...r, text: value, ...style,
});

export const group = (children: Prim[], extra: Partial<GroupPrim> = {}): GroupPrim => ({ k: 'group', children, ...extra });

/** Retire récursivement les groupes marqués « guide ». */
export function stripGuides(prims: Prim[]): Prim[] {
  const out: Prim[] = [];
  for (const p of prims) {
    if (p.k === 'group') {
      if (p.guide) continue;
      out.push({ ...p, children: stripGuides(p.children) });
    } else {
      out.push(p);
    }
  }
  return out;
}
