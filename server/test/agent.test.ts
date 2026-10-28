import { test } from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { createBook, unsupportedTags, type AgentEvent, type Book } from '@shared';
import { SYSTEM_PROMPT } from '../src/agent/prompt';
import { runAgent } from '../src/agent/run';
import { createTools, type ToolContext } from '../src/agent/tools';

function ctxFor(book: Book, scope: ToolContext['scope'] = new Set(['listing', 'interior', 'cover'])) {
  const events: AgentEvent[] = [];
  const ctx: ToolContext = { draft: structuredClone(book), idea: null, scope, images: false, assets: () => ({}), emit: (e) => events.push(e) };
  const tools = createTools(ctx);
  const get = (name: string) => {
    const t = tools.find((x) => (x as { name?: string }).name === name);
    assert.ok(t, `outil ${name} absent`);
    return t as unknown as { run: (i: unknown) => Promise<string>; parse: (i: unknown) => unknown; eager_input_streaming?: boolean };
  };
  return { ctx, events, tools, get };
}

test('prompt système figé et assez long pour être mis en cache', () => {
  assert.ok(SYSTEM_PROMPT.length > 8000);
  assert.ok(!/\d{4}-\d{2}-\d{2}T/.test(SYSTEM_PROMPT), 'pas d\'horodatage variable');
  assert.ok(SYSTEM_PROMPT.includes('password-book') && SYSTEM_PROMPT.includes('leather'));
});

test('les outils hors périmètre ne sont pas proposés', () => {
  const { tools } = ctxFor(createBook(), new Set(['listing']));
  const names = tools.map((t) => (t as { name?: string }).name);
  assert.deepEqual(names, ['read_book', 'update_listing', 'check_book']);
});

test('update_listing nettoie la description et complète les cases', async () => {
  const { ctx, get, events } = ctxFor(createBook());
  const out = JSON.parse(await get('update_listing').run({
    title: 'Livre de caisse', subtitle: 'Registre des recettes et dépenses pour commerçants', author: 'Éditions Test',
    descriptionHtml: '<h2>Titre</h2><p><strong>Gras</strong></p>', keywords: ['registre comptable auto-entrepreneur'], categories: ['Livres > Commerce'],
  }));
  assert.equal(ctx.draft.metadata.title, 'Livre de caisse');
  assert.equal(ctx.draft.metadata.keywords.length, 7);
  assert.equal(ctx.draft.metadata.categories.length, 3);
  assert.deepEqual(unsupportedTags(ctx.draft.metadata.descriptionHtml), []);
  assert.ok(out.notes.length === 1);
  assert.deepEqual(events.map((e) => e.type), ['tool', 'tool_result']);
});

test('set_interior_sections refuse un paramètre inconnu', async () => {
  const { get } = ctxFor(createBook());
  await assert.rejects(() => get('set_interior_sections').run({ sections: [{ templateId: 'lined', pages: 100, params: { couleur: 'rouge' } }] }), /paramètres inconnus/);
});

test('set_interior_sections et apply_interior_preset modifient le brouillon', async () => {
  const { ctx, get } = ctxFor(createBook());
  const out = JSON.parse(await get('set_interior_sections').run({
    sections: [{ templateId: 'title-page', pages: 1 }, { templateId: 'form', pages: 99, params: { perPage: 2 }, alt: { templateId: 'blank', params: { frame: 'dashed' } } }],
  }));
  assert.equal(out.pages, 100);
  assert.equal(ctx.draft.interior.sections[1].alt?.templateId, 'blank');
  await get('apply_interior_preset').run({ presetId: 'herbarium' });
  assert.equal(ctx.draft.format.trimId, 'a4');
});

test('design_cover applique style puis palette, et garde les textes liés à la fiche', async () => {
  const book = createBook();
  book.cover.texts.title = 'Autre titre';
  const { ctx, get } = ctxFor(book);
  const out = JSON.parse(await get('design_cover').run({ styleId: 'leather', paletteId: 'black-gold', title: { size: 34 }, backText: 'Un registre sobre.' }));
  assert.equal(ctx.draft.cover.pattern.id, 'leather');
  assert.equal(ctx.draft.cover.background.color, '#151515');
  assert.equal(ctx.draft.cover.title.size, 34);
  assert.equal(ctx.draft.cover.texts.title, '');
  assert.equal(ctx.draft.cover.back.show, true);
  assert.equal(typeof out.metriques.lignesTitreEstimees, 'number');
  assert.throws(() => get('design_cover').parse({ background: { color: 'rouge' } }));
  await assert.rejects(() => get('design_cover').run({ background: { type: 'image' } }), /sans image/);
});

test('check_book renvoie les erreurs bloquantes', async () => {
  const { get } = ctxFor(createBook());
  const out = JSON.parse(await get('check_book').run({}));
  assert.ok(out.erreurs.some((e: { message: string }) => e.message.includes('titre est obligatoire')));
});

test('les outils diffusent leurs entrées (eager_input_streaming)', () => {
  const { tools } = ctxFor(createBook());
  assert.ok(tools.every((t) => (t as { eager_input_streaming?: boolean }).eager_input_streaming === true));
});

// ---------------------------------------------------------------- Boucle complète contre une API simulée
const sse = (events: object[]) =>
  events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join('');

const start = (id: string) => ({
  type: 'message_start',
  message: { id, type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 1, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 } },
});
const toolTurn = (id: string, toolId: string, name: string, input: object, note: string) => sse([
  start(id),
  { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: note } },
  { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'sig' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: toolId, name, input: {} } },
  { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) } },
  { type: 'content_block_stop', index: 1 },
  { type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 80 } },
  { type: 'message_stop' },
]);
const textTurn = (id: string, text: string) => sse([
  start(id),
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 40 } },
  { type: 'message_stop' },
]);

test('runAgent : boucle d\'outils complète avec streaming, cache et fallbacks', async () => {
  const script = [
    toolTurn('msg_1', 'toolu_1', 'update_listing', { title: 'Carnet de dégustation de whisky', author: 'Éditions Test', keywords: ['cadeau amateur de single malt'] }, 'Je rédige la fiche.'),
    toolTurn('msg_2', 'toolu_2', 'design_cover', { styleId: 'minimal', paletteId: 'black-gold' }, 'Je compose la couverture.'),
    textTurn('msg_3', 'Fiche et couverture prêtes.'),
  ];
  const requests: { headers: Headers; body: Record<string, unknown> }[] = [];
  const fakeFetch = (async (_url: unknown, init?: RequestInit) => {
    requests.push({ headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    const payload = script[requests.length - 1];
    return new Response(payload, { status: 200, headers: { 'content-type': 'text/event-stream', 'request-id': `req_${requests.length}` } });
  }) as typeof fetch;
  const client = new Anthropic({ apiKey: 'test', fetch: fakeFetch, maxRetries: 0 });
  const book = createBook({ presetId: 'tasting-journal' });
  const events: AgentEvent[] = [];
  await runAgent({ book, idea: null, request: { instruction: 'Fiche et couverture', scope: ['listing', 'cover'], images: false }, assets: () => ({}), emit: (e) => events.push(e), signal: new AbortController().signal, client });

  assert.equal(requests.length, 3);
  const first = requests[0];
  assert.equal(first.body.model, 'claude-opus-5-5');
  assert.equal(first.body.fallbacks, 'default');
  assert.deepEqual(first.body.thinking, { type: 'adaptive', display: 'updates' });
  assert.match(first.headers.get('anthropic-beta') ?? '', /server-side-fallback-2026-07-01/);
  assert.match(first.headers.get('anthropic-beta') ?? '', /thinking-display-updates-2026-08-18/);
  assert.deepEqual((first.body.system as { cache_control?: object }[])[0].cache_control, { type: 'ephemeral' });
  const toolNames = (first.body.tools as { name: string }[]).map((t) => t.name);
  assert.deepEqual(toolNames, ['read_book', 'update_listing', 'design_cover', 'check_book']);
  // Le 2e appel renvoie le résultat de l'outil, sans erreur
  const second = requests[1].body.messages as { role: string; content: { type: string; tool_use_id?: string; is_error?: boolean }[] }[];
  const result = second[second.length - 1].content.find((c) => c.type === 'tool_result');
  assert.equal(result?.tool_use_id, 'toolu_1');
  assert.notEqual(result?.is_error, true);

  const types = events.map((e) => e.type);
  assert.ok(types.includes('progress'));
  assert.ok(types.filter((t) => t === 'tool').length === 2);
  const done = events.find((e) => e.type === 'done');
  assert.ok(done && done.type === 'done');
  assert.equal(done.draft.metadata.title, 'Carnet de dégustation de whisky');
  assert.equal(done.draft.cover.background.color, '#151515');
  assert.equal(book.metadata.title, '', 'le livre d\'origine n\'est pas modifié');
  assert.equal(done.summary, 'Fiche et couverture prêtes.');
  assert.equal(done.usage.iterations, 3);
  assert.equal(done.usage.cacheReadTokens, 2700);
});
