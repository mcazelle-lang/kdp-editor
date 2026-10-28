import type { InkPaper } from '../model';
import { findTrim, MARKETPLACES } from './specs';

// Coûts d'impression KDP broché (fixe + coût par page), relevés le 2026-10-14.
// Paliers : B&W blanc/crème forfait jusqu'à 108 p. ; groundwood jusqu'à 112 p. ; premium couleur jusqu'à 40 p.
interface Cost { flatMax: number; flat: number; flatLarge: number; fixed: number; perPage: number; perPageLarge: number }

const USD: Record<InkPaper, Cost> = {
  'bw-white': { flatMax: 108, flat: 2.3, flatLarge: 2.84, fixed: 1, perPage: 0.012, perPageLarge: 0.017 },
  'bw-cream': { flatMax: 108, flat: 2.3, flatLarge: 2.84, fixed: 1, perPage: 0.012, perPageLarge: 0.017 },
  'bw-groundwood': { flatMax: 112, flat: 2.23, flatLarge: 2.75, fixed: 1, perPage: 0.0114, perPageLarge: 0.0162 },
  'std-color': { flatMax: 0, flat: 0, flatLarge: 0, fixed: 1, perPage: 0.0255, perPageLarge: 0.0402 },
  'premium-color': { flatMax: 40, flat: 3.6, flatLarge: 4.2, fixed: 1, perPage: 0.065, perPageLarge: 0.08 },
};

const EUR: Record<InkPaper, Cost> = {
  'bw-white': { flatMax: 108, flat: 2.05, flatLarge: 2.48, fixed: 0.75, perPage: 0.012, perPageLarge: 0.016 },
  'bw-cream': { flatMax: 108, flat: 2.05, flatLarge: 2.48, fixed: 0.75, perPage: 0.012, perPageLarge: 0.016 },
  'bw-groundwood': { flatMax: 112, flat: 1.98, flatLarge: 2.39, fixed: 0.75, perPage: 0.0114, perPageLarge: 0.0152 },
  'std-color': { flatMax: 0, flat: 0, flatLarge: 0, fixed: 0.75, perPage: 0.024, perPageLarge: 0.035 },
  'premium-color': { flatMax: 40, flat: 2.85, flatLarge: 3.61, fixed: 0.75, perPage: 0.0525, perPageLarge: 0.0715 },
};

export const ROYALTY = {
  high: 0.6,
  low: 0.5,
  /** Seuil de prix public à partir duquel la redevance passe à 60 % (depuis le 10 juin 2025) */
  threshold: { USD: 9.99, EUR: 9.99 } as Record<string, number>,
  /** Date d'entrée en vigueur du seuil (taux de 50 % en dessous) */
  thresholdSince: '2025-06-10',
  maxPrice: 250,
};

export interface RoyaltyEstimate {
  currency: string;
  printCost: number;
  rate: number;
  priceExVat: number;
  royalty: number;
  minPrice: number;
  /** Prix minimum pour toucher 60 % */
  highRatePrice: number;
}

export function printCost(currency: 'USD' | 'EUR', ink: InkPaper, pages: number, trimId: string): number {
  const c = (currency === 'USD' ? USD : EUR)[ink];
  const large = findTrim(trimId).large;
  if (pages <= c.flatMax) return large ? c.flatLarge : c.flat;
  return round2(c.fixed + pages * (large ? c.perPageLarge : c.perPage));
}

export function estimateRoyalty(marketplace: string, ink: InkPaper, pages: number, trimId: string, price: number): RoyaltyEstimate {
  const m = MARKETPLACES.find((x) => x.id === marketplace) ?? MARKETPLACES[0];
  const currency = m.currency as 'USD' | 'EUR';
  const cost = printCost(currency, ink, pages, trimId);
  const threshold = ROYALTY.threshold[currency];
  const rate = price >= threshold ? ROYALTY.high : ROYALTY.low;
  // Estimation : sur les places de marché européennes, la redevance est calculée hors TVA.
  const priceExVat = price / (1 + m.vat);
  const royalty = round2(rate * priceExVat - cost);
  const minPrice = round2((cost / ROYALTY.low) * (1 + m.vat));
  return { currency, printCost: cost, rate, priceExVat: round2(priceExVat), royalty, minPrice, highRatePrice: threshold };
}

const round2 = (v: number) => Math.round(v * 100) / 100;
