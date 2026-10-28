import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createBook, PRESETS, totalPages, type Book } from '@shared';
import { ROOT_DIR } from '../src/config';
import { parseIdeasWorkbook } from '../src/import/xlsx';
import { buildCoverPdf, buildInteriorPdf } from '../src/pdf/documents';

const collect = (doc: PDFKit.PDFDocument) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

const pageCount = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

// Fichier d'idées personnel, non versionné : le test est sauté sur un clone du dépôt
const IDEAS_FILE = 'Low content Q1 2020.xlsx';
test('import du fichier « Low content Q1 2020.xlsx »', { skip: !existsSync(join(ROOT_DIR, IDEAS_FILE)) && 'fichier d\'idées absent (non versionné)' }, async () => {
  const file = IDEAS_FILE;
  const ideas = await parseIdeasWorkbook(await readFile(join(ROOT_DIR, file)), file);
  assert.ok(ideas.length > 50, `${ideas.length} idées`);
  const stup = ideas.find((i) => i.niche === 'Registre des stupéfiants');
  assert.ok(stup);
  assert.equal(stup.titles.length, 10);
  assert.equal(stup.keywords.length, 7);
  assert.ok(stup.description.includes('Code de la Santé'));
  const password = ideas.find((i) => i.niche === 'Carnet de mot de passe');
  assert.ok(password?.translations['de']);
  assert.ok(!ideas.some((i) => i.categories.some((c) => /^a{10,}$/.test(c))), 'la règle « aaaa » est ignorée');
  const noContent = ideas.filter((i) => i.category === 'No content');
  assert.equal(noContent.length, 1);
});

test('PDF intérieur et couverture pour chaque préréglage', async () => {
  for (const preset of PRESETS) {
    const book: Book = createBook({ presetId: preset.id });
    book.metadata.title = preset.name;
    book.metadata.author = 'Test';
    const pdf = await collect(buildInteriorPdf(book));
    assert.equal(pageCount(pdf), totalPages(book), `${preset.id} : nombre de pages`);
    const cover = await collect(buildCoverPdf(book));
    assert.equal(pageCount(cover), 1, `${preset.id} : couverture sur une page`);
    assert.ok(!/\/BaseFont\s*\/(Helvetica|Times|Courier)/.test(pdf.toString('latin1') + cover.toString('latin1')), `${preset.id} : police non embarquée`);
  }
});
