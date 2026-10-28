import type { Lang } from '../i18n';

// Marchés Amazon couverts par le radar de niches. Les paramètres d'autocomplétion ont été vérifiés le 15/10/2026
// (point d'accès public non documenté : mid + alias + prefix + limit + lop ; tout autre paramètre vide la réponse en Europe).
export type MarketId = 'amazon.fr' | 'amazon.com' | 'amazon.de' | 'amazon.es' | 'amazon.it';

export interface Market {
  id: MarketId;
  label: string;
  flag: string;
  host: string;
  completionHost: string;
  mid: string;
  lop: string;
  lang: Lang;
  currency: 'EUR' | 'USD';
}

export const MARKETS: Market[] = [
  { id: 'amazon.fr', label: 'Amazon.fr', flag: 'FR', host: 'www.amazon.fr', completionHost: 'completion.amazon.fr', mid: 'A13V1IB3VIYZZH', lop: 'fr_FR', lang: 'fr', currency: 'EUR' },
  { id: 'amazon.com', label: 'Amazon.com', flag: 'US', host: 'www.amazon.com', completionHost: 'completion.amazon.com', mid: 'ATVPDKIKX0DER', lop: 'en_US', lang: 'en', currency: 'USD' },
  { id: 'amazon.de', label: 'Amazon.de', flag: 'DE', host: 'www.amazon.de', completionHost: 'completion.amazon.de', mid: 'A1PA6795UKMFR9', lop: 'de_DE', lang: 'de', currency: 'EUR' },
  { id: 'amazon.es', label: 'Amazon.es', flag: 'ES', host: 'www.amazon.es', completionHost: 'completion.amazon.es', mid: 'A1RKKUPIHCS9HS', lop: 'es_ES', lang: 'es', currency: 'EUR' },
  { id: 'amazon.it', label: 'Amazon.it', flag: 'IT', host: 'www.amazon.it', completionHost: 'completion.amazon.it', mid: 'APJ6JRA9NG5V4', lop: 'it_IT', lang: 'it', currency: 'EUR' },
];

export const findMarket = (id: string): Market => MARKETS.find((m) => m.id === id) ?? MARKETS[0];

export const marketFromHost = (host: string): Market | null => MARKETS.find((m) => m.host === host.toLowerCase() || `www.${m.id}` === host.toLowerCase()) ?? null;

/** Recherche rayon Livres (stripbooks) */
export const amazonSearchUrl = (market: MarketId, keyword: string) => `https://${findMarket(market).host}/s?k=${encodeURIComponent(keyword)}&i=stripbooks`;

export const amazonProductUrl = (market: MarketId, asin: string) => `https://${findMarket(market).host}/dp/${asin}`;
