import type { Fill, Prim, TextPrim } from '../prims';

export interface SvgOptions {
  width: number;
  height: number;
  /** URL d'un asset image (côté client : /uploads/<id>) */
  resolveImage: (id: string) => string;
  idPrefix?: string;
  /** Classe CSS appliquée à la racine */
  className?: string;
  showGuides?: boolean;
  /** Cadrage (ex. 1re de couverture seule pour la vignette) */
  viewBox?: { x: number; y: number; w: number; h: number };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: number) => (Math.round(v * 100) / 100).toString();

/** Convertit les primitives en document SVG (unités = points PDF). */
export function primsToSvg(prims: Prim[], o: SvgOptions): string {
  let counter = 0;
  const prefix = o.idPrefix ?? 'p';
  const defs: string[] = [];
  const nextId = () => `${prefix}${counter++}`;

  const fillAttr = (f: Fill | undefined): string => {
    if (!f) return 'fill="none"';
    if (typeof f === 'string') return `fill="${esc(f)}"`;
    const id = nextId();
    const a = (f.angle * Math.PI) / 180;
    const x1 = 0.5 - Math.cos(a) / 2;
    const y1 = 0.5 - Math.sin(a) / 2;
    defs.push(`<linearGradient id="${id}" x1="${n(x1)}" y1="${n(y1)}" x2="${n(1 - x1)}" y2="${n(1 - y1)}">${f.stops.map((s) => `<stop offset="${s.offset}" stop-color="${esc(s.color)}"/>`).join('')}</linearGradient>`);
    return `fill="url(#${id})"`;
  };

  const strokeAttr = (p: { stroke?: string; width?: number; dash?: [number, number] }) =>
    p.stroke ? ` stroke="${esc(p.stroke)}" stroke-width="${n(p.width ?? 1)}"${p.dash ? ` stroke-dasharray="${p.dash.join(' ')}"` : ''}` : '';
  const op = (v?: number) => (v !== undefined && v < 1 ? ` opacity="${n(v)}"` : '');

  const textSvg = (t: TextPrim): string => {
    const justify = t.valign === 'top' ? 'flex-start' : t.valign === 'bottom' ? 'flex-end' : 'center';
    const style = [
      'width:100%', 'height:100%', 'display:flex', 'flex-direction:column', `justify-content:${justify}`, 'margin:0', 'padding:0', 'box-sizing:border-box',
      `font-family:'${t.font}'`, `font-size:${n(t.size)}px`, `font-weight:${t.weight ?? 400}`, `font-style:${t.italic ? 'italic' : 'normal'}`,
      `color:${t.color}`, `text-align:${t.align ?? 'left'}`, `line-height:${t.lineHeight ?? 1.2}`, 'white-space:pre-line', 'overflow-wrap:break-word',
      t.letterSpacing ? `letter-spacing:${n(t.letterSpacing)}px` : '', t.uppercase ? 'text-transform:uppercase' : '',
    ].filter(Boolean).join(';');
    return `<foreignObject x="${n(t.x)}" y="${n(t.y)}" width="${n(Math.max(1, t.w))}" height="${n(Math.max(1, t.h))}"${op(t.opacity)}><div xmlns="http://www.w3.org/1999/xhtml" style="${esc(style)}"><span>${esc(t.text)}</span></div></foreignObject>`;
  };

  const render = (p: Prim): string => {
    switch (p.k) {
      case 'line':
        return `<line x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(p.x2)}" y2="${n(p.y2)}"${strokeAttr(p)}${p.cap ? ` stroke-linecap="${p.cap}"` : ''}${op(p.opacity)}/>`;
      case 'rect':
        return `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}"${p.r ? ` rx="${n(p.r)}"` : ''} ${fillAttr(p.fill)}${strokeAttr(p)}${op(p.opacity)}/>`;
      case 'circle':
        return `<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.r)}" ${fillAttr(p.fill)}${strokeAttr(p)}${op(p.opacity)}/>`;
      case 'path':
        return `<path d="${esc(p.d)}" ${fillAttr(p.fill)}${strokeAttr(p)} stroke-linecap="round" stroke-linejoin="round"${op(p.opacity)}/>`;
      case 'text':
        return textSvg(p);
      case 'image': {
        const par = p.fit === 'stretch' ? 'none' : p.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice';
        return `<image href="${esc(o.resolveImage(p.src))}" x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}" preserveAspectRatio="${par}"${op(p.opacity)}/>`;
      }
      case 'group': {
        if (p.guide && o.showGuides === false) return '';
        let attrs = '';
        if (p.clip) {
          const id = nextId();
          defs.push(`<clipPath id="${id}"><rect x="${n(p.clip.x)}" y="${n(p.clip.y)}" width="${n(p.clip.w)}" height="${n(p.clip.h)}"/></clipPath>`);
          attrs += ` clip-path="url(#${id})"`;
        }
        if (p.rotate) attrs += ` transform="rotate(${p.rotate.angle} ${n(p.rotate.cx)} ${n(p.rotate.cy)})"`;
        attrs += op(p.opacity);
        if (p.guide) attrs += ' class="guide"';
        return `<g${attrs}>${p.children.map(render).join('')}</g>`;
      }
    }
  };

  const body = prims.map(render).join('');
  const vb = o.viewBox ?? { x: 0, y: 0, w: o.width, h: o.height };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(vb.x)} ${n(vb.y)} ${n(vb.w)} ${n(vb.h)}"${o.className ? ` class="${o.className}"` : ''} preserveAspectRatio="xMidYMid meet"><defs>${defs.join('')}</defs>${body}</svg>`;
}
