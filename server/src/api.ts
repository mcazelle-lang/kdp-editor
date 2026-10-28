import express, { type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { unlink } from 'node:fs/promises';
import { extname, join } from 'node:path';
import {
  AGENT_SCOPES, bookFromIdea, coverTexts, createBook, findTrim, generateDescription, lintBook, totalPages, uid,
  type AgentEvent, type AgentRequest, type AgentStatus, type Book, type BookFormat, type Lang,
} from '@shared';
import { imagesAvailable } from './agent/images';
import { anthropicConfigured, friendlyError, runAgent } from './agent/run';
import { saveAsset } from './assets';
import { AGENT, UPLOADS_DIR } from './config';
import { db } from './db';
import { kdpRouter } from './kdp/routes';
import { nichesRouter } from './niches/routes';
import { openSse } from './sse';
import { importLocalIdeas, upsertIdeas } from './ideas';
import { parseIdeasWorkbook } from './import/xlsx';
import { buildCoverPdf, buildCoverTemplatePdf, buildInteriorPdf } from './pdf/documents';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024 } });
export const api = express.Router();

const wrap = (fn: (req: Request, res: Response) => Promise<unknown> | unknown) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res)).catch(next);

const slug = (s: string) =>
  (s || 'livre').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60).toLowerCase() || 'livre';

function sendPdf(res: Response, doc: PDFKit.PDFDocument, name: string, download: boolean) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${name}"`);
  doc.pipe(res);
}

function getBook(req: Request, res: Response): Book | null {
  const b = db.book(String(req.params.id));
  if (!b) res.status(404).json({ error: 'Livre introuvable' });
  return b ?? null;
}

api.get('/health', (_req, res) => res.json({ ok: true }));
api.use('/niches', nichesRouter);
api.use('/kdp', kdpRouter);

// ---------------------------------------------------------------- Idées
api.get('/ideas', (_req, res) => res.json(db.data.ideas));

api.post('/ideas/import', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier .xlsx manquant' });
  const ideas = await parseIdeasWorkbook(req.file.buffer, req.file.originalname);
  res.json({ ...(await upsertIdeas(ideas)), total: ideas.length });
}));

api.post('/ideas/import-local', wrap(async (_req, res) => res.json(await importLocalIdeas())));

api.delete('/ideas/:id', wrap(async (req, res) => {
  db.data.ideas = db.data.ideas.filter((i) => i.id !== req.params.id);
  await db.save();
  res.json({ ok: true });
}));

api.post('/ideas/:id/book', wrap(async (req, res) => {
  const idea = db.data.ideas.find((i) => i.id === req.params.id);
  if (!idea) return res.status(404).json({ error: 'Idée introuvable' });
  const book = bookFromIdea(idea, { titleIndex: Number(req.body?.titleIndex ?? 0), presetId: req.body?.presetId });
  db.data.books.unshift(book);
  await db.save();
  res.json(book);
}));

// ---------------------------------------------------------------- Livres
api.get('/books', (_req, res) => res.json(db.data.books));

api.post('/books', wrap(async (req, res) => {
  const b = createBook({ lang: (req.body?.lang ?? 'fr') as Lang, presetId: req.body?.presetId, title: req.body?.title, styleId: req.body?.styleId });
  db.data.books.unshift(b);
  await db.save();
  res.json(b);
}));

api.get('/books/:id', (req, res) => {
  const b = getBook(req, res);
  if (b) res.json(b);
});

api.put('/books/:id', wrap(async (req, res) => {
  const i = db.data.books.findIndex((b) => b.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Livre introuvable' });
  const next: Book = { ...req.body, id: db.data.books[i].id, createdAt: db.data.books[i].createdAt, updatedAt: new Date().toISOString() };
  db.data.books[i] = next;
  await db.save();
  res.json(next);
}));

api.delete('/books/:id', wrap(async (req, res) => {
  db.data.books = db.data.books.filter((b) => b.id !== req.params.id);
  await db.save();
  res.json({ ok: true });
}));

api.post('/books/:id/duplicate', wrap(async (req, res) => {
  const b = getBook(req, res);
  if (!b) return;
  const copy: Book = structuredClone(b);
  copy.id = uid('b');
  copy.createdAt = copy.updatedAt = new Date().toISOString();
  copy.status = 'en-cours';
  if (req.body?.cover) copy.cover = req.body.cover;
  if (req.body?.title) copy.metadata.title = req.body.title;
  db.data.books.unshift(copy);
  await db.save();
  res.json(copy);
}));

api.get('/books/:id/lint', (req, res) => {
  const b = getBook(req, res);
  if (b) res.json(lintBook(b, db.assetMap()));
});

api.get('/books/:id/interior.pdf', (req, res) => {
  const b = getBook(req, res);
  if (!b) return;
  const guides = req.query.guides === '1';
  const from = req.query.from ? Number(req.query.from) : undefined;
  const to = req.query.to ? Number(req.query.to) : undefined;
  sendPdf(res, buildInteriorPdf(b, { guides, from, to }), `${slug(b.metadata.title)}-interieur-${findTrim(b.format.trimId).id}-${totalPages(b)}p.pdf`, req.query.download === '1');
});

api.get('/books/:id/cover.pdf', (req, res) => {
  const b = getBook(req, res);
  if (!b) return;
  sendPdf(res, buildCoverPdf(b, { guides: req.query.guides === '1' }), `${slug(b.metadata.title)}-couverture.pdf`, req.query.download === '1');
});

/** Fiche texte à copier-coller dans le formulaire KDP. */
api.get('/books/:id/listing.txt', (req, res) => {
  const b = getBook(req, res);
  if (!b) return;
  const m = b.metadata;
  const t = findTrim(b.format.trimId);
  const lines = [
    `TITRE : ${m.title}`, `SOUS-TITRE : ${m.subtitle}`, `AUTEUR : ${m.author}`, `LANGUE : ${m.language}`, `PLACE DE MARCHÉ : ${m.marketplace}`, '',
    'DESCRIPTION (HTML) :', m.descriptionHtml || generateDescription(b), '',
    'MOTS-CLÉS :', ...m.keywords.map((k, i) => `  ${i + 1}. ${k}`), '',
    'CATÉGORIES :', ...m.categories.filter(Boolean).map((c) => `  - ${c}`), '',
    `LIVRE LOW-CONTENT : ${m.lowContent ? 'oui (case à cocher dans KDP)' : 'non'}`,
    `FORMAT : ${t.label} (${t.cm}) · ${b.format.binding === 'hardcover' ? 'rigide' : 'broché'} · ${b.format.ink} · fond perdu ${b.format.bleed ? 'oui' : 'non'} · ${b.format.finish === 'glossy' ? 'brillant' : 'mat'}`,
    `PAGES : ${totalPages(b)}`, `PRIX : ${m.price}`,
    `CONTENU IA : texte ${m.aiGenerated.text ? 'oui' : 'non'} · images ${m.aiGenerated.images ? 'oui' : 'non'} · traduction ${m.aiGenerated.translation ? 'oui' : 'non'}`,
    `TITRE SUR LA COUVERTURE : ${coverTexts(b).title}`,
  ];
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${slug(m.title)}-fiche-kdp.txt"`);
  res.send(lines.join('\n'));
});

// ---------------------------------------------------------------- Gabarits
api.get('/cover-template.pdf', (req, res) => {
  const format: BookFormat = {
    binding: req.query.binding === 'hardcover' ? 'hardcover' : 'paperback',
    trimId: String(req.query.trim ?? '6x9'),
    ink: (String(req.query.ink ?? 'bw-white') as BookFormat['ink']),
    bleed: true,
    finish: 'matte',
    spineOverride: req.query.spine ? Number(req.query.spine) : null,
  };
  const pages = Math.max(24, Number(req.query.pages ?? 100));
  sendPdf(res, buildCoverTemplatePdf(format, pages), `gabarit-couverture-${format.binding}-${format.trimId}-${pages}p.pdf`, req.query.download === '1');
});

// ---------------------------------------------------------------- Images
api.get('/assets', (_req, res) => res.json(db.data.assets));

api.post('/assets', upload.single('file'), wrap(async (req, res) => {
  const f = req.file;
  if (!f) return res.status(400).json({ error: 'Image manquante' });
  const ext = extname(f.originalname).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(ext)) return res.status(400).json({ error: 'Formats acceptés : PNG ou JPEG (les seuls embarquables dans le PDF).' });
  res.json(await saveAsset(f.buffer, ext === '.png' ? '.png' : '.jpg', f.originalname));
}));

api.delete('/assets/:id', wrap(async (req, res) => {
  const a = db.data.assets.find((x) => x.id === req.params.id);
  if (a) {
    db.data.assets = db.data.assets.filter((x) => x.id !== a.id);
    await unlink(join(UPLOADS_DIR, a.file)).catch(() => undefined);
    await db.save();
  }
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- Assistant IA
api.get('/agent/status', (_req, res) => {
  const ready = anthropicConfigured();
  const status: AgentStatus = {
    ready,
    model: AGENT.model,
    images: imagesAvailable(),
    imageModel: imagesAvailable() ? AGENT.imageModel : null,
    reason: ready ? undefined : 'Ajoute ANTHROPIC_API_KEY dans server/.env puis redémarre le serveur.',
  };
  res.json(status);
});

/** Exécute l'assistant et diffuse sa progression en Server-Sent Events ; le livre n'est pas modifié (brouillon renvoyé à la fin). */
api.post('/books/:id/agent', async (req, res) => {
  const b = getBook(req, res);
  if (!b) return;
  if (!anthropicConfigured()) return res.status(400).json({ error: 'Assistant non configuré : ajoute ANTHROPIC_API_KEY dans server/.env.' });
  const body = (req.body ?? {}) as Partial<AgentRequest>;
  const request: AgentRequest = {
    instruction: String(body.instruction ?? '').slice(0, 4000),
    scope: (Array.isArray(body.scope) ? body.scope : []).filter((s): s is AgentRequest['scope'][number] => AGENT_SCOPES.some((x) => x.id === s)),
    images: body.images === true,
  };
  const sse = openSse<AgentEvent>(res);
  const send = sse.send;
  try {
    const idea = b.ideaId ? db.data.ideas.find((i) => i.id === b.ideaId) ?? null : null;
    await runAgent({ book: b, idea, request, assets: () => db.assetMap(), emit: send, signal: sse.signal });
  } catch (err) {
    console.error('[agent]', err);
    send({ type: 'error', message: friendlyError(err) });
  } finally {
    sse.close();
  }
});
