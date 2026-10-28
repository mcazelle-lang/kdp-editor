import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import {
  amazonSearchUrl, computeNicheMetrics, findMarket, MARKETS, NICHE_STATUS_LABELS,
  type MarketId, type Niche, type NicheMetrics, type NicheStatus, type Suggestion,
} from '@shared';
import { Api } from '../../core/api';
import { bookmarkletHref } from '../../core/bookmarklet';
import { NicheDetail } from './niche-detail';
import { NicheRuns } from './niche-runs';

type Row = { n: Niche; m: NicheMetrics };
type SuggestionRow = Suggestion & { inRadar: boolean; picked: boolean };

@Component({
  selector: 'app-niches-page',
  imports: [FormsModule, DecimalPipe, NicheDetail],
  providers: [NicheRuns],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <h1>Niches</h1>
        <span class="badge">{{ niches().length }} au radar</span>
        <span class="badge ok">{{ goCount() }} score ≥ 65</span>
        <span class="spacer"></span>
        <button class="btn dark" (click)="showDiscover.set(!showDiscover())">✨ Découvrir avec Claude</button>
      </div>

      @if (showDiscover()) {
        <div class="card stack discover">
          <h2 style="margin: 0">Découvrir des niches avec Claude</h2>
          <p class="small muted" style="margin: 0">Claude explore l'autocomplétion Amazon des marchés choisis et, si tu l'autorises, le web (tendances, usages, réglementation), puis ajoute au radar des niches précises et justifiées. Il n'invente aucun chiffre de ventes : la validation passe par tes captures.</p>
          @if (runs.status() && !runs.status()!.ready) { <div class="issue warning">{{ runs.status()!.reason }}</div> }
          <div class="row">
            <input type="text" [(ngModel)]="theme" placeholder="Thème : ex. petite enfance, métiers de la santé, passions manuelles, registres d'entreprise…" style="flex: 1" />
            <label class="small">Recherches web <input type="number" min="0" max="15" [(ngModel)]="maxSearches" style="width: 60px" /></label>
          </div>
          <div class="row">@for (mk of markets; track mk.id) { <label class="check small"><input type="checkbox" [checked]="discoverMarkets().has(mk.id)" (change)="toggle(discoverMarkets, mk.id)" /> {{ mk.label }}</label> }</div>
          <div class="row">
            @if (runs.running()?.kind === 'discover') {
              <button class="btn danger" (click)="runs.cancel()">■ Arrêter</button><span class="muted small">Claude explore…</span>
            } @else {
              <button class="btn primary" [disabled]="!runs.status()?.ready || !!runs.running() || !discoverMarkets().size" (click)="discover()">Lancer la découverte</button>
              <span class="muted small">Chaque exécution consomme des jetons Claude (et des recherches web).</span>
            }
          </div>
          @if (runs.log().length && lastRun === 'discover') {
            <div class="log">
              @for (l of runs.log(); track $index) { <div class="line" [class]="l.kind"><span class="ic">{{ icon(l) }}</span>{{ l.text }}</div> }
            </div>
            @if (runs.summary() && !runs.running()) { <div class="summary">{{ runs.summary() }}</div> }
          }
        </div>
      }

      <div class="grid-top">
        <div class="card stack">
          <h2 style="margin: 0">1. Explorer l'autocomplétion Amazon</h2>
          <p class="small muted" style="margin: 0">Ce que les acheteurs tapent vraiment dans la recherche du rayon Livres. Mode alphabet : « mot a », « mot b »… (≈ 11 s par mot et par marché).</p>
          <textarea rows="2" [(ngModel)]="seeds" placeholder="Un mot de départ par ligne : carnet de, registre, journal de bord, password book…"></textarea>
          <div class="row">@for (mk of markets; track mk.id) { <label class="check small"><input type="checkbox" [checked]="suggestMarkets().has(mk.id)" (change)="toggle(suggestMarkets, mk.id)" /> {{ mk.flag }}</label> }</div>
          <div class="row">
            <label class="check small"><input type="checkbox" [(ngModel)]="alphabet" /> Mode alphabet</label>
            <span class="spacer"></span>
            <button class="btn primary" [disabled]="searching()" (click)="suggest()">{{ searching() ? 'Recherche…' : 'Chercher les suggestions' }}</button>
          </div>
          @if (suggestError()) { <div class="issue error">{{ suggestError() }}</div> }
          @if (suggestions().length) {
            <div class="row small"><b>{{ suggestions().length }} suggestions</b><span class="spacer"></span>
              <button class="btn sm" (click)="pickAll()">Tout cocher</button>
              <button class="btn sm primary" [disabled]="!pickedCount()" (click)="addPicked()">Ajouter au radar ({{ pickedCount() }})</button></div>
            <div class="sugg">
              @for (s of suggestions(); track s.marketplace + s.keyword) {
                <label class="check small s" [class.known]="s.inRadar">
                  <input type="checkbox" [(ngModel)]="s.picked" [disabled]="s.inRadar" />
                  <span class="badge">{{ flag(s.marketplace) }}</span> {{ s.keyword }}
                  <span class="muted">#{{ s.position }}{{ s.hits > 1 ? ' · ×' + s.hits : '' }}</span>
                  @if (s.inRadar) { <span class="badge blue">au radar</span> }
                </label>
              }
            </div>
          }
        </div>

        <div class="card stack">
          <h2 style="margin: 0">2. Capturer les données sur Amazon</h2>
          <ol class="small steps">
            <li>Glisse ce bouton dans ta barre de favoris : <a class="btn sm dark bm" [href]="bookmarklet" (click)="$event.preventDefault()" title="Glisse-moi dans la barre de favoris">📌 Capturer pour Book Creator</a></li>
            <li>Dans le radar, clique « Amazon ↗ » sur une niche : la recherche s'ouvre dans le rayon Livres.</li>
            <li>Clique sur le favori : la page de résultats (prix, avis, nombre de résultats) est enregistrée.</li>
            <li>Ouvre 3 à 5 fiches du top 10 et clique à nouveau sur le favori pour récupérer leur <b>BSR</b>.</li>
          </ol>
          <p class="small muted" style="margin: 0">Le favori lit uniquement la page que tu as ouverte : pas de robot, pas de téléchargement en arrière-plan. Autorise les pop-ups d'Amazon si ton navigateur les bloque.</p>
        </div>
      </div>

      <div class="card">
        <div class="row" style="margin-bottom: 10px">
          <h2 style="margin: 0">3. Radar</h2>
          <span class="spacer"></span>
          <input type="search" placeholder="Filtrer…" [ngModel]="q()" (ngModelChange)="q.set($event)" style="width: 200px" />
          <select [ngModel]="marketFilter()" (ngModelChange)="marketFilter.set($event)" style="width: 170px"><option value="">Tous les marchés</option>@for (mk of markets; track mk.id) { <option [value]="mk.id">{{ mk.label }}</option> }</select>
          <select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)" style="width: 150px"><option value="">Tous les statuts</option>@for (s of statuses; track s[0]) { <option [value]="s[0]">{{ s[1] }}</option> }</select>
        </div>
        @if (!rows().length) {
          <div class="empty">Radar vide : explore l'autocomplétion ou lance une découverte avec Claude.</div>
        } @else {
          <div class="table-wrap">
            <table class="data small">
              <thead><tr>
                <th (click)="sortBy('score')" class="sort">Score</th><th>Niche</th><th>Marché</th><th>Statut</th>
                <th (click)="sortBy('ac')" class="sort">Suggestion</th><th>Résultats</th><th (click)="sortBy('reviews')" class="sort">Avis méd.</th>
                <th (click)="sortBy('bsr')" class="sort">BSR méd.</th><th>Ventes/j est.</th><th>Prix méd.</th><th>Redevance</th><th>Verdict IA</th><th></th>
              </tr></thead>
              @for (r of rows(); track r.n.id) {
                <tr [class.sel]="selectedId() === r.n.id" (click)="selectedId.set(r.n.id)">
                  <td><span class="badge" [class.ok]="r.m.score >= 65" [class.warn]="r.m.score >= 40 && r.m.score < 65" [class.err]="r.m.score < 40">{{ r.m.score }}</span>
                    @if (r.m.confidence === 'faible') { <span class="muted" title="Peu de données capturées">?</span> }</td>
                  <td class="kw"><b>{{ r.n.keyword }}</b>@if (r.m.trademarks.length) { <span class="badge err">marque</span> }</td>
                  <td>{{ flag(r.n.marketplace) }}</td>
                  <td>{{ statusLabel(r.n.status) }}</td>
                  <td>{{ r.n.autocomplete ? '#' + r.n.autocomplete.position + (r.n.autocomplete.hits > 1 ? ' ×' + r.n.autocomplete.hits : '') : '—' }}</td>
                  <td>{{ r.m.competition.totalResults !== null ? (r.m.competition.totalResults | number) : '—' }}</td>
                  <td>{{ r.m.competition.medianReviews !== null ? (r.m.competition.medianReviews | number: '1.0-0') : '—' }}</td>
                  <td>{{ r.m.demand.medianBsr !== null ? (r.m.demand.medianBsr | number: '1.0-0') : '—' }}</td>
                  <td>{{ r.m.demand.salesPerDayTop !== null ? (r.m.demand.salesPerDayTop | number: '1.1-1') : '—' }}</td>
                  <td>{{ r.m.price.median !== null ? (r.m.price.median | number: '1.2-2') : '—' }}</td>
                  <td>{{ r.m.profit.royaltyPerSale !== null ? (r.m.profit.royaltyPerSale | number: '1.2-2') : '—' }}</td>
                  <td>@if (r.n.report) { <span class="badge" [class.ok]="r.n.report.verdict === 'go'" [class.warn]="r.n.report.verdict === 'a-tester'" [class.err]="r.n.report.verdict === 'eviter'">{{ r.n.report.verdict }}</span> }</td>
                  <td><a [href]="searchUrl(r.n)" target="_blank" rel="noopener" (click)="$event.stopPropagation()">Amazon ↗</a></td>
                </tr>
              }
            </table>
          </div>
        }
      </div>

      @if (selected(); as s) {
        <div style="margin-top: 16px"><app-niche-detail [niche]="s" (changed)="onChanged(s.id, $event)" (closed)="selectedId.set(null)" /></div>
      }
    </div>
  `,
  styles: `
    .grid-top { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; margin-bottom: 16px; align-items: start; }
    .discover { margin-bottom: 16px; border-color: var(--ink-2); }
    .sugg { display: flex; flex-direction: column; gap: 2px; max-height: 320px; overflow: auto; border: 1px solid var(--line); border-radius: 8px; padding: 6px 8px; }
    .sugg .s { display: flex; gap: 6px; align-items: center; padding: 2px 0; }
    .sugg .known { opacity: 0.6; }
    .steps { margin: 0; padding-left: 18px; line-height: 1.7; }
    .bm { cursor: grab; }
    .table-wrap { overflow-x: auto; }
    th.sort { cursor: pointer; text-decoration: underline dotted; }
    tr { cursor: pointer; }
    tr.sel td { background: var(--accent-2) !important; }
    td.kw { min-width: 220px; }
    .log { display: flex; flex-direction: column; gap: 3px; max-height: 240px; overflow: auto; background: #fafbfe; border-radius: 8px; padding: 8px; }
    .line { font-size: 12.5px; display: flex; gap: 6px; }
    .line.progress { font-style: italic; color: var(--ink-2); }
    .line.search { color: var(--blue); }
    .line.error { color: var(--err); font-weight: 600; }
    .ic { width: 16px; text-align: center; flex-shrink: 0; }
    .summary { white-space: pre-wrap; font-size: 13px; background: #fafbfe; border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
    @media (max-width: 1100px) { .grid-top { grid-template-columns: 1fr; } }
  `,
})
export class NichesPage {
  private api = inject(Api);
  runs = inject(NicheRuns);
  markets = MARKETS;
  statuses = Object.entries(NICHE_STATUS_LABELS) as [NicheStatus, string][];
  bookmarklet = inject(DomSanitizer).bypassSecurityTrustUrl(bookmarkletHref(location.origin));

  niches = signal<Niche[]>([]);
  selectedId = signal<string | null>(null);
  q = signal('');
  marketFilter = signal<'' | MarketId>('');
  statusFilter = signal<'' | NicheStatus>('');
  sort = signal<'score' | 'ac' | 'reviews' | 'bsr'>('score');

  seeds = '';
  alphabet = false;
  suggestMarkets = signal(new Set<MarketId>(['amazon.fr']));
  suggestions = signal<SuggestionRow[]>([]);
  searching = signal(false);
  suggestError = signal('');

  showDiscover = signal(false);
  theme = '';
  maxSearches = 5;
  discoverMarkets = signal(new Set<MarketId>(['amazon.fr', 'amazon.com']));
  lastRun: 'discover' | null = null;

  rows = computed<Row[]>(() => {
    const q = this.q().toLowerCase();
    const list = this.niches()
      .filter((n) => (!this.marketFilter() || n.marketplace === this.marketFilter()) && (!this.statusFilter() || n.status === this.statusFilter()) && (!q || n.keyword.includes(q)))
      .map((n) => ({ n, m: computeNicheMetrics(n) }));
    const key = this.sort();
    const val = (r: Row) =>
      key === 'score' ? -r.m.score : key === 'ac' ? r.n.autocomplete?.position ?? 99 : key === 'reviews' ? r.m.competition.medianReviews ?? 1e9 : r.m.demand.medianBsr ?? 1e12;
    return list.sort((a, b) => val(a) - val(b));
  });
  selected = computed(() => this.niches().find((n) => n.id === this.selectedId()) ?? null);
  goCount = computed(() => this.niches().filter((n) => computeNicheMetrics(n).score >= 65).length);
  pickedCount = computed(() => this.suggestions().filter((s) => s.picked).length);

  constructor() {
    this.load();
    this.runs.loadStatus();
  }

  async load() {
    this.niches.set(await this.api.niches());
  }

  flag = (id: string) => findMarket(id).flag;
  statusLabel = (s: NicheStatus) => NICHE_STATUS_LABELS[s];
  searchUrl = (n: Niche) => amazonSearchUrl(n.marketplace, n.keyword);
  sortBy = (k: 'score' | 'ac' | 'reviews' | 'bsr') => this.sort.set(k);
  icon = (l: { kind: string; ok?: boolean }) => (l.kind === 'tool' ? (l.ok === undefined ? '…' : l.ok ? '✓' : '✗') : ({ status: '•', progress: '›', search: '🔎', error: '⚠' } as Record<string, string>)[l.kind] ?? '•');

  toggle(set: ReturnType<typeof signal<Set<MarketId>>>, id: MarketId) {
    const s = new Set(set());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    set.set(s);
  }

  async suggest() {
    const seeds = this.seeds.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!seeds.length || !this.suggestMarkets().size) return;
    this.searching.set(true);
    this.suggestError.set('');
    try {
      const r = await this.api.suggest({ seeds, markets: [...this.suggestMarkets()], alphabet: this.alphabet });
      this.suggestions.set(r.suggestions.map((s) => ({ ...s, picked: false })));
      if (r.errors.length) this.suggestError.set(r.errors.join(' · '));
    } catch (err) {
      this.suggestError.set((err as { error?: { error?: string } })?.error?.error ?? 'Recherche impossible.');
    } finally {
      this.searching.set(false);
    }
  }

  pickAll() {
    this.suggestions.update((l) => l.map((s) => ({ ...s, picked: !s.inRadar })));
  }

  async addPicked() {
    const picked = this.suggestions().filter((s) => s.picked);
    await this.api.addNiches(picked);
    this.suggestions.update((l) => l.map((s) => (s.picked ? { ...s, picked: false, inRadar: true } : s)));
    await this.load();
  }

  async discover() {
    this.lastRun = 'discover';
    const done = await this.runs.discover({ theme: this.theme, markets: [...this.discoverMarkets()], maxSearches: this.maxSearches });
    await this.load();
    if (done?.nicheIds.length) this.statusFilter.set('');
  }

  async onChanged(id: string, n: Niche | null) {
    if (!n) {
      this.selectedId.set(null);
      await this.load();
      return;
    }
    if (n.id === id) this.niches.update((list) => list.map((x) => (x.id === id ? n : x)));
    await this.load();
  }
}
