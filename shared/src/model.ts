import type { Lang } from './i18n';

export type Binding = 'paperback' | 'hardcover';
export type InkPaper = 'bw-white' | 'bw-cream' | 'bw-groundwood' | 'std-color' | 'premium-color';
export type Finish = 'matte' | 'glossy';
export type BookStatus = 'idee' | 'en-cours' | 'pret' | 'publie';

export type ParamValue = string | number | boolean | unknown[] | Record<string, unknown>;
export type Params = Record<string, ParamValue>;

export interface Section {
  id: string;
  name?: string;
  templateId: string;
  pages: number;
  params: Params;
  /** Modèle alternatif appliqué aux pages de gauche (versos) : double page différenciée (herbier, bucket list...). */
  alt?: { templateId: string; params: Params } | null;
}

export interface BookFormat {
  binding: Binding;
  trimId: string;
  ink: InkPaper;
  bleed: boolean;
  finish: Finish;
  /** Épaisseur de dos saisie à la main (pouces), ex. valeur du calculateur KDP pour la reliure rigide. */
  spineOverride?: number | null;
  /** Dimensions totales de couverture lues dans le calculateur KDP (pouces) — recommandé pour la reliure rigide. */
  coverSizeOverride?: { w: number; h: number } | null;
}

export interface InteriorSettings {
  sections: Section[];
  /** Marges en pouces ; la marge intérieure est relevée automatiquement au minimum KDP. */
  margins: { top: number; bottom: number; outside: number; inside: number };
  lineColor: string;
  lineWidth: number;
  font: string;
  pageNumbers: boolean;
  /** Ajoute une page blanche si le total est impair. */
  padToEven: boolean;
}

export interface TextStyle {
  font: string;
  size: number;
  weight: number;
  italic?: boolean;
  color: string;
  uppercase?: boolean;
  letterSpacing?: number;
}

export type PatternId =
  | 'none' | 'stripes' | 'dots' | 'grid' | 'chevron' | 'waves' | 'triangles' | 'maze'
  | 'hexagons' | 'confetti' | 'leather' | 'floral' | 'memphis';

export interface CoverDesign {
  background: {
    type: 'solid' | 'gradient' | 'image';
    color: string;
    color2: string;
    gradientAngle: number;
    imageId?: string | null;
  };
  pattern: { id: PatternId; color: string; scale: number; opacity: number; frontOnly: boolean };
  frontImage: { imageId: string | null; x: number; y: number; w: number; h: number; fit: 'cover' | 'contain' };
  titleBlock: {
    style: 'plain' | 'label' | 'band' | 'frame' | 'circle';
    /** Position verticale du centre du bloc (0 = haut, 1 = bas) sur la 1re de couverture */
    position: number;
    fill: string;
    border: string;
    width: number;
  };
  /** Laisser vide = reprend le titre de la fiche KDP (KDP exige la correspondance). */
  texts: { title: string; subtitle: string; author: string; back: string };
  title: TextStyle;
  subtitle: TextStyle & { show: boolean };
  author: TextStyle & { show: boolean; position: 'top' | 'bottom' };
  stitch: { show: boolean; color: string };
  spine: { show: boolean; text: string; direction: 'top-bottom' | 'bottom-top'; color: string; background: string | null; size: number; font: string };
  back: TextStyle & { show: boolean; align: 'left' | 'center' };
  overlay: { imageId: string | null; opacity: number; show: boolean };
}

export interface ListingMetadata {
  language: Lang;
  marketplace: string;
  title: string;
  subtitle: string;
  author: string;
  publisher: string;
  series: string;
  seriesNumber: string;
  edition: string;
  descriptionHtml: string;
  keywords: string[];
  categories: string[];
  lowContent: boolean;
  aiGenerated: { text: boolean; images: boolean; translation: boolean };
  price: number;
  niche: string;
  audience: string;
  notes: string;
}

export interface Book {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: BookStatus;
  ideaId?: string | null;
  presetId?: string | null;
  metadata: ListingMetadata;
  format: BookFormat;
  interior: InteriorSettings;
  cover: CoverDesign;
  /** Lien avec le titre correspondant dans la Bibliothèque KDP (capturée) */
  kdp?: { titleId: string; asin: string | null; status: string; linkedAt: string; /** Fiche Amazon du livre */ url?: string | null } | null;
}

export interface Idea {
  id: string;
  source: { file: string; sheet: string; column: string };
  category: string;
  niche: string;
  language: string;
  titles: string[];
  subtitle: string;
  description: string;
  categories: string[];
  keywords: string[];
  translations: Record<string, string>;
  format: string;
  author: string;
  notes: string[];
  links: string[];
  importedAt: string;
}

export interface Asset {
  id: string;
  file: string;
  mime: string;
  width: number;
  height: number;
  originalName: string;
}

export const STATUS_LABELS: Record<BookStatus, string> = {
  idee: 'Idée',
  'en-cours': 'En cours',
  pret: 'Prêt à publier',
  publie: 'Publié',
};

export function defaultCover(): CoverDesign {
  return {
    background: { type: 'solid', color: '#1f3a5f', color2: '#3d6a9e', gradientAngle: 90, imageId: null },
    pattern: { id: 'none', color: '#ffffff', scale: 1, opacity: 0.18, frontOnly: false },
    frontImage: { imageId: null, x: 0.15, y: 0.42, w: 0.7, h: 0.4, fit: 'contain' },
    titleBlock: { style: 'label', position: 0.32, fill: '#ffffff', border: '#1f3a5f', width: 0.74 },
    texts: { title: '', subtitle: '', author: '', back: '' },
    title: { font: 'Playfair Display', size: 30, weight: 700, color: '#1f3a5f' },
    subtitle: { font: 'Montserrat', size: 11, weight: 400, color: '#1f3a5f', show: true },
    author: { font: 'Montserrat', size: 11, weight: 600, color: '#ffffff', show: true, position: 'bottom', letterSpacing: 1.5, uppercase: true },
    stitch: { show: false, color: '#ffffff' },
    spine: { show: true, text: '', direction: 'top-bottom', color: '#ffffff', background: null, size: 10, font: 'Montserrat' },
    back: { font: 'Open Sans', size: 10, weight: 400, color: '#ffffff', show: false, align: 'left' },
    overlay: { imageId: null, opacity: 0.5, show: true },
  };
}

export function defaultMetadata(lang: Lang = 'fr'): ListingMetadata {
  return {
    language: lang,
    marketplace: lang === 'en' ? 'amazon.com' : lang === 'de' ? 'amazon.de' : lang === 'es' ? 'amazon.es' : lang === 'it' ? 'amazon.it' : 'amazon.fr',
    title: '',
    subtitle: '',
    author: '',
    publisher: '',
    series: '',
    seriesNumber: '',
    edition: '',
    descriptionHtml: '',
    keywords: ['', '', '', '', '', '', ''],
    categories: ['', '', ''],
    lowContent: true,
    aiGenerated: { text: false, images: false, translation: false },
    price: 6.99,
    niche: '',
    audience: '',
    notes: '',
  };
}

export function defaultInterior(): InteriorSettings {
  return {
    sections: [],
    margins: { top: 0.5, bottom: 0.5, outside: 0.4, inside: 0.5 },
    lineColor: '#8a8a8a',
    lineWidth: 0.75,
    font: 'Open Sans',
    pageNumbers: false,
    padToEven: true,
  };
}

export function uid(prefix = ''): string {
  const c = globalThis.crypto;
  const id = c && 'randomUUID' in c ? c.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix + id.replace(/-/g, '').slice(0, 12);
}
