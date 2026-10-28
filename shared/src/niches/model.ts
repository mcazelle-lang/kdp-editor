import type { MarketId } from './markets';

export type NicheStatus = 'nouvelle' | 'a-analyser' | 'retenue' | 'ecartee' | 'en-production';
export type NicheSource = 'autocompletion' | 'agent' | 'capture' | 'manuel';

export const NICHE_STATUS_LABELS: Record<NicheStatus, string> = {
  nouvelle: 'Nouvelle',
  'a-analyser': 'À analyser',
  retenue: 'Retenue',
  ecartee: 'Écartée',
  'en-production': 'En production',
};

export interface SerpItem {
  asin: string;
  position: number;
  title: string;
  price: number | null;
  rating: number | null;
  reviews: number | null;
  sponsored: boolean;
  format: string | null;
  image: string | null;
}

export interface SerpCapture {
  capturedAt: string;
  url: string;
  totalResults: number | null;
  items: SerpItem[];
}

export interface ProductCapture {
  asin: string;
  capturedAt: string;
  title: string;
  bsr: number | null;
  bsrCategory: string | null;
  subRanks: { rank: number; category: string }[];
  price: number | null;
  rating: number | null;
  reviews: number | null;
  pages: number | null;
  publisher: string | null;
  publicationDate: string | null;
  dimensions: string | null;
}

export interface NicheReport {
  createdAt: string;
  model: string;
  verdict: 'go' | 'a-tester' | 'eviter';
  score: number;
  summary: string;
  demand: string;
  competition: string;
  angle: string;
  subNiches: string[];
  titleIdeas: string[];
  keywords: string[];
  presetId: string | null;
  price: number | null;
  seasonality: string;
  risks: string[];
  sources: { title: string; url: string }[];
}

export interface Niche {
  id: string;
  marketplace: MarketId;
  keyword: string;
  source: NicheSource;
  status: NicheStatus;
  createdAt: string;
  updatedAt: string;
  /** Meilleure position dans l'autocomplétion (1 = première suggestion) et nombre de préfixes où elle apparaît */
  autocomplete: { position: number; hits: number; seed: string; seenAt: string } | null;
  serp: SerpCapture | null;
  products: ProductCapture[];
  notes: string;
  tags: string[];
  report: NicheReport | null;
  bookIds: string[];
}

/** Données brutes envoyées par le favori « Capturer pour Book Creator » (lues dans la page Amazon ouverte). */
export interface RawCapture {
  v: 1;
  kind: 'serp' | 'product';
  url: string;
  host: string;
  lang: string;
  capturedAt: string;
  resultInfo?: string;
  cards?: { asin: string; text: string; title: string; labels: string[]; sponsored: boolean; img?: string }[];
  asin?: string;
  title?: string;
  details?: string;
  price?: string;
  rating?: string;
  reviews?: string;
}

export interface Suggestion {
  marketplace: MarketId;
  keyword: string;
  position: number;
  hits: number;
  seed: string;
}

// --- Agent de recherche de niches (flux SSE)
export interface NicheDiscoverRequest {
  theme: string;
  markets: MarketId[];
  maxSearches: number;
}

export interface NicheAnalyzeRequest {
  instruction: string;
  maxSearches: number;
}

export type NicheAgentEvent =
  | { type: 'status'; message: string }
  | { type: 'progress'; text: string }
  | { type: 'text'; delta: string }
  | { type: 'tool'; id: string; name: string; label: string }
  | { type: 'tool_result'; id: string; name: string; ok: boolean; message: string }
  | { type: 'search'; query: string }
  | { type: 'done'; summary: string; nicheIds: string[]; searches: number; usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; iterations: number } }
  | { type: 'error'; message: string };

export const normalizeKeyword = (k: string) => k.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();
