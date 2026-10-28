import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adviseTitle, amazonUrl, bookFromKdpTitle, catalogDiagnosis, familiesOf, familyKey, guessTitleLang, parseRoyaltyReport, reportMonth,
  themeOf, titlePerformance, titlesFromReports, type SheetRows,
} from '../src/index';

// Structure des rapports « Prior Month Royalties » (en-têtes français), valeurs inventées
const PRINT_HEADER = ['Titre', 'Auteur', 'ISBN', 'Marché', 'Exemplaires vendus', 'Exemplaires remboursés', "Type de droits d'auteur", 'Prix catalogue moyen HT', 'Prix de vente moyen HT', 'Coût de fabrication moyen', 'Redevance', 'Devise', 'ASIN'];
const NOUNOU = 'Carnet de liaison nounou: Cahier pour la communication parents-nounou ';
const GENEA = 'Mein Stammbaum: 10 Generationen zum Ausfüllen';

const report = (label: string, rows: unknown[][]): SheetRows[] => [
  { name: 'Redevances sur les ebooks', rows: [['Période de vente', label], ['Titre', 'Auteur', 'ASIN', 'Marché', 'Exemplaires vendus', 'Exemplaires remboursés', 'Nombre net d’exemplaires vendus', "Type de droits d'auteur", 'Type de transaction', 'Devise', 'Prix catalogue moyen HT', 'Prix de vente moyen HT', 'Taille de fichier moyenne (Mo)', 'Coût de livraison moyen', 'Redevance']] },
  { name: 'Pages KENP lues', rows: [['Période de vente', label], ['Titre', 'Auteur', 'ASIN', 'Marché', "Pages normalisées de l'édition Kindle (KENP) lues"]] },
  { name: 'Redevances sur les livres broch', rows: [['Période de vente', label], PRINT_HEADER, ...rows] },
  { name: 'Total des revenus', rows: [['Période de vente', label], ['Titre', 'Auteur', 'ASIN/ISBN', 'Marché'], ...rows] },
];

const dec21 = parseRoyaltyReport(report('décembre 2021', [
  [NOUNOU, 'Éditions Liaison', '9798000000011', 'Amazon.fr', 25, 0, '60%', 4.73, 4.73, 2.16, 17, 'EUR', 'B08AAAAAA1'],
  [NOUNOU, 'Éditions Liaison', '9798000000028', 'Amazon.fr', 2, 0, '60%', 4.73, 4.73, 2.16, 1.36, 'EUR', 'B08AAAAAA2'],
  [NOUNOU, 'Éditions Liaison', '9798000000035', 'Amazon.fr', 1, 0, '60%', 4.73, 4.73, 2.16, 0.68, 'EUR', 'B08AAAAAA3'],
  [GENEA, 'Familien Verlag', '9798000000042', 'Amazon.de', 130, 2, '60%', 14.29, 14.29, 2.39, 791, 'EUR', 'B08BBBBBB1'],
  ['Notebook - Papyrus: Cover with color of the year 2020', 'Colored Notebooks', '9798000000059', 'Amazon.co.uk', 3, 0, '60%', 4.6, 4.6, 1.93, 1.5, 'GBP', 'B08CCCCCC1'],
]), 'KDP_Prior_Month_Royalties-2021-12-01-x.xlsx', '2026-10-17T10:00:00Z');
const jun22 = parseRoyaltyReport(report('juin 2022', [
  [NOUNOU, 'Éditions Liaison', '9798000000011', 'Amazon.fr', 20, 0, '60%', 4.73, 4.73, 2.16, 13.6, 'EUR', 'B08AAAAAA1'],
  [GENEA, 'Familien Verlag', '9798000000042', 'Amazon.de', 20, 0, '60%', 14.29, 14.29, 2.39, 122, 'EUR', 'B08BBBBBB1'],
]), 'KDP_Prior_Month_Royalties-2022-06-01-x.xlsx');
const dec25 = parseRoyaltyReport(report('décembre 2025', [
  [NOUNOU, 'Éditions Liaison', '9798000000011', 'Amazon.fr', 160, 0, '50%', 4.74, 4.74, 2.31, 9.6, 'EUR', 'B08AAAAAA1'],
  [NOUNOU, 'Éditions Liaison', '9798000000011', 'Amazon.com.be', 4, 0, '50%', 4.74, 4.74, 2.31, 0.24, 'EUR', 'B08AAAAAA1'],
  [GENEA, 'Familien Verlag', '9798000000042', 'Amazon.de', 6, 0, '60%', 14.29, 14.29, 3.13, 32.7, 'EUR', 'B08BBBBBB1'],
]), 'KDP_Prior_Month_Royalties-2025-12-01-x.xlsx');
const snaps = [dec21, jun22, dec25];

test('rapport KDP : période, feuilles par format, colonnes', () => {
  assert.equal(dec21.month, '2021-12');
  assert.equal(dec21.period, 'décembre 2021');
  assert.equal(dec21.source, 'rapport');
  assert.equal(dec21.rows.length, 5, 'la feuille « Total des revenus » est ignorée');
  const g = dec21.rows.find((r) => r.asin === 'B08BBBBBB1')!;
  assert.deepEqual([g.units, g.refunds, g.rate, g.listPrice, g.printCost, g.royalty, g.currency, g.isbn, g.format], [128, 2, 0.6, 14.29, 2.39, 791, 'EUR', '9798000000042', 'paperback']);
  assert.equal(reportMonth('July 2026'), '2026-07');
  assert.equal(reportMonth('', 'KDP_Prior_Month_Royalties-2024-06-01-abc.xlsx'), '2024-06');
});

test('catalogue déduit des rapports : place de marché principale, prix public, statut, lien', () => {
  const titles = titlesFromReports(snaps);
  assert.equal(titles.length, 5);
  const n = titles.find((t) => t.id === 'B08AAAAAA1')!;
  assert.deepEqual([n.marketplace, n.price, n.currency, n.status, n.isbn], ['amazon.fr', 4.99, 'EUR', 'live', '9798000000011']);
  assert.equal(titles.find((t) => t.id === 'B08AAAAAA2')!.status, 'unknown', 'pas de vente dans le dernier rapport');
  assert.equal(amazonUrl(n.asin, n.marketplace), 'https://www.amazon.fr/dp/B08AAAAAA1');
  assert.equal(guessTitleLang(GENEA, 'amazon.fr'), 'de');
  assert.equal(guessTitleLang('Il mio libro genealogico - 10 generazioni da compilare', 'amazon.fr'), 'it');
  assert.equal(guessTitleLang('Mi libro genealógico - 10 generaciones para rellenar', 'amazon.com'), 'es');
  assert.equal(guessTitleLang('Whiskey tasting journal: Tasting notebook', 'amazon.de'), 'en');
});

test('livre « publié » créé depuis un titre KDP', () => {
  const t = titlesFromReports(snaps).find((x) => x.id === 'B08AAAAAA1')!;
  const b = bookFromKdpTitle(t, 'publie');
  assert.equal(b.metadata.title, 'Carnet de liaison nounou');
  assert.equal(b.metadata.subtitle, 'Cahier pour la communication parents-nounou');
  assert.equal(b.metadata.author, 'Éditions Liaison');
  assert.equal(b.metadata.price, 4.99);
  assert.equal(b.metadata.niche, 'Liaison nounou');
  assert.equal(b.presetId, 'nanny-liaison');
  assert.equal(b.status, 'publie');
  assert.equal(b.kdp?.url, 'https://www.amazon.fr/dp/B08AAAAAA1');
});

test('conseils : prix et marge calculés sur le coût réel, publicité, variantes', () => {
  const titles = titlesFromReports(snaps);
  const perfs = titles.map((t) => titlePerformance(snaps, t.id)!);
  const fams = familiesOf(perfs);
  const p = perfs.find((x) => x.key === 'B08AAAAAA1')!;
  assert.equal(p.marketplace, 'amazon.fr');
  assert.deepEqual(p.months.map((m) => m.units), [25, 20, 164]);
  const advice = adviseTitle(p, { family: fams.get(familyKey(p.title)), themeLangs: ['fr'], year: 2026 });
  const price = advice.find((a) => a.area === 'prix')!;
  assert.equal(price.level, 'urgent');
  assert.match(price.title, /0,06\s€ par exemplaire/);
  assert.match(price.detail, /coût 2,16\s€, taux 60 %/);
  assert.match(price.detail, /10 juin 2025/);
  assert.match(price.detail, /9,99\s€ → 3,37\s€ par exemplaire \(60 %\)/);
  assert.ok(advice.some((a) => a.area === 'publicite' && a.title === 'Pas de publicité à ce prix'));
  assert.ok(advice.some((a) => a.area === 'variantes' && /3 variantes au titre identique/.test(a.title)));
  assert.ok(advice.some((a) => a.area === 'tendance' && /progression/.test(a.title) && /remonter le prix/.test(a.detail)));
  assert.ok(!advice.some((a) => a.area === 'marches'), 'liaison nounou : produit propre à la France');
  assert.equal(advice[0].level, 'urgent', 'conseils triés par priorité');
});

test('conseils : recul, saison, marge suffisante, mention datée', () => {
  const g = titlePerformance(snaps, 'B08BBBBBB1')!;
  const a = adviseTitle(g, { themeLangs: ['de', 'fr'], year: 2026 });
  assert.ok(!a.some((x) => x.area === 'prix'), 'prix au-dessus du seuil, marge correcte');
  assert.ok(a.some((x) => x.area === 'tendance' && /recul \(-95 %\)/.test(x.title)));
  assert.ok(a.some((x) => x.area === 'publicite' && /Marge suffisante/.test(x.title)));
  assert.ok(a.some((x) => x.area === 'saison' && /Pic de décembre/.test(x.title)));
  assert.equal(themeOf(g.title)?.id, 'genealogie');
  const old = adviseTitle(titlePerformance(snaps, 'B08CCCCCC1')!, { year: 2026 });
  assert.ok(old.some((x) => x.level === 'urgent' && /« 2020 »/.test(x.title) && /nouvelle édition/.test(x.detail)));
});

test('diagnostic du catalogue : redevances qui baissent plus vite que les ventes, taux de 50 %', () => {
  const d = catalogDiagnosis(snaps);
  assert.equal(d.currency, 'EUR');
  assert.deepEqual(d.months.map((m) => m.month), ['2021-12', '2022-06', '2025-12']);
  const drop = d.findings[0];
  assert.equal(drop.level, 'urgent');
  assert.match(drop.title, /Redevances -95 %, exemplaires \+7 % \(déc\. 2021 → déc\. 2025\)/);
  assert.match(drop.detail, /chaque vente rapporte beaucoup moins/);
  assert.ok(d.findings.some((f) => /au taux de 50 %/.test(f.title)));
  assert.ok(d.findings.some((f) => f.title === 'Les plus fortes baisses de redevances' && /Mein Stammbaum/.test(f.detail)));
});
