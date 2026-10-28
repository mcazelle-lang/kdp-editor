import type { Binding, InkPaper } from '../model';

// Spécifications KDP vérifiées sur kdp.amazon.com le 2026-10-14 (voir .claude/skills/kdp-mise-en-page/references/kdp-specs.md).
// Mettre à jour ce fichier si KDP change ses règles : toute l'app (aperçu, PDF, contrôles) en dépend.
export const SPECS_CHECKED_ON = '2026-10-14';

export interface InkInfo {
  id: InkPaper;
  label: string;
  /** Épaisseur de dos par page, en pouces */
  spinePerPage: number;
  color: boolean;
}

export const INKS: InkInfo[] = [
  { id: 'bw-white', label: 'Noir & blanc — papier blanc', spinePerPage: 0.002252, color: false },
  { id: 'bw-cream', label: 'Noir & blanc — papier crème', spinePerPage: 0.0025, color: false },
  { id: 'bw-groundwood', label: 'Noir & blanc — papier groundwood', spinePerPage: 0.00235, color: false },
  { id: 'std-color', label: 'Couleur standard — papier blanc', spinePerPage: 0.002252, color: true },
  { id: 'premium-color', label: 'Couleur premium — papier blanc', spinePerPage: 0.002347, color: true },
];

type Range = [number, number];
type PageRanges = Partial<Record<InkPaper, Range>>;

const R_STD: PageRanges = { 'bw-white': [24, 828], 'bw-cream': [24, 776], 'bw-groundwood': [24, 812], 'std-color': [72, 600], 'premium-color': [24, 828] };
const R_825: PageRanges = { 'bw-white': [24, 800], 'bw-cream': [24, 750], 'bw-groundwood': [24, 784], 'std-color': [72, 600], 'premium-color': [24, 800] };
const R_85: PageRanges = { 'bw-white': [24, 590], 'bw-cream': [24, 550], 'bw-groundwood': [24, 578], 'std-color': [72, 600], 'premium-color': [24, 590] };
const R_A4: PageRanges = { 'bw-white': [24, 780], 'bw-cream': [24, 730], 'bw-groundwood': [24, 764], 'premium-color': [24, 590] };
const R_HARD: PageRanges = { 'bw-white': [76, 550], 'bw-cream': [76, 550], 'premium-color': [76, 550] };

export interface TrimSize {
  id: string;
  label: string;
  /** Pouces */
  w: number;
  h: number;
  cm: string;
  large: boolean;
  bindings: Binding[];
  pages: PageRanges;
  hardcoverPages?: PageRanges;
  note?: string;
}

const trim = (w: number, h: number, pages: PageRanges, opts: Partial<TrimSize> = {}): TrimSize => ({
  id: `${w}x${h}`,
  label: `${w} × ${h} in`,
  w,
  h,
  cm: `${(w * 2.54).toFixed(2).replace(/\.?0+$/, '')} × ${(h * 2.54).toFixed(2).replace(/\.?0+$/, '')} cm`,
  large: w > 6.12 || h > 9,
  bindings: ['paperback'],
  pages,
  ...opts,
});

const HARD: Partial<TrimSize> = { bindings: ['paperback', 'hardcover'], hardcoverPages: R_HARD };

export const TRIM_SIZES: TrimSize[] = [
  trim(5, 8, R_STD, { note: 'Roman de poche, carnet compact' }),
  trim(5.06, 7.81, R_STD),
  trim(5.25, 8, R_STD),
  trim(5.5, 8.5, R_STD, { ...HARD, note: '≈ A5 US — carnets, journaux' }),
  trim(6, 9, R_STD, { ...HARD, note: 'Le plus courant pour les journaux et carnets lignés' }),
  trim(6.14, 9.21, R_STD, HARD),
  trim(6.69, 9.61, R_STD),
  trim(7, 10, R_STD, { ...HARD, note: 'Bucket lists, journaux de couple' }),
  trim(7.44, 9.69, R_STD),
  trim(7.5, 9.25, R_STD, { note: 'Composition notebook, cahiers d\'écriture' }),
  trim(8, 10, R_STD, { note: 'Livres de coloriage, cahiers enfants' }),
  trim(8.25, 6, R_825, { note: 'Paysage — partitions, BD à l\'italienne' }),
  trim(8.25, 8.25, R_825, { note: 'Carré — livres photo, enfants' }),
  trim(8.5, 8.5, R_85, { note: 'Carré grand format' }),
  trim(8.5, 11, R_85, { note: 'Letter — registres, BD vierges, sketchbooks' }),
  { ...trim(8.27, 11.69, R_A4, { note: 'A4 — registres FR, cahiers de musique (pas de couleur standard)' }), id: 'a4', label: 'A4 (8.27 × 11.69 in)', cm: '21 × 29.7 cm' },
  trim(8.25, 11, { 'bw-white': [76, 550], 'bw-cream': [76, 550], 'premium-color': [76, 550] }, { bindings: ['hardcover'], hardcoverPages: R_HARD, note: 'Rigide uniquement' }),
];

export const findTrim = (id: string): TrimSize => TRIM_SIZES.find((t) => t.id === id) ?? TRIM_SIZES.find((t) => t.id === '6x9')!;
export const findInk = (id: InkPaper): InkInfo => INKS.find((i) => i.id === id) ?? INKS[0];

export function pageRange(trimId: string, ink: InkPaper, binding: Binding): Range | null {
  const t = findTrim(trimId);
  const ranges = binding === 'hardcover' ? t.hardcoverPages : t.pages;
  return ranges?.[ink] ?? null;
}

// --- Intérieur ---
export const INTERIOR = {
  bleed: 0.125,
  minOutsideNoBleed: 0.25,
  minOutsideBleed: 0.375,
  minLineWeightPt: 0.75,
  minFontSizePt: 7,
  minGrayPercent: 10,
  minDpi: 300,
  gutter: [
    { max: 150, inside: 0.375 },
    { max: 300, inside: 0.5 },
    { max: 500, inside: 0.625 },
    { max: 700, inside: 0.75 },
    { max: 828, inside: 0.875 },
  ],
};

export function minGutter(pages: number): number {
  return (INTERIOR.gutter.find((g) => pages <= g.max) ?? INTERIOR.gutter[INTERIOR.gutter.length - 1]).inside;
}

// --- Couverture ---
export const COVER = {
  bleed: 0.125,
  /** Zone de sécurité recommandée pour le texte, depuis le bord de coupe */
  safe: 0.25,
  /** Distance minimale imposée par KDP entre le texte et la coupe */
  safeHard: 0.125,
  spineTextMinPages: 80,
  spineMargin: 0.0625,
  barcode: { w: 2, h: 1.2, fromSpine: 0.25, fromBottom: 0.25 },
  hardcover: {
    wrap: 0.51,
    hinge: 0.4,
    safe: 0.635,
    barcodeFromBottom: 0.76,
    /** KDP ne publie pas de formule : estimation à remplacer par la valeur du calculateur officiel */
    spineEstimate: (pages: number, perPage: number) => pages * perPage + 0.06,
  },
  maxPdfMb: 650,
  calculatorUrl: 'https://kdp.amazon.com/cover-calculator',
};

// --- Métadonnées de la fiche produit ---
export const LISTING = {
  titleSubtitleMax: 200,
  keywordSlots: 7,
  keywordMax: 50,
  descriptionMax: 4000,
  categoriesMax: 3,
  allowedHtmlTags: ['br', 'p', 'b', 'em', 'i', 'u', 'h4', 'h5', 'h6', 'ol', 'ul', 'li'],
  /** Limite de création de titres (non confirmée sur une page d'aide officielle au 2026-10-14) */
  weeklyTitleLimit: 2,
};

/** Livre imprimé déjà publié : ce qui se modifie et ce qui exige une nouvelle édition (aide KDP G201743310). */
export const PUBLISHED_PRINT_EDITS = {
  /** Titre, sous-titre et auteur principal : modifiables seulement dans ce délai après la publication */
  identityLockHours: 72,
  editable: ['prix', 'description', 'mots-clés', 'catégories', 'contributeurs', 'couverture', 'intérieur', 'Contenu A+'],
  newEdition: ['titre', 'sous-titre', 'auteur principal', 'format de coupe', 'ISBN'],
};

export const MARKETPLACES = [
  { id: 'amazon.fr', label: 'Amazon.fr', currency: 'EUR', vat: 0.055 },
  { id: 'amazon.com', label: 'Amazon.com', currency: 'USD', vat: 0 },
  { id: 'amazon.de', label: 'Amazon.de', currency: 'EUR', vat: 0.07 },
  { id: 'amazon.es', label: 'Amazon.es', currency: 'EUR', vat: 0.04 },
  { id: 'amazon.it', label: 'Amazon.it', currency: 'EUR', vat: 0.04 },
  { id: 'amazon.nl', label: 'Amazon.nl', currency: 'EUR', vat: 0.09 },
] as const;
