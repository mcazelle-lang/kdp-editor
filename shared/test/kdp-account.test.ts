import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFillPayload, createBook, emptyKdpState, kdpPage, mergeTitles, parseKdpBookshelf, parseKdpReports, salesByMarketplace, salesByTitle,
  splitAuthor, totals, unsoldLiveTitles, type KdpRawCapture,
} from '../src/index';

// Textes tels que les remonte le favori : pour chaque ASIN, les textes de ses ancêtres successifs
const book1 = 'Carnet de liaison nounou\npar Éditions de la Forêt\nBroché\nEN VENTE\nASIN : B0LIAISON1\nPrix : 7,90 €\nPublié le 4 sept. 2025\neBook Kindle\nBROUILLON\nASIN : B0LIAISONK\nPrix : 2,99 €';
const book2 = 'Mon herbier secret de druide\npar Éditions de la Forêt\nBroché\nEN COURS DE VÉRIFICATION\nISBN : 9798765432101\nPrix : 9,99 €';

const bookshelf: KdpRawCapture = {
  v: 1, kind: 'kdp', url: 'https://kdp.amazon.com/fr_FR/bookshelf', host: 'kdp.amazon.com', lang: 'fr', capturedAt: '2026-10-15T10:00:00Z',
  text: `${book1}\n\n${book2}`,
  ladders: [
    { id: 'B0LIAISON1', texts: ['ASIN : B0LIAISON1', 'Broché\nEN VENTE\nASIN : B0LIAISON1\nPrix : 7,90 €\nPublié le 4 sept. 2025', book1, `${book1}\n\n${book2}`] },
    { id: 'B0LIAISONK', texts: ['ASIN : B0LIAISONK', 'eBook Kindle\nBROUILLON\nASIN : B0LIAISONK\nPrix : 2,99 €', book1, `${book1}\n\n${book2}`] },
    { id: '9798765432101', texts: ['ISBN : 9798765432101', book2, `${book1}\n\n${book2}`] },
  ],
};

test('Bibliothèque KDP : titres, formats, statuts, prix, dates', () => {
  assert.equal(kdpPage(bookshelf.url), 'bookshelf');
  assert.equal(kdpPage('https://kdp.amazon.com/en_US/reports-new/dashboard'), 'reports');
  const titles = parseKdpBookshelf(bookshelf);
  assert.equal(titles.length, 3);
  const p = titles.find((t) => t.id === 'B0LIAISON1')!;
  assert.equal(p.title, 'Carnet de liaison nounou');
  assert.equal(p.author, 'Éditions de la Forêt');
  assert.equal(p.format, 'paperback');
  assert.equal(p.status, 'live');
  assert.equal(p.price, 7.9);
  assert.equal(p.date, '4 sept. 2025');
  const k = titles.find((t) => t.id === 'B0LIAISONK')!;
  assert.deepEqual([k.title, k.format, k.status, k.price], ['Carnet de liaison nounou', 'ebook', 'draft', 2.99]);
  const h = titles.find((t) => t.id === '9798765432101')!;
  assert.deepEqual([h.title, h.status, h.isbn, h.asin], ['Mon herbier secret de druide', 'review', '9798765432101', null]);
});

test('fusion du catalogue : les liens vers les livres de l\'app sont conservés', () => {
  const first = parseKdpBookshelf(bookshelf);
  first[0].bookId = 'b123';
  const again = parseKdpBookshelf({ ...bookshelf, capturedAt: '2026-10-16T10:00:00Z' });
  const merged = mergeTitles(first, again);
  assert.equal(merged.added, 0);
  assert.equal(merged.updated, 3);
  assert.equal(merged.titles.find((t) => t.id === first[0].id)?.bookId, 'b123');
  assert.equal(merged.titles.find((t) => t.id === first[0].id)?.firstSeenAt, '2026-10-15T10:00:00Z');
});

const row1 = 'Carnet de liaison nounou\nB0LIAISON1\nAmazon.fr\nBroché\n12\n18,60 €';
const row2 = 'Carnet de liaison nounou\nB0LIAISON1\nAmazon.de\nBroché\n3\n4,10 €';
const row3 = 'Password Book for Seniors\nB0PASSWORD\nAmazon.com\nPaperback\nUnits sold: 25\n$41.25';
const reports: KdpRawCapture = {
  v: 1, kind: 'kdp', url: 'https://kdp.amazon.com/fr_FR/reports-new/royalties', host: 'kdp.amazon.com', lang: 'fr', capturedAt: '2026-10-15T11:00:00Z',
  period: '1 sept. 2026 - 30 sept. 2026',
  text: [row1, row2, row3].join('\n'),
  ladders: [
    { id: 'B0LIAISON1', texts: ['B0LIAISON1', row1, [row1, row2, row3].join('\n')] },
    { id: 'B0PASSWORD', texts: ['B0PASSWORD', row3, [row1, row2, row3].join('\n')] },
  ],
};

test('Rapports KDP : unités, redevances, marché, période', () => {
  const snap = parseKdpReports(reports);
  assert.equal(snap.period, '1 sept. 2026 - 30 sept. 2026');
  const fr = snap.rows.find((r) => r.asin === 'B0LIAISON1')!;
  assert.deepEqual([fr.units, fr.royalty, fr.currency, fr.marketplace, fr.format], [12, 18.6, 'EUR', 'Amazon.fr', 'paperback']);
  const us = snap.rows.find((r) => r.asin === 'B0PASSWORD')!;
  assert.deepEqual([us.units, us.royalty, us.currency, us.title], [25, 41.25, 'USD', 'Password Book for Seniors']);
});

test('analyses : par titre, par marché, totaux, titres en vente sans vente', () => {
  const s1 = parseKdpReports(reports);
  const s1bis = parseKdpReports({ ...reports, capturedAt: '2026-10-15T12:00:00Z' });
  const byTitle = salesByTitle([s1, s1bis]);
  assert.equal(byTitle[0].title, 'Password Book for Seniors', 'une seule capture par période est comptée');
  assert.equal(byTitle[0].units, 25);
  assert.deepEqual(byTitle.find((t) => t.asin === 'B0LIAISON1')?.royalties, { EUR: 18.6 });
  assert.deepEqual(totals([s1]), { units: 37, kenp: 0, royalties: { EUR: 18.6, USD: 41.25 } });
  assert.equal(salesByMarketplace([s1])[0].marketplace, 'Amazon.com');
  const state = { ...emptyKdpState(), titles: parseKdpBookshelf(bookshelf), snapshots: [s1] };
  assert.deepEqual(unsoldLiveTitles(state).map((t) => t.id), [], 'le seul titre en vente a vendu');
});

test('paquet de publication : auteur, impression, blocages', () => {
  assert.deepEqual(splitAuthor('Éditions de la Forêt'), { first: 'Éditions de la', last: 'Forêt' });
  assert.deepEqual(splitAuthor('Forêt'), { first: '', last: 'Forêt' });
  const book = createBook({ presetId: 'password-book' });
  const empty = buildFillPayload(book, { interior: '/i.pdf', cover: '/c.pdf' });
  assert.ok(empty.blocking.some((b) => b.includes('titre est obligatoire')));
  assert.equal(empty.print.pages, 110);
  assert.equal(empty.marketplace, 'Amazon.fr');
  assert.equal(empty.currency, 'EUR');
});

test('Bibliothèque : un livre multi-format en 2e position garde son propre titre', () => {
  const all = `${book2}\n\n${book1}`;
  const swapped: KdpRawCapture = {
    ...bookshelf,
    text: all,
    ladders: [
      { id: '9798765432101', texts: ['ISBN : 9798765432101', book2, all] },
      { id: 'B0LIAISON1', texts: ['ASIN : B0LIAISON1', 'Broché\nEN VENTE\nASIN : B0LIAISON1\nPrix : 7,90 €', book1, all] },
      { id: 'B0LIAISONK', texts: ['ASIN : B0LIAISONK', 'eBook Kindle\nBROUILLON\nASIN : B0LIAISONK', book1, all] },
    ],
  };
  const titles = parseKdpBookshelf(swapped);
  assert.equal(titles.find((t) => t.id === 'B0LIAISON1')?.title, 'Carnet de liaison nounou');
  assert.equal(titles.find((t) => t.id === 'B0LIAISONK')?.title, 'Carnet de liaison nounou');
  assert.equal(titles.find((t) => t.id === '9798765432101')?.title, 'Mon herbier secret de druide');
});

test('Rapports : cellules de tableau séparées par des tabulations', () => {
  const row = 'Carnet de liaison nounou\tB0LIAISON1\tAmazon.fr\tBroché\t12\t18,60 €';
  const snap = parseKdpReports({ ...reports, text: row, ladders: [{ id: 'B0LIAISON1', texts: ['B0LIAISON1', row] }] });
  assert.deepEqual(
    [snap.rows[0].title, snap.rows[0].units, snap.rows[0].royalty, snap.rows[0].marketplace],
    ['Carnet de liaison nounou', 12, 18.6, 'Amazon.fr'],
  );
});

test('Rapports : un même ASIN sur plusieurs lignes (une par place de marché)', () => {
  const fr = 'Carnet de liaison nounou\tB0LIAISON1\tAmazon.fr\tBroché\t12\t18,60 €';
  const de = 'Carnet de liaison nounou\tB0LIAISON1\tAmazon.de\tBroché\t3\t4,10 €';
  const table = `Titre\tASIN\tPlace de marché\n${fr}\n${de}`;
  // Lignes de tableau capturées
  const viaRows = parseKdpReports({ ...reports, text: table, ladders: [], rows: [fr, de] });
  assert.deepEqual(viaRows.rows.map((r) => [r.marketplace, r.units]), [['Amazon.fr', 12], ['Amazon.de', 3]]);
  // Sans lignes de tableau : deux échelles distinctes pour le même ASIN
  const viaLadders = parseKdpReports({ ...reports, text: table, ladders: [{ id: 'B0LIAISON1', texts: ['B0LIAISON1', fr, table] }, { id: 'B0LIAISON1', texts: ['B0LIAISON1', de, table] }] });
  assert.equal(viaLadders.rows.length, 2);
  assert.equal(totals([viaLadders]).units, 15);
});
