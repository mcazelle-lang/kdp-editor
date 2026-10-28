import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBook, generateDescription, lintBook, lintKeyword, matchPreset, packKeywords, parseKeywordCounts, sanitizeDescription, unsupportedTags,
} from '../src/index';

test('mots-clés : marques, fautes volontaires, longueur, auteurs', () => {
  const titleWords = new Set<string>(['carnet']);
  const lv = (kw: string) => lintKeyword(kw, 0, titleWords).map((i) => i.level);
  assert.ok(lv('pencils activity frozen markers cars unicorn paint').includes('error'));
  assert.ok(lv('journql depense registre auto budget planner perso').includes('warning'));
  assert.ok(lv('x'.repeat(51)).includes('error'));
  assert.ok(lv('bushcraft 101 francais piero san giorgio nrbc note').includes('error'));
  assert.deepEqual(lv('idee cadeau anniversaire noel art dessin'), []);
});

test('description : balises KDP uniquement', () => {
  const html = '<h2>Titre <strong>gras</strong></h2><p style="x">Texte <span>ok</span></p>';
  assert.deepEqual(unsupportedTags(html).sort(), ['h2', 'span', 'strong']);
  const fixed = sanitizeDescription(html);
  assert.equal(fixed, '<h4>Titre <b>gras</b></h4><p>Texte ok</p>');
  assert.deepEqual(unsupportedTags(fixed), []);
});

test('description générée conforme', () => {
  const book = createBook({ presetId: 'password-book' });
  book.metadata.audience = 'ceux qui oublient leurs mots de passe';
  const html = generateDescription(book);
  assert.deepEqual(unsupportedTags(html), []);
  assert.ok(html.includes('fiches à remplir'));
  assert.ok(html.length < 4000);
});

test('rangement des mots-clés en 7 cases de 50 caractères', () => {
  const slots = packKeywords(['cadeau couple', 'saint valentin', 'journal intime', 'bucket list', 'idee cadeau mariage', 'anniversaire de mariage', 'questions reponses']);
  assert.equal(slots.length, 7);
  assert.ok(slots.every((s) => s.length <= 50));
});

test('lecture des listes « mot (nombre) »', () => {
  const r = parseKeywordCounts('herbier (22) cahier (13) canson (10)');
  assert.deepEqual(r[0], { word: 'herbier', count: 22 });
  assert.equal(r.length, 3);
});

test('choix automatique du préréglage depuis une idée', () => {
  assert.equal(matchPreset('Carnet de mot de passe')?.id, 'password-book');
  assert.equal(matchPreset('Registre des stupéfiants', 'Livre de caisse - motifs bleus')?.id, 'cash-book');
  assert.equal(matchPreset('Testing whisky', 'whiskey tasting journal')?.id, 'tasting-journal');
  assert.equal(matchPreset('Mon herbier secret de druide')?.id, 'herbarium');
});

test('un livre complet et propre ne remonte aucune erreur', () => {
  const book = createBook({ presetId: 'notebook-lined' });
  Object.assign(book.metadata, {
    title: 'Carnet de notes Bleu Horizon', author: 'Éditions Horizon', descriptionHtml: '', categories: ['Livres > Papeterie', '', ''],
    keywords: ['idee cadeau collegue', 'journal intime femme', 'bloc notes a5', 'bullet journal ligne', 'agenda papier', 'fournitures bureau', 'cadeau anniversaire'],
    price: 7.99,
  });
  book.metadata.descriptionHtml = generateDescription(book);
  const errors = lintBook(book).filter((i) => i.level === 'error');
  assert.deepEqual(errors, []);
});
