// Polices libres (SIL OFL) fournies par les paquets @fontsource : embarquées dans les PDF (exigence KDP)
// et chargées par le navigateur pour l'aperçu, via la route /fonts du serveur.
export interface FontFamily {
  family: string;
  pkg: string;
  weights: number[];
  italic: boolean;
  kind: 'sans' | 'serif' | 'script' | 'display' | 'hand';
}

export const FONTS: FontFamily[] = [
  { family: 'Montserrat', pkg: 'montserrat', weights: [400, 600, 700, 800], italic: true, kind: 'sans' },
  { family: 'Open Sans', pkg: 'open-sans', weights: [400, 600, 700], italic: true, kind: 'sans' },
  { family: 'Playfair Display', pkg: 'playfair-display', weights: [400, 700, 900], italic: true, kind: 'serif' },
  { family: 'Lora', pkg: 'lora', weights: [400, 700], italic: true, kind: 'serif' },
  { family: 'Abril Fatface', pkg: 'abril-fatface', weights: [400], italic: false, kind: 'display' },
  { family: 'Bebas Neue', pkg: 'bebas-neue', weights: [400], italic: false, kind: 'display' },
  { family: 'Dancing Script', pkg: 'dancing-script', weights: [400, 700], italic: false, kind: 'script' },
  { family: 'Pacifico', pkg: 'pacifico', weights: [400], italic: false, kind: 'script' },
  { family: 'Caveat', pkg: 'caveat', weights: [400, 700], italic: false, kind: 'hand' },
];

export const DEFAULT_FONT = 'Montserrat';

export function findFont(family: string): FontFamily {
  return FONTS.find((f) => f.family === family) ?? FONTS[0];
}

export function resolveWeight(f: FontFamily, weight = 400): number {
  return f.weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), f.weights[0]);
}

/** Nom du fichier @fontsource (sous-ensemble latin : couvre le français, l'anglais, l'allemand, l'espagnol, l'italien). */
export function fontFile(family: string, weight = 400, italic = false, ext: 'woff' | 'woff2' = 'woff'): string {
  const f = findFont(family);
  const w = resolveWeight(f, weight);
  const style = italic && f.italic ? 'italic' : 'normal';
  return `${f.pkg}/${f.pkg}-latin-${w}-${style}.${ext}`;
}
