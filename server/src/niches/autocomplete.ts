import { findMarket, normalizeKeyword, type MarketId, type Suggestion } from '@shared';

// Autocomplétion de la recherche Amazon (rayon Livres). Point d'accès public non documenté :
// requêtes espacées (≥ 400 ms), mises en cache 24 h, jamais en parallèle.
const TTL = 24 * 3600 * 1000;
/** Délai minimal entre deux requêtes (réglable pour les tests) */
export const autocompleteOptions = { gapMs: 400 };
const cache = new Map<string, { at: number; values: string[] }>();
let queue: Promise<unknown> = Promise.resolve();
let last = 0;

type Fetch = typeof fetch;

async function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = autocompleteOptions.gapMs - (Date.now() - last);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      return await fn();
    } finally {
      last = Date.now();
    }
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function fetchSuggestions(market: MarketId, prefix: string, fetchImpl: Fetch = fetch): Promise<string[]> {
  const key = `${market}|${normalizeKeyword(prefix)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.values;
  const m = findMarket(market);
  const params = new URLSearchParams({ mid: m.mid, alias: 'stripbooks', prefix, limit: '11', lop: m.lop });
  const values = await throttled(async () => {
    const res = await fetchImpl(`https://${m.completionHost}/api/2017/suggestions?${params}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (Book Creator; recherche de niches)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Autocomplétion ${m.label} : HTTP ${res.status}`);
    const json = (await res.json()) as { suggestions?: { value?: string; type?: string }[] };
    return (json.suggestions ?? []).filter((s) => s.value && (!s.type || s.type === 'KEYWORD')).map((s) => normalizeKeyword(s.value!));
  });
  cache.set(key, { at: Date.now(), values });
  return values;
}

/**
 * Suggestions pour un mot-clé de départ : le préfixe seul, puis (mode « alphabet ») préfixe + a…z.
 * Une suggestion trouvée par plusieurs préfixes est un signal de demande plus fort.
 */
export async function expandSeed(market: MarketId, seed: string, alphabet: boolean, fetchImpl: Fetch = fetch): Promise<Suggestion[]> {
  const base = normalizeKeyword(seed);
  const prefixes = [base, ...(alphabet ? 'abcdefghijklmnopqrstuvwxyz'.split('').map((l) => `${base} ${l}`) : [])];
  const found = new Map<string, Suggestion>();
  for (const prefix of prefixes) {
    const values = await fetchSuggestions(market, prefix, fetchImpl);
    values.forEach((keyword, i) => {
      const prev = found.get(keyword);
      if (prev) {
        prev.hits++;
        prev.position = Math.min(prev.position, i + 1);
      } else found.set(keyword, { marketplace: market, keyword, position: i + 1, hits: 1, seed: base });
    });
  }
  return [...found.values()].sort((a, b) => b.hits - a.hits || a.position - b.position);
}

export function clearSuggestionCache() {
  cache.clear();
}
