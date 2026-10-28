import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { familyKey, monthLabel, type Book, type KdpSalesSnapshot, type KdpTitle } from '@shared';
import { Api } from '../../core/api';
import { kdpInsights, money, type BookInsight } from '../../core/kdp-insights';
import { AdviceList } from '../../ui/advice-list';
import { MonthBars } from '../../ui/month-bars';
import { ReportImport } from '../../ui/report-import';

type Sort = 'redevances' | 'exemplaires' | 'urgence';

interface Row {
  book: Book;
  insight: BookInsight | null;
  units: number;
  lastUnits: number;
  royalty: number;
  urgent: number;
}

/** « Mes carnets publiés » : un groupe par famille de variantes, avec lien Amazon, ventes et conseils. */
@Component({
  selector: 'app-published-list',
  imports: [FormsModule, RouterLink, AdviceList, MonthBars, ReportImport],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!loaded()) {
      <div class="empty">Chargement…</div>
    } @else {
      @if (!hasReports() || importing()) {
        <app-report-import (imported)="onImported()" />
      }

      @if (insights().diagnosis.findings.length) {
        <div class="card diag">
          <div class="row">
            <h2 style="margin: 0">Pourquoi tes revenus baissent</h2>
            <span class="muted small">d'après {{ months().length }} rapports mensuels ({{ monthLabel(months()[0]) }} → {{ monthLabel(months()[months().length - 1]) }})</span>
            <span class="spacer"></span>
            <a class="btn sm" routerLink="/kdp" [queryParams]="{ onglet: 'ventes' }">Ventes détaillées</a>
            @if (!importing()) { <button class="btn sm ghost" (click)="importing.set(true)">Importer d'autres rapports</button> }
          </div>
          <app-advice-list [advice]="insights().diagnosis.findings" [showArea]="false" />
        </div>
      }

      @if (books().length) {
        <div class="row toolbar">
          <span class="small muted">Trier par</span>
          <select [ngModel]="sort()" (ngModelChange)="sort.set($event)" style="width: 190px">
            <option value="redevances">Redevances</option>
            <option value="exemplaires">Exemplaires vendus</option>
            <option value="urgence">Conseils urgents</option>
          </select>
          <label class="check small"><input type="checkbox" [ngModel]="liveOnly()" (ngModelChange)="liveOnly.set($event)" /> Seulement ceux qui ont vendu dans le dernier rapport</label>
          <span class="spacer"></span>
          <span class="small muted">{{ shownCount() }} carnet(s) · {{ groups().length }} famille(s)</span>
        </div>
      }

      @for (g of groups(); track g.key) {
        <div class="card fam">
          <div class="fam-head">
            <h3>{{ g.label }}</h3>
            @if (g.rows.length > 1) { <span class="badge">{{ g.rows.length }} variantes</span> }
            <span class="spacer"></span>
            <span class="small muted">{{ n(g.units) }} ex. dans les rapports</span>
          </div>
          @for (r of g.rows; track r.book.id) {
            @let ins = r.insight;
            <div class="pub">
              <div class="t">
                <a [routerLink]="['/livres', r.book.id]" [queryParams]="{ onglet: 'marketing' }" class="title">{{ r.book.metadata.title || 'Sans titre' }}</a>
                @if (r.book.metadata.subtitle) { <div class="muted small sub" [title]="r.book.metadata.subtitle">{{ r.book.metadata.subtitle }}</div> }
                <div class="row small meta">
                  @if (ins?.perf?.marketplace) { <span class="badge">{{ ins!.perf.marketplace }}</span> }
                  @if (ins?.title?.status === 'live') { <span class="badge ok">A vendu en {{ monthLabel(lastMonth()) }}</span> }
                  @else if (ins) { <span class="badge">Dernière vente : {{ ins.perf.lastSold ? monthLabel(ins.perf.lastSold) : '—' }}</span> }
                  <span class="muted">{{ r.book.metadata.author }}</span>
                </div>
              </div>
              @if (ins) {
                <app-month-bars [data]="bars(ins)" [mini]="true" label="Exemplaires par mois de rapport :" />
                <div class="nums small">
                  <div><b>{{ n(r.lastUnits) }}</b> ex. en {{ monthLabel(lastMonth()) }}</div>
                  <div class="muted">{{ n(r.units) }} ex. sur {{ months().length }} rapports</div>
                </div>
                <div class="nums small">
                  @if (ins.price) {
                    <div><b>{{ money(ins.price.current.price, ins.price.currency) }}</b></div>
                    <div [class.low]="ins.price.current.royalty < 1">{{ money(ins.price.current.royalty, ins.price.currency) }} / ex.</div>
                  }
                </div>
              } @else {
                <div class="muted small nodata">Pas de ventes dans les rapports importés</div>
              }
              <div class="links">
                @if (r.book.kdp?.url) { <a class="btn sm" [href]="r.book.kdp!.url" target="_blank" rel="noopener" title="Fiche produit sur Amazon">Amazon ↗</a> }
                <a class="btn sm ghost" [routerLink]="['/livres', r.book.id]" [queryParams]="{ onglet: 'marketing' }">Ouvrir</a>
              </div>
            </div>
            @if (ins?.advice?.length) {
              <div class="pub-adv">
                <app-advice-list [advice]="ins!.advice" [limit]="isOpen(r.book.id) ? 0 : 2" [compact]="!isOpen(r.book.id)" />
                <button class="btn ghost sm more" (click)="toggle(r.book.id)">{{ isOpen(r.book.id) ? 'Masquer le détail' : 'Voir les ' + ins!.advice.length + ' conseils en détail' }}</button>
              </div>
            }
          }
        </div>
      } @empty {
        @if (hasReports()) { <div class="card empty">Aucun carnet publié ne correspond à la recherche.</div> }
      }
    }
  `,
  styles: `
    .diag { margin-bottom: 14px; display: flex; flex-direction: column; gap: 10px; }
    .toolbar { margin-bottom: 10px; }
    .check { display: inline-flex; gap: 6px; align-items: center; }
    .fam { margin-bottom: 12px; padding: 12px 14px; }
    .fam-head { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; }
    .fam-head h3 { margin: 0; font-size: 14.5px; }
    .pub { display: grid; grid-template-columns: minmax(0, 1fr) 132px 150px 96px auto; gap: 14px; align-items: center; padding: 10px 0 6px; border-top: 1px solid var(--line); }
    .fam-head + .pub { border-top: none; }
    .title { font-family: var(--font-head); font-weight: 700; color: var(--ink); text-decoration: none; font-size: 13.5px; }
    .title:hover { color: var(--accent); }
    .sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .meta { gap: 6px; margin-top: 4px; }
    .nums { line-height: 1.4; font-variant-numeric: tabular-nums; }
    .low { color: var(--err); font-weight: 700; }
    .nodata { grid-column: span 3; }
    .links { display: flex; gap: 4px; justify-content: flex-end; }
    .pub-adv { padding: 0 0 8px; display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
    .more { padding-left: 0; }
    @media (max-width: 1000px) { .pub { grid-template-columns: 1fr 1fr; } .nodata { grid-column: auto; } }
  `,
})
export class PublishedList {
  private api = inject(Api);
  books = input.required<Book[]>();
  changed = output<void>();

  loaded = signal(false);
  importing = signal(false);
  snapshots = signal<KdpSalesSnapshot[]>([]);
  titles = signal<KdpTitle[]>([]);
  sort = signal<Sort>('redevances');
  liveOnly = signal(false);
  open = signal(new Set<string>());

  insights = computed(() => kdpInsights(this.snapshots(), this.titles(), this.books()));
  months = computed(() => this.insights().diagnosis.months.map((m) => m.month));
  lastMonth = computed(() => this.months()[this.months().length - 1] ?? '');
  hasReports = computed(() => this.months().length > 0);

  rows = computed<Row[]>(() => {
    const cur = this.insights().diagnosis.currency;
    return this.books().map((book) => {
      const insight = this.insights().byBook.get(book.id) ?? null;
      const p = insight?.perf;
      return {
        book,
        insight,
        units: p?.totalUnits ?? 0,
        lastUnits: p?.months[p.months.length - 1]?.units ?? 0,
        royalty: p ? (cur ? (p.royalties[cur] ?? 0) : 0) : 0,
        urgent: insight?.advice.filter((a) => a.level === 'urgent').length ?? 0,
      };
    });
  });

  groups = computed(() => {
    const map = new Map<string, { key: string; label: string; rows: Row[]; units: number; royalty: number; urgent: number }>();
    for (const r of this.rows()) {
      if (this.liveOnly() && r.insight?.title?.status !== 'live') continue;
      const key = r.insight?.family?.key ?? familyKey(r.book.metadata.title || r.book.id);
      const g = map.get(key) ?? { key, label: r.insight?.family?.label ?? r.book.metadata.title, rows: [], units: 0, royalty: 0, urgent: 0 };
      g.rows.push(r);
      g.units += r.units;
      g.royalty += r.royalty;
      g.urgent += r.urgent;
      map.set(key, g);
    }
    const by = this.sort();
    const score = (x: { units: number; royalty: number; urgent: number }) => (by === 'exemplaires' ? x.units : by === 'urgence' ? x.urgent * 1e6 + x.royalty : x.royalty || x.units / 1000);
    const groups = [...map.values()];
    for (const g of groups) g.rows.sort((a, b) => score(b) - score(a));
    return groups.sort((a, b) => score(b) - score(a));
  });

  shownCount = computed(() => this.groups().reduce((n, g) => n + g.rows.length, 0));

  constructor() {
    this.load();
  }

  async load() {
    const s = await this.api.kdp();
    this.snapshots.set(s.snapshots);
    this.titles.set(s.titles);
    this.loaded.set(true);
  }

  async onImported() {
    this.importing.set(false);
    await this.load();
    this.changed.emit();
  }

  bars = (ins: BookInsight) => ins.perf.months.map((m) => ({ month: m.month, value: m.units }));
  isOpen = (id: string) => this.open().has(id);
  toggle(id: string) {
    const next = new Set(this.open());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.open.set(next);
  }
  monthLabel = (m: string) => (m ? monthLabel(m) : '');
  n = (v: number) => v.toLocaleString('fr-FR');
  money = money;
}
