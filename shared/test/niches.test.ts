import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNicheMetrics, estimateDailySales, missingBsr, parseBsr, parseCapture, parseCount, parsePrice, parseRating, parseReviews,
  parseTotalResults, type Niche, type RawCapture,
} from '../src/index';

test('nombres, prix, notes et avis dans les formats des 5 marchés', () => {
  assert.equal(parseCount('12 345'), 12345);
  assert.equal(parseCount('12 345'), 12345);
  assert.equal(parseCount('12.345'), 12345);
  assert.equal(parseCount('12,345'), 12345);
  assert.equal(parseCount('(2,1 k)'), 2100);
  assert.equal(parsePrice('7,99 €'), 7.99);
  assert.equal(parsePrice('$7.99'), 7.99);
  assert.equal(parsePrice('1.299,00 €'), 1299);
  assert.equal(parsePrice('EUR 12,50'), 12.5);
  assert.equal(parseRating('4,6 sur 5 étoiles'), 4.6);
  assert.equal(parseRating('4.6 out of 5 stars'), 4.6);
  assert.equal(parseRating('4,6 von 5 Sternen'), 4.6);
  assert.equal(parseRating('4,6 de 5 estrellas'), 4.6);
  assert.equal(parseRating('4,6 su 5 stelle'), 4.6);
  assert.equal(parseReviews('1 234 évaluations'), 1234);
  assert.equal(parseReviews('1,234 ratings'), 1234);
  assert.equal(parseReviews('1.234 Sternebewertungen'), 1234);
  assert.equal(parseReviews('1.234 valoraciones'), 1234);
  assert.equal(parseReviews('1.234 voti'), 1234);
});

test('nombre total de résultats', () => {
  assert.equal(parseTotalResults('1-48 sur plus de 5 000 résultats pour "carnet de mot de passe"'), 5000);
  assert.equal(parseTotalResults('1-48 of over 10,000 results for "password book"'), 10000);
  assert.equal(parseTotalResults('1-48 von mehr als 3.000 Ergebnissen oder Vorschlägen für "passwortbuch"'), 3000);
  assert.equal(parseTotalResults('1-48 de más de 2.000 resultados para "cuaderno de contraseñas"'), 2000);
  assert.equal(parseTotalResults('1-48 dei più di 1.000 risultati in Libri per "quaderno password"'), 1000);
  assert.equal(parseTotalResults('312 résultats pour "registre des stupéfiants"'), 312);
});

test('BSR et sous-classements (FR, EN, DE, ES, IT)', () => {
  const fr = parseBsr("Éditeur ‏ : ‎ Independently published (12 mars 2024)\nClassement des meilleures ventes d'Amazon : 12 345 en Livres (Voir les 100 premiers en Livres)\n12 en Agendas et calendriers\n45 en Papeterie\nCommentaires client : 4,6 sur 5 étoiles");
  assert.deepEqual(fr, { bsr: 12345, bsrCategory: 'Livres', subRanks: [{ rank: 12, category: 'Agendas et calendriers' }, { rank: 45, category: 'Papeterie' }] });
  const en = parseBsr('Best Sellers Rank: #12,345 in Books (See Top 100 in Books)\n#15 in Password Books');
  assert.equal(en.bsr, 12345);
  assert.deepEqual(en.subRanks, [{ rank: 15, category: 'Password Books' }]);
  assert.equal(parseBsr('Amazon Bestseller-Rang: Nr. 54.321 in Bücher (Siehe Top 100 in Bücher)\nNr. 5 in Notizbücher').bsr, 54321);
  assert.equal(parseBsr('Clasificación en los más vendidos de Amazon: nº98.765 en Libros (Ver el Top 100 en Libros)').bsr, 98765);
  assert.equal(parseBsr('Posizione nella classifica Bestseller di Amazon: n. 3.210 in Libri (Visualizza i Top 100 nella categoria Libri)').bsr, 3210);
  assert.equal(parseBsr('Aucun classement').bsr, null);
});

const serpRaw: RawCapture = {
  v: 1, kind: 'serp', url: 'https://www.amazon.fr/s?k=carnet+de+mot+de+passe&i=stripbooks', host: 'www.amazon.fr', lang: 'fr-fr', capturedAt: '2026-10-15T08:00:00Z',
  resultInfo: '1-48 sur plus de 2 000 résultats pour "carnet de mot de passe"',
  cards: [
    { asin: 'B0AAAAAAA1', title: 'Sponsorisé Carnet de mots de passe A-Z', text: 'Sponsorisé\nCarnet de mots de passe A-Z\nBroché\n6,99 €', labels: ['4,5 sur 5 étoiles', '312 évaluations'], sponsored: false },
    { asin: 'B0AAAAAAA2', title: 'Mon répertoire de mots de passe', text: 'Mon répertoire de mots de passe\nde Éditions X\n4,7 sur 5 étoiles 1 204\nKindle\n2,99 €\nBroché\n7,49 €', labels: ['4,7 sur 5 étoiles', '1 204 évaluations'], sponsored: false },
    { asin: 'B0AAAAAAA3', title: 'Carnet codes secrets', text: 'Carnet codes secrets\nBroché\n8,99 €', labels: [], sponsored: false },
    { asin: 'pas-un-asin', title: 'Bloc', text: 'x', labels: [], sponsored: false },
  ],
};

test('capture d\'une page de résultats', () => {
  const p = parseCapture(serpRaw);
  assert.equal(p.marketplace, 'amazon.fr');
  assert.equal(p.keyword, 'carnet de mot de passe');
  assert.equal(p.serp?.totalResults, 2000);
  assert.equal(p.serp?.items.length, 3);
  const [a, b, c] = p.serp!.items;
  assert.equal(a.sponsored, true);
  assert.equal(b.price, 7.49, 'prix du broché, pas du Kindle');
  assert.equal(b.reviews, 1204);
  assert.equal(b.rating, 4.7);
  assert.equal(c.reviews, null);
  assert.equal(c.format, 'Broché');
});

test('capture d\'une fiche produit', () => {
  const p = parseCapture({
    v: 1, kind: 'product', url: 'https://www.amazon.com/dp/B0BBBBBBB1', host: 'www.amazon.com', lang: 'en-us', capturedAt: '2026-10-15T08:00:00Z',
    asin: 'B0BBBBBBB1', title: ' Password Book for Seniors ', price: '$6.99', rating: '4.7 out of 5 stars', reviews: '2,345 ratings',
    details: 'Publisher ‏ : ‎ Independently published (March 3, 2024)\nPaperback ‏ : ‎ 110 pages\nDimensions ‏ : ‎ 6 x 0.25 x 9 inches\nBest Sellers Rank: #8,765 in Books (See Top 100 in Books)\n#3 in Password Books',
  });
  assert.equal(p.marketplace, 'amazon.com');
  const prod = p.product!;
  assert.equal(prod.title, 'Password Book for Seniors');
  assert.equal(prod.bsr, 8765);
  assert.equal(prod.pages, 110);
  assert.equal(prod.publisher, 'Independently published');
  assert.equal(prod.publicationDate, 'March 3, 2024');
  assert.equal(prod.price, 6.99);
  assert.equal(prod.reviews, 2345);
  assert.equal(prod.dimensions, '6 x 0.25 x 9 inches');
  assert.throws(() => parseCapture({ ...serpRaw, host: 'www.ebay.fr' }));
});

const niche = (over: Partial<Niche> = {}): Niche => ({
  id: 'n1', marketplace: 'amazon.fr', keyword: 'carnet de mot de passe', source: 'autocompletion', status: 'nouvelle', createdAt: '', updatedAt: '',
  autocomplete: { position: 2, hits: 3, seed: 'carnet', seenAt: '' }, serp: null, products: [], notes: '', tags: [], report: null, bookIds: [], ...over,
});

test('score : données manquantes, demande et concurrence', () => {
  const empty = computeNicheMetrics(niche());
  assert.equal(empty.confidence, 'faible');
  assert.ok(empty.missing.length >= 2);
  assert.ok(empty.score <= 12);

  const serp = parseCapture(serpRaw).serp!;
  const products = ['B0AAAAAAA2', 'B0AAAAAAA3'].map((asin, i) => ({ asin, capturedAt: '', title: '', bsr: [40_000, 90_000][i], bsrCategory: 'Livres', subRanks: [], price: 7.49, rating: null, reviews: null, pages: 110, publisher: null, publicationDate: null, dimensions: null }));
  const m = computeNicheMetrics(niche({ serp, products }));
  assert.equal(m.demand.medianBsr, 65_000);
  assert.equal(m.demand.level, 'forte');
  assert.equal(m.competition.organicCount, 2);
  // 32 (BSR médian < 150 000) + 3 (médiane de 602 avis) + 6 (≈ 1,71 € de redevance) + 10 (autocomplétion)
  assert.deepEqual([m.demand.points, m.competition.points, m.profit.points, m.autocomplete.points, m.score], [32, 3, 6, 10, 51]);
  assert.equal(m.confidence, 'moyenne');
  assert.deepEqual(missingBsr(niche({ serp, products })), []);
  assert.deepEqual(missingBsr(niche({ serp })), ['B0AAAAAAA2', 'B0AAAAAAA3']);

  const tm = computeNicheMetrics(niche({ keyword: 'carnet moleskine', serp, products }));
  assert.ok(tm.score <= 10);
  assert.deepEqual(tm.trademarks, ['moleskine']);
});

test('estimation des ventes décroissante avec le BSR', () => {
  const us = estimateDailySales('amazon.com', 100_000);
  assert.ok(us > 0.8 && us < 3, `≈ 1-2 ventes/jour à 100 000 (${us})`);
  assert.ok(estimateDailySales('amazon.fr', 100_000) < us);
  assert.ok(estimateDailySales('amazon.com', 10_000) > estimateDailySales('amazon.com', 500_000));
});
