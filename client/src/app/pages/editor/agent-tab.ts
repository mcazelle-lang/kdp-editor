import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AGENT_SCOPES, type AgentScope } from '@shared';
import { CoverThumb } from '../../ui/cover-thumb';
import { AgentSession, diffBooks } from './agent-session';
import { BookStore } from './book-store';

// Tarifs Claude Opus 5.5 ($ / million de jetons) pour une estimation indicative du coût d'une exécution.
const OPUS_55 = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };

@Component({
  selector: 'app-agent-tab',
  imports: [FormsModule, DecimalPipe, CoverThumb],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let st = agent.status();
    <div class="split">
      <div class="side stack">
        <div class="card stack">
          <div class="row"><h2 style="margin: 0">Assistant IA</h2><span class="spacer"></span>
            @if (st?.ready) { <span class="badge ok">{{ st!.model }}</span> } @else if (st) { <span class="badge err">non configuré</span> }
          </div>
          <p class="small muted" style="margin: 0">Claude rédige la fiche, compose l'intérieur et la couverture en respectant les règles KDP de l'application, puis te présente une proposition. Rien n'est modifié tant que tu ne l'as pas appliquée.</p>
          @if (st && !st.ready) { <div class="issue warning">{{ st.reason }}</div> }

          <label class="field">Ta demande
            <textarea rows="5" [(ngModel)]="instruction" placeholder="Ex. Prépare une fiche complète pour le marché français à partir de l'idée importée, une couverture sobre façon registre professionnel, et vérifie les mots-clés."></textarea>
          </label>
          <div class="chips">
            @for (q of quick; track q) { <button class="chip" (click)="instruction = q">{{ q }}</button> }
          </div>
          <div class="section-title">Domaines</div>
          @for (s of scopes; track s.id) {
            <label class="check"><input type="checkbox" [checked]="picked().has(s.id)" (change)="toggle(s.id)" /> <b>{{ s.label }}</b> <span class="muted small">{{ s.hint }}</span></label>
          }
          <label class="check" [class.muted]="!st?.images">
            <input type="checkbox" [(ngModel)]="images" [disabled]="!st?.images || !picked().has('cover')" />
            Autoriser une illustration générée ({{ st?.imageModel ?? 'clé GEMINI_API_KEY absente' }})
          </label>
          @if (images && st?.images) { <div class="issue info">Une illustration générée par IA devra être déclarée sur KDP (la case est cochée automatiquement).</div> }
          <div class="row">
            @if (agent.running()) {
              <button class="btn danger" (click)="agent.cancel()">■ Arrêter</button>
              <span class="muted small">En cours…</span>
            } @else {
              <button class="btn primary" [disabled]="!st?.ready || !picked().size" (click)="run()">✨ Lancer l'assistant</button>
            }
          </div>
        </div>

        <div class="card">
          <h3>Déroulé</h3>
          @if (!agent.log().length && !agent.running()) { <p class="small muted" style="margin: 0">Les étapes de l'assistant s'afficheront ici.</p> }
          <div class="log">
            @for (l of agent.log(); track $index) {
              <div class="line" [class]="l.kind">
                <span class="ic">{{ icon(l) }}</span><span>{{ l.text }}</span>
              </div>
            }
            @if (agent.running()) { <div class="line status"><span class="ic spin">◌</span><span>Claude travaille…</span></div> }
          </div>
        </div>
      </div>

      <div class="stack">
        @if (agent.draft(); as d) {
          <div class="card stack">
            <div class="row">
              <h2 style="margin: 0">Proposition</h2>
              <span class="badge" [class.ok]="errors() === 0" [class.err]="errors() > 0">{{ errors() }} erreur(s) KDP</span>
              <span class="badge warn">{{ warnings() }} avertissement(s)</span>
              <span class="spacer"></span>
              <button class="btn ghost" (click)="agent.discard()">Ignorer</button>
              <button class="btn primary" (click)="agent.apply()">Appliquer au livre</button>
            </div>
            @if (agent.summary()) { <div class="summary">{{ agent.summary() }}</div> }
            @if (agent.scope().includes('cover')) {
              <div class="covers">
                <div><div class="section-title">Actuelle</div><div style="width: 150px"><app-cover-thumb [book]="store.book()!" /></div></div>
                <div class="arrow">→</div>
                <div><div class="section-title">Proposée</div><div style="width: 150px"><app-cover-thumb [book]="d" /></div></div>
              </div>
            }
            <div class="section-title">Modifications ({{ changes().length }})</div>
            <table class="data small">
              @for (c of changes(); track c.label) {
                <tr><td class="lab">{{ c.label }}</td><td class="muted">{{ c.before }}</td><td>{{ c.after }}</td></tr>
              } @empty { <tr><td class="muted">Aucune modification.</td></tr> }
            </table>
            @if (d.metadata.descriptionHtml && agent.scope().includes('listing')) {
              <div class="section-title">Description proposée</div>
              <div class="desc" [innerHTML]="d.metadata.descriptionHtml"></div>
            }
            @if (agent.draftIssues().length) {
              <div class="section-title">Contrôles restants</div>
              @for (i of agent.draftIssues(); track $index) {
                @if (i.level !== 'info') { <div class="issue" [class]="i.level">{{ i.message }}</div> }
              }
            }
          </div>
        } @else if (agent.summary() && !agent.running()) {
          <div class="card"><div class="summary">{{ agent.summary() }}</div></div>
        } @else {
          <div class="card empty">
            <h2>Comment ça marche ?</h2>
            <p>1. Choisis les domaines et décris ce que tu veux (ou utilise une suggestion).<br />
              2. L'assistant lit le livre et l'idée importée, modifie un brouillon et le fait passer par le contrôle KDP jusqu'à zéro erreur.<br />
              3. Compare, puis applique ou ignore la proposition.</p>
          </div>
        }
        @if (agent.usage(); as u) {
          <div class="small muted">{{ u.iterations }} échanges · {{ u.inputTokens + u.cacheReadTokens + u.cacheWriteTokens | number }} jetons lus (dont {{ u.cacheReadTokens | number }} en cache) · {{ u.outputTokens | number }} jetons écrits
            @if (cost() !== null) { · coût estimé ≈ {{ cost() | number: '1.2-2' }} $ }</div>
        }
      </div>
    </div>
  `,
  styles: `
    .split { display: grid; grid-template-columns: minmax(360px, 460px) minmax(0, 1fr); gap: 16px; align-items: start; }
    .log { display: flex; flex-direction: column; gap: 4px; max-height: 420px; overflow: auto; }
    .line { display: flex; gap: 8px; font-size: 12.5px; line-height: 1.4; padding: 3px 0; }
    .line.progress { color: var(--ink-2); font-style: italic; }
    .line.error { color: var(--err); font-weight: 600; }
    .line.asset { color: var(--blue); }
    .ic { width: 16px; flex-shrink: 0; text-align: center; }
    .spin { display: inline-block; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .summary { white-space: pre-wrap; font-size: 13.5px; line-height: 1.5; background: #fafbfe; border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
    .covers { display: flex; gap: 16px; align-items: center; }
    .arrow { font-size: 22px; color: var(--muted); }
    .lab { font-weight: 600; white-space: nowrap; }
    .desc { font-size: 13px; border: 1px solid var(--line); border-radius: 8px; padding: 4px 12px; max-height: 280px; overflow: auto; }
    @media (max-width: 1100px) { .split { grid-template-columns: 1fr; } }
  `,
})
export class AgentTab {
  agent = inject(AgentSession);
  store = inject(BookStore);
  scopes = AGENT_SCOPES;
  picked = signal(new Set<AgentScope>(['listing', 'interior', 'cover']));
  instruction = '';
  images = false;
  quick = [
    'Prépare une fiche KDP complète et conforme à partir de l\'idée importée.',
    'Propose une couverture qui se démarque en vignette, avec les codes visuels de la niche.',
    'Adapte l\'intérieur à l\'usage réel de la niche (colonnes, champs, pages bonus).',
    'Crée la version anglaise pour amazon.com (titre, mots-clés, description).',
  ];

  changes = computed(() => (this.agent.draft() && this.store.book() ? diffBooks(this.store.book()!, this.agent.draft()!) : []));
  errors = computed(() => this.agent.draftIssues().filter((i) => i.level === 'error').length);
  warnings = computed(() => this.agent.draftIssues().filter((i) => i.level === 'warning').length);
  cost = computed(() => {
    const u = this.agent.usage();
    if (!u || this.agent.status()?.model !== 'claude-opus-5-5') return null;
    return (u.inputTokens * OPUS_55.input + u.outputTokens * OPUS_55.output + u.cacheReadTokens * OPUS_55.cacheRead + u.cacheWriteTokens * OPUS_55.cacheWrite) / 1e6;
  });

  constructor() {
    if (!this.agent.status()) this.agent.loadStatus();
  }

  toggle(id: AgentScope) {
    const s = new Set(this.picked());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.picked.set(s);
  }

  run() {
    this.agent.run({ instruction: this.instruction, scope: [...this.picked()], images: this.images && this.picked().has('cover') });
  }

  icon(l: { kind: string; ok?: boolean }) {
    if (l.kind === 'tool') return l.ok === undefined ? '…' : l.ok ? '✓' : '✗';
    return { status: '•', progress: '›', error: '⚠', asset: '🖼' }[l.kind] ?? '•';
  }
}
