import { estimateRoyalty } from '../kdp/pricing';
import { findInk, findTrim, INTERIOR, LISTING, pageRange } from '../kdp/specs';
import type { Asset, Book } from '../model';
import { coverGeometry } from '../kdp/geometry';
import { totalPages } from '../interior/layout';
import { normalize } from '../interior/presets';
import { grayPercent } from '../color';
import {
  AMAZON_PROGRAMS, AUTHOR_NAMES, GENERIC_WORDS, KNOWN_TYPOS, MAYBE_TRADEMARKS, MISLEADING_FORMAT, PRICE_WORDS, REVIEW_WORDS, SUBJECTIVE,
  TIME_SENSITIVE, TITLE_GENERIC, TRADEMARKS,
} from './rules';

export type Level = 'error' | 'warning' | 'info';
export type Area = 'titre' | 'mots-cles' | 'description' | 'categories' | 'prix' | 'couverture' | 'interieur' | 'conformite';

export interface Issue {
  level: Level;
  area: Area;
  message: string;
  field?: string;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function hasTerm(normText: string, term: string): boolean {
  if (/^[a-z0-9 '-]+$/.test(term)) return new RegExp(`(^|[^a-z0-9])${escapeRe(term)}([^a-z0-9]|$)`).test(normText);
  return normText.includes(term);
}

export const findTerms = (text: string, terms: string[]) => {
  const n = normalize(text);
  return terms.filter((t) => hasTerm(n, t));
};

export const words = (s: string) => normalize(s).split(/[^a-z0-9]+/).filter((w) => w.length > 1);

/** Mots suspects : fautes connues ou « q » non suivi de « u » (ex. « journql »). */
export function suspectTypos(s: string): { word: string; fix?: string }[] {
  const out: { word: string; fix?: string }[] = [];
  for (const w of words(s)) {
    if (KNOWN_TYPOS[w]) out.push({ word: w, fix: KNOWN_TYPOS[w] });
    else if (/q(?!u)/.test(w) && !['qatar', 'iraq', 'coq', 'cinq', 'qi', 'faq', 'qr', 'qa', 'sql', 'mysql', 'nosql', 'iq', 'qwerty'].includes(w) && w !== 'q') out.push({ word: w });
  }
  return out;
}

export function lintKeyword(kw: string, i: number, titleWords: Set<string>): Issue[] {
  const issues: Issue[] = [];
  const field = `keywords.${i}`;
  const slot = `Mot-clé ${i + 1}`;
  const add = (level: Level, message: string) => issues.push({ level, area: 'mots-cles', message: `${slot} : ${message}`, field });
  if (kw.length > LISTING.keywordMax) add('error', `${kw.length} caractères (max ${LISTING.keywordMax}).`);
  const tm = findTerms(kw, TRADEMARKS);
  if (tm.length) add('error', `marque déposée « ${tm.join(', ')} » — interdit (risque de blocage du compte).`);
  const maybe = findTerms(kw, MAYBE_TRADEMARKS);
  if (maybe.length) add('warning', `« ${maybe.join(', ')} » peut être une marque déposée.`);
  const au = findTerms(kw, AUTHOR_NAMES);
  if (au.length) add('error', `nom d'auteur/personnalité « ${au.join(', ')} » — interdit par KDP.`);
  const prog = findTerms(kw, AMAZON_PROGRAMS);
  if (prog.length) add('error', `programme Amazon « ${prog.join(', ')} » — interdit.`);
  const subj = findTerms(kw, SUBJECTIVE);
  if (subj.length) add('error', `affirmation subjective « ${subj.join(', ')} ».`);
  const time = findTerms(kw, TIME_SENSITIVE);
  if (time.length) add('warning', `terme temporaire « ${time.join(', ')} ».`);
  if (/["«»“”]/.test(kw)) add('error', 'guillemets interdits.');
  const fmt = findTerms(kw, MISLEADING_FORMAT);
  if (fmt.length) add('warning', `« ${fmt.join(', ')} » décrit un autre format que le broché : trompeur.`);
  const typos = suspectTypos(kw);
  if (typos.length) add('warning', `faute probable : ${typos.map((t) => (t.fix ? `${t.word} → ${t.fix}` : t.word)).join(', ')} (les fautes volontaires sont interdites).`);
  const gen = findTerms(kw, GENERIC_WORDS);
  if (gen.length) add('info', `mot générique « ${gen.join(', ')} » : place gaspillée.`);
  const dup = words(kw).filter((w) => w.length > 3 && titleWords.has(w));
  if (dup.length) add('info', `répète le titre (${[...new Set(dup)].join(', ')}) : déjà indexé par Amazon, utilisez d'autres termes.`);
  return issues;
}

export function lintBook(book: Book, assets: Record<string, Asset> = {}): Issue[] {
  const issues: Issue[] = [];
  const add = (level: Level, area: Area, message: string, field?: string) => issues.push({ level, area, message, field });
  const m = book.metadata;
  const pages = totalPages(book);
  const trim = findTrim(book.format.trimId);

  // --- Titre
  const full = `${m.title} ${m.subtitle}`.trim();
  if (!m.title.trim()) add('error', 'titre', 'Le titre est obligatoire.', 'title');
  const tLen = m.title.length + (m.subtitle ? m.subtitle.length : 0);
  if (tLen > LISTING.titleSubtitleMax) add('error', 'titre', `Titre + sous-titre : ${tLen} caractères (max ${LISTING.titleSubtitleMax}).`, 'subtitle');
  for (const [list, msg, level] of [
    [TRADEMARKS, 'marque déposée', 'error'], [AUTHOR_NAMES, 'nom d\'auteur', 'error'], [SUBJECTIVE, 'affirmation subjective / « best-seller »', 'error'],
    [['free', 'gratuit'], 'mention « gratuit »', 'error'], [MAYBE_TRADEMARKS, 'marque possible', 'warning'],
  ] as [string[], string, Level][]) {
    const found = findTerms(full, list);
    if (found.length) add(level, 'titre', `Titre/sous-titre : ${msg} « ${found.join(', ')} ».`, 'title');
  }
  if (/<[^>]+>/.test(full)) add('error', 'titre', 'Pas de HTML dans le titre.', 'title');
  const counts = new Map<string, number>();
  for (const w of words(full)) if (TITLE_GENERIC.includes(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
  const repeated = [...counts].filter(([, c]) => c > 1).map(([w]) => w);
  if (repeated.length) add('warning', 'titre', `Mots génériques répétés (${repeated.join(', ')}) : KDP refuse le bourrage de mots-clés dans le titre.`, 'subtitle');
  if (m.subtitle && (m.subtitle.split(',').length > 4 || m.subtitle.length > 150)) add('warning', 'titre', 'Sous-titre très long ou en liste de mots-clés : risque de refus et de lisibilité.', 'subtitle');
  if (m.title && m.title === m.title.toUpperCase() && /[A-Z]{4}/.test(m.title)) add('info', 'titre', 'Titre tout en majuscules : préférez la casse normale dans la fiche.', 'title');
  const ct = book.cover.texts;
  if (ct.title.trim() && normalize(ct.title.trim()) !== normalize(m.title.trim())) add('error', 'couverture', 'Le titre sur la couverture doit correspondre au titre de la fiche KDP.', 'cover.title');
  if (ct.author.trim() && normalize(ct.author.trim()) !== normalize(m.author.trim())) add('warning', 'couverture', 'Le nom d\'auteur de la couverture diffère de la fiche KDP.', 'cover.author');
  if (!m.author.trim()) add('error', 'titre', 'Nom d\'auteur (ou pseudonyme / marque éditoriale) obligatoire.', 'author');

  // --- Mots-clés
  const titleWords = new Set(words(full));
  const filled = m.keywords.map((k) => k.trim()).filter(Boolean);
  if (filled.length < LISTING.keywordSlots) add('info', 'mots-cles', `${LISTING.keywordSlots - filled.length} emplacement(s) de mots-clés vide(s) : utilisez les 7.`, 'keywords');
  m.keywords.forEach((k, i) => k.trim() && issues.push(...lintKeyword(k.trim(), i, titleWords)));
  const seen = new Map<string, number>();
  m.keywords.forEach((k, i) => {
    for (const w of new Set(words(k))) {
      if (w.length < 4) continue;
      if (seen.has(w) && seen.get(w) !== i) {
        add('info', 'mots-cles', `« ${w} » apparaît dans plusieurs mots-clés : une seule fois suffit.`, `keywords.${i}`);
        break;
      }
      seen.set(w, i);
    }
  });

  // --- Description
  const desc = m.descriptionHtml ?? '';
  if (!desc.trim()) add('error', 'description', 'Description vide.', 'description');
  if (desc.length > LISTING.descriptionMax) add('error', 'description', `${desc.length} caractères (max ${LISTING.descriptionMax}, balises comprises).`, 'description');
  const bad = unsupportedTags(desc);
  if (bad.length) add('error', 'description', `Balises HTML non prises en charge : ${bad.map((b) => `<${b}>`).join(' ')} (utilisez h4-h6, b, i, u, em, p, br, ul, ol, li). Bouton « Corriger le HTML ».`, 'description');
  if (/(https?:\/\/|www\.|@[a-z0-9-]+\.[a-z])/i.test(desc)) add('error', 'description', 'Pas d\'URL ni d\'e-mail dans la description.', 'description');
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(desc)) add('error', 'description', 'Les emojis sont interdits.', 'description');
  const descText = stripTags(desc);
  const rev = findTerms(descText, REVIEW_WORDS);
  if (rev.length) add('warning', 'description', `Avis / témoignages interdits (${rev.join(', ')}).`, 'description');
  const price = findTerms(descText, PRICE_WORDS);
  if (price.length) add('warning', 'description', `Prix ou promotion à éviter (${price.join(', ')}).`, 'description');
  if (m.lowContent && /feuilleter|look inside/i.test(descText)) add('warning', 'description', 'Sans ISBN, un livre low-content n\'a pas de « Feuilleter / Look Inside » : retirez cette mention ou utilisez votre propre ISBN.', 'description');
  const descTm = findTerms(descText, TRADEMARKS);
  if (descTm.length) add('error', 'description', `Marque déposée dans la description : ${descTm.join(', ')}.`, 'description');

  // --- Catégories
  const cats = m.categories.filter((c) => c.trim());
  if (!cats.length) add('warning', 'categories', 'Choisissez jusqu\'à 3 catégories (les moins concurrentielles mais pertinentes).', 'categories');
  if (cats.length > LISTING.categoriesMax) add('error', 'categories', `Maximum ${LISTING.categoriesMax} catégories.`, 'categories');

  // --- Conformité
  if (m.lowContent && m.series.trim()) add('error', 'conformite', 'Les livres low-content ne peuvent pas faire partie d\'une série KDP.', 'series');
  add('info', 'conformite', `Limite KDP : environ ${LISTING.weeklyTitleLimit} nouveaux titres par format et par semaine (à vérifier) : planifiez vos sorties et privilégiez la qualité.`);
  if (m.aiGenerated.images || m.aiGenerated.text) add('info', 'conformite', 'Contenu généré par IA : cochez la déclaration correspondante lors de la publication KDP.');

  // --- Prix
  const est = estimateRoyalty(m.marketplace, book.format.ink, pages, book.format.trimId, m.price);
  if (m.price < est.minPrice) add('error', 'prix', `Prix inférieur au minimum KDP (≈ ${est.minPrice.toFixed(2)} ${est.currency}).`, 'price');
  else if (est.royalty <= 0.3) add('warning', 'prix', `Redevance très faible (${est.royalty.toFixed(2)} ${est.currency} par vente).`, 'price');
  if (m.price < est.highRatePrice) add('info', 'prix', `Sous ${est.highRatePrice} ${est.currency} la redevance est de 50 % au lieu de 60 %.`, 'price');

  // --- Intérieur
  const range = pageRange(book.format.trimId, book.format.ink, book.format.binding);
  if (!range) add('error', 'interieur', `Le format ${trim.label} n'existe pas en « ${findInk(book.format.ink).label} »${book.format.binding === 'hardcover' ? ' (rigide)' : ''}.`, 'format');
  else if (pages < range[0] || pages > range[1]) add('error', 'interieur', `${pages} pages : ce format accepte ${range[0]} à ${range[1]} pages.`, 'pages');
  if (!trim.bindings.includes(book.format.binding)) add('error', 'interieur', `Le format ${trim.label} n'est pas disponible en ${book.format.binding === 'hardcover' ? 'rigide' : 'broché'}.`, 'format');
  if (book.interior.lineWidth < INTERIOR.minLineWeightPt) add('error', 'interieur', `Épaisseur de trait ${book.interior.lineWidth} pt < minimum KDP ${INTERIOR.minLineWeightPt} pt.`, 'lineWidth');
  if (grayPercent(book.interior.lineColor) < INTERIOR.minGrayPercent) add('error', 'interieur', 'Lignes trop claires (moins de 10 % de gris) : elles risquent de ne pas s\'imprimer.', 'lineColor');
  if (!book.interior.sections.length) add('error', 'interieur', 'Aucune section d\'intérieur.', 'sections');

  // --- Couverture
  const geo = coverGeometry(book.format, pages);
  if (!geo.spineTextAllowed && book.cover.spine.show) add('info', 'couverture', `Moins de 80 pages : pas de texte sur le dos (masqué automatiquement).`, 'spine');
  if (geo.estimated) add('warning', 'couverture', 'Reliure rigide : saisissez les dimensions du calculateur KDP (ou importez le gabarit officiel) — l\'épaisseur du dos est estimée.', 'coverSize');
  const dpi = (id: string | null | undefined, wPt: number, hPt: number, where: string) => {
    const a = id ? assets[id] : undefined;
    if (!a) return;
    const eff = Math.min(a.width / (wPt / 72), a.height / (hPt / 72));
    if (eff < INTERIOR.minDpi) add('warning', 'couverture', `${where} : ${Math.round(eff)} DPI effectifs (< 300). Utilisez une image plus grande.`, 'image');
  };
  const c = book.cover;
  if (c.background.type === 'image') dpi(c.background.imageId, geo.width, geo.height, 'Image de fond');
  dpi(c.frontImage.imageId, c.frontImage.w * geo.front.w, c.frontImage.h * geo.front.h, 'Illustration');

  return issues;
}

export function score(issues: Issue[]): number {
  const e = issues.filter((i) => i.level === 'error').length;
  const w = issues.filter((i) => i.level === 'warning').length;
  return Math.max(0, 100 - e * 12 - w * 4);
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export function unsupportedTags(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/<\/?\s*([a-z0-9]+)[^>]*>/gi)) {
    const tag = m[1].toLowerCase();
    if (!LISTING.allowedHtmlTags.includes(tag)) found.add(tag);
  }
  return [...found];
}

/** Convertit une description vers les balises acceptées par KDP. */
export function sanitizeDescription(html: string): string {
  return html
    .replace(/<\s*(\/?)\s*strong\b[^>]*>/gi, '<$1b>')
    .replace(/<\s*(\/?)\s*h[1-3]\b[^>]*>/gi, '<$1h4>')
    .replace(/<\s*(\/?)\s*([a-z0-9]+)\b[^>]*>/gi, (all, slash: string, tag: string) => {
      const t = tag.toLowerCase();
      return LISTING.allowedHtmlTags.includes(t) ? `<${slash}${t}>` : '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
