import type { PatternId } from '../model';
import type { Prim } from '../prims';
import type { Rect } from '../units';

export const PATTERNS: { id: PatternId; label: string }[] = [
  { id: 'none', label: 'Aucun' },
  { id: 'stripes', label: 'Rayures diagonales' },
  { id: 'dots', label: 'Pois' },
  { id: 'grid', label: 'Quadrillage' },
  { id: 'chevron', label: 'Chevrons' },
  { id: 'waves', label: 'Vagues' },
  { id: 'triangles', label: 'Triangles' },
  { id: 'maze', label: 'Labyrinthe' },
  { id: 'hexagons', label: 'Hexagones' },
  { id: 'confetti', label: 'Confettis' },
  { id: 'memphis', label: 'Memphis' },
  { id: 'floral', label: 'Floral' },
  { id: 'leather', label: 'Effet cuir (grain)' },
];

const f = (v: number) => v.toFixed(2);

/** Génère un motif vectoriel couvrant la zone r (à découper par un groupe avec clip). */
export function patternPrims(id: PatternId, r: Rect, color: string, scale: number, rng: () => number): Prim[] {
  const u = 26 * Math.max(0.3, scale);
  const out: Prim[] = [];
  const x1 = r.x + r.w;
  const y1 = r.y + r.h;
  switch (id) {
    case 'stripes': {
      let d = '';
      for (let o = -r.h; o < r.w + r.h; o += u) d += `M ${f(r.x + o)} ${f(y1)} L ${f(r.x + o + r.h)} ${f(r.y)} `;
      out.push({ k: 'path', d, stroke: color, width: u * 0.32 });
      break;
    }
    case 'dots': {
      for (let j = 0, y = r.y; y <= y1 + u; y += u * 0.866, j++)
        for (let x = r.x + (j % 2 ? u / 2 : 0); x <= x1 + u; x += u) out.push({ k: 'circle', cx: x, cy: y, r: u * 0.16, fill: color });
      break;
    }
    case 'grid': {
      let d = '';
      for (let x = r.x; x <= x1; x += u) d += `M ${f(x)} ${f(r.y)} L ${f(x)} ${f(y1)} `;
      for (let y = r.y; y <= y1; y += u) d += `M ${f(r.x)} ${f(y)} L ${f(x1)} ${f(y)} `;
      out.push({ k: 'path', d, stroke: color, width: Math.max(0.75, u * 0.05) });
      break;
    }
    case 'chevron': {
      let d = '';
      for (let y = r.y - u; y <= y1 + u; y += u * 0.7) {
        d += `M ${f(r.x - u)} ${f(y)} `;
        for (let x = r.x - u, k = 0; x <= x1 + u; x += u / 2, k++) d += `L ${f(x + u / 2)} ${f(y + (k % 2 === 0 ? -u * 0.3 : 0))} `;
      }
      out.push({ k: 'path', d, stroke: color, width: u * 0.14 });
      break;
    }
    case 'waves': {
      let d = '';
      for (let y = r.y; y <= y1 + u; y += u * 0.6) {
        d += `M ${f(r.x - u)} ${f(y)} `;
        for (let x = r.x - u; x <= x1 + u; x += u) d += `Q ${f(x + u / 4)} ${f(y - u * 0.22)} ${f(x + u / 2)} ${f(y)} T ${f(x + u)} ${f(y)} `;
      }
      out.push({ k: 'path', d, stroke: color, width: u * 0.08 });
      break;
    }
    case 'triangles': {
      const h = u * 0.866;
      for (let j = 0, y = r.y - h; y <= y1; y += h, j++) {
        for (let i = 0, x = r.x - u; x <= x1 + u; x += u / 2, i++) {
          if (rng() < 0.45) continue;
          const up = (i + j) % 2 === 0;
          const d = up ? `M ${f(x)} ${f(y + h)} L ${f(x + u / 2)} ${f(y)} L ${f(x + u)} ${f(y + h)} Z` : `M ${f(x)} ${f(y)} L ${f(x + u)} ${f(y)} L ${f(x + u / 2)} ${f(y + h)} Z`;
          out.push({ k: 'path', d, fill: color, opacity: 0.35 + rng() * 0.65 });
        }
      }
      break;
    }
    case 'maze': {
      const s = u * 0.7;
      let d = '';
      for (let y = r.y; y < y1; y += s)
        for (let x = r.x; x < x1; x += s) d += rng() < 0.5 ? `M ${f(x)} ${f(y)} L ${f(x + s)} ${f(y + s)} ` : `M ${f(x + s)} ${f(y)} L ${f(x)} ${f(y + s)} `;
      out.push({ k: 'path', d, stroke: color, width: s * 0.13 });
      break;
    }
    case 'hexagons': {
      const R = u * 0.6;
      const w = Math.sqrt(3) * R;
      let d = '';
      for (let j = 0, y = r.y; y <= y1 + R; y += R * 1.5, j++)
        for (let x = r.x + (j % 2 ? w / 2 : 0); x <= x1 + w; x += w) {
          const pts = Array.from({ length: 6 }, (_, k) => {
            const a = (Math.PI / 3) * k + Math.PI / 6;
            return `${f(x + R * Math.cos(a))} ${f(y + R * Math.sin(a))}`;
          });
          d += `M ${pts.join(' L ')} Z `;
        }
      out.push({ k: 'path', d, stroke: color, width: Math.max(0.75, u * 0.06) });
      break;
    }
    case 'confetti':
    case 'memphis': {
      const n = Math.round(((r.w * r.h) / (u * u)) * (id === 'confetti' ? 0.9 : 0.45));
      for (let i = 0; i < n; i++) {
        const x = r.x + rng() * r.w;
        const y = r.y + rng() * r.h;
        const s = u * (0.12 + rng() * 0.22);
        const kind = Math.floor(rng() * (id === 'confetti' ? 3 : 4));
        const outline = id === 'memphis';
        const paint = outline ? { stroke: color, width: Math.max(0.9, u * 0.07) } : { fill: color };
        if (kind === 0) out.push({ k: 'circle', cx: x, cy: y, r: s * 0.6, ...paint });
        else if (kind === 1) {
          const a = rng() * Math.PI;
          const dx = Math.cos(a) * s;
          const dy = Math.sin(a) * s;
          out.push({ k: 'path', d: `M ${f(x - dx)} ${f(y - dy)} L ${f(x + dx)} ${f(y + dy)}`, stroke: color, width: s * 0.45, ...(outline ? { width: Math.max(0.9, u * 0.07) } : {}) });
        } else if (kind === 2) out.push({ k: 'path', d: `M ${f(x)} ${f(y - s)} L ${f(x + s)} ${f(y + s * 0.7)} L ${f(x - s)} ${f(y + s * 0.7)} Z`, ...paint });
        else out.push({ k: 'path', d: `M ${f(x - s * 1.5)} ${f(y)} q ${f(s * 0.5)} ${f(-s)} ${f(s)} 0 t ${f(s)} 0 t ${f(s)} 0`, stroke: color, width: Math.max(0.9, u * 0.07) });
      }
      break;
    }
    case 'floral': {
      for (let j = 0, y = r.y; y <= y1 + u; y += u * 1.6, j++)
        for (let x = r.x + (j % 2 ? u * 0.8 : 0); x <= x1 + u; x += u * 1.6) {
          const cx = x + (rng() - 0.5) * u * 0.5;
          const cy = y + (rng() - 0.5) * u * 0.5;
          const pr = u * (0.18 + rng() * 0.1);
          const rot = rng() * Math.PI;
          for (let k = 0; k < 5; k++) {
            const a = rot + (k * 2 * Math.PI) / 5;
            out.push({ k: 'circle', cx: cx + Math.cos(a) * pr * 1.1, cy: cy + Math.sin(a) * pr * 1.1, r: pr, fill: color, opacity: 0.75 });
          }
          out.push({ k: 'circle', cx, cy, r: pr * 0.6, fill: color });
        }
      break;
    }
    case 'leather': {
      // Grain : nuée de petits points plus clairs/plus sombres (couleur du motif)
      const n = Math.min(9000, Math.round((r.w * r.h) / (40 / Math.max(0.3, scale))));
      for (let i = 0; i < n; i++) out.push({ k: 'circle', cx: r.x + rng() * r.w, cy: r.y + rng() * r.h, r: 0.35 + rng() * 0.9, fill: color, opacity: 0.25 + rng() * 0.75 });
      break;
    }
    default:
      break;
  }
  return out;
}
