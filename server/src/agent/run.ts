import Anthropic from '@anthropic-ai/sdk';
import { lintBook, type AgentEvent, type AgentRequest, type AgentScope, type AgentUsage, type Asset, type Book, type Idea } from '@shared';
import { AGENT } from '../config';
import { SYSTEM_PROMPT } from './prompt';
import { bookSnapshot, createTools, type ToolContext } from './tools';

export const anthropicConfigured = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const SCOPE_TEXT: Record<AgentScope, string> = {
  listing: 'la fiche KDP (titre, sous-titre, auteur si vide, description, 7 mots-clés, catégories, prix)',
  interior: 'l\'intérieur (format et sections de pages)',
  cover: 'la couverture (design, typographie, dos, 4e de couverture)',
};

/** Exécute l'assistant sur une copie du livre ; la personne applique ou non le brouillon final. */
export async function runAgent(opts: {
  book: Book;
  idea: Idea | null;
  request: AgentRequest;
  assets: () => Record<string, Asset>;
  emit: (e: AgentEvent) => void;
  signal: AbortSignal;
  /** Client injectable (tests) ; par défaut, identifiants lus dans l'environnement */
  client?: Anthropic;
}): Promise<void> {
  const { emit, signal } = opts;
  const scope = new Set<AgentScope>(opts.request.scope.length ? opts.request.scope : ['listing', 'interior', 'cover']);
  const ctx: ToolContext = { draft: structuredClone(opts.book), idea: opts.idea, scope, images: opts.request.images, assets: opts.assets, emit, signal };
  const tools = createTools(ctx);

  const instruction = opts.request.instruction.trim() || 'Prépare une proposition complète et prête à publier.';
  const userText = [
    `Demande : ${instruction}`,
    `Domaines à traiter : ${[...scope].map((s) => SCOPE_TEXT[s]).join(' ; ')}.`,
    opts.request.images ? 'Tu peux générer une illustration si elle sert vraiment la couverture.' : 'Pas de génération d\'image pour cette demande.',
    `État actuel du livre (JSON) :\n${JSON.stringify(bookSnapshot(ctx))}`,
  ].join('\n\n');

  const client = opts.client ?? new Anthropic();
  const usage: AgentUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, iterations: 0 };
  let summary = '';
  let lastStop: string | null = null;

  let runner = client.beta.messages.toolRunner(
    {
      model: AGENT.model,
      max_tokens: 64000,
      thinking: { type: 'adaptive', display: 'updates' },
      output_config: { effort: AGENT.effort },
      betas: ['server-side-fallback-2026-07-01', 'thinking-display-updates-2026-08-18'],
      fallbacks: 'default',
      cache_control: { type: 'ephemeral' },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools,
      messages: [{ role: 'user', content: userText }],
      max_iterations: AGENT.maxIterations,
      stream: true,
    },
    { signal },
  );

  emit({ type: 'status', message: `Analyse du livre avec ${AGENT.model}…` });
  let jsonRetries = 0;
  for (;;) {
    try {
      for await (const stream of runner) {
        const progress = new Map<number, string>();
        let text = '';
        for await (const event of stream) {
          if (event.type === 'content_block_delta') {
            if (event.delta.type === 'thinking_delta' && event.delta.thinking) progress.set(event.index, (progress.get(event.index) ?? '') + event.delta.thinking);
            if (event.delta.type === 'text_delta') {
              text += event.delta.text;
              emit({ type: 'text', delta: event.delta.text });
            }
          } else if (event.type === 'content_block_stop') {
            const note = progress.get(event.index)?.trim();
            if (note) emit({ type: 'progress', text: note });
          }
        }
        const message = await stream.finalMessage();
        jsonRetries = 0;
        usage.iterations++;
        usage.inputTokens += message.usage.input_tokens;
        usage.outputTokens += message.usage.output_tokens;
        usage.cacheReadTokens += message.usage.cache_read_input_tokens ?? 0;
        usage.cacheWriteTokens += message.usage.cache_creation_input_tokens ?? 0;
        lastStop = message.stop_reason;
        if (message.stop_reason === 'refusal') throw new Error(`Le modèle a décliné la demande${message.stop_details?.category ? ` (${message.stop_details.category})` : ''}.`);
        if (message.stop_reason === 'max_tokens') throw new Error('Réponse tronquée (limite de jetons atteinte) : relance avec une demande plus ciblée.');
        if (text.trim()) summary = text.trim();
      }
      break;
    } catch (err) {
      // Seule une entrée d'outil illisible (AnthropicError hors APIError) est relancée, deux fois au plus.
      const jsonError = err instanceof Anthropic.AnthropicError && !(err instanceof Anthropic.APIError);
      if (!jsonError || signal.aborted || jsonRetries >= 2) throw err;
      jsonRetries++;
      emit({ type: 'status', message: 'Entrée d\'outil illisible, nouvelle tentative…' });
      runner = client.beta.messages.toolRunner({ ...runner.params, stream: true }, { signal });
    }
  }

  if (!summary) summary = lastStop === 'tool_use' ? `Nombre maximal d'étapes atteint (${AGENT.maxIterations}) : la proposition est partielle.` : 'Proposition prête.';
  emit({ type: 'done', draft: ctx.draft, summary, issues: lintBook(ctx.draft, opts.assets()), usage });
}

export function friendlyError(err: unknown): string {
  if (err instanceof Anthropic.APIUserAbortError) return 'Exécution annulée.';
  if (err instanceof Anthropic.AuthenticationError) return 'Clé API Anthropic invalide : vérifie ANTHROPIC_API_KEY dans server/.env.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'Accès refusé par l\'API Anthropic pour ce modèle ou cette fonctionnalité.';
  if (err instanceof Anthropic.RateLimitError) return 'Limite de débit Anthropic atteinte : réessaie dans un instant.';
  if (err instanceof Anthropic.APIConnectionError) return 'Impossible de joindre l\'API Anthropic (connexion).';
  if (err instanceof Anthropic.APIError) return `Erreur de l'API Anthropic (${err.status ?? '?'}) : ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
