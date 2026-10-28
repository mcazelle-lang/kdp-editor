import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  amazonProductUrl, amazonSearchUrl, computeNicheMetrics, findMarket, findPreset, lintKeyword, missingBsr, NICHE_STATUS_LABELS,
  type Niche, type NicheStatus,
} from '@shared';
import { Api } from '../../core/api';
import { NicheRuns } from './niche-runs';

const VERDICT: Record<string, { label: string; cls: string }> = {
  go: { label: 'GO', cls: 'ok' },
  'a-tester': { label: 'À tester', cls: 'warn' },
  eviter: { label: 'À éviter', cls: 'err' },
};

@Component({
  selector: 'app-niche-detail',
  imports: [FormsModule, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let n = niche();
    @let m = metrics();
    <div class="card stack">
      <div class="row">
        <div>
          <div class="muted small">{{ market().label }} · {{ n.source }} · ajoutée le {{ n.createdAt.slice(0, 10) }}</div>
          <h2 style="margin: 2px 0 0">{{ n.keyword }}</h2>
        </div>
        <span class="spacer"></span>
        <select [ngModel]="n.status" (ngModelChange)="setStatus($event)" style="width: 150px">
          @for (s of statuses; track s[0]) { <option [value]="s[0]">{{ s[1] }}</option> }
        </select>
        <button class="icon-btn" title="Fermer" (click)="closed.emit()">✕</button>
      </div>

      <div class="kpis">
        <div class="kpi"><span class="lab">Score</span><b [class]="scoreClass(m.score)">{{ m.score }}</b><span class="muted small">confiance {{ m.confidence }}</span></div>
        <div class="kpi"><span class="lab">Demande</span><b>{{ m.demand.level }}</b>
          <span class="muted small">@if (m.demand.medianBsr) { BSR méd. {{ m.demand.medianBsr | number: '1.0-0' }} } @else { BSR inconnu }</span></div>
        <div class="kpi"><span class="lab">Concurrence</span><b>{{ m.competition.level }}</b>
          <span class="muted small">@if (m.competition.medianReviews !== null) { {{ m.competition.medianReviews | number: '1.0-0' }} avis méd. } @else { non capturée }</span></div>
        <div class="kpi"><span class="lab">Redevance / vente</span><b>@if (m.profit.royaltyPerSale !== null) { {{ m.profit.royaltyPerSale | number: '1.2-2' }} } @else { — }</b>
          <span class="muted small">prix méd. {{ m.price.median !== null ? (m.price.median | number: '1.2-2') : '—' }} {{ m.profit.currency }}</span></div>
        <div class="kpi"><span class="lab">Ventes / jour (est.)</span><b>{{ m.demand.salesPerDayTop !== null ? (m.demand.salesPerDayTop | number: '1.1-1') : '—' }}</b>
          <span class="muted small">@if (m.profit.monthlyIfMedianBook !== null) { ≈ {{ m.profit.monthlyIfMedianBook | number: '1.0-0' }} {{ m.profit.currency }}/mois par titre } @else { fiche type du top 10 }</span></div>
      </div>

      @for (r of m.reasons; track $index) { <div class="issue info">{{ r }}</div> }
      @for (r of m.missing; track $index) { <div class="issue warning">{{ r }}</div> }
      <p class="small muted" style="margin: 0">Ventes estimées à partir du BSR : ordre de grandeur indicatif, à recalibrer avec tes propres ventes KDP.</p>

      <div class="row">
        <a class="btn primary" [href]="searchUrl()" target="_blank" rel="noopener">Ouvrir la recherche sur {{ market().label }} ↗</a>
        <span class="muted small">puis clique sur ton favori « Capturer pour Book Creator ».</span>
      </div>

      @if (n.serp) {
        <div class="section-title">Top des résultats (capturé le {{ n.serp.capturedAt.slice(0, 10) }}{{ n.serp.totalResults !== null ? ' · ' + (n.serp.totalResults | number) + ' résultats' : '' }})</div>
        <table class="data small">
          <thead><tr><th>#</th><th>Titre</th><th>Prix</th><th>Avis</th><th>Note</th><th>BSR</th><th>Pages</th><th></th></tr></thead>
          @for (i of topItems(); track i.asin) {
            @let p = product(i.asin);
            <tr [class.sponsored]="i.sponsored">
              <td>{{ i.position }}</td>
              <td class="t">{{ i.title }} @if (i.sponsored) { <span class="badge">sponsorisé</span> }</td>
              <td>{{ i.price !== null ? (i.price | number: '1.2-2') : '—' }}</td>
              <td>{{ i.reviews ?? '—' }}</td>
              <td>{{ i.rating ?? '—' }}</td>
              <td>@if (p?.bsr) { <b>{{ p!.bsr | number }}</b> } @else if (!i.sponsored) { <span class="muted">—</span> }</td>
              <td>{{ p?.pages ?? '' }}</td>
              <td><a [href]="productUrl(i.asin)" target="_blank" rel="noopener" [title]="p ? 'Fiche capturée' : 'Ouvrir la fiche pour capturer le BSR'">{{ p ? 'fiche ✓' : 'fiche ↗' }}</a></td>
            </tr>
          }
        </table>
        @if (toCapture().length) { <p class="small muted" style="margin: 0">BSR manquant pour {{ toCapture().length }} fiche(s) du top 10 : ouvre-les et clique sur le favori.</p> }
      }

      <div class="section-title">Analyse par Claude</div>
      @if (runs.status() && !runs.status()!.ready) { <div class="issue warning">{{ runs.status()!.reason }}</div> }
      <div class="row">
        <input type="text" [(ngModel)]="instruction" placeholder="Précision facultative (ex. cibler les seniors, comparer FR/DE)" style="flex: 1" />
        <label class="small">Recherches web <input type="number" min="0" max="10" [(ngModel)]="searches" style="width: 60px" /></label>
        @if (runningHere()) {
          <button class="btn danger" (click)="runs.cancel()">■ Arrêter</button>
        } @else {
          <button class="btn dark" [disabled]="!runs.status()?.ready || !!runs.running()" (click)="analyze()">✨ Analyser</button>
        }
      </div>
      @if (runningHere() || (runs.log().length && lastRunHere)) {
        <div class="log">
          @for (l of runs.log(); track $index) { <div class="line" [class]="l.kind"><span class="ic">{{ icon(l) }}</span>{{ l.text }}</div> }
          @if (runningHere()) { <div class="line status"><span class="ic">◌</span>Claude analyse la niche…</div> }
        </div>
      }

      @if (n.report; as r) {
        <div class="report">
          <div class="row">
            <span class="badge" [class]="verdict(r.verdict).cls">{{ verdict(r.verdict).label }}</span>
            <span class="badge">score Claude {{ r.score }}</span>
            <span class="muted small">{{ r.model }} · {{ r.createdAt.slice(0, 16).replace('T', ' ') }}</span>
          </div>
          <p>{{ r.summary }}</p>
          <div class="grid-2 small">
            <div><b>Demande</b><p>{{ r.demand }}</p></div>
            <div><b>Concurrence</b><p>{{ r.competition }}</p></div>
            <div><b>Angle</b><p>{{ r.angle }}</p></div>
            <div><b>Saisonnalité</b><p>{{ r.seasonality }}</p></div>
          </div>
          @if (r.subNiches.length) {
            <div class="section-title">Sous-niches</div>
            <div class="chips">@for (s of r.subNiches; track s) { <button class="chip" title="Ajouter au radar" (click)="addSub(s)">+ {{ s }}</button> }</div>
          }
          @if (r.titleIdeas.length) { <div class="section-title">Idées de titres</div><ul class="small">@for (t of r.titleIdeas; track t) { <li>{{ t }}</li> }</ul> }
          @if (r.keywords.length) {
            <div class="section-title">Mots-clés proposés</div>
            @for (k of r.keywords; track $index) {
              <div class="small kw"><span class="counter" [class.over]="k.length > 50">{{ k.length }}</span> {{ k }}
                @for (iss of kwIssues(k, $index); track $index) { <span class="badge" [class.err]="iss.level === 'error'" [class.warn]="iss.level === 'warning'">{{ iss.message.replace('Mot-clé ' + ($index + 1) + ' : ', '') }}</span> }
              </div>
            }
          }
          <div class="row small" style="margin-top: 8px">
            @if (r.presetId) { <span class="badge blue">Intérieur : {{ presetName(r.presetId) }}</span> }
            @if (r.price) { <span class="badge">Prix conseillé {{ r.price | number: '1.2-2' }} {{ m.profit.currency }}</span> }
          </div>
          @if (r.risks.length) { <div class="section-title">Risques</div>@for (k of r.risks; track k) { <div class="issue warning">{{ k }}</div> } }
          @if (r.sources.length) { <div class="section-title">Sources</div>@for (s of r.sources; track s.url) { <div class="small"><a [href]="s.url" target="_blank" rel="noopener">{{ s.title }}</a></div> } }
        </div>
      }

      <div class="section-title">Notes</div>
      <textarea rows="3" [ngModel]="n.notes" (blur)="saveNotes($any($event.target).value)"></textarea>

      <div class="row">
        <button class="btn primary" (click)="createBook()">Créer le livre depuis cette niche →</button>
        <span class="spacer"></span>
        <button class="btn ghost danger" (click)="remove()">Supprimer</button>
      </div>
    </div>
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
    .kpi { background: #fafbfe; border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
    .kpi .lab { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 700; }
    .kpi b { font-family: var(--font-head); font-size: 18px; text-transform: capitalize; }
    b.ok { color: var(--ok); } b.warn { color: var(--warn); } b.err { color: var(--err); }
    td.t { max-width: 320px; }
    tr.sponsored td { color: var(--muted); }
    .log { display: flex; flex-direction: column; gap: 3px; max-height: 220px; overflow: auto; background: #fafbfe; border-radius: 8px; padding: 8px; }
    .line { font-size: 12.5px; display: flex; gap: 6px; }
    .line.progress { font-style: italic; color: var(--ink-2); }
    .line.search { color: var(--blue); }
    .line.error { color: var(--err); font-weight: 600; }
    .ic { width: 16px; text-align: center; flex-shrink: 0; }
    .report { border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; background: #fff; }
    .report p { margin: 6px 0; font-size: 13px; }
    .kw { display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; padding: 2px 0; }
    @media (max-width: 1100px) { .kpis { grid-template-columns: repeat(2, 1fr); } }
  `,
})
export class NicheDetail {
  private api = inject(Api);
  private router = inject(Router);
  runs = inject(NicheRuns);
  niche = input.required<Niche>();
  changed = output<Niche | null>();
  closed = output<void>();
  instruction = '';
  searches = 4;
  lastRunHere = false;
  statuses = Object.entries(NICHE_STATUS_LABELS) as [NicheStatus, string][];

  metrics = computed(() => computeNicheMetrics(this.niche()));
  market = computed(() => findMarket(this.niche().marketplace));
  searchUrl = computed(() => amazonSearchUrl(this.niche().marketplace, this.niche().keyword));
  topItems = computed(() => (this.niche().serp?.items ?? []).slice(0, 20));
  toCapture = computed(() => missingBsr(this.niche()));
  runningHere = computed(() => {
    const r = this.runs.running();
    return r?.kind === 'analyze' && r.nicheId === this.niche().id;
  });
  busy = signal(false);

  product = (asin: string) => this.niche().products.find((p) => p.asin === asin);
  productUrl = (asin: string) => amazonProductUrl(this.niche().marketplace, asin);
  verdict = (v: string) => VERDICT[v] ?? VERDICT['a-tester'];
  presetName = (id: string) => findPreset(id)?.name ?? id;
  scoreClass = (s: number) => (s >= 65 ? 'ok' : s >= 40 ? 'warn' : 'err');
  icon = (l: { kind: string; ok?: boolean }) => (l.kind === 'tool' ? (l.ok === undefined ? '…' : l.ok ? '✓' : '✗') : ({ status: '•', progress: '›', search: '🔎', error: '⚠' } as Record<string, string>)[l.kind] ?? '•');
  kwIssues = (k: string, i: number) => lintKeyword(k, i, new Set()).filter((x) => x.level !== 'info');

  async analyze() {
    this.lastRunHere = true;
    await this.runs.analyze(this.niche().id, { instruction: this.instruction, maxSearches: this.searches });
    const fresh = (await this.api.niches()).find((x) => x.id === this.niche().id);
    if (fresh) this.changed.emit(fresh);
  }

  async setStatus(status: NicheStatus) {
    this.changed.emit(await this.api.updateNiche(this.niche().id, { status }));
  }

  async saveNotes(notes: string) {
    if (notes === this.niche().notes) return;
    this.changed.emit(await this.api.updateNiche(this.niche().id, { notes }));
  }

  async addSub(keyword: string) {
    await this.api.addNiches([{ marketplace: this.niche().marketplace, keyword }]);
    this.changed.emit(this.niche());
  }

  async createBook() {
    const b = await this.api.nicheBook(this.niche().id);
    this.router.navigate(['/livres', b.id], { queryParams: { onglet: 'agent' } });
  }

  async remove() {
    if (!confirm(`Supprimer « ${this.niche().keyword} » du radar ?`)) return;
    await this.api.deleteNiche(this.niche().id);
    this.changed.emit(null);
  }
}
