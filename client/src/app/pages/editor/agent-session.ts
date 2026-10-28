import { Injectable, inject, signal } from '@angular/core';
import { findTemplate, findTrim, totalPages, type AgentEvent, type AgentRequest, type AgentScope, type AgentStatus, type AgentUsage, type Book, type Issue } from '@shared';
import { Api } from '../../core/api';
import { BookStore } from './book-store';

export interface LogLine {
  kind: 'status' | 'progress' | 'tool' | 'error' | 'asset';
  text: string;
  ok?: boolean;
  id?: string;
}

export interface Change {
  label: string;
  before: string;
  after: string;
}

/** Exécution de l'assistant pour le livre ouvert ; survit aux changements d'onglet de l'éditeur. */
@Injectable()
export class AgentSession {
  private api = inject(Api);
  private store = inject(BookStore);
  private controller: AbortController | null = null;

  status = signal<AgentStatus | null>(null);
  running = signal(false);
  log = signal<LogLine[]>([]);
  summary = signal('');
  draft = signal<Book | null>(null);
  draftIssues = signal<Issue[]>([]);
  usage = signal<AgentUsage | null>(null);
  scope = signal<AgentScope[]>([]);

  async loadStatus() {
    try {
      this.status.set(await this.api.agentStatus());
    } catch {
      this.status.set({ ready: false, model: '', images: false, imageModel: null, reason: 'Serveur injoignable.' });
    }
  }

  async run(request: AgentRequest) {
    const book = this.store.book();
    if (!book || this.running()) return;
    await this.store.flush();
    this.controller = new AbortController();
    this.running.set(true);
    this.log.set([]);
    this.summary.set('');
    this.draft.set(null);
    this.usage.set(null);
    this.scope.set(request.scope);
    try {
      for await (const e of this.api.runAgent(book.id, request, this.controller.signal)) this.handle(e);
    } catch (err) {
      if (!this.controller.signal.aborted) this.push({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
      else this.push({ kind: 'status', text: 'Exécution annulée.' });
    } finally {
      this.running.set(false);
      this.controller = null;
    }
  }

  cancel() {
    this.controller?.abort();
  }

  private push(l: LogLine) {
    this.log.update((list) => [...list, l]);
  }

  private handle(e: AgentEvent) {
    switch (e.type) {
      case 'status':
        this.push({ kind: 'status', text: e.message });
        break;
      case 'progress':
        this.push({ kind: 'progress', text: e.text });
        break;
      case 'text':
        this.summary.update((s) => s + e.delta);
        break;
      case 'tool':
        this.push({ kind: 'tool', id: e.id, text: e.label });
        break;
      case 'tool_result':
        this.log.update((list) => list.map((l) => (l.kind === 'tool' && l.id === e.id ? { ...l, ok: e.ok, text: e.ok ? l.text : `${l.text} — ${e.message}` } : l)));
        break;
      case 'asset':
        this.store.assets.update((list) => [...list, e.asset]);
        this.push({ kind: 'asset', text: `Illustration générée (${e.asset.width} × ${e.asset.height} px)` });
        break;
      case 'done':
        this.draft.set(e.draft);
        this.draftIssues.set(e.issues);
        this.usage.set(e.usage);
        this.summary.set(e.summary);
        break;
      case 'error':
        this.push({ kind: 'error', text: e.message });
        break;
    }
  }

  /** Applique au livre les seuls domaines traités par l'assistant. */
  apply() {
    const d = this.draft();
    if (!d) return;
    const scope = new Set(this.scope());
    this.store.update((b) => {
      if (scope.has('listing')) b.metadata = structuredClone(d.metadata);
      if (scope.has('interior')) {
        b.format = structuredClone(d.format);
        b.interior = structuredClone(d.interior);
        b.presetId = d.presetId;
      }
      if (scope.has('cover')) {
        b.cover = structuredClone(d.cover);
        b.metadata.aiGenerated = { ...b.metadata.aiGenerated, images: b.metadata.aiGenerated.images || d.metadata.aiGenerated.images };
      }
    });
    this.draft.set(null);
    this.push({ kind: 'status', text: 'Proposition appliquée au livre.' });
  }

  discard() {
    this.draft.set(null);
  }
}

const short = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n)}…` : s || '—');

export function diffBooks(a: Book, b: Book): Change[] {
  const out: Change[] = [];
  const add = (label: string, x: unknown, y: unknown, fmt: (v: unknown) => string = (v) => short(String(v ?? ''))) => {
    if (JSON.stringify(x) !== JSON.stringify(y)) out.push({ label, before: fmt(x), after: fmt(y) });
  };
  const m1 = a.metadata;
  const m2 = b.metadata;
  add('Titre', m1.title, m2.title);
  add('Sous-titre', m1.subtitle, m2.subtitle);
  add('Auteur', m1.author, m2.author);
  add('Public visé', m1.audience, m2.audience);
  add('Description', m1.descriptionHtml, m2.descriptionHtml, (v) => `${String(v ?? '').length} caractères`);
  m2.keywords.forEach((k, i) => add(`Mot-clé ${i + 1}`, m1.keywords[i] ?? '', k));
  add('Catégories', m1.categories.filter(Boolean).join(' · '), m2.categories.filter(Boolean).join(' · '));
  add('Prix', m1.price, m2.price);
  add('Format', a.format.trimId, b.format.trimId, (v) => findTrim(String(v)).label);
  add('Papier', a.format.ink, b.format.ink);
  const secs = (x: Book) => `${totalPages(x)} p. : ${x.interior.sections.map((s) => `${s.pages}× ${findTemplate(s.templateId).name}${s.alt ? ` / ${findTemplate(s.alt.templateId).name}` : ''}`).join(', ')}`;
  add('Intérieur', secs(a), secs(b), (v) => short(String(v), 140));
  const look = (x: Book) => `${x.cover.background.type} ${x.cover.background.color} · motif ${x.cover.pattern.id} · bloc ${x.cover.titleBlock.style} · ${x.cover.title.font} ${x.cover.title.size} pt`;
  add('Couverture', look(a), look(b));
  add('Illustration', a.cover.frontImage.imageId ?? a.cover.background.imageId ?? '', b.cover.frontImage.imageId ?? b.cover.background.imageId ?? '', (v) => (v ? 'oui' : 'aucune'));
  add('Texte de 4e de couverture', a.cover.back.show ? a.cover.texts.back : '', b.cover.back.show ? b.cover.texts.back : '');
  add('Déclaration IA (images)', m1.aiGenerated.images, m2.aiGenerated.images, (v) => (v ? 'oui' : 'non'));
  return out;
}
