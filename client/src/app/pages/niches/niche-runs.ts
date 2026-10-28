import { Injectable, inject, signal } from '@angular/core';
import type { AgentStatus, NicheAgentEvent, NicheAnalyzeRequest, NicheDiscoverRequest } from '@shared';
import { Api } from '../../core/api';

export interface RunLine {
  kind: 'status' | 'progress' | 'tool' | 'search' | 'error';
  text: string;
  ok?: boolean;
  id?: string;
}

type Done = Extract<NicheAgentEvent, { type: 'done' }>;
type RunKind = { kind: 'discover' } | { kind: 'analyze'; nicheId: string };

/** Exécutions de l'agent de niches (une à la fois) : découverte d'un thème ou analyse d'une niche. */
@Injectable()
export class NicheRuns {
  private api = inject(Api);
  private controller: AbortController | null = null;

  status = signal<AgentStatus | null>(null);
  running = signal<RunKind | null>(null);
  log = signal<RunLine[]>([]);
  summary = signal('');
  last = signal<Done | null>(null);

  async loadStatus() {
    try {
      this.status.set(await this.api.agentStatus());
    } catch {
      this.status.set({ ready: false, model: '', images: false, imageModel: null, reason: 'Serveur injoignable.' });
    }
  }

  discover(req: NicheDiscoverRequest) {
    return this.run({ kind: 'discover' }, (signal) => this.api.discoverNiches(req, signal));
  }

  analyze(nicheId: string, req: NicheAnalyzeRequest) {
    return this.run({ kind: 'analyze', nicheId }, (signal) => this.api.analyzeNiche(nicheId, req, signal));
  }

  cancel() {
    this.controller?.abort();
  }

  private async run(kind: RunKind, start: (s: AbortSignal) => AsyncGenerator<NicheAgentEvent | { type: 'error'; message: string }>): Promise<Done | null> {
    if (this.running()) return null;
    this.controller = new AbortController();
    this.running.set(kind);
    this.log.set([]);
    this.summary.set('');
    this.last.set(null);
    let done: Done | null = null;
    try {
      for await (const e of start(this.controller.signal)) {
        switch (e.type) {
          case 'status': this.push({ kind: 'status', text: e.message }); break;
          case 'progress': this.push({ kind: 'progress', text: e.text }); break;
          case 'search': this.push({ kind: 'search', text: e.query }); break;
          case 'text': this.summary.update((s) => s + e.delta); break;
          case 'tool': this.push({ kind: 'tool', id: e.id, text: e.label }); break;
          case 'tool_result':
            this.log.update((l) => l.map((x) => (x.kind === 'tool' && x.id === e.id ? { ...x, ok: e.ok, text: e.ok ? x.text : `${x.text} — ${e.message}` } : x)));
            break;
          case 'done':
            done = e;
            this.summary.set(e.summary);
            this.last.set(e);
            break;
          case 'error': this.push({ kind: 'error', text: e.message }); break;
        }
      }
    } catch (err) {
      this.push(this.controller.signal.aborted ? { kind: 'status', text: 'Exécution annulée.' } : { kind: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      this.running.set(null);
      this.controller = null;
    }
    return done;
  }

  private push(l: RunLine) {
    this.log.update((list) => [...list, l]);
  }
}
