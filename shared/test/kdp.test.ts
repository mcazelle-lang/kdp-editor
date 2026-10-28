import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  coverGeometry, createBook, estimateRoyalty, expandPages, interiorPageGeometry, minGutter, pageRange, printCost, renderCover,
  renderInteriorPage, spineWidthIn, TEMPLATES, totalPages, defaultParams, inToPt, type BookFormat, type Prim,
} from '../src/index';

const fmt = (o: Partial<BookFormat> = {}): BookFormat => ({ binding: 'paperback', trimId: '6x9', ink: 'bw-white', bleed: false, finish: 'matte', ...o });
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('épaisseur de dos KDP par type de papier', () => {
  close(spineWidthIn(fmt(), 100).value, 0.2252);
  close(spineWidthIn(fmt({ ink: 'bw-cream' }), 100).value, 0.25);
  close(spineWidthIn(fmt({ ink: 'premium-color' }), 100).value, 0.2347);
  close(spineWidthIn(fmt({ spineOverride: 0.5 }), 100).value, 0.5);
});

test('dimensions de couverture broché 6x9 / 100 pages', () => {
  const g = coverGeometry(fmt(), 100);
  close(g.widthIn, 0.125 * 2 + 6 * 2 + 0.2252);
  close(g.heightIn, 9.25);
  assert.equal(g.spineTextAllowed, true);
  assert.equal(coverGeometry(fmt(), 78).spineTextAllowed, false);
  // Code-barres dans la 4e de couverture, à 0,25 in du dos et du bas
  close(g.barcode.x + g.barcode.w, g.back.x + g.back.w - inToPt(0.25));
  close(g.barcode.y + g.barcode.h, g.back.y + g.back.h - inToPt(0.25));
});

test('dimensions forcées depuis le calculateur KDP (rigide)', () => {
  const g = coverGeometry(fmt({ binding: 'hardcover', coverSizeOverride: { w: 13.5, h: 10.25 } }), 120);
  close(g.widthIn, 13.5);
  close(g.spineIn, 13.5 - (10.25 - 9) - 12);
  assert.equal(g.estimated, false);
  assert.equal(coverGeometry(fmt({ binding: 'hardcover' }), 120).estimated, true);
});

test('marge intérieure minimale selon le nombre de pages', () => {
  assert.equal(minGutter(24), 0.375);
  assert.equal(minGutter(150), 0.375);
  assert.equal(minGutter(151), 0.5);
  assert.equal(minGutter(828), 0.875);
});

test('géométrie intérieure avec fond perdu : bord extérieur seulement', () => {
  const book = createBook({ presetId: 'notebook-lined' });
  book.format.bleed = true;
  const recto = interiorPageGeometry(book.format, book.interior, 120, 1);
  const verso = interiorPageGeometry(book.format, book.interior, 120, 2);
  close(recto.width, inToPt(6.125));
  close(recto.height, inToPt(9.25));
  assert.equal(recto.trim.x, 0);
  close(verso.trim.x, inToPt(0.125));
  assert.ok(recto.content.x - recto.trim.x >= inToPt(0.375) - 1e-6, 'gouttière côté reliure (gauche) sur un recto');
});

test('plages de pages et disponibilité des encres', () => {
  assert.deepEqual(pageRange('6x9', 'bw-white', 'paperback'), [24, 828]);
  assert.deepEqual(pageRange('8.5x11', 'bw-cream', 'paperback'), [24, 550]);
  assert.equal(pageRange('a4', 'std-color', 'paperback'), null);
  assert.deepEqual(pageRange('6x9', 'bw-white', 'hardcover'), [76, 550]);
});

test('coûts d\'impression et redevances (exemple officiel : 300 p. N&B = 4,60 $)', () => {
  close(printCost('USD', 'bw-white', 300, '6x9'), 4.6);
  close(printCost('USD', 'bw-white', 100, '6x9'), 2.3);
  close(printCost('USD', 'bw-white', 100, '8.5x11'), 2.84);
  close(printCost('EUR', 'bw-white', 120, '6x9'), 0.75 + 120 * 0.012);
  assert.equal(estimateRoyalty('amazon.com', 'bw-white', 120, '6x9', 9.99).rate, 0.6);
  assert.equal(estimateRoyalty('amazon.com', 'bw-white', 120, '6x9', 7.99).rate, 0.5);
});

const finite = (prims: Prim[]): boolean =>
  prims.every((p) => {
    if (p.k === 'group') return finite(p.children);
    return Object.values(p).every((v) => typeof v !== 'number' || Number.isFinite(v));
  });

test('chaque modèle de page produit des primitives valides', () => {
  for (const tpl of TEMPLATES) {
    const book = createBook();
    book.interior.sections = [{ id: 's1', templateId: tpl.id, pages: 3, params: defaultParams(tpl, 'fr') }];
    const pages = expandPages(book);
    for (const ref of pages) {
      const r = renderInteriorPage(book, ref, pages.length);
      assert.ok(finite(r.prims), `${tpl.id} produit des coordonnées invalides`);
    }
  }
});

test('alternance gauche/droite et page de complément', () => {
  const book = createBook();
  book.interior.sections = [{ id: 's', templateId: 'lined', pages: 5, params: {}, alt: { templateId: 'blank', params: {} } }];
  const pages = expandPages(book);
  assert.equal(pages.length, 6);
  assert.equal(totalPages(book), 6);
  assert.deepEqual(pages.map((p) => p.templateId), ['lined', 'blank', 'lined', 'blank', 'lined', 'blank']);
  assert.equal(pages[5].padding, true);
});

test('la couverture se rend sans erreur pour tous les styles de motif', () => {
  const book = createBook();
  for (const id of ['stripes', 'dots', 'grid', 'chevron', 'waves', 'triangles', 'maze', 'hexagons', 'confetti', 'memphis', 'floral', 'leather'] as const) {
    book.cover.pattern.id = id;
    const r = renderCover(book, 120, { guides: true });
    assert.ok(finite(r.prims), id);
  }
});
