import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import {
  bookFromKdpTitle, buildFillPayload, kdpPage, mergeTitles, parseKdpBookshelf, parseKdpReports,
  type KdpCaptureLog, type KdpRawCapture,
} from '@shared';
import { IDEAS_DIR } from '../config';
import { db } from '../db';
import { importLocalReports, importRoyaltyReports, localReportFiles } from './reports';

// Compte KDP sans connexion : les données viennent des pages KDP ouvertes par la personne (favori),
// la publication est assistée (le favori remplit le formulaire, la personne valide et publie).
export const kdpRouter = express.Router();

const wrap = (fn: (req: Request, res: Response) => Promise<unknown> | unknown) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res)).catch(next);

const MAX_LOGS = 12;
const KDP_HOST = 'kdp.amazon.com';

kdpRouter.get('/', (_req, res) => {
  const k = db.data.kdp;
  res.json({ ...k, captures: k.captures.map(({ text, ...c }) => ({ ...c, size: text.length })) });
});

kdpRouter.get('/captures/:index/text', (req, res) => {
  const c = db.data.kdp.captures[Number(req.params.index)];
  if (!c) return res.status(404).json({ error: 'Capture introuvable' });
  res.type('text/plain; charset=utf-8').send(c.text);
});

/** Capture d'une page KDP (Bibliothèque ou Rapports) relayée par la page /capture de l'app. */
kdpRouter.post('/capture', wrap(async (req, res) => {
  const raw = req.body as KdpRawCapture;
  if (raw?.v !== 1 || raw.kind !== 'kdp' || raw.host !== KDP_HOST || typeof raw.text !== 'string' || !Array.isArray(raw.ladders)) {
    return res.status(400).json({ error: 'Capture KDP invalide.' });
  }
  const k = db.data.kdp;
  const page = kdpPage(raw.url);
  let message = '';
  if (page === 'bookshelf') {
    const titles = parseKdpBookshelf(raw);
    const merged = mergeTitles(k.titles, titles);
    k.titles = merged.titles;
    message = titles.length
      ? `Bibliothèque : ${titles.length} format(s) lu(s), ${merged.added} nouveau(x), ${merged.updated} mis à jour.`
      : 'Bibliothèque : aucun titre reconnu sur cette page (texte brut conservé pour ajuster l\'analyse).';
  } else if (page === 'reports') {
    const snap = parseKdpReports(raw);
    k.snapshots = [snap, ...k.snapshots.filter((s) => s.period !== snap.period)].slice(0, 120);
    const units = snap.rows.reduce((s, r) => s + r.units, 0);
    message = snap.rows.length
      ? `Rapports (${snap.period}) : ${snap.rows.length} ligne(s), ${units} exemplaire(s).`
      : `Rapports (${snap.period}) : aucune ligne de vente reconnue (texte brut conservé pour ajuster l'analyse).`;
  } else {
    message = 'Page KDP non reconnue : ouvre ta Bibliothèque ou la page Rapports, ou un formulaire de création pour le remplissage.';
  }
  const log: KdpCaptureLog = { at: raw.capturedAt, page, url: raw.url, message, text: raw.text.slice(0, 60_000) };
  k.captures = [log, ...k.captures].slice(0, MAX_LOGS);
  await db.save();
  res.json({ page, message });
}));

kdpRouter.post('/titles/:id/link', wrap(async (req, res) => {
  const t = db.data.kdp.titles.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Titre KDP introuvable' });
  const bookId = req.body?.bookId ? String(req.body.bookId) : null;
  for (const b of db.data.books) if (b.kdp?.titleId === t.id) b.kdp = null;
  t.bookId = bookId;
  const book = bookId ? db.data.books.find((b) => b.id === bookId) : null;
  if (book) book.kdp = { titleId: t.id, asin: t.asin, status: t.status, linkedAt: new Date().toISOString() };
  await db.save();
  res.json(t);
}));

/** Crée dans l'app la fiche d'un carnet déjà publié (l'intérieur et la couverture ne sont pas récupérables depuis KDP). */
kdpRouter.post('/titles/:id/import', wrap(async (req, res) => {
  const t = db.data.kdp.titles.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Titre KDP introuvable' });
  if (t.bookId && db.data.books.some((b) => b.id === t.bookId)) return res.status(409).json({ error: 'Ce titre est déjà relié à un livre de l\'app.' });
  const book = bookFromKdpTitle(t);
  t.bookId = book.id;
  db.data.books.unshift(book);
  await db.save();
  res.json(book);
}));

kdpRouter.delete('/titles/:id', wrap(async (req, res) => {
  db.data.kdp.titles = db.data.kdp.titles.filter((t) => t.id !== req.params.id);
  await db.save();
  res.json({ ok: true });
}));

kdpRouter.delete('/snapshots/:id', wrap(async (req, res) => {
  db.data.kdp.snapshots = db.data.kdp.snapshots.filter((s) => s.id !== req.params.id);
  await db.save();
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- Rapports de redevances (.xlsx exportés de KDP)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 120 } });
const wantBooks = (v: unknown) => v !== false && v !== 'false';

kdpRouter.get('/reports/local', wrap(async (_req, res) => {
  res.json({ dir: IDEAS_DIR, files: await localReportFiles() });
}));

kdpRouter.post('/reports/import-local', wrap(async (req, res) => {
  res.json(await importLocalReports({ createBooks: wantBooks(req.body?.createBooks) }));
}));

kdpRouter.post('/reports', upload.array('files'), wrap(async (req, res) => {
  const files = ((req.files as Express.Multer.File[] | undefined) ?? []).map((f) => ({ name: Buffer.from(f.originalname, 'latin1').toString('utf8'), data: f.buffer }));
  if (!files.length) return res.status(400).json({ error: 'Aucun fichier .xlsx reçu.' });
  res.json(await importRoyaltyReports(files, { createBooks: wantBooks(req.body?.createBooks) }));
}));

// ---------------------------------------------------------------- Publication assistée
const fillPayload = (bookId: string) => {
  const book = db.data.books.find((b) => b.id === bookId);
  return book ? buildFillPayload(book, { interior: `/api/books/${book.id}/interior.pdf?download=1`, cover: `/api/books/${book.id}/cover.pdf?download=1` }) : null;
};

kdpRouter.post('/publish/:bookId', wrap(async (req, res) => {
  const payload = fillPayload(String(req.params.bookId));
  if (!payload) return res.status(404).json({ error: 'Livre introuvable' });
  db.data.kdp.publishing = { bookId: payload.bookId, preparedAt: new Date().toISOString() };
  await db.save();
  res.json(payload);
}));

/** Lu par la page relais quand le favori le demande depuis un formulaire KDP. */
kdpRouter.get('/publish/current', (_req, res) => {
  const p = db.data.kdp.publishing;
  const payload = p ? fillPayload(p.bookId) : null;
  if (!payload) return res.status(404).json({ error: 'Aucun livre en cours de publication : clique d\'abord « Publier sur KDP » dans l\'app.' });
  res.json(payload);
});

kdpRouter.delete('/publish/current', wrap(async (_req, res) => {
  db.data.kdp.publishing = null;
  await db.save();
  res.json({ ok: true });
}));
