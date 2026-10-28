import { createHash } from 'node:crypto';
import { normalizeKeyword, type MarketId, type Niche, type NicheSource, type ParsedCapture } from '@shared';
import { db } from '../db';

export const nicheId = (market: MarketId, keyword: string) => 'n' + createHash('sha1').update(`${market}|${normalizeKeyword(keyword)}`).digest('hex').slice(0, 12);

export function findNiche(market: MarketId, keyword: string): Niche | undefined {
  const id = nicheId(market, keyword);
  return db.data.niches.find((n) => n.id === id);
}

/** Crée la niche si besoin et applique la mise à jour ; ne rétrograde jamais une meilleure position d'autocomplétion. */
export function upsertNiche(market: MarketId, keyword: string, source: NicheSource, patch: Partial<Niche> = {}): Niche {
  const now = new Date().toISOString();
  let n = findNiche(market, keyword);
  if (!n) {
    n = {
      id: nicheId(market, keyword), marketplace: market, keyword: normalizeKeyword(keyword), source, status: 'nouvelle', createdAt: now, updatedAt: now,
      autocomplete: null, serp: null, products: [], notes: '', tags: [], report: null, bookIds: [],
    };
    db.data.niches.unshift(n);
  }
  const { autocomplete, notes, tags, ...rest } = patch;
  Object.assign(n, rest);
  if (autocomplete && (!n.autocomplete || autocomplete.position < n.autocomplete.position || autocomplete.hits > n.autocomplete.hits)) n.autocomplete = autocomplete;
  if (notes && !n.notes.includes(notes)) n.notes = n.notes ? `${n.notes}\n\n${notes}` : notes;
  if (tags) n.tags = [...new Set([...n.tags, ...tags])];
  n.updatedAt = now;
  return n;
}

/** Range une capture navigateur : page de résultats → niche du mot-clé ; fiche produit → toutes les niches où l'ASIN apparaît. */
export function storeCapture(parsed: ParsedCapture): { niches: Niche[]; message: string } {
  if (parsed.kind === 'serp' && parsed.serp) {
    if (!parsed.keyword) throw new Error('Mot-clé introuvable dans l\'adresse de la recherche.');
    const n = upsertNiche(parsed.marketplace, parsed.keyword, 'capture', { serp: parsed.serp });
    if (n.status === 'nouvelle') n.status = 'a-analyser';
    return { niches: [n], message: `${parsed.serp.items.length} résultats capturés pour « ${n.keyword} » (${parsed.marketplace}).` };
  }
  const p = parsed.product!;
  if (!p.asin) throw new Error('ASIN introuvable sur la fiche produit.');
  const matches = db.data.niches.filter((n) => n.marketplace === parsed.marketplace && n.serp?.items.some((i) => i.asin === p.asin));
  for (const n of matches) {
    n.products = [...n.products.filter((x) => x.asin !== p.asin), p];
    n.updatedAt = new Date().toISOString();
  }
  const bsr = p.bsr ? `BSR ${p.bsr.toLocaleString('fr-FR')}` : 'BSR introuvable';
  return {
    niches: matches,
    message: matches.length
      ? `Fiche ${p.asin} (${bsr}) ajoutée à ${matches.length} niche${matches.length > 1 ? 's' : ''}.`
      : `Fiche ${p.asin} (${bsr}) : elle n'apparaît dans aucune recherche capturée. Capture d'abord la page de résultats.`,
  };
}
