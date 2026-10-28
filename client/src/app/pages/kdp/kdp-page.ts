import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import {
  amazonUrl, catalogDiagnosis, KDP_FORMAT_LABELS, KDP_STATUS_LABELS, salesByMarketplace, salesByTitle, totals, unsoldLiveTitles, latestSnapshots,
  type Book, type KdpFillPayload, type KdpState, type KdpTitle,
} from '@shared';
import { Api } from '../../core/api';
import { apiUrl } from '../../core/api-base';
import { bookmarkletHref } from '../../core/bookmarklet';
import { AdviceList } from '../../ui/advice-list';
import { MonthBars } from '../../ui/month-bars';
import { ReportImport } from '../../ui/report-import';

type Tab = 'catalogue' | 'ventes' | 'publication' | 'diagnostic';
type State = Awaited<ReturnType<Api['kdp']>>;

const KDP = 'https://kdp.amazon.com/fr_FR';

@Component({
  selector: 'app-kdp-page',
  imports: [FormsModule, RouterLink, AdviceList, MonthBars, ReportImport],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <h1>Compte KDP</h1>
        <span class="badge">{{ state()?.titles?.length ?? 0 }} formats au catalogue</span>
        <span class="badge">{{ periods().length }} période(s) de ventes</span>
        <span class="spacer"></span>
        <a class="btn" [href]="kdp + '/bookshelf'" target="_blank" rel="noopener">Ma Bibliothèque KDP ↗</a>
        <a class="btn" [href]="kdp + '/reports-new'" target="_blank" rel="noopener">Mes Rapports KDP ↗</a>
      </div>

      <div class="card connect">
        <div>
          <h2 style="margin: 0 0 6px">Connexion sans mot de passe</h2>
          <p class="small muted" style="margin: 0">KDP n'a pas d'API : l'app ne se connecte jamais à ton compte. Le favori lit les pages KDP que tu ouvres toi-même, et remplit les formulaires de création que tu valides toi-même.</p>
        </div>
        <ol class="small steps">
          <li>Glisse le favori dans ta barre : <a class="btn sm dark bm" [href]="bookmarklet" (click)="$event.preventDefault()">📌 Book Creator</a><span class="muted"> (le même que pour les niches : remplace l'ancien)</span></li>
          <li><b>Catalogue</b> : ouvre ta Bibliothèque KDP (fais défiler pour afficher tous les titres) et clique sur le favori.</li>
          <li><b>Ventes</b> : ouvre la page Rapports, choisis la période, clique sur le favori. Une capture par mois suffit.</li>
          <li><b>Publication</b> : dans l'éditeur d'un livre, « Publier sur KDP », puis clique sur le favori sur chaque page du formulaire KDP.</li>
        </ol>
      </div>

      <div class="tabs">
        @for (t of tabs; track t.id) { <button [class.active]="tab() === t.id" (click)="tab.set(t.id)">{{ t.label }}</button> }
      </div>

      @switch (tab()) {
        @case ('catalogue') {
          @if (!state()?.titles?.length) {
            <div class="card empty">Aucun titre capturé : ouvre ta Bibliothèque KDP et clique sur le favori.</div>
          } @else {
            <div class="card table-wrap">
              <table class="data small">
                <thead><tr><th>Titre</th><th>Format</th><th>Statut</th><th>Prix</th><th>ASIN / ISBN</th><th>Date</th><th>Livre de l'app</th><th></th></tr></thead>
                @for (t of state()!.titles; track t.id) {
                  <tr>
                    <td><b>{{ t.title }}</b>@if (t.author) { <div class="muted">{{ t.author }}</div> }</td>
                    <td>{{ formatLabel(t) }}</td>
                    <td><span class="badge" [class.ok]="t.status === 'live'" [class.warn]="t.status === 'review' || t.status === 'publishing'" [class.err]="t.status === 'blocked'">{{ statusLabel(t) }}</span></td>
                    <td>{{ t.price !== null ? money(t.price, t.currency) : '—' }}</td>
                    <td class="mono">@if (t.asin) { <a [href]="productUrl(t)" target="_blank" rel="noopener">{{ t.asin }}</a> } @else { {{ t.isbn ?? '—' }} }</td>
                    <td>{{ t.date ?? '' }}</td>
                    <td>
                      <select [ngModel]="t.bookId ?? ''" (ngModelChange)="link(t, $event)" style="width: 200px">
                        <option value="">— non relié —</option>
                        @for (b of books(); track b.id) { <option [value]="b.id">{{ b.metadata.title || 'Sans titre' }}</option> }
                      </select>
                    </td>
                    <td class="actions">
                      @if (t.bookId) { <a class="btn sm" [routerLink]="['/livres', t.bookId]">Ouvrir</a> }
                      @else { <button class="btn sm" (click)="importTitle(t)" title="Crée la fiche dans l'app (intérieur et couverture à refaire)">Importer</button> }
                      <button class="icon-btn" title="Retirer du catalogue" (click)="removeTitle(t)">✕</button>
                    </td>
                  </tr>
                }
              </table>
            </div>
          }
        }

        @case ('ventes') {
          <app-report-import (imported)="load()" />
          @if (!periods().length) {
            <div class="card empty">Aucune vente : importe tes rapports mensuels ci-dessus, ou ouvre la page Rapports de KDP et clique sur le favori.</div>
          } @else {
            @if (diagnosis().months.length; as count) {
              <div class="card" style="margin-bottom: 14px">
                <div class="row" style="margin-bottom: 8px">
                  <h3 style="margin: 0">Évolution sur {{ count }} rapports mensuels</h3>
                  <span class="spacer"></span>
                  <a class="btn sm" routerLink="/" [queryParams]="{ vue: 'publies' }">Conseils par carnet →</a>
                </div>
                <div class="grid-2">
                  <div><div class="small muted">Exemplaires vendus</div><app-month-bars [data]="unitsByMonth()" label="Exemplaires par mois :" /></div>
                  @if (diagnosis().currency; as cur) {
                    <div><div class="small muted">Redevances en {{ cur }}</div><app-month-bars [data]="royaltyByMonth()" [format]="moneyFmt(cur)" label="Redevances par mois :" /></div>
                  }
                </div>
                <p class="small muted" style="margin-bottom: 0">Seuls les mois importés apparaissent (pas forcément consécutifs). Les autres devises sont comptées à part dans les tuiles ci-dessous.</p>
              </div>
              @if (diagnosis().findings.length) {
                <div class="card" style="margin-bottom: 14px">
                  <h3>Pourquoi tes revenus baissent</h3>
                  <app-advice-list [advice]="diagnosis().findings" [showArea]="false" />
                </div>
              }
            }
            <div class="kpis">
              <div class="kpi"><span class="lab">Exemplaires</span><b>{{ n(total().units) }}</b><span class="muted small">{{ periods().length }} période(s)</span></div>
              @for (c of currencies(); track c[0]) {
                <div class="kpi"><span class="lab">Redevances {{ c[0] }}</span><b>{{ money(c[1], c[0]) }}</b><span class="muted small">périodes importées</span></div>
              }
              @if (total().kenp) { <div class="kpi"><span class="lab">Pages lues (KENP)</span><b>{{ n(total().kenp) }}</b></div> }
              <div class="kpi"><span class="lab">En vente sans vente</span><b>{{ unsold().length }}</b><span class="muted small">sur {{ liveCount() }} formats en vente</span></div>
            </div>

            <div class="grid-2" style="margin-top: 14px">
              <div class="card">
                <h3>Exemplaires par titre</h3>
                <div class="bars">
                  @for (r of byTitle().slice(0, 15); track r.key) {
                    <div class="bar-row" tabindex="0">
                      <span class="bar-label" [title]="r.title">{{ r.title }}</span>
                      <span class="bar-track"><span class="bar" [style.width.%]="pct(r.units, maxTitle())"></span><span class="bar-value">{{ n(r.units) }}</span></span>
                      <span class="tip">{{ n(r.units) }} ex. · {{ royaltyText(r.royalties) }} · {{ r.marketplaces.join(', ') || 'marché non précisé' }}</span>
                    </div>
                  }
                </div>
              </div>
              <div class="card">
                <h3>Exemplaires par marché</h3>
                <div class="bars">
                  @for (m of byMarket(); track m.marketplace) {
                    <div class="bar-row" tabindex="0">
                      <span class="bar-label">{{ m.marketplace }}</span>
                      <span class="bar-track"><span class="bar" [style.width.%]="pct(m.units, maxMarket())"></span><span class="bar-value">{{ n(m.units) }}</span></span>
                      <span class="tip">{{ n(m.units) }} ex. · {{ royaltyText(m.royalties) }}</span>
                    </div>
                  }
                </div>
                <h3 style="margin-top: 16px">Périodes capturées</h3>
                <div class="chips">
                  @for (s of periods(); track s.id) {
                    <span class="chip">{{ s.period }} · {{ s.rows.length }} ligne(s) <button class="icon-btn" title="Supprimer cette capture" (click)="removeSnapshot(s.id)">✕</button></span>
                  }
                </div>
              </div>
            </div>

            <div class="card table-wrap" style="margin-top: 14px">
              <h3>Détail par titre</h3>
              <table class="data small">
                <thead><tr><th>Titre</th><th>ASIN</th><th>Exemplaires</th><th>Redevances</th><th>Pages lues</th><th>Marchés</th><th>Périodes</th></tr></thead>
                @for (r of byTitle(); track r.key) {
                  <tr><td>{{ r.title }}</td><td class="mono">{{ r.asin ?? '—' }}</td><td>{{ n(r.units) }}</td><td>{{ royaltyText(r.royalties) }}</td><td>{{ r.kenp || '' }}</td><td>{{ r.marketplaces.join(', ') }}</td><td>{{ r.periods }}</td></tr>
                }
              </table>
            </div>

            @if (unsold().length) {
              <div class="card" style="margin-top: 14px">
                <h3>En vente mais sans vente sur les périodes capturées</h3>
                <p class="small muted" style="margin-top: 0">Pistes : retravailler la couverture (vignette), les mots-clés et le prix, tester une campagne Amazon Ads, ou décliner la niche ailleurs.</p>
                @for (t of unsold(); track t.id) { <div class="small">• {{ t.title }} <span class="muted">({{ formatLabel(t) }}{{ t.asin ? ', ' + t.asin : '' }})</span></div> }
              </div>
            }
          }
        }

        @case ('publication') {
          @if (!publishing()) {
            <div class="card empty">
              <h2>Aucun livre en cours de publication</h2>
              <p>Ouvre un livre dans l'éditeur et clique sur « Publier sur KDP ».</p>
            </div>
          } @else {
            @let p = publishing()!;
            <div class="card stack">
              <div class="row"><h2 style="margin: 0">{{ p.title || 'Sans titre' }}</h2><span class="spacer"></span>
                <a class="btn sm" [routerLink]="['/livres', p.bookId]">Ouvrir dans l'éditeur</a>
                <button class="btn sm ghost" (click)="clearPublishing()">Annuler la préparation</button></div>
              @if (p.blocking.length) {
                <div class="issue error"><b>À corriger avant de publier :</b></div>
                @for (b of p.blocking; track $index) { <div class="issue error">{{ b }}</div> }
              } @else { <div class="issue info">Le contrôle KDP de l'app ne remonte aucune erreur.</div> }
              <ol class="steps">
                <li>Télécharge les fichiers (le favori tente aussi de les déposer sur la page Contenu) :
                  <a class="btn sm" [href]="fileUrl(p.files.interior)">⬇ PDF intérieur</a> <a class="btn sm" [href]="fileUrl(p.files.cover)">⬇ PDF couverture</a></li>
                <li><a [href]="kdp + '/title-setup/paperback/new/details'" target="_blank" rel="noopener">Crée un nouveau livre broché sur KDP ↗</a> (ou ouvre un brouillon existant).</li>
                <li>Sur la page <b>Détails</b>, clique sur le favori : titre, sous-titre, auteur, description, mots-clés, droits, case low-content. Choisis les catégories à la main.</li>
                <li>Sur la page <b>Contenu</b> : favori à nouveau (encre et papier, fond perdu, finition, fichiers). Choisis le format <b>{{ p.print.trim }}</b> à la main et réponds aux questions sur l'IA.</li>
                <li>Sur la page <b>Tarification</b> : favori pour le prix {{ money(p.price, p.currency) }} ({{ p.marketplace }}).</li>
                <li>Vérifie l'aperçu KDP, puis clique toi-même sur <b>Publier</b>.</li>
              </ol>
              <div class="row"><button class="btn primary" (click)="markPublished(p)">J'ai publié : marquer le livre comme publié</button></div>
              <details class="small"><summary>Données qui seront remplies</summary>
                <table class="data small">
                  <tr><td>Titre</td><td>{{ p.title }}</td></tr><tr><td>Sous-titre</td><td>{{ p.subtitle }}</td></tr>
                  <tr><td>Auteur</td><td>{{ p.authorFirst }} {{ p.authorLast }}</td></tr><tr><td>Langue / marché</td><td>{{ p.languageLabel }} · {{ p.marketplace }}</td></tr>
                  <tr><td>Mots-clés</td><td>{{ p.keywords.filter(nonEmpty).join(' · ') }}</td></tr><tr><td>Catégories</td><td>{{ p.categories.join(' · ') }}</td></tr>
                  <tr><td>Impression</td><td>{{ p.print.trim }} · {{ p.print.inkLabel }} · {{ p.print.bleed ? 'avec' : 'sans' }} fond perdu · {{ p.print.finish === 'glossy' ? 'brillante' : 'mate' }} · {{ p.print.pages }} pages</td></tr>
                  <tr><td>Low-content</td><td>{{ p.lowContent ? 'oui' : 'non' }}</td></tr>
                </table>
              </details>
            </div>
          }
        }

        @case ('diagnostic') {
          <div class="card">
            <h3>Dernières captures KDP</h3>
            <p class="small muted" style="margin-top: 0">Si un titre ou une vente manque, copie le texte brut de la capture : il sert à ajuster l'analyse (rien d'autre n'est conservé).</p>
            @for (c of state()?.captures ?? []; track c.at; let i = $index) {
              <div class="row small cap">
                <span class="badge">{{ c.page }}</span><span class="muted">{{ c.at.slice(0, 16).replace('T', ' ') }}</span><span>{{ c.message }}</span>
                <span class="spacer"></span><button class="btn sm" (click)="copyRaw(i)">{{ copied() === i ? '✓ Copié' : 'Copier le texte brut' }}</button>
              </div>
            } @empty { <div class="muted small">Aucune capture.</div> }
          </div>
        }
      }
    </div>
  `,
  styles: `
    .connect { display: grid; grid-template-columns: 1fr 1.4fr; gap: 18px; margin-bottom: 16px; }
    .steps { margin: 0; padding-left: 18px; line-height: 1.75; }
    .bm { cursor: grab; }
    .table-wrap { overflow-x: auto; }
    td.actions { white-space: nowrap; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
    .kpi { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; box-shadow: var(--shadow); }
    .kpi .lab { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 700; }
    .kpi b { font-family: var(--font-head); font-size: 24px; color: var(--ink); font-variant-numeric: tabular-nums; }
    /* Barres horizontales : une seule série (bleu), 14 px, extrémité arrondie de 4 px, valeur au bout en couleur de texte */
    .bars { display: flex; flex-direction: column; gap: 6px; }
    .bar-row { position: relative; display: grid; grid-template-columns: minmax(120px, 38%) 1fr; gap: 10px; align-items: center; padding: 2px 0; border-radius: 4px; outline: none; }
    .bar-label { font-size: 12.5px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bar-track { display: flex; align-items: center; gap: 6px; min-width: 0; }
    .bar { height: 14px; min-width: 2px; background: var(--blue); border-radius: 0 4px 4px 0; }
    .bar-value { font-size: 12px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .tip { display: none; position: absolute; left: 38%; top: 100%; z-index: 5; background: var(--ink); color: #fff; font-size: 12px; padding: 5px 8px; border-radius: 6px; white-space: nowrap; box-shadow: var(--shadow); }
    .bar-row:hover .tip, .bar-row:focus .tip { display: block; }
    .bar-row:hover, .bar-row:focus { background: #f2f4fa; }
    .cap { border-bottom: 1px solid var(--line); padding: 6px 0; }
    @media (max-width: 1100px) { .connect { grid-template-columns: 1fr; } }
  `,
})
export class KdpPage {
  private api = inject(Api);
  private router = inject(Router);
  onglet = input<string | undefined>(undefined);
  kdp = KDP;
  tabs: { id: Tab; label: string }[] = [
    { id: 'catalogue', label: 'Catalogue' },
    { id: 'ventes', label: 'Ventes' },
    { id: 'publication', label: 'Publication' },
    { id: 'diagnostic', label: 'Diagnostic' },
  ];
  tab = signal<Tab>('catalogue');
  state = signal<State | null>(null);
  books = signal<Book[]>([]);
  publishing = signal<KdpFillPayload | null>(null);
  copied = signal<number | null>(null);
  bookmarklet = inject(DomSanitizer).bypassSecurityTrustUrl(bookmarkletHref(location.origin));

  periods = computed(() => latestSnapshots(this.state()?.snapshots ?? []));
  byTitle = computed(() => salesByTitle(this.state()?.snapshots ?? []));
  byMarket = computed(() => salesByMarketplace(this.state()?.snapshots ?? []));
  total = computed(() => totals(this.state()?.snapshots ?? []));
  currencies = computed(() => Object.entries(this.total().royalties));
  unsold = computed(() => (this.state() ? unsoldLiveTitles(this.state() as unknown as KdpState) : []));
  liveCount = computed(() => (this.state()?.titles ?? []).filter((t) => t.status === 'live').length);
  diagnosis = computed(() => catalogDiagnosis(this.state()?.snapshots ?? []));
  unitsByMonth = computed(() => this.diagnosis().months.map((m) => ({ month: m.month, value: m.units })));
  royaltyByMonth = computed(() => this.diagnosis().months.map((m) => ({ month: m.month, value: m.royalty[this.diagnosis().currency ?? ''] ?? 0 })));
  moneyFmt = (cur: string) => (v: number) => v.toLocaleString('fr-FR', { style: 'currency', currency: cur, maximumFractionDigits: 0 });
  maxTitle = computed(() => Math.max(1, ...this.byTitle().map((r) => r.units)));
  maxMarket = computed(() => Math.max(1, ...this.byMarket().map((r) => r.units)));

  constructor() {
    this.load();
    queueMicrotask(() => {
      const o = this.onglet();
      if (o && this.tabs.some((t) => t.id === o)) this.tab.set(o as Tab);
    });
  }

  async load() {
    const [state, books] = await Promise.all([this.api.kdp(), this.api.books()]);
    this.state.set(state);
    this.books.set(books);
    this.publishing.set(state.publishing ? await this.api.kdpPublishCurrent().catch(() => null) : null);
  }

  statusLabel = (t: KdpTitle) => KDP_STATUS_LABELS[t.status];
  formatLabel = (t: KdpTitle) => KDP_FORMAT_LABELS[t.format];
  productUrl = (t: KdpTitle) => amazonUrl(t.asin, t.marketplace ?? (t.currency === 'USD' ? 'amazon.com' : 'amazon.fr'));
  pct = (v: number, max: number) => Math.max(0.5, (v / max) * 100);
  n = (v: number) => v.toLocaleString('fr-FR');
  money = (v: number, currency: string | null) => (currency ? v.toLocaleString('fr-FR', { style: 'currency', currency }) : v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  royaltyText = (r: Record<string, number>) => Object.entries(r).map(([c, v]) => this.money(v, c)).join(' + ') || '—';
  nonEmpty = (s: string) => !!s;
  fileUrl = (path: string) => apiUrl(path);

  async link(t: KdpTitle, bookId: string) {
    await this.api.kdpLink(t.id, bookId || null);
    await this.load();
  }

  async importTitle(t: KdpTitle) {
    const b = await this.api.kdpImport(t.id);
    this.router.navigate(['/livres', b.id]);
  }

  async removeTitle(t: KdpTitle) {
    if (!confirm(`Retirer « ${t.title} » (${this.formatLabel(t)}) du catalogue de l'app ? (Rien n'est modifié sur KDP.)`)) return;
    await this.api.kdpDeleteTitle(t.id);
    await this.load();
  }

  async removeSnapshot(id: string) {
    await this.api.kdpDeleteSnapshot(id);
    await this.load();
  }

  async clearPublishing() {
    await this.api.kdpPublishClear();
    await this.load();
  }

  async markPublished(p: KdpFillPayload) {
    const book = await this.api.book(p.bookId);
    book.status = 'publie';
    await this.api.saveBook(book);
    await this.api.kdpPublishClear();
    await this.load();
  }

  async copyRaw(i: number) {
    const text = await this.api.kdpCaptureText(i);
    await navigator.clipboard.writeText(text);
    this.copied.set(i);
  }
}
