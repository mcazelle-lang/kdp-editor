import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import type { NicheAgentEvent, RawCapture } from '@shared';

// Base de données jetable : ces tests écrivent dans db.json
process.env.BOOK_CREATOR_DATA = mkdtempSync(join(tmpdir(), 'bc-niches-'));
const { parseCapture } = await import('@shared');
const { db } = await import('../src/db');
const { autocompleteOptions, clearSuggestionCache, expandSeed } = await import('../src/niches/autocomplete');
const { storeCapture, upsertNiche } = await import('../src/niches/store');
const { runNicheAgent } = await import('../src/niches/agent');
autocompleteOptions.gapMs = 0;

const calls: URL[] = [];
const completionFetch = (async (input: string | URL | Request) => {
  const url = new URL(String(input));
  calls.push(url);
  const prefix = url.searchParams.get('prefix') ?? '';
  const values = prefix === 'carnet de' ? ['carnet de lecture', 'carnet de mot de passe'] : prefix === 'carnet de l' ? ['carnet de lecture', 'carnet de liaison nounou'] : [];
  return new Response(JSON.stringify({ alias: 'stripbooks', prefix, suggestions: values.map((value) => ({ type: 'KEYWORD', value })) }), { status: 200 });
}) as typeof fetch;

test('autocomplétion : paramètres du marché, mode alphabet, fusion et cache', async () => {
  clearSuggestionCache();
  const list = await expandSeed('amazon.fr', 'Carnet  de', true, completionFetch);
  assert.equal(calls.length, 27);
  const first = calls[0];
  assert.equal(first.host, 'completion.amazon.fr');
  assert.equal(first.searchParams.get('mid'), 'A13V1IB3VIYZZH');
  assert.equal(first.searchParams.get('alias'), 'stripbooks');
  assert.equal(first.searchParams.get('lop'), 'fr_FR');
  assert.equal(first.searchParams.get('prefix'), 'carnet de');
  assert.deepEqual(list[0], { marketplace: 'amazon.fr', keyword: 'carnet de lecture', position: 1, hits: 2, seed: 'carnet de' });
  assert.equal(list.length, 3);
  await expandSeed('amazon.fr', 'carnet de', false, completionFetch);
  assert.equal(calls.length, 27, 'réponse servie par le cache');
});

const serp: RawCapture = {
  v: 1, kind: 'serp', url: 'https://www.amazon.fr/s?k=carnet+de+liaison+nounou&i=stripbooks', host: 'www.amazon.fr', lang: 'fr', capturedAt: '2026-10-15T09:00:00Z',
  resultInfo: '1-48 sur 412 résultats pour "carnet de liaison nounou"',
  cards: [{ asin: 'B0CCCCCCC1', title: 'Carnet de liaison', text: 'Carnet de liaison\nBroché\n7,90 €', labels: ['4,8 sur 5 étoiles', '23 évaluations'], sponsored: false }],
};

test('captures : page de résultats puis fiche produit rattachée à la niche', () => {
  const r1 = storeCapture(parseCapture(serp));
  assert.equal(r1.niches[0].keyword, 'carnet de liaison nounou');
  assert.equal(r1.niches[0].status, 'a-analyser');
  const r2 = storeCapture(parseCapture({
    v: 1, kind: 'product', url: 'https://www.amazon.fr/dp/B0CCCCCCC1', host: 'www.amazon.fr', lang: 'fr', capturedAt: '2026-10-15T09:01:00Z', asin: 'B0CCCCCCC1',
    title: 'Carnet de liaison', details: "Classement des meilleures ventes d'Amazon : 45 678 en Livres (Voir les 100 premiers en Livres)", price: '7,90 €',
  }));
  assert.match(r2.message, /BSR 45/);
  assert.equal(r1.niches[0].products[0].bsr, 45678);
  const r3 = storeCapture(parseCapture({ ...serp, kind: 'product', url: 'https://www.amazon.fr/dp/B0ZZZZZZZ9', asin: 'B0ZZZZZZZ9', details: '' }));
  assert.equal(r3.niches.length, 0);
  // La position d'autocomplétion n'est jamais rétrogradée
  upsertNiche('amazon.fr', 'carnet de liaison nounou', 'autocompletion', { autocomplete: { position: 2, hits: 1, seed: 'carnet', seenAt: '' } });
  upsertNiche('amazon.fr', 'carnet de liaison nounou', 'autocompletion', { autocomplete: { position: 5, hits: 1, seed: 'carnet', seenAt: '' } });
  assert.equal(r1.niches[0].autocomplete?.position, 2);
});

// ---------------------------------------------------------------- Agent de découverte contre une API simulée
const sse = (events: object[]) => events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
const start = (id: string) => ({ type: 'message_start', message: { id, type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 800, output_tokens: 1, cache_read_input_tokens: 4000, cache_creation_input_tokens: 0 } } });
const end = (stop: string) => [{ type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 60 } }, { type: 'message_stop' }];

test('runNicheAgent (découverte) : recherche web, autocomplétion, ajout au radar', async () => {
  globalThis.fetch = completionFetch;
  const script = [
    sse([
      start('m1'),
      { type: 'content_block_start', index: 0, content_block: { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: {} } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"query":"carnet liaison assistante maternelle obligatoire"}' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'content_block_start', index: 1, content_block: { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [{ type: 'web_search_result', title: 'Le cahier de liaison', url: 'https://exemple.fr/liaison', encrypted_content: 'x', page_age: null }] } },
      { type: 'content_block_stop', index: 1 },
      { type: 'content_block_start', index: 2, content_block: { type: 'tool_use', id: 'toolu_1', name: 'amazon_suggestions', input: {} } },
      { type: 'content_block_delta', index: 2, delta: { type: 'input_json_delta', partial_json: '{"market":"amazon.fr","prefix":"carnet de l"}' } },
      { type: 'content_block_stop', index: 2 },
      ...end('tool_use'),
    ]),
    sse([
      start('m2'),
      { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_2', name: 'add_to_radar', input: {} } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify({ niches: [
        { market: 'amazon.fr', keyword: 'carnet de liaison nounou', rationale: 'Usage quotidien des assistantes maternelles.', angle: 'Version semaine + santé' },
        { market: 'amazon.de', keyword: 'tagebuch für tagesmutter', rationale: 'Même usage côté allemand.' },
        { market: 'amazon.fr', keyword: 'carnet moleskine nounou', rationale: 'Marque.' },
      ] }) } },
      { type: 'content_block_stop', index: 0 },
      ...end('tool_use'),
    ]),
    sse([start('m3'), { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }, { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Deux pistes ajoutées.' } }, { type: 'content_block_stop', index: 0 }, ...end('end_turn')]),
  ];
  const bodies: Record<string, unknown>[] = [];
  const fakeFetch = (async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(script[bodies.length - 1], { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }) as typeof fetch;
  const client = new Anthropic({ apiKey: 'test', fetch: fakeFetch, maxRetries: 0 });
  const events: NicheAgentEvent[] = [];
  await runNicheAgent({ mode: 'discover', request: { theme: 'petite enfance', markets: ['amazon.fr', 'amazon.de'], maxSearches: 3 }, emit: (e) => events.push(e), signal: new AbortController().signal, client });

  const tools = bodies[0].tools as { name: string; type?: string; max_uses?: number }[];
  assert.deepEqual(tools.map((t) => t.name), ['amazon_suggestions', 'radar', 'add_to_radar', 'web_search']);
  assert.equal(tools[3].type, 'web_search_20260209');
  assert.equal(tools[3].max_uses, 3);
  // Le résultat de l'autocomplétion revient à Claude
  const msgs = bodies[1].messages as { role: string; content: { type: string; content?: string }[] }[];
  const result = msgs[msgs.length - 1].content.find((c) => c.type === 'tool_result');
  assert.match(String(result?.content), /carnet de liaison nounou/);

  assert.ok(events.some((e) => e.type === 'search' && e.query.includes('assistante maternelle')));
  const done = events.find((e) => e.type === 'done');
  assert.ok(done && done.type === 'done');
  assert.equal(done.searches, 1);
  assert.equal(done.nicheIds.length, 2, 'la niche avec marque est refusée');
  assert.ok(db.data.niches.some((n) => n.keyword === 'tagebuch für tagesmutter' && n.source === 'agent' && n.notes.includes('Claude')));
  assert.ok(!db.data.niches.some((n) => n.keyword.includes('moleskine')));
});
