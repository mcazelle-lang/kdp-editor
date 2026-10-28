import { estimateRoyalty } from '../kdp/pricing';
import { TRADEMARKS, AUTHOR_NAMES } from '../marketing/rules';
import { findTerms } from '../marketing/lint';
import type { MarketId } from './markets';
import type { Niche } from './model';

/**
 * Ventes quotidiennes ≈ k × BSR^-alpha (livres imprimés).
 * ORDRES DE GRANDEUR, pas des données Amazon : calés sur le repère « BSR 100 000 ≈ 1 à 2 ventes/jour » sur amazon.com,
 * puis réduits pour les marchés européens. À recalibrer avec tes propres ventes (rapports KDP) dès que possible.
 */
export const SALES_MODEL: Record<MarketId, { k: number; alpha: number }> = {
  'amazon.com': { k: 26600, alpha: 0.85 },
  'amazon.de': { k: 7000, alpha: 0.85 },
  'amazon.fr': { k: 4000, alpha: 0.85 },
  'amazon.it': { k: 2200, alpha: 0.85 },
  'amazon.es': { k: 2200, alpha: 0.85 },
};

export function estimateDailySales(market: MarketId, bsr: number): number {
  const { k, alpha } = SALES_MODEL[market];
  return Math.min(5000, k * Math.pow(Math.max(1, bsr), -alpha));
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export type NicheLevel = 'forte' | 'moyenne' | 'faible' | 'inconnue';

export interface NicheMetrics {
  demand: { level: NicheLevel; medianBsr: number | null; bestBsr: number | null; bsrCount: number; salesPerDayTop: number | null; points: number };
  competition: { level: NicheLevel; totalResults: number | null; organicCount: number; medianReviews: number | null; under50: number | null; points: number };
  price: { median: number | null; min: number | null; max: number | null };
  profit: { royaltyPerSale: number | null; currency: string; monthlyIfMedianBook: number | null; points: number };
  autocomplete: { position: number | null; hits: number; points: number };
  trademarks: string[];
  score: number;
  confidence: 'faible' | 'moyenne' | 'bonne';
  reasons: string[];
  missing: string[];
}

/** Score 0-100 : demande (40) + concurrence (35) + rentabilité (15) + présence dans l'autocomplétion (10). */
export function computeNicheMetrics(n: Niche): NicheMetrics {
  const reasons: string[] = [];
  const missing: string[] = [];
  const organic = (n.serp?.items ?? []).filter((i) => !i.sponsored).slice(0, 20);
  const top10 = organic.slice(0, 10);

  // --- Demande : BSR des fiches capturées parmi les 10 premiers résultats (sinon toutes les fiches capturées)
  const topAsins = new Set(top10.map((i) => i.asin));
  let bsrs = n.products.filter((p) => p.bsr && topAsins.has(p.asin)).map((p) => p.bsr!);
  if (!bsrs.length) bsrs = n.products.filter((p) => p.bsr).map((p) => p.bsr!);
  const medianBsr = median(bsrs);
  const bestBsr = bsrs.length ? Math.min(...bsrs) : null;
  const salesPerDayTop = bsrs.length ? bsrs.reduce((s, b) => s + estimateDailySales(n.marketplace, b), 0) / bsrs.length : null;
  let demandPts = 0;
  let demandLevel: NicheLevel = 'inconnue';
  if (medianBsr !== null) {
    if (medianBsr < 50_000) [demandPts, demandLevel] = [40, 'forte'];
    else if (medianBsr < 150_000) [demandPts, demandLevel] = [32, 'forte'];
    else if (medianBsr < 300_000) [demandPts, demandLevel] = [24, 'moyenne'];
    else if (medianBsr < 600_000) [demandPts, demandLevel] = [12, 'faible'];
    else [demandPts, demandLevel] = [4, 'faible'];
    reasons.push(`BSR médian des fiches capturées : ${Math.round(medianBsr).toLocaleString('fr-FR')} (${bsrs.length} fiche${bsrs.length > 1 ? 's' : ''}).`);
    if (bsrs.length < 3) missing.push('Capture au moins 3 fiches produit du top 10 pour fiabiliser la demande.');
  } else {
    missing.push('Aucun BSR : ouvre 3 à 5 fiches du top 10 sur Amazon et clique sur le favori de capture.');
  }

  // --- Concurrence : avis des 10 premiers résultats organiques
  const reviews = top10.map((i) => i.reviews ?? 0);
  const medianReviews = top10.length ? median(reviews) : null;
  const under50 = top10.length ? reviews.filter((r) => r < 50).length : null;
  let compPts = 0;
  let compLevel: NicheLevel = 'inconnue';
  if (medianReviews !== null) {
    if (medianReviews < 20) [compPts, compLevel] = [35, 'faible'];
    else if (medianReviews < 50) [compPts, compLevel] = [28, 'faible'];
    else if (medianReviews < 150) [compPts, compLevel] = [20, 'moyenne'];
    else if (medianReviews < 500) [compPts, compLevel] = [10, 'forte'];
    else [compPts, compLevel] = [3, 'forte'];
    reasons.push(`Top ${top10.length} organique : ${Math.round(medianReviews)} avis en médiane, ${under50}/${top10.length} fiche${top10.length > 1 ? 's' : ''} sous 50 avis.`);
    if (under50 !== null && under50 >= 4 && compPts < 35) compPts += 4;
  } else {
    missing.push('Aucune page de résultats capturée : ouvre la recherche Amazon et clique sur le favori.');
  }
  const totalResults = n.serp?.totalResults ?? null;
  if (totalResults !== null) reasons.push(`${totalResults.toLocaleString('fr-FR')} résultats dans le rayon Livres.`);

  // --- Prix et rentabilité (carnet 6×9 de 120 pages N&B au prix médian du marché)
  const prices = organic.map((i) => i.price).filter((p): p is number => p !== null && p > 0);
  const medPrice = median(prices);
  let royalty: number | null = null;
  let currency = n.marketplace === 'amazon.com' ? 'USD' : 'EUR';
  let profitPts = 0;
  if (medPrice !== null) {
    const est = estimateRoyalty(n.marketplace, 'bw-white', 120, '6x9', medPrice);
    royalty = est.royalty;
    currency = est.currency;
    profitPts = royalty >= 3 ? 15 : royalty >= 2 ? 11 : royalty >= 1 ? 6 : 2;
    reasons.push(`Prix médian ${medPrice.toFixed(2)} ${currency} → ≈ ${royalty.toFixed(2)} ${currency} de redevance par vente (carnet 6×9, 120 p.).`);
  }
  const monthly = royalty !== null && salesPerDayTop !== null ? royalty * salesPerDayTop * 30 : null;

  // --- Autocomplétion : preuve que des acheteurs tapent cette recherche
  const ac = n.autocomplete;
  const acPts = ac ? (ac.position <= 3 ? 10 : ac.position <= 7 ? 7 : 5) + Math.min(3, ac.hits - 1) : 0;
  if (ac) reasons.push(`Suggérée par Amazon (position ${ac.position}${ac.hits > 1 ? `, ${ac.hits} préfixes` : ''}).`);

  const trademarks = [...findTerms(n.keyword, TRADEMARKS), ...findTerms(n.keyword, AUTHOR_NAMES)];
  let score = Math.min(100, demandPts + compPts + profitPts + Math.min(10, acPts));
  if (trademarks.length) {
    score = Math.min(score, 10);
    reasons.unshift(`Marque ou nom protégé dans la recherche (${trademarks.join(', ')}) : niche inexploitable sur KDP.`);
  }
  const confidence = medianBsr !== null && medianReviews !== null && bsrs.length >= 3 ? 'bonne' : medianBsr !== null || medianReviews !== null ? 'moyenne' : 'faible';

  return {
    demand: { level: demandLevel, medianBsr, bestBsr, bsrCount: bsrs.length, salesPerDayTop, points: demandPts },
    competition: { level: compLevel, totalResults, organicCount: organic.length, medianReviews, under50, points: compPts },
    price: { median: medPrice, min: prices.length ? Math.min(...prices) : null, max: prices.length ? Math.max(...prices) : null },
    profit: { royaltyPerSale: royalty, currency, monthlyIfMedianBook: monthly, points: profitPts },
    autocomplete: { position: ac?.position ?? null, hits: ac?.hits ?? 0, points: Math.min(10, acPts) },
    trademarks,
    score,
    confidence,
    reasons,
    missing,
  };
}

/** Fiches du top 10 dont le BSR n'a pas encore été capturé. */
export function missingBsr(n: Niche): string[] {
  const have = new Set(n.products.filter((p) => p.bsr).map((p) => p.asin));
  return (n.serp?.items ?? []).filter((i) => !i.sponsored).slice(0, 10).map((i) => i.asin).filter((a) => !have.has(a));
}
