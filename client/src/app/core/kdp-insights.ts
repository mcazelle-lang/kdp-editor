import {
  adviseTitle, catalogDiagnosis, familiesOf, familyKey, guessTitleLang, priceCheck, themeOf, titlePerformance,
  type Advice, type Book, type CatalogDiagnosis, type FamilyStats, type KdpSalesSnapshot, type KdpTitle, type PriceCheck, type TitlePerformance,
} from '@shared';

// Ventes et conseils de chaque livre relié à KDP, calculés dans le navigateur à partir des rapports importés.

export interface BookInsight {
  perf: TitlePerformance;
  advice: Advice[];
  family: FamilyStats | null;
  title: KdpTitle | null;
  price: PriceCheck | null;
}

export interface KdpInsights {
  diagnosis: CatalogDiagnosis;
  byBook: Map<string, BookInsight>;
}

export function kdpInsights(snapshots: KdpSalesSnapshot[], titles: KdpTitle[], books: Book[]): KdpInsights {
  const perfs = new Map<string, TitlePerformance>();
  for (const t of titles) {
    const p = titlePerformance(snapshots, t.id);
    if (p) perfs.set(t.id, p);
  }
  const families = familiesOf([...perfs.values()]);
  const themeLangs = new Map<string, Set<string>>();
  for (const t of titles) {
    const th = themeOf(t.title);
    if (th) themeLangs.set(th.id, (themeLangs.get(th.id) ?? new Set()).add(guessTitleLang(t.title, t.marketplace)));
  }
  const year = new Date().getFullYear();
  const byBook = new Map<string, BookInsight>();
  for (const b of books) {
    const id = b.kdp?.titleId;
    const perf = id ? (perfs.get(id) ?? titlePerformance(snapshots, id)) : null;
    if (!perf) continue;
    const family = families.get(familyKey(perf.title)) ?? null;
    const theme = themeOf(perf.title);
    byBook.set(b.id, {
      perf,
      family,
      title: titles.find((t) => t.id === id) ?? null,
      price: priceCheck(perf.latest, theme),
      advice: adviseTitle(perf, { family, themeLangs: theme ? [...(themeLangs.get(theme.id) ?? [])] : [], year }),
    });
  }
  return { diagnosis: catalogDiagnosis(snapshots), byBook };
}

export const money = (v: number, currency: string | null | undefined) =>
  currency ? v.toLocaleString('fr-FR', { style: 'currency', currency }) : v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
