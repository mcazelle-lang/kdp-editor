import type { KdpSalesSnapshot, KdpState } from './model';

export interface TitleSales {
  key: string;
  title: string;
  asin: string | null;
  units: number;
  kenp: number;
  royalties: Record<string, number>;
  marketplaces: string[];
  periods: number;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

/** Une seule capture par période (la plus récente) pour ne pas compter deux fois les mêmes ventes. */
export function latestSnapshots(snapshots: KdpSalesSnapshot[]): KdpSalesSnapshot[] {
  const byPeriod = new Map<string, KdpSalesSnapshot>();
  for (const s of snapshots) {
    const prev = byPeriod.get(s.period);
    if (!prev || prev.capturedAt < s.capturedAt) byPeriod.set(s.period, s);
  }
  return [...byPeriod.values()].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

export function salesByTitle(snapshots: KdpSalesSnapshot[]): TitleSales[] {
  const map = new Map<string, TitleSales & { _periods: Set<string> }>();
  for (const s of latestSnapshots(snapshots)) {
    for (const r of s.rows) {
      const key = r.asin ?? norm(r.title);
      const t = map.get(key) ?? { key, title: r.title, asin: r.asin, units: 0, kenp: 0, royalties: {}, marketplaces: [], periods: 0, _periods: new Set<string>() };
      t.units += r.units;
      t.kenp += r.kenp ?? 0;
      if (r.royalty !== null && r.currency) t.royalties[r.currency] = Math.round(((t.royalties[r.currency] ?? 0) + r.royalty) * 100) / 100;
      if (r.marketplace && !t.marketplaces.includes(r.marketplace)) t.marketplaces.push(r.marketplace);
      t._periods.add(s.period);
      map.set(key, t);
    }
  }
  return [...map.values()].map(({ _periods, ...t }) => ({ ...t, periods: _periods.size })).sort((a, b) => b.units - a.units);
}

export function salesByMarketplace(snapshots: KdpSalesSnapshot[]): { marketplace: string; units: number; royalties: Record<string, number> }[] {
  const map = new Map<string, { marketplace: string; units: number; royalties: Record<string, number> }>();
  for (const s of latestSnapshots(snapshots)) {
    for (const r of s.rows) {
      const k = r.marketplace ?? 'Non précisé';
      const m = map.get(k) ?? { marketplace: k, units: 0, royalties: {} };
      m.units += r.units;
      if (r.royalty !== null && r.currency) m.royalties[r.currency] = Math.round(((m.royalties[r.currency] ?? 0) + r.royalty) * 100) / 100;
      map.set(k, m);
    }
  }
  return [...map.values()].sort((a, b) => b.units - a.units);
}

export function totals(snapshots: KdpSalesSnapshot[]): { units: number; kenp: number; royalties: Record<string, number> } {
  const out = { units: 0, kenp: 0, royalties: {} as Record<string, number> };
  for (const t of salesByTitle(snapshots)) {
    out.units += t.units;
    out.kenp += t.kenp;
    for (const [c, v] of Object.entries(t.royalties)) out.royalties[c] = Math.round(((out.royalties[c] ?? 0) + v) * 100) / 100;
  }
  return out;
}

/** Titres en vente sans aucune vente dans les périodes capturées. */
export function unsoldLiveTitles(state: KdpState) {
  const sold = new Set(salesByTitle(state.snapshots).filter((t) => t.units > 0).flatMap((t) => [t.asin ?? '', norm(t.title)]));
  return state.titles.filter((t) => t.status === 'live' && !sold.has(t.asin ?? '') && !sold.has(norm(t.title)));
}
