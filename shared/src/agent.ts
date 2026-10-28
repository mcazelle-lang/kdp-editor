import type { Asset, Book } from './model';
import type { Issue } from './marketing/lint';

// Contrat entre l'assistant IA (serveur) et l'éditeur (client).
export type AgentScope = 'listing' | 'interior' | 'cover';

export const AGENT_SCOPES: { id: AgentScope; label: string; hint: string }[] = [
  { id: 'listing', label: 'Fiche KDP', hint: 'titre, sous-titre, description, 7 mots-clés, catégories, prix' },
  { id: 'interior', label: 'Intérieur', hint: 'format, sections et modèles de pages' },
  { id: 'cover', label: 'Couverture', hint: 'style, palette, motif, typographie, dos, 4e de couverture' },
];

export interface AgentRequest {
  instruction: string;
  scope: AgentScope[];
  /** Autorise la génération d'une illustration (modèle d'image Gemini) */
  images: boolean;
}

export interface AgentStatus {
  ready: boolean;
  model: string;
  images: boolean;
  imageModel: string | null;
  reason?: string;
}

export interface AgentUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  iterations: number;
}

export type AgentEvent =
  | { type: 'status'; message: string }
  | { type: 'progress'; text: string }
  | { type: 'text'; delta: string }
  | { type: 'tool'; id: string; name: string; label: string }
  | { type: 'tool_result'; id: string; name: string; ok: boolean; message: string }
  | { type: 'asset'; asset: Asset }
  | { type: 'done'; draft: Book; summary: string; issues: Issue[]; usage: AgentUsage }
  | { type: 'error'; message: string };
