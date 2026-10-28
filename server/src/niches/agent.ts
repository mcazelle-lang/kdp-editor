import Anthropic from '@anthropic-ai/sdk';
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import type { BetaToolUnion } from '@anthropic-ai/sdk/resources/beta';
import { z } from 'zod';
import {
  AUTHOR_NAMES, computeNicheMetrics, findMarket, findTerms, MARKETS, missingBsr, PRESETS, TRADEMARKS,
  type MarketId, type Niche, type NicheAgentEvent, type NicheAnalyzeRequest, type NicheDiscoverRequest,
} from '@shared';
import { makeTool } from '../agent/tooling';
import { AGENT } from '../config';
import { db } from '../db';
import { expandSeed } from './autocomplete';
import { upsertNiche } from './store';

const marketEnum = z.enum(MARKETS.map((m) => m.id) as [MarketId, ...MarketId[]]);
const MAX_ALPHABET = 6;

// Prompt figé (mis en cache) : méthode de la skill kdp-marketing-low-content appliquée à la recherche de niches.
export const NICHE_SYSTEM_PROMPT = `Tu es analyste de niches pour l'auto-édition de livres low-content sur Amazon KDP (carnets, journaux, registres, planners, livres d'or, cahiers spécialisés…), sur ${MARKETS.map((m) => m.label).join(', ')}. Tu travailles pour une personne qui produit ses intérieurs et couvertures avec l'application Book Creator.

# Ce qu'est une niche rentable
- Une recherche précise que de vrais acheteurs tapent (preuve : elle sort dans l'autocomplétion Amazon, idéalement pour plusieurs préfixes), liée à un usage concret : métier, registre obligatoire, passion, événement de vie, apprentissage, cadeau ciblé.
- Une demande réelle : plusieurs fiches du top 10 avec un BSR inférieur à ~300 000 (rayon Livres).
- Une concurrence abordable : médiane des avis du top 10 faible (< 50 idéal, > 500 = verrouillée), couvertures ou intérieurs médiocres, formats ou langues non servis.
- Une rentabilité : prix de marché permettant au moins 1,50 €/$ de redevance par vente (60 % dès 9,99, 50 % en dessous, moins l'impression).
- Une faisabilité : intérieur réalisable en low-content (voir les préréglages de l'app) avec une vraie valeur ajoutée, sans marque, personnage protégé ni nom d'auteur.

# Règles
- N'invente JAMAIS de BSR, de nombre d'avis, de volume de recherche ou de ventes. Les seules données de marché sont celles des outils (autocomplétion, captures faites par la personne) ; dis clairement quand elles manquent et quelle capture faire.
- La recherche web sert aux tendances, à la saisonnalité, à la réglementation (registres obligatoires), aux usages et au vocabulaire des acheteurs ; cite tes sources. N'utilise pas la recherche web pour deviner des chiffres de ventes Amazon.
- Pense multi-marchés : une niche saturée sur amazon.com peut être libre en FR, DE, ES ou IT, avec le vocabulaire local (vérifie-le dans l'autocomplétion du marché).
- Écarte les niches avec marques ou noms protégés, et signale les niches adultes ou réglementées (contenu à faire valider).
- Réponds en français, de façon concise.

# Préréglages d'intérieur disponibles dans l'app
${PRESETS.map((p) => `${p.id} : ${p.name}`).join(' · ')}`;

const DISCOVER_INSTRUCTIONS = `Mode découverte. Objectif : alimenter le radar avec des niches candidates précises et justifiées autour du thème donné.
1. Si la recherche web est disponible, commence par comprendre le thème (usages, publics, occasions, obligations réglementaires, saisonnalité).
2. Explore l'autocomplétion Amazon des marchés demandés avec des préfixes variés (mode alphabet pour les préfixes prometteurs, ${MAX_ALPHABET} au plus) : les suggestions sont ta matière première.
3. Consulte le radar pour éviter les doublons.
4. Ajoute au radar 5 à 15 niches (mots-clés exacts tels qu'Amazon les suggère, du plus précis au plus large), chacune avec sa justification et l'angle de différenciation.
5. Termine par un court bilan : les 3 pistes les plus prometteuses, et les captures que la personne doit faire sur Amazon pour les valider.`;

const ANALYZE_INSTRUCTIONS = `Mode analyse d'une niche. Lis la niche (get_niche) : métriques calculées, page de résultats et fiches capturées. Complète si utile avec l'autocomplétion (variantes, autres marchés) et la recherche web. Puis appelle submit_report avec un rapport argumenté : verdict (go / a-tester / eviter), score 0-100 cohérent avec les données, angle, sous-niches, idées de titres, 7 mots-clés conformes KDP (50 caractères max, ni marque ni nom d'auteur), préréglage d'intérieur, prix conseillé, saisonnalité, risques, sources. Si les données de marché manquent, mets un verdict « a-tester » et liste les captures à faire. Termine par un résumé de 4 lignes.`;

const reportSchema = z.object({
  verdict: z.enum(['go', 'a-tester', 'eviter']),
  score: z.number().int().min(0).max(100),
  summary: z.string().max(1200),
  demand: z.string().max(600),
  competition: z.string().max(600),
  angle: z.string().max(600),
  subNiches: z.array(z.string()).max(10),
  titleIdeas: z.array(z.string()).max(6),
  keywords: z.array(z.string().max(50)).max(7),
  presetId: z.enum(PRESETS.map((p) => p.id) as [string, ...string[]]).nullable(),
  price: z.number().positive().max(100).nullable(),
  seasonality: z.string().max(400),
  risks: z.array(z.string()).max(8),
  sources: z.array(z.object({ title: z.string(), url: z.string().url() })).max(10),
});

function nicheView(n: Niche) {
  const m = computeNicheMetrics(n);
  return {
    id: n.id, marche: n.marketplace, motCle: n.keyword, statut: n.status, source: n.source, notes: n.notes,
    autocompletion: n.autocomplete,
    metriques: { score: m.score, confiance: m.confidence, demande: m.demand, concurrence: m.competition, prix: m.price, rentabilite: m.profit, marques: m.trademarks, raisons: m.reasons, manquant: m.missing },
    resultats: n.serp ? { capturee: n.serp.capturedAt, total: n.serp.totalResults, top20: n.serp.items.slice(0, 20).map((i) => ({ pos: i.position, asin: i.asin, titre: i.title, prix: i.price, note: i.rating, avis: i.reviews, sponsorise: i.sponsored })) } : null,
    fiches: n.products.map((p) => ({ asin: p.asin, titre: p.title, bsr: p.bsr, categorie: p.bsrCategory, sousClassements: p.subRanks, pages: p.pages, editeur: p.publisher, publication: p.publicationDate, prix: p.price, avis: p.reviews })),
    fichesSansBsr: missingBsr(n),
    rapportPrecedent: n.report,
  };
}

type Mode = { mode: 'discover'; request: NicheDiscoverRequest } | { mode: 'analyze'; niche: Niche; request: NicheAnalyzeRequest };

export async function runNicheAgent(opts: Mode & { emit: (e: NicheAgentEvent) => void; signal: AbortSignal; client?: Anthropic }): Promise<void> {
  const { emit, signal } = opts;
  const touched = new Set<string>();
  let alphabetCalls = 0;

  const tools: (BetaRunnableTool<any> | BetaToolUnion)[] = [
    makeTool(emit, 'amazon_suggestions', 'Autocomplétion Amazon',
      'Suggestions de recherche Amazon (rayon Livres) pour un préfixe sur un marché. alphabet=true teste aussi « préfixe a » … « préfixe z » (plus lent, limité). Chaque suggestion indique sa meilleure position et le nombre de préfixes qui la font sortir.',
      z.object({ market: marketEnum, prefix: z.string().min(2).max(80), alphabet: z.boolean().optional() }),
      async ({ market, prefix, alphabet }) => {
        if (alphabet && ++alphabetCalls > MAX_ALPHABET) throw new Error(`Limite de ${MAX_ALPHABET} explorations alphabétiques atteinte : utilise des préfixes simples.`);
        const list = await expandSeed(market, prefix, !!alphabet);
        const known = new Set(db.data.niches.filter((n) => n.marketplace === market).map((n) => n.keyword));
        return list.slice(0, 40).map((s) => ({ motCle: s.keyword, position: s.position, prefixes: s.hits, auRadar: known.has(s.keyword) }));
      }),
    makeTool(emit, 'radar', 'Lecture du radar',
      'Niches déjà présentes dans le radar (mot-clé, marché, statut, score, confiance).',
      z.object({ market: marketEnum.optional() }),
      ({ market }) => db.data.niches.filter((n) => !market || n.marketplace === market).slice(0, 150).map((n) => {
        const m = computeNicheMetrics(n);
        return { marche: n.marketplace, motCle: n.keyword, statut: n.status, score: m.score, confiance: m.confidence };
      })),
  ];

  if (opts.mode === 'discover') {
    tools.push(makeTool(emit, 'add_to_radar', 'Ajout au radar',
      'Ajoute des niches candidates au radar. Utilise le mot-clé exact suggéré par Amazon. Justification et angle en une ou deux phrases chacun.',
      z.object({
        niches: z.array(z.object({
          market: marketEnum,
          keyword: z.string().min(3).max(100),
          rationale: z.string().max(400),
          angle: z.string().max(300).optional(),
          tags: z.array(z.string().max(30)).max(5).optional(),
        })).min(1).max(15),
      }),
      async ({ niches }) => {
        const added: string[] = [];
        const rejected: string[] = [];
        for (const c of niches) {
          const bad = [...findTerms(c.keyword, TRADEMARKS), ...findTerms(c.keyword, AUTHOR_NAMES)];
          if (bad.length) {
            rejected.push(`${c.keyword} (${bad.join(', ')})`);
            continue;
          }
          const n = upsertNiche(c.market, c.keyword, 'agent', { notes: `Claude : ${c.rationale}${c.angle ? ` Angle : ${c.angle}` : ''}`, tags: c.tags });
          touched.add(n.id);
          added.push(`${n.keyword} (${n.marketplace})`);
        }
        await db.save();
        return { ajoutees: added, refusees: rejected.length ? { raison: 'marque ou nom protégé', motsCles: rejected } : undefined };
      }));
  } else {
    const niche = opts.niche;
    touched.add(niche.id);
    tools.push(
      makeTool(emit, 'get_niche', 'Lecture de la niche', 'Données complètes de la niche analysée : métriques, résultats et fiches capturés, rapport précédent.', z.object({}), () => nicheView(niche)),
      makeTool(emit, 'submit_report', 'Enregistrement du rapport', 'Enregistre le rapport d\'analyse de la niche (remplace le précédent).', reportSchema, async (report) => {
        niche.report = { ...report, createdAt: new Date().toISOString(), model: AGENT.model };
        if (niche.status === 'nouvelle') niche.status = 'a-analyser';
        niche.updatedAt = new Date().toISOString();
        await db.save();
        return { ok: true };
      }),
    );
  }

  const maxSearches = Math.max(0, Math.min(15, Math.round(opts.request.maxSearches)));
  if (maxSearches > 0) tools.push({ type: 'web_search_20260209', name: 'web_search', max_uses: maxSearches });

  const user = opts.mode === 'discover'
    ? `${DISCOVER_INSTRUCTIONS}\n\nThème : ${opts.request.theme.trim() || 'carnets et registres pratiques'}\nMarchés : ${opts.request.markets.map((m) => findMarket(m).label).join(', ')}\nRecherches web autorisées : ${maxSearches}`
    : `${ANALYZE_INSTRUCTIONS}\n\nNiche : « ${opts.niche.keyword} » sur ${findMarket(opts.niche.marketplace).label}.${opts.request.instruction.trim() ? `\nDemande complémentaire : ${opts.request.instruction.trim()}` : ''}\nRecherches web autorisées : ${maxSearches}`;

  const client = opts.client ?? new Anthropic();
  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, iterations: 0 };
  let summary = '';
  let searches = 0;
  emit({ type: 'status', message: opts.mode === 'discover' ? 'Exploration du thème…' : `Analyse de « ${opts.niche.keyword} »…` });

  let runner = client.beta.messages.toolRunner(
    {
      model: AGENT.model,
      max_tokens: 64000,
      thinking: { type: 'adaptive', display: 'updates' },
      output_config: { effort: AGENT.effort },
      betas: ['server-side-fallback-2026-07-01', 'thinking-display-updates-2026-08-18'],
      fallbacks: 'default',
      cache_control: { type: 'ephemeral' },
      system: [{ type: 'text', text: NICHE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools,
      messages: [{ role: 'user', content: user }],
      max_iterations: AGENT.maxIterations,
      stream: true,
    },
    { signal },
  );

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
        usage.iterations++;
        usage.inputTokens += message.usage.input_tokens;
        usage.outputTokens += message.usage.output_tokens;
        usage.cacheReadTokens += message.usage.cache_read_input_tokens ?? 0;
        usage.cacheWriteTokens += message.usage.cache_creation_input_tokens ?? 0;
        for (const block of message.content) {
          if (block.type === 'server_tool_use' && block.name === 'web_search') {
            searches++;
            emit({ type: 'search', query: String((block.input as { query?: string })?.query ?? '') });
          }
        }
        if (message.stop_reason === 'refusal') throw new Error('Le modèle a décliné la demande.');
        if (message.stop_reason === 'max_tokens') throw new Error('Réponse tronquée (limite de jetons atteinte).');
        // Recherche web longue : le tour est mis en pause, on le renvoie tel quel pour qu'il reprenne
        if (message.stop_reason === 'pause_turn') runner.pushMessages({ role: 'assistant', content: message.content });
        if (text.trim()) summary = text.trim();
      }
      break;
    } catch (err) {
      // Seule une entrée d'outil illisible (AnthropicError hors APIError) est relancée, deux fois au plus.
      const jsonError = err instanceof Anthropic.AnthropicError && !(err instanceof Anthropic.APIError);
      if (!jsonError || signal.aborted || jsonRetries++ >= 2) throw err;
      emit({ type: 'status', message: "Entrée d'outil illisible, nouvelle tentative…" });
      runner = client.beta.messages.toolRunner({ ...runner.params, stream: true }, { signal });
    }
  }

  emit({ type: 'done', summary: summary || 'Terminé.', nicheIds: [...touched], searches, usage });
}
