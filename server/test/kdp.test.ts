import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';
import type { Book, KdpFillPayload, KdpRawCapture, KdpState } from '@shared';

// Base de données jetable : ces tests écrivent dans db.json
process.env.BOOK_CREATOR_DATA = mkdtempSync(join(tmpdir(), 'bc-kdp-'));
// Dossier des rapports .xlsx « locaux » (import depuis le dossier du projet)
process.env.BOOK_CREATOR_IDEAS = mkdtempSync(join(tmpdir(), 'bc-kdp-reports-'));
const { createBook } = await import('@shared');
const { db } = await import('../src/db');
const { kdpRouter } = await import('../src/kdp/routes');

const app = express();
app.use(express.json());
app.use('/api/kdp', kdpRouter);
const server = app.listen(0);
after(() => server.close());
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/kdp`;

const call = async <T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> => {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, data: (res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text) as T };
};

const shelfText = 'Carnet de liaison nounou\npar Éditions de la Forêt\nBroché\nEN VENTE\nASIN : B0LIAISON1\nPrix : 7,90 €';
const capture = (url: string, text: string, ladders: KdpRawCapture['ladders'], extra: Partial<KdpRawCapture> = {}): KdpRawCapture => ({
  v: 1, kind: 'kdp', url, host: 'kdp.amazon.com', lang: 'fr', capturedAt: '2026-10-15T10:00:00Z', text, ladders, ...extra,
});

test('capture : hôte vérifié, Bibliothèque puis Rapports, journal du texte brut', async () => {
  const bad = await call('POST', '/capture', { ...capture('https://kdp.amazon.com/fr_FR/bookshelf', '', []), host: 'evil.example' });
  assert.equal(bad.status, 400);

  const shelf = await call<{ page: string; message: string }>('POST', '/capture', capture('https://kdp.amazon.com/fr_FR/bookshelf', shelfText, [
    { id: 'B0LIAISON1', texts: ['ASIN : B0LIAISON1', shelfText] },
  ]));
  assert.equal(shelf.data.page, 'bookshelf');
  assert.match(shelf.data.message, /1 nouveau/);

  const row = 'Carnet de liaison nounou\tB0LIAISON1\tAmazon.fr\tBroché\t12\t18,60 €';
  const rep = await call<{ message: string }>('POST', '/capture', capture('https://kdp.amazon.com/fr_FR/reports-new/royalties', row, [
    { id: 'B0LIAISON1', texts: ['B0LIAISON1', row] },
  ], { period: '1 sept. 2026 - 30 sept. 2026' }));
  assert.match(rep.data.message, /1 ligne\(s\), 12 exemplaire/);
  // Même période capturée à nouveau : remplacée, pas additionnée
  await call('POST', '/capture', capture('https://kdp.amazon.com/fr_FR/reports-new/royalties', row, [{ id: 'B0LIAISON1', texts: ['B0LIAISON1', row] }], {
    period: '1 sept. 2026 - 30 sept. 2026', capturedAt: '2026-10-15T11:00:00Z',
  }));

  const state = await call<KdpState & { captures: { size: number }[] }>('GET', '/');
  assert.equal(state.data.titles.length, 1);
  assert.equal(state.data.snapshots.length, 1);
  assert.equal(state.data.captures.length, 3);
  assert.ok(!('text' in state.data.captures[0]), 'le texte brut n\'est pas renvoyé dans l\'état');
  const raw = await call<string>('GET', '/captures/2/text');
  assert.equal(raw.data, shelfText);
});

test('import d\'un titre de la Bibliothèque, puis liaison à un autre livre', async () => {
  const imp = await call<Book>('POST', '/titles/B0LIAISON1/import');
  assert.equal(imp.status, 200);
  assert.equal(imp.data.metadata.title, 'Carnet de liaison nounou');
  assert.equal(imp.data.metadata.author, 'Éditions de la Forêt');
  assert.equal(imp.data.status, 'publie');
  assert.equal(imp.data.kdp?.asin, 'B0LIAISON1');
  assert.equal((await call('POST', '/titles/B0LIAISON1/import')).status, 409, 'pas de double import');

  const other = createBook({ presetId: 'password-book' });
  db.data.books.push(other);
  await call('POST', '/titles/B0LIAISON1/link', { bookId: other.id });
  assert.equal(db.data.books.find((b) => b.id === imp.data.id)?.kdp, null, 'l\'ancien lien est retiré');
  assert.equal(db.data.books.find((b) => b.id === other.id)?.kdp?.titleId, 'B0LIAISON1');
  assert.equal(db.data.kdp.titles[0].bookId, other.id);
});

test('publication assistée : préparation, lecture par la page relais, effacement', async () => {
  assert.equal((await call('GET', '/publish/current')).status, 404);
  const book = createBook({ presetId: 'password-book', title: 'Carnet de mots de passe' });
  book.metadata.author = 'Éditions de la Forêt';
  db.data.books.push(book);
  const prep = await call<KdpFillPayload>('POST', `/publish/${book.id}`);
  assert.equal(prep.data.title, 'Carnet de mots de passe');
  assert.equal(prep.data.authorLast, 'Forêt');
  assert.equal(prep.data.files.interior, `/api/books/${book.id}/interior.pdf?download=1`);
  const cur = await call<KdpFillPayload>('GET', '/publish/current');
  assert.equal(cur.data.bookId, book.id);
  await call('DELETE', '/publish/current');
  assert.equal((await call('GET', '/publish/current')).status, 404);
  assert.equal((await call('POST', '/publish/inconnu')).status, 404);
});

test('favori autonome : aucune décomposition d\'objet (le build injecterait des fonctions extérieures)', async () => {
  const { readFile } = await import('node:fs/promises');
  const { ROOT_DIR } = await import('../src/config');
  const src = await readFile(join(ROOT_DIR, 'client/src/app/core/favori.ts'), 'utf8');
  const code = src.slice(src.indexOf('export function bookCreatorFavori'));
  assert.doesNotMatch(code, /\{\s*\.\.\.|,\s*\.\.\.\w[\w.]*\s*[,}]/, 'utiliser Object.assign');
});

// Rapport KDP « Prior Month Royalties » minimal, écrit avec exceljs comme l'export KDP
async function royaltyXlsx(label: string, rows: unknown[][]) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const print = wb.addWorksheet('Redevances sur les livres broch');
  print.addRow(['Période de vente', label]);
  print.addRow(['Titre', 'Auteur', 'ISBN', 'Marché', 'Exemplaires vendus', 'Exemplaires remboursés', "Type de droits d'auteur", 'Prix catalogue moyen HT', 'Prix de vente moyen HT', 'Coût de fabrication moyen', 'Redevance', 'Devise', 'ASIN']);
  for (const r of rows) print.addRow(r);
  wb.addWorksheet('Total des revenus').addRow(['Période de vente', label]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

test('rapports de redevances : import (téléversement puis dossier), livres publiés avec lien, réimport sans doublon', async () => {
  const { writeFile } = await import('node:fs/promises');
  const row = (units: number, rate: string, cost: number, royalty: number) =>
    ['Cahier de caisse: Livre de caisse pour professionnel', 'Éditions Compta', '9798000000066', 'Amazon.fr', units, 0, rate, 5.68, 5.68, cost, royalty, 'EUR', 'B08DDDDDD1'];
  const form = new FormData();
  form.append('files', new Blob([await royaltyXlsx('juin 2025', [row(21, '60%', 2.48, 11.55)])]), 'KDP_Prior_Month_Royalties-2025-06-01-a.xlsx');
  form.append('files', new Blob([Buffer.from('pas un classeur')]), 'KDP_bad.xlsx');
  const res = await fetch(`${base}/reports`, { method: 'POST', body: form });
  const r1 = (await res.json()) as { files: { file: string; rows: number; error?: string }[]; months: string[]; books: number };
  assert.equal(r1.files[0].rows, 1);
  assert.match(r1.files[1].error ?? '', /illisible/);
  assert.deepEqual(r1.months, ['2025-06']);
  assert.equal(r1.books, 1);
  const book = db.data.books.find((b) => b.kdp?.titleId === 'B08DDDDDD1')!;
  assert.equal(book.status, 'publie');
  assert.equal(book.metadata.title, 'Cahier de caisse');
  assert.equal(book.kdp?.url, 'https://www.amazon.fr/dp/B08DDDDDD1');

  const dir = process.env.BOOK_CREATOR_IDEAS!;
  await writeFile(join(dir, 'KDP_Prior_Month_Royalties-2026-07-01-b.xlsx'), await royaltyXlsx('juillet 2026', [row(62, '50%', 2.48, 22.32)]));
  await writeFile(join(dir, 'KDP_Prior_Month_Royalties-2025-06-01-a.xlsx'), await royaltyXlsx('juin 2025', [row(21, '60%', 2.48, 11.55)]));
  assert.equal((await call<{ files: string[] }>('GET', '/reports/local')).data.files.length, 2);
  const r2 = await call<{ months: string[]; books: number }>('POST', '/reports/import-local', {});
  assert.deepEqual(r2.data.months, ['2025-06', '2026-07']);
  assert.equal(r2.data.books, 0, 'le titre a déjà son livre');
  assert.equal(db.data.books.filter((b) => b.kdp?.titleId === 'B08DDDDDD1').length, 1);
  assert.equal(db.data.kdp.snapshots.filter((s) => s.month === '2025-06').length, 1, 'un mois réimporté remplace le précédent');
  assert.equal(db.data.kdp.titles.find((t) => t.id === 'B08DDDDDD1')?.status, 'live');
});
