import type { CoverDesign } from '../model';

export interface Palette {
  id: string;
  name: string;
  bg: string;
  bg2: string;
  /** Fond du bloc titre (étiquette, bandeau...) */
  block: string;
  /** Texte sur le bloc */
  ink: string;
  /** Texte / motif sur le fond */
  light: string;
}

export const PALETTES: Palette[] = [
  { id: 'navy', name: 'Bleu marine', bg: '#1f3a5f', bg2: '#3d6a9e', block: '#ffffff', ink: '#1f3a5f', light: '#ffffff' },
  { id: 'classic-blue', name: 'Bleu classique', bg: '#0f4c81', bg2: '#2a6fae', block: '#f4f1ea', ink: '#0f4c81', light: '#f4f1ea' },
  { id: 'sky', name: 'Bleu horizon', bg: '#8fb8de', bg2: '#c6dcef', block: '#ffffff', ink: '#2c4a6b', light: '#ffffff' },
  { id: 'burgundy', name: 'Rouge bordeaux', bg: '#6d1a2a', bg2: '#9b2c3e', block: '#f6efe4', ink: '#6d1a2a', light: '#f6efe4' },
  { id: 'forest', name: 'Vert sapin', bg: '#1e4d3a', bg2: '#2f7356', block: '#f2efe6', ink: '#1e4d3a', light: '#f2efe6' },
  { id: 'verdigris', name: 'Vert-de-gris', bg: '#43b3ae', bg2: '#7fd0cb', block: '#ffffff', ink: '#1d5c59', light: '#ffffff' },
  { id: 'old-pink', name: 'Vieux rose', bg: '#c08081', bg2: '#ddb0b0', block: '#fff8f5', ink: '#7a3f42', light: '#fff8f5' },
  { id: 'rose-gold', name: 'Rose or', bg: '#e8c4b8', bg2: '#f4ddd4', block: '#ffffff', ink: '#8a5a4a', light: '#8a5a4a' },
  { id: 'peach', name: 'Pêche', bg: '#ffbe98', bg2: '#ffd9c2', block: '#ffffff', ink: '#9a4f2a', light: '#ffffff' },
  { id: 'mustard', name: 'Moutarde', bg: '#d9a52b', bg2: '#ecc35c', block: '#2b2b2b', ink: '#f7e7b4', light: '#2b2b2b' },
  { id: 'terracotta', name: 'Terracotta', bg: '#b8573d', bg2: '#d27a5e', block: '#f8efe6', ink: '#7c321f', light: '#f8efe6' },
  { id: 'granite', name: 'Gris granit', bg: '#5b5f63', bg2: '#80858a', block: '#ffffff', ink: '#3a3d40', light: '#ffffff' },
  { id: 'black-gold', name: 'Noir & or', bg: '#151515', bg2: '#2c2c2c', block: '#c9a24a', ink: '#151515', light: '#d8b663' },
  { id: 'leather-brown', name: 'Cuir havane', bg: '#6b4226', bg2: '#8a5a36', block: '#e9d8b4', ink: '#4a2c17', light: '#e9d8b4' },
  { id: 'lavender', name: 'Lavande', bg: '#b9a6d6', bg2: '#d8ccec', block: '#ffffff', ink: '#4e3d78', light: '#ffffff' },
  { id: 'mint', name: 'Menthe', bg: '#a8dcc5', bg2: '#d2eee1', block: '#ffffff', ink: '#2f6b55', light: '#2f6b55' },
  { id: 'papyrus', name: 'Papyrus', bg: '#efe3c2', bg2: '#f7efdb', block: '#5a4a2f', ink: '#efe3c2', light: '#5a4a2f' },
  { id: 'kids', name: 'Arc-en-ciel enfant', bg: '#ffd23f', bg2: '#ff8fab', block: '#ffffff', ink: '#e8434f', light: '#ffffff' },
];

export function applyPalette(d: CoverDesign, p: Palette): CoverDesign {
  const onBlock = ['label', 'band', 'circle'].includes(d.titleBlock.style);
  return {
    ...d,
    background: { ...d.background, color: p.bg, color2: p.bg2 },
    pattern: { ...d.pattern, color: p.light },
    titleBlock: { ...d.titleBlock, fill: p.block, border: p.ink },
    title: { ...d.title, color: onBlock ? p.ink : p.light },
    subtitle: { ...d.subtitle, color: onBlock ? p.ink : p.light },
    author: { ...d.author, color: p.light },
    stitch: { ...d.stitch, color: p.light },
    spine: { ...d.spine, color: p.light },
    back: { ...d.back, color: p.light },
  };
}

export interface CoverStyle {
  id: string;
  name: string;
  description: string;
  palette: string;
  apply: (d: CoverDesign) => CoverDesign;
}

export const COVER_STYLES: CoverStyle[] = [
  {
    id: 'classic-label', name: 'Étiquette classique', description: 'Fond uni, étiquette centrale à coins arrondis.', palette: 'navy',
    apply: (d) => ({ ...d, background: { ...d.background, type: 'solid' }, pattern: { ...d.pattern, id: 'none' }, stitch: { ...d.stitch, show: false },
      titleBlock: { ...d.titleBlock, style: 'label', position: 0.34, width: 0.74 }, title: { ...d.title, font: 'Playfair Display', weight: 700, size: 30, uppercase: false } }),
  },
  {
    id: 'leather', name: 'Cuir surpiqué', description: 'Grain de cuir et surpiqûre : registres, livres de compte.', palette: 'leather-brown',
    apply: (d) => ({ ...d, background: { ...d.background, type: 'solid' }, pattern: { ...d.pattern, id: 'leather', opacity: 0.22, scale: 1 }, stitch: { ...d.stitch, show: true },
      titleBlock: { ...d.titleBlock, style: 'frame', position: 0.36, width: 0.72 }, title: { ...d.title, font: 'Playfair Display', weight: 700, size: 28, uppercase: true, letterSpacing: 1.5 } }),
  },
  {
    id: 'modern-band', name: 'Bandeau moderne', description: 'Bandeau horizontal clair, typo grasse en capitales.', palette: 'classic-blue',
    apply: (d) => ({ ...d, background: { ...d.background, type: 'solid' }, pattern: { ...d.pattern, id: 'none' }, stitch: { ...d.stitch, show: false },
      titleBlock: { ...d.titleBlock, style: 'band', position: 0.58 }, title: { ...d.title, font: 'Montserrat', weight: 800, size: 28, uppercase: true, letterSpacing: 1 } }),
  },
  {
    id: 'maze', name: 'Motif labyrinthe', description: 'Motif « labyrinthe » couvrant + étiquette.', palette: 'burgundy',
    apply: (d) => ({ ...d, background: { ...d.background, type: 'solid' }, pattern: { ...d.pattern, id: 'maze', opacity: 0.25, scale: 1, frontOnly: false },
      titleBlock: { ...d.titleBlock, style: 'label', position: 0.4, width: 0.76 }, title: { ...d.title, font: 'Montserrat', weight: 700, size: 26, uppercase: false } }),
  },
  {
    id: 'pastel', name: 'Pastel dégradé', description: 'Dégradé doux, titre manuscrit : bébé, couple, bien-être.', palette: 'rose-gold',
    apply: (d) => ({ ...d, background: { ...d.background, type: 'gradient', gradientAngle: 135 }, pattern: { ...d.pattern, id: 'none' }, stitch: { ...d.stitch, show: false },
      titleBlock: { ...d.titleBlock, style: 'plain', position: 0.4 }, title: { ...d.title, font: 'Dancing Script', weight: 700, size: 40, uppercase: false } }),
  },
  {
    id: 'minimal', name: 'Minimal typographique', description: 'Grand titre en capitales condensées, rien d\'autre.', palette: 'granite',
    apply: (d) => ({ ...d, background: { ...d.background, type: 'solid' }, pattern: { ...d.pattern, id: 'none' }, stitch: { ...d.stitch, show: false },
      titleBlock: { ...d.titleBlock, style: 'plain', position: 0.42 }, title: { ...d.title, font: 'Bebas Neue', weight: 400, size: 54, uppercase: true, letterSpacing: 2 } }),
  },
  {
    id: 'kids', name: 'Enfants confettis', description: 'Couleurs vives, confettis, médaillon rond.', palette: 'kids',
    apply: (d) => ({ ...d, background: { ...d.background, type: 'gradient', gradientAngle: 120 }, pattern: { ...d.pattern, id: 'confetti', opacity: 0.45, scale: 1 },
      titleBlock: { ...d.titleBlock, style: 'circle', position: 0.42, width: 0.78 }, title: { ...d.title, font: 'Pacifico', weight: 400, size: 30, uppercase: false } }),
  },
  {
    id: 'floral', name: 'Floral', description: 'Semis de fleurs et cadre fin : recettes, herbier, cadeau.', palette: 'papyrus',
    apply: (d) => ({ ...d, background: { ...d.background, type: 'solid' }, pattern: { ...d.pattern, id: 'floral', opacity: 0.2, scale: 1 },
      titleBlock: { ...d.titleBlock, style: 'label', position: 0.38, width: 0.72 }, title: { ...d.title, font: 'Playfair Display', weight: 700, size: 30, uppercase: false } }),
  },
  {
    id: 'geometric', name: 'Géométrique', description: 'Triangles colorés + bandeau.', palette: 'verdigris',
    apply: (d) => ({ ...d, background: { ...d.background, type: 'solid' }, pattern: { ...d.pattern, id: 'triangles', opacity: 0.3, scale: 1.4 },
      titleBlock: { ...d.titleBlock, style: 'band', position: 0.55 }, title: { ...d.title, font: 'Montserrat', weight: 700, size: 26, uppercase: true } }),
  },
  {
    id: 'register', name: 'Registre professionnel', description: 'Sobre et lisible : registres obligatoires, livres de caisse.', palette: 'black-gold',
    apply: (d) => ({ ...d, background: { ...d.background, type: 'solid' }, pattern: { ...d.pattern, id: 'none' }, stitch: { ...d.stitch, show: false },
      titleBlock: { ...d.titleBlock, style: 'frame', position: 0.4, width: 0.8 }, title: { ...d.title, font: 'Montserrat', weight: 700, size: 26, uppercase: true, letterSpacing: 1 } }),
  },
];

export function applyStyle(d: CoverDesign, styleId: string): CoverDesign {
  const s = COVER_STYLES.find((x) => x.id === styleId);
  if (!s) return d;
  const p = PALETTES.find((x) => x.id === s.palette) ?? PALETTES[0];
  return applyPalette(s.apply(d), p);
}
