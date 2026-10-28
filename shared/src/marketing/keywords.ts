import { LISTING } from '../kdp/specs';

export interface WordCount {
  word: string;
  count: number;
}

/** Extrait les listes « mot (123) » collées depuis un outil d'analyse de mots-clés. */
export function parseKeywordCounts(text: string): WordCount[] {
  const out: WordCount[] = [];
  for (const m of text.matchAll(/([\p{L}0-9'&-]+(?:\s[\p{L}0-9'&-]+)?)\s*\((\d+)\)/gu)) out.push({ word: m[1].trim().toLowerCase(), count: Number(m[2]) });
  return out.sort((a, b) => b.count - a.count);
}

/** Range des expressions dans 7 emplacements de 50 caractères maximum, sans doublons. */
export function packKeywords(phrases: string[], slots = LISTING.keywordSlots, max = LISTING.keywordMax): string[] {
  const out: string[] = Array.from({ length: slots }, () => '');
  const seen = new Set<string>();
  const unique = phrases.map((p) => p.trim().replace(/\s+/g, ' ')).filter((p) => p && !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase()));
  for (const p of unique) {
    if (p.length > max) continue;
    const i = out.findIndex((s) => (s ? s.length + 1 + p.length : p.length) <= max);
    if (i === -1) break;
    out[i] = out[i] ? `${out[i]} ${p}` : p;
  }
  return out;
}

/** Normalise une ligne de mots-clés importée (virgules superflues, espaces). */
export function cleanKeywordLine(s: string): string {
  return s.replace(/\s*,\s*/g, ' ').replace(/\s+/g, ' ').trim();
}
