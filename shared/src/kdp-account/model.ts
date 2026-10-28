// Compte KDP : catalogue et ventes capturés depuis les pages KDP ouvertes par la personne (favori),
// et paquet de publication assistée. Aucune connexion au compte, aucun identifiant stocké.

export type KdpFormat = 'paperback' | 'hardcover' | 'ebook' | 'unknown';
export type KdpTitleStatus = 'live' | 'draft' | 'review' | 'publishing' | 'blocked' | 'unpublished' | 'unknown';

export const KDP_STATUS_LABELS: Record<KdpTitleStatus, string> = {
  live: 'En vente',
  draft: 'Brouillon',
  review: 'En cours de vérification',
  publishing: 'Publication en cours',
  blocked: 'Bloqué',
  unpublished: 'Non publié',
  unknown: 'Inconnu',
};

export const KDP_FORMAT_LABELS: Record<KdpFormat, string> = { paperback: 'Broché', hardcover: 'Relié', ebook: 'eBook Kindle', unknown: '?' };

export interface KdpTitle {
  /** Identifiant stable : ASIN/ISBN, sinon titre + format normalisés */
  id: string;
  asin: string | null;
  isbn: string | null;
  title: string;
  author: string | null;
  format: KdpFormat;
  status: KdpTitleStatus;
  price: number | null;
  currency: string | null;
  date: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  bookId: string | null;
  /** Place de marché principale (domaine, ex. « amazon.fr ») : celle qui vend le plus d'après les rapports */
  marketplace?: string | null;
}

export interface KdpSalesRow {
  title: string;
  asin: string | null;
  marketplace: string | null;
  format: KdpFormat;
  units: number;
  royalty: number | null;
  currency: string | null;
  kenp: number | null;
  // Champs des rapports KDP exportés (.xlsx) ; absents des captures de la page Rapports
  isbn?: string | null;
  author?: string | null;
  refunds?: number;
  /** Prix catalogue moyen hors taxes */
  listPrice?: number | null;
  /** Coût d'impression moyen */
  printCost?: number | null;
  /** Taux de redevance (0,5 ou 0,6 pour un livre imprimé) */
  rate?: number | null;
}

export interface KdpSalesSnapshot {
  id: string;
  capturedAt: string;
  /** Période affichée sur la page Rapports (texte libre, ex. « 1 sept. 2026 - 30 sept. 2026 ») */
  period: string;
  rows: KdpSalesRow[];
  /** Mois couvert (AAAA-MM), connu pour les rapports mensuels importés */
  month?: string | null;
  source?: 'capture' | 'rapport';
  file?: string;
}

/** Données lues par le favori sur une page kdp.amazon.com. */
export interface KdpRawCapture {
  v: 1;
  kind: 'kdp';
  url: string;
  host: string;
  lang: string;
  capturedAt: string;
  /** Texte visible de la page (tronqué) */
  text: string;
  /** Pour chaque identifiant ASIN/ISBN trouvé : textes de ses ancêtres successifs (du plus petit au plus grand) */
  ladders: { id: string; texts: string[] }[];
  /** Lignes de tableau (tr, [role=row]) qui contiennent un identifiant, cellules séparées par des tabulations */
  rows?: string[];
  /** Texte de la période sélectionnée (page Rapports) */
  period?: string;
}

export interface KdpCaptureLog {
  at: string;
  page: 'bookshelf' | 'reports' | 'autre';
  url: string;
  message: string;
  /** Texte brut conservé pour ajuster l'analyse si la page KDP change */
  text: string;
}

export interface KdpState {
  titles: KdpTitle[];
  snapshots: KdpSalesSnapshot[];
  captures: KdpCaptureLog[];
  publishing: { bookId: string; preparedAt: string } | null;
}

export const emptyKdpState = (): KdpState => ({ titles: [], snapshots: [], captures: [], publishing: null });

/** Données envoyées au favori pour remplir le formulaire de création KDP (le clic « Publier » reste manuel). */
export interface KdpFillPayload {
  bookId: string;
  language: string;
  languageLabel: string;
  marketplace: string;
  title: string;
  subtitle: string;
  authorFirst: string;
  authorLast: string;
  descriptionHtml: string;
  keywords: string[];
  categories: string[];
  lowContent: boolean;
  price: number;
  currency: string;
  print: { trim: string; ink: string; inkLabel: string; bleed: boolean; finish: 'matte' | 'glossy'; pages: number };
  aiGenerated: { text: boolean; images: boolean; translation: boolean };
  files: { interior: string; cover: string };
  blocking: string[];
}
