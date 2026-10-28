import { ROYALTY } from '../kdp/pricing';
import { LISTING, MARKETPLACES, PUBLISHED_PRINT_EDITS } from '../kdp/specs';
import type { KdpSalesRow, KdpSalesSnapshot } from './model';
import { mainMarket, marketDomain, publicPrice, reportSnapshots, titleKey } from './royalty-report';
import { themeOf, type NicheTheme } from './themes';

// Conseils marketing pour un carnet déjà publié, calculés sur ses ventes réelles (rapports KDP importés).
// Aucun chiffre de marché n'est supposé : le prix, la tendance et la saisonnalité viennent des rapports.

export type AdviceLevel = 'urgent' | 'important' | 'idee';
export type AdviceArea = 'prix' | 'tendance' | 'variantes' | 'fiche' | 'marches' | 'saison' | 'publicite' | 'niche';

export interface Advice {
  level: AdviceLevel;
  area: AdviceArea;
  title: string;
  detail: string;
}

export const ADVICE_LEVEL_LABELS: Record<AdviceLevel, string> = { urgent: 'Urgent', important: 'Important', idee: 'Idée' };

export interface MonthPoint {
  month: string;
  units: number;
  royalty: Record<string, number>;
}

type Row = KdpSalesRow & { month: string };

export interface TitlePerformance {
  key: string;
  title: string;
  author: string | null;
  /** Place de marché principale (domaine) */
  marketplace: string | null;
  markets: string[];
  /** Un point par rapport importé, zéros compris */
  months: MonthPoint[];
  totalUnits: number;
  royalties: Record<string, number>;
  /** Première et dernière ligne de vente sur la place de marché principale */
  first: Row | null;
  latest: Row | null;
  lastSold: string | null;
}

const MONTH_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const monthLabel = (m: string) => `${MONTH_FR[Number(m.slice(5, 7)) - 1] ?? m.slice(5, 7)} ${m.slice(0, 4)}`;

const round2 = (v: number) => Math.round(v * 100) / 100;
const money = (v: number, currency: string) => v.toLocaleString('fr-FR', { style: 'currency', currency });
const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)} %`;
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const addTo = (acc: Record<string, number>, cur: string | null, v: number | null) => {
  if (cur && v !== null) acc[cur] = round2((acc[cur] ?? 0) + v);
};

const matches = (r: KdpSalesRow, key: string) => titleKey(r) === key || r.asin === key || r.isbn === key;

export function titlePerformance(snapshots: KdpSalesSnapshot[], key: string): TitlePerformance | null {
  const reports = reportSnapshots(snapshots);
  const rows: Row[] = reports.flatMap((s) => s.rows.filter((r) => matches(r, key) && !(r.kenp && !r.units)).map((r) => ({ ...r, month: s.month! })));
  if (!rows.length) return null;
  const byMarket = new Map<string, number>();
  for (const r of rows) byMarket.set(r.marketplace ?? '', (byMarket.get(r.marketplace ?? '') ?? 0) + r.units);
  const main = mainMarket(byMarket) ?? '';
  const mainRows = rows.filter((r) => (r.marketplace ?? '') === main);
  const royalties: Record<string, number> = {};
  for (const r of rows) addTo(royalties, r.currency, r.royalty);
  const months = reports.map((s) => {
    const rs = rows.filter((r) => r.month === s.month);
    const royalty: Record<string, number> = {};
    for (const r of rs) addTo(royalty, r.currency, r.royalty);
    return { month: s.month!, units: rs.reduce((n, r) => n + r.units, 0), royalty };
  });
  const sold = months.filter((m) => m.units > 0);
  return {
    key,
    title: rows[rows.length - 1].title,
    author: rows[rows.length - 1].author ?? null,
    marketplace: marketDomain(main || null),
    markets: [...byMarket.keys()].filter(Boolean),
    months,
    totalUnits: rows.reduce((n, r) => n + r.units, 0),
    royalties,
    first: mainRows[0] ?? null,
    latest: mainRows[mainRows.length - 1] ?? null,
    lastSold: sold[sold.length - 1]?.month ?? null,
  };
}

// ---------------------------------------------------------------- Familles (variantes d'un même carnet)

export interface FamilyStats {
  key: string;
  label: string;
  members: { key: string; title: string; units: number }[];
  units: number;
  /** Toutes les variantes portent exactement le même titre et sous-titre */
  identical: boolean;
}

export const familyKey = (title: string) => norm(title.split(':')[0]).replace(/[^a-z0-9]+/g, ' ').trim();

export function familiesOf(perfs: TitlePerformance[]): Map<string, FamilyStats> {
  const map = new Map<string, FamilyStats>();
  for (const p of perfs) {
    const k = familyKey(p.title);
    const f = map.get(k) ?? { key: k, label: p.title.split(':')[0].trim(), members: [], units: 0, identical: true };
    f.members.push({ key: p.key, title: p.title, units: p.totalUnits });
    f.units += p.totalUnits;
    map.set(k, f);
  }
  for (const f of map.values()) {
    f.members.sort((a, b) => b.units - a.units);
    f.identical = f.members.length > 1 && new Set(f.members.map((m) => norm(m.title))).size === 1;
  }
  return map;
}

// ---------------------------------------------------------------- Prix

const LADDER = [5.99, 6.99, 7.99, 8.99, 9.99, 12.99, 14.99, 19.99, 24.99];

export interface PriceOption {
  price: number;
  royalty: number;
  rate: number;
}

export interface PriceCheck {
  currency: string;
  current: PriceOption;
  printCost: number;
  options: PriceOption[];
  recommended: PriceOption | null;
  /** Palier du seuil des 60 % */
  atThreshold: PriceOption | null;
  target: number;
}

/** Redevance par exemplaire au prix actuel et aux paliers supérieurs, avec le coût d'impression réel du rapport. */
export function priceCheck(latest: Row | null, theme: NicheTheme | null): PriceCheck | null {
  if (!latest || latest.listPrice == null || latest.printCost == null || !latest.currency) return null;
  const threshold = ROYALTY.threshold[latest.currency];
  const market = MARKETPLACES.find((m) => m.id === marketDomain(latest.marketplace));
  if (!threshold || !market) return null;
  const at = (price: number): PriceOption => {
    const rate = price >= threshold ? ROYALTY.high : ROYALTY.low;
    return { price, rate, royalty: round2((rate * price) / (1 + market.vat) - latest.printCost!) };
  };
  const currentPrice = publicPrice(latest.listPrice, market.vat);
  const current = { price: currentPrice, rate: latest.rate ?? at(currentPrice).rate, royalty: round2((latest.rate ?? at(currentPrice).rate) * latest.listPrice - latest.printCost) };
  const target = theme?.targetRoyalty ?? (theme?.kind === 'pro' ? 3 : 1.5);
  const higher = LADDER.filter((p) => p > currentPrice + 0.005).map(at);
  const recommended = higher.find((o) => o.royalty >= target) ?? null;
  const firstOverOne = higher.find((o) => o.royalty >= 1);
  const atThreshold = higher.find((o) => o.price >= threshold) ?? null;
  const options = [...new Map([firstOverOne, recommended, atThreshold].filter((o): o is PriceOption => !!o).map((o) => [o.price, o])).values()].sort((a, b) => a.price - b.price);
  return { currency: latest.currency, current, printCost: latest.printCost, options, recommended, atThreshold, target };
}

// ---------------------------------------------------------------- Conseils

export interface AdviceContext {
  family?: FamilyStats | null;
  /** Langues du thème dans tout le catalogue */
  themeLangs?: string[];
  /** Année en cours (mentions datées dans le titre) */
  year?: number;
}

const ORDER: Record<AdviceLevel, number> = { urgent: 0, important: 1, idee: 2 };
const LOCKED = `ne se modifie plus ${PUBLISHED_PRINT_EDITS.identityLockHours} h après la publication`;
const since = () => new Date(ROYALTY.thresholdSince).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function adviseTitle(perf: TitlePerformance, ctx: AdviceContext = {}): Advice[] {
  const out: Advice[] = [];
  const theme = themeOf(perf.title);
  const add = (level: AdviceLevel, area: AdviceArea, title: string, detail: string) => out.push({ level, area, title, detail });

  // Prix et marge
  const pc = priceCheck(perf.latest, theme);
  if (pc) {
    const m = (v: number) => money(v, pc.currency);
    const cur = pc.current;
    if (cur.royalty < pc.target && pc.options.length) {
      const rec = pc.recommended ?? pc.options[pc.options.length - 1];
      let detail = `Au prix actuel (${m(cur.price)}), chaque exemplaire rapporte ${m(cur.royalty)} : coût d'impression ${m(pc.printCost)}, taux ${Math.round(cur.rate * 100)} %.`;
      const f = perf.first;
      if (f && f.month < perf.latest!.month && f.listPrice != null && f.printCost != null && f.rate != null) {
        const before = round2(f.rate * f.listPrice - f.printCost);
        if (before > cur.royalty + 0.05) {
          detail += ` En ${monthLabel(f.month)}, il rapportait ${m(before)} (coût ${m(f.printCost)}, taux ${Math.round(f.rate * 100)} %)`;
          detail += f.rate > cur.rate ? ` : depuis le ${since()}, KDP ne verse plus que ${ROYALTY.low * 100} % sous ${m(ROYALTY.threshold[pc.currency])}.` : '.';
        }
      }
      detail += ` Paliers : ${pc.options.map((o) => `${m(o.price)} → ${m(o.royalty)} par exemplaire (${Math.round(o.rate * 100)} %)`).join(' ; ')}.`;
      detail += cur.royalty > 0
        ? ` À ${m(rec.price)}, vendre ${Math.max(1, Math.ceil((cur.royalty / rec.royalty) * 100))} % des exemplaires actuels suffit pour garder la même redevance.`
        : ' Aujourd\'hui, une vente ne rapporte rien.';
      add(cur.royalty < 1 ? 'urgent' : 'important', 'prix', `Prix à revoir : ${m(cur.royalty)} par exemplaire, passe à ${m(rec.price)}`, detail);
      if (cur.royalty < 1) add('important', 'publicite', 'Pas de publicité à ce prix', `Avec ${m(cur.royalty)} de marge par exemplaire, un clic publicitaire coûte en général plus que la vente rapporte : remonte d'abord le prix.`);
    } else if (pc.atThreshold && cur.price >= pc.atThreshold.price - 2 && pc.atThreshold.royalty >= cur.royalty * 1.5) {
      add('idee', 'prix', `À ${m(pc.atThreshold.price)}, la redevance passe de ${m(cur.royalty)} à ${m(pc.atThreshold.royalty)}`, `Le taux monte à ${ROYALTY.high * 100} % à partir de ${m(ROYALTY.threshold[pc.currency])} : un petit écart de prix pour une marge nettement plus haute.`);
    }
    const recent = perf.months.slice(-3).reduce((n, p) => n + p.units, 0);
    if (cur.royalty >= 3 && recent > 0) {
      add('idee', 'publicite', `Marge suffisante pour la publicité (${m(cur.royalty)} par exemplaire)`, 'Campagne Amazon Ads automatique à 3-5 € par jour pendant 2 à 3 semaines, puis passe les termes rentables en campagne manuelle et exclus les autres. Lance-la avant le pic de la niche.');
    }
  }

  // Tendance
  const pts = perf.months;
  const recentUnits = pts.slice(-3).reduce((n, p) => n + p.units, 0);
  if (pts.length >= 4 && perf.totalUnits > 0 && recentUnits === 0 && perf.lastSold) {
    add('important', 'tendance', `Plus aucune vente depuis ${monthLabel(perf.lastSold)}`, 'Le titre ne vend plus dans les 3 derniers rapports. Retravaille ce qui se modifie (prix, couverture, description, mots-clés) ou retire-le pour concentrer tes efforts sur les titres qui vendent.');
  } else {
    // Même mois de l'année, le plus ancien et le plus récent
    const byCal = new Map<string, MonthPoint[]>();
    for (const p of pts) byCal.set(p.month.slice(5), [...(byCal.get(p.month.slice(5)) ?? []), p]);
    const series = [...byCal.values()].filter((s) => s.length >= 2).sort((a, b) => (+b[b.length - 1].month.slice(0, 4) - +b[0].month.slice(0, 4)) - (+a[a.length - 1].month.slice(0, 4) - +a[0].month.slice(0, 4)) || b[0].units - a[0].units)[0];
    if (series) {
      const a = series[0];
      const b = series[series.length - 1];
      const last = pts[pts.length - 1];
      const prevYear = pts.find((p) => p.month === `${+last.month.slice(0, 4) - 1}${last.month.slice(4)}`);
      const yoy = prevYear && prevYear.units >= 3 ? ` Sur un an : ${monthLabel(prevYear.month)} ${prevYear.units} ex. → ${monthLabel(last.month)} ${last.units} ex.` : '';
      if (a.units >= 5 && b.units / a.units - 1 <= -0.5) {
        add('important', 'tendance', `Ventes en recul (${pct(b.units / a.units - 1)})`, `${monthLabel(a.month)} : ${a.units} ex. → ${monthLabel(b.month)} : ${b.units} ex.${yoy}`);
      } else if (b.units >= 5 && (a.units === 0 || b.units / a.units - 1 >= 0.3)) {
        const next = pc && pc.current.royalty < 1 ? ' La demande est là : c\'est le moment de remonter le prix.' : ` Capitalise : ${theme?.local ? 'variantes' : 'variantes, autres langues'}, publicité si la marge le permet.`;
        add('idee', 'tendance', `Ventes en progression${a.units ? ` (${pct(b.units / a.units - 1)})` : ''}`, `${monthLabel(a.month)} : ${a.units} ex. → ${monthLabel(b.month)} : ${b.units} ex.${yoy}${next}`);
      }
    }
  }

  // Saisonnalité (rapports de juin et décembre)
  const avg = (suffix: string) => {
    const s = pts.filter((p) => p.month.endsWith(suffix));
    return s.length ? s.reduce((n, p) => n + p.units, 0) / s.length : null;
  };
  const dec = avg('-12');
  const jun = avg('-06');
  if (dec !== null && jun !== null) {
    if (dec >= 5 && dec >= 2 * jun) {
      add('idee', 'saison', `Pic de décembre (×${(dec / Math.max(jun, 0.5)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} par rapport à juin)`, `En moyenne ${Math.round(dec)} ex. en décembre contre ${Math.round(jun)} en juin dans tes rapports : c'est un achat cadeau. Prix, couverture et publicité prêts dès la fin octobre.`);
    } else if (jun >= 5 && jun >= 1.5 * dec) {
      add('idee', 'saison', 'Ventes plus fortes en juin qu\'en décembre', `En moyenne ${Math.round(jun)} ex. en juin contre ${Math.round(dec)} en décembre : un achat d'usage, pas un cadeau de Noël.`);
    }
  }

  // Variantes
  const fam = ctx.family;
  if (fam && fam.members.length >= 3) {
    const share = fam.units ? perf.totalUnits / fam.units : 0;
    if (fam.members[0].key === perf.key && share >= 0.2) {
      add('idee', 'variantes', `Variante la plus vendue (${Math.round(share * 100)} % de ses ${fam.members.length} variantes)`, 'Concentre sur elle la publicité et les demandes d\'avis : c\'est elle qu\'Amazon montre le plus.');
    } else if (fam.units >= 20 && share < 0.05) {
      add('important', 'variantes', `Variante qui ne vend presque pas (${perf.totalUnits} ex. sur ${fam.units})`, `Sur ${fam.members.length} variantes, celle-ci pèse ${Math.round(share * 100)} % des ventes. Donne-lui un angle distinct (couleur et motif annoncés sur la couverture, mots-clés différents) ou retire-la.`);
    }
    if (fam.identical) {
      add('important', 'variantes', `${fam.members.length} variantes au titre identique`, `Des doublons stricts se concurrencent entre eux et KDP les déconseille. Change dès maintenant les mots-clés pour que chaque variante vise d'autres recherches. Le titre ${LOCKED} : différencie-le à la prochaine édition, avec un suffixe comme « – Vert sapin ».`);
    }
  }

  // Fiche
  const full = perf.title;
  const year = ctx.year ?? new Date().getFullYear();
  const dated = [...full.matchAll(/\b(20[1-3]\d)\b/g)].map((x) => +x[1]).find((y) => y < year);
  if (dated) add('urgent', 'fiche', `Mention datée « ${dated} » dans le titre`, `Le titre annonce une année passée et ${LOCKED} : publie une nouvelle édition sans date, ou retire ce titre s'il ne vend plus.`);
  const promisesCompliance = /conforme|compliant/i.test(full);
  if (promisesCompliance) add('important', 'fiche', 'Le titre promet la conformité', 'Vérifie que les textes cités sont toujours en vigueur et indique la date de vérification dans la description. À la prochaine édition, préfère « selon les articles … » à « conforme ».');
  if (full.length > LISTING.titleSubtitleMax) add('idee', 'fiche', `Titre et sous-titre longs (${full.length} caractères)`, `Au-delà de ${LISTING.titleSubtitleMax} caractères, le titre est tronqué dans les résultats. À raccourcir à la prochaine édition ; d'ici là, mets les détails dans la description.`);

  // Marchés
  if (theme && !theme.local && ctx.themeLangs && ctx.themeLangs.length === 1 && perf.totalUnits >= 10) {
    add('idee', 'marches', 'Traduis ce carnet', `Le thème « ${theme.label} » n'est publié qu'en une langue dans ton catalogue alors qu'il n'est pas propre à un pays : une version allemande, espagnole ou italienne ouvre des marchés souvent moins concurrentiels. Déclare la traduction si elle est générée par IA.`);
  }

  // Niche
  for (const tip of theme?.tips ?? []) {
    if (promisesCompliance && /textes en vigueur/.test(tip.title)) continue;
    add('idee', 'niche', tip.title, tip.detail);
  }

  return out.sort((a, b) => ORDER[a.level] - ORDER[b.level]);
}

// ---------------------------------------------------------------- Diagnostic du catalogue

export interface CatalogMonth {
  month: string;
  units: number;
  royalty: Record<string, number>;
  /** Part des exemplaires imprimés vendus au taux de 50 % */
  lowRateShare: number;
}

export interface CatalogDiagnosis {
  months: CatalogMonth[];
  /** Devise principale (celle qui rapporte le plus) */
  currency: string | null;
  findings: Advice[];
}

export function catalogDiagnosis(snapshots: KdpSalesSnapshot[]): CatalogDiagnosis {
  const reports = reportSnapshots(snapshots);
  const months: CatalogMonth[] = reports.map((s) => {
    const royalty: Record<string, number> = {};
    for (const r of s.rows) addTo(royalty, r.currency, r.royalty);
    const print = s.rows.filter((r) => r.rate != null && r.format !== 'ebook');
    const printUnits = print.reduce((n, r) => n + r.units, 0);
    return {
      month: s.month!,
      units: s.rows.reduce((n, r) => n + r.units, 0),
      royalty,
      lowRateShare: printUnits ? print.filter((r) => r.rate! <= ROYALTY.low).reduce((n, r) => n + r.units, 0) / printUnits : 0,
    };
  });
  const totals: Record<string, number> = {};
  for (const m of months) for (const [c, v] of Object.entries(m.royalty)) addTo(totals, c, v);
  const currency = Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const findings: Advice[] = [];
  if (months.length < 2 || !currency) return { months, currency, findings };
  const m = (v: number) => money(v, currency);

  // Même mois de l'année, le plus ancien et le plus récent (décembre en priorité à écart égal)
  const byCal = new Map<string, CatalogMonth[]>();
  for (const x of months) byCal.set(x.month.slice(5), [...(byCal.get(x.month.slice(5)) ?? []), x]);
  const series = [...byCal.entries()].filter(([, s]) => s.length >= 2)
    .sort(([ka, a], [kb, b]) => (+b[b.length - 1].month.slice(0, 4) - +b[0].month.slice(0, 4)) - (+a[a.length - 1].month.slice(0, 4) - +a[0].month.slice(0, 4)) || +kb - +ka)[0]?.[1];
  if (series) {
    const a = series[0];
    const b = series[series.length - 1];
    const unitsIn = (s: CatalogMonth, cur: string) => reports.find((r) => r.month === s.month)!.rows.filter((r) => r.currency === cur).reduce((n, r) => n + r.units, 0);
    const ra = a.royalty[currency] ?? 0;
    const rb = b.royalty[currency] ?? 0;
    const ua = unitsIn(a, currency);
    const ub = unitsIn(b, currency);
    if (ra > 0) {
      const dropR = rb / ra - 1;
      const dropU = a.units ? b.units / a.units - 1 : 0;
      add(dropR <= -0.5 && dropU > dropR + 0.3 ? 'urgent' : 'important', `Redevances ${pct(dropR)}, exemplaires ${pct(dropU)} (${monthLabel(a.month)} → ${monthLabel(b.month)})`,
        `${monthLabel(a.month)} : ${a.units} ex., ${m(ra)} ; ${monthLabel(b.month)} : ${b.units} ex., ${m(rb)}. Redevance moyenne par exemplaire en ${currency} : ${m(ua ? ra / ua : 0)} → ${m(ub ? rb / ub : 0)}.`
        + (dropU > dropR + 0.3 ? ' Tu ne vends pas beaucoup moins : chaque vente rapporte beaucoup moins.' : ''));
    }

    // Taux de 50 %
    const first = months[0];
    const last = months[months.length - 1];
    if (last.lowRateShare > first.lowRateShare + 0.2) {
      add('urgent', `${Math.round(last.lowRateShare * 100)} % des ventes au taux de ${ROYALTY.low * 100} % (${Math.round(first.lowRateShare * 100)} % en ${monthLabel(first.month)})`,
        `Depuis le ${since()}, KDP verse ${ROYALTY.low * 100} % au lieu de ${ROYALTY.high * 100} % sous ${m(ROYALTY.threshold[currency] ?? 9.99)}. La plupart de tes prix n'ont pas bougé depuis : c'est le premier levier.`);
    }

    // Coût d'impression des mêmes livres
    const costOf = (month: string) => new Map(reports.find((r) => r.month === month)!.rows.filter((r) => r.printCost != null && r.currency === currency).map((r) => [`${titleKey(r)}|${r.marketplace}`, r.printCost!]));
    const ca = costOf(first.month);
    const cb = costOf(last.month);
    const common = [...ca.keys()].filter((k) => cb.has(k));
    if (common.length >= 3) {
      const rise = common.reduce((s, k) => s + cb.get(k)! / ca.get(k)!, 0) / common.length - 1;
      if (rise >= 0.03) add('important', `Coût d'impression ${pct(rise)} sur les mêmes livres (${monthLabel(first.month)} → ${monthLabel(last.month)})`, `Calculé sur ${common.length} livres vendus aux deux dates : la hausse est prélevée sur ta redevance tant que le prix reste le même.`);
    }

    // Familles qui perdent et qui gagnent le plus
    const famRoy = (month: string) => {
      const map = new Map<string, { label: string; royalty: number; units: number }>();
      for (const r of reports.find((x) => x.month === month)!.rows) {
        if (r.currency !== currency) continue;
        const k = familyKey(r.title);
        const f = map.get(k) ?? { label: r.title.split(':')[0].trim(), royalty: 0, units: 0 };
        f.royalty += r.royalty ?? 0;
        f.units += r.units;
        map.set(k, f);
      }
      return map;
    };
    const fa = famRoy(a.month);
    const fb = famRoy(b.month);
    const deltas = [...new Set([...fa.keys(), ...fb.keys()])].map((k) => ({ k, label: (fa.get(k) ?? fb.get(k))!.label, ra: fa.get(k)?.royalty ?? 0, rb: fb.get(k)?.royalty ?? 0, ua: fa.get(k)?.units ?? 0, ub: fb.get(k)?.units ?? 0 }));
    const losers = deltas.filter((d) => d.ra - d.rb >= 20).sort((x, y) => y.ra - y.rb - (x.ra - x.rb)).slice(0, 3);
    if (losers.length) add('important', 'Les plus fortes baisses de redevances', losers.map((d) => `${d.label} : ${m(d.ra)} → ${m(d.rb)} (${d.ua} → ${d.ub} ex.)`).join(' ; ') + `, entre ${monthLabel(a.month)} et ${monthLabel(b.month)}.`);
    const winners = deltas.filter((d) => d.ub - d.ua >= 10).sort((x, y) => y.ub - y.ua - (x.ub - x.ua)).slice(0, 2);
    if (winners.length) add('idee', 'Ce qui progresse', winners.map((d) => `${d.label} : ${d.ua} → ${d.ub} ex., ${m(d.ub ? d.rb / d.ub : 0)} par exemplaire`).join(' ; ') + '.');
  }

  // Noms d'auteur
  const authors = new Set(reports.flatMap((s) => s.rows.map((r) => r.author?.trim()).filter(Boolean)));
  if (authors.size >= 5) {
    add('idee', `${authors.size} noms d'auteur différents`, `Une ou deux marques d'éditeur par langue regroupent la collection sur une seule page auteur : un acheteur satisfait trouve tes autres carnets. L'auteur ne se change plus sur un livre publié : applique-le aux nouveaux titres et aux nouvelles éditions.`);
  }
  return { months, currency, findings };

  function add(level: AdviceLevel, title: string, detail: string) {
    findings.push({ level, area: 'tendance', title, detail });
  }
}
