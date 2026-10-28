import express, { type NextFunction, type Request, type Response } from 'express';
import {
  amazonSearchUrl, bookFromIdea, findMarket, MARKETS, normalizeKeyword, parseCapture,
  type Idea, type MarketId, type NicheAgentEvent, type NicheStatus, type RawCapture, type Suggestion,
} from '@shared';
import { friendlyError, anthropicConfigured } from '../agent/run';
import { db } from '../db';
import { openSse } from '../sse';
import { runNicheAgent } from './agent';
import { expandSeed } from './autocomplete';
import { nicheId, storeCapture, upsertNiche } from './store';

export const nichesRouter = express.Router();

const wrap = (fn: (req: Request, res: Response) => Promise<unknown> | unknown) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res)).catch(next);
const markets = (v: unknown): MarketId[] => (Array.isArray(v) ? v : []).filter((m): m is MarketId => MARKETS.some((x) => x.id === m));
const STATUSES: NicheStatus[] = ['nouvelle', 'a-analyser', 'retenue', 'ecartee', 'en-production'];

nichesRouter.get('/', (_req, res) => res.json(db.data.niches));

/** Autocomplétion Amazon pour des mots-clés de départ (requêtes espacées : quelques secondes par graine en mode alphabet). */
nichesRouter.post('/suggest', wrap(async (req, res) => {
  const seeds = (Array.isArray(req.body?.seeds) ? req.body.seeds : []).map((s: unknown) => String(s).trim()).filter((s: string) => s.length >= 2).slice(0, 10);
  const ms = markets(req.body?.markets);
  if (!seeds.length || !ms.length) return res.status(400).json({ error: 'Indique au moins un mot-clé de départ et un marché.' });
  const alphabet = req.body?.alphabet === true;
  if (alphabet && seeds.length * ms.length > 6) return res.status(400).json({ error: 'Mode alphabet : 6 combinaisons mot-clé × marché au plus par recherche.' });
  const suggestions: Suggestion[] = [];
  const errors: string[] = [];
  for (const m of ms) {
    for (const seed of seeds) {
      try {
        suggestions.push(...(await expandSeed(m, seed, alphabet)));
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
  }
  const known = new Set(db.data.niches.map((n) => n.id));
  res.json({ suggestions: suggestions.map((s) => ({ ...s, inRadar: known.has(nicheId(s.marketplace, s.keyword)) })), errors });
}));

nichesRouter.post('/', wrap(async (req, res) => {
  const items = (Array.isArray(req.body?.items) ? req.body.items : []) as Partial<Suggestion>[];
  const out = [];
  for (const it of items.slice(0, 200)) {
    const m = markets([it.marketplace])[0];
    const keyword = normalizeKeyword(String(it.keyword ?? ''));
    if (!m || keyword.length < 2) continue;
    out.push(upsertNiche(m, keyword, it.position ? 'autocompletion' : 'manuel', it.position
      ? { autocomplete: { position: Number(it.position), hits: Number(it.hits ?? 1), seed: String(it.seed ?? ''), seenAt: new Date().toISOString() } }
      : {}));
  }
  await db.save();
  res.json(out);
}));

nichesRouter.put('/:id', wrap(async (req, res) => {
  const n = db.data.niches.find((x) => x.id === req.params.id);
  if (!n) return res.status(404).json({ error: 'Niche introuvable' });
  if (STATUSES.includes(req.body?.status)) n.status = req.body.status;
  if (typeof req.body?.notes === 'string') n.notes = req.body.notes.slice(0, 5000);
  if (Array.isArray(req.body?.tags)) n.tags = req.body.tags.map(String).slice(0, 10);
  n.updatedAt = new Date().toISOString();
  await db.save();
  res.json(n);
}));

nichesRouter.delete('/:id', wrap(async (req, res) => {
  db.data.niches = db.data.niches.filter((n) => n.id !== req.params.id);
  await db.save();
  res.json({ ok: true });
}));

/** Reçoit une capture du favori navigateur (relayée par la page /niches/capture de l'app). */
nichesRouter.post('/capture', wrap(async (req, res) => {
  const raw = req.body as RawCapture;
  if (raw?.v !== 1 || (raw.kind !== 'serp' && raw.kind !== 'product')) return res.status(400).json({ error: 'Capture invalide.' });
  let parsed;
  try {
    parsed = parseCapture(raw);
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
  const result = storeCapture(parsed);
  await db.save();
  res.json({ ...result, kind: parsed.kind, marketplace: parsed.marketplace, parsed: parsed.serp ?? parsed.product });
}));

/** Transforme une niche (et son rapport) en idée puis en livre prêt à éditer. */
nichesRouter.post('/:id/book', wrap(async (req, res) => {
  const n = db.data.niches.find((x) => x.id === req.params.id);
  if (!n) return res.status(404).json({ error: 'Niche introuvable' });
  const r = n.report;
  const m = findMarket(n.marketplace);
  const now = new Date().toISOString();
  const idea: Idea = {
    id: `i${n.id.slice(1)}`, source: { file: 'Radar de niches', sheet: m.label, column: n.keyword }, category: 'Radar de niches', niche: n.keyword, language: m.lang,
    titles: r?.titleIdeas.length ? r.titleIdeas : [n.keyword.charAt(0).toUpperCase() + n.keyword.slice(1)], subtitle: '', description: '', categories: [],
    keywords: r?.keywords ?? [], translations: {}, format: '', author: '',
    notes: [r?.summary, r?.angle ? `Angle : ${r.angle}` : '', ...(r?.risks ?? []).map((x) => `Risque : ${x}`), n.notes].filter((x): x is string => !!x),
    links: [amazonSearchUrl(n.marketplace, n.keyword)], importedAt: now,
  };
  db.data.ideas = [idea, ...db.data.ideas.filter((i) => i.id !== idea.id)];
  const book = bookFromIdea(idea, { presetId: r?.presetId ?? undefined });
  book.metadata.marketplace = n.marketplace;
  if (r?.price) book.metadata.price = r.price;
  db.data.books.unshift(book);
  n.bookIds.push(book.id);
  n.status = 'en-production';
  await db.save();
  res.json(book);
}));

// ---------------------------------------------------------------- Agent (SSE)
const agentGuard = (res: Response) => {
  if (anthropicConfigured()) return true;
  res.status(400).json({ error: 'Assistant non configuré : ajoute ANTHROPIC_API_KEY dans server/.env.' });
  return false;
};

nichesRouter.post('/agent', async (req, res) => {
  if (!agentGuard(res)) return;
  const sse = openSse<NicheAgentEvent>(res);
  try {
    await runNicheAgent({
      mode: 'discover',
      request: { theme: String(req.body?.theme ?? '').slice(0, 500), markets: markets(req.body?.markets).length ? markets(req.body?.markets) : ['amazon.fr'], maxSearches: Number(req.body?.maxSearches ?? 5) },
      emit: sse.send, signal: sse.signal,
    });
  } catch (err) {
    console.error('[niches/agent]', err);
    sse.send({ type: 'error', message: friendlyError(err) });
  } finally {
    sse.close();
  }
});

nichesRouter.post('/:id/agent', async (req, res) => {
  const n = db.data.niches.find((x) => x.id === req.params.id);
  if (!n) return res.status(404).json({ error: 'Niche introuvable' });
  if (!agentGuard(res)) return;
  const sse = openSse<NicheAgentEvent>(res);
  try {
    await runNicheAgent({ mode: 'analyze', niche: n, request: { instruction: String(req.body?.instruction ?? '').slice(0, 2000), maxSearches: Number(req.body?.maxSearches ?? 4) }, emit: sse.send, signal: sse.signal });
  } catch (err) {
    console.error('[niches/agent]', err);
    sse.send({ type: 'error', message: friendlyError(err) });
  } finally {
    sse.close();
  }
});
