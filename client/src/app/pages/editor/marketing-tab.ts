import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { applyPalette, LISTING, monthLabel, PALETTES, parseKeywordCounts, words, type Area, type Book, type Issue } from '@shared';
import { Api } from '../../core/api';
import { kdpInsights, money, type BookInsight } from '../../core/kdp-insights';
import { AdviceList } from '../../ui/advice-list';
import { MonthBars } from '../../ui/month-bars';
import { BookStore } from './book-store';

const AREA_LABELS: Record<Area, string> = {
  titre: 'Titre & auteur', 'mots-cles': 'Mots-clés', description: 'Description', categories: 'Catégories', prix: 'Prix',
  couverture: 'Couverture', interieur: 'Intérieur', conformite: 'Conformité KDP',
};

const CHECKLIST = [
  'Niche validée : 3 à 5 concurrents qui se vendent (BSR régulier), mais pas saturée',
  'Titre et sous-titre clairs, sans marque déposée ni mot répété',
  'Les 7 mots-clés remplis avec des expressions que tapent les acheteurs',
  '3 catégories précises choisies',
  'PDF intérieur relu page par page (nombre de pages, marges, page de garde)',
  'Couverture contrôlée dans le « Previewer » KDP (dos, code-barres, fond perdu)',
  'Case « Low-content book » cochée, déclaration IA renseignée',
  'Prix fixé en tenant compte du seuil des 60 %',
  'Exemplaire d\'auteur (proof) commandé et vérifié avant de pousser les ventes',
  'Campagne Amazon Ads automatique lancée à petit budget, puis mots-clés gagnants en manuel',
  '2-3 variantes de couleur publiées pour occuper la page de résultats',
];

@Component({
  selector: 'app-marketing-tab',
  imports: [FormsModule, RouterLink, AdviceList, MonthBars],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.book(); as b) {
      @if (sales(); as s) {
        <div class="card sales">
          <div class="row">
            <h2 style="margin: 0">Ventes KDP et conseils</h2>
            <span class="muted small">{{ s.perf.marketplace }} · {{ n(s.perf.totalUnits) }} ex. sur {{ s.perf.months.length }} rapports mensuels</span>
            <span class="spacer"></span>
            @if (s.price) {
              <span class="badge">{{ money(s.price.current.price, s.price.currency) }}</span>
              <span class="badge" [class.err]="s.price.current.royalty < 1" [class.ok]="s.price.current.royalty >= s.price.target">{{ money(s.price.current.royalty, s.price.currency) }} par exemplaire</span>
            }
            @if (b.kdp?.url) { <a class="btn sm" [href]="b.kdp!.url" target="_blank" rel="noopener">Fiche Amazon ↗</a> }
          </div>
          <div class="sales-grid">
            <div>
              <div class="small muted" style="margin-bottom: 4px">Exemplaires par mois de rapport ({{ monthLabel(s.perf.months[0].month) }} → {{ monthLabel(s.perf.months[s.perf.months.length - 1].month) }})</div>
              <app-month-bars [data]="bars(s)" label="Exemplaires par mois de rapport :" />
            </div>
            <app-advice-list [advice]="s.advice" />
          </div>
          <p class="small muted" style="margin: 0">Sur un livre publié, le prix, la description, les mots-clés, les catégories, la couverture et le Contenu A+ se modifient à tout moment ; le titre, le sous-titre et l'auteur demandent une nouvelle édition.</p>
        </div>
      }
      <div class="grid-2 top">
        <div class="stack">
          <div class="card score-card">
            <div class="gauge" [style.--v]="store.score()" [class.ok]="store.score() >= 80" [class.mid]="store.score() < 80 && store.score() >= 50">
              <b>{{ store.score() }}</b><span>/100</span>
            </div>
            <div>
              <h2 style="margin-bottom: 4px">Score de conformité & qualité</h2>
              <div class="row small" style="gap: 6px">
                <span class="badge err">{{ count('error') }} bloquant(s)</span>
                <span class="badge warn">{{ count('warning') }} à corriger</span>
                <span class="badge">{{ count('info') }} conseil(s)</span>
              </div>
              <p class="small muted" style="margin-bottom: 0">Basé sur les règles KDP (métadonnées, impression) et les bonnes pratiques low-content. Un point bloquant = risque de refus ou de blocage du compte.</p>
            </div>
          </div>

          @for (g of grouped(); track g.area) {
            <div class="card">
              <h3>{{ g.label }}</h3>
              <div class="stack" style="gap: 4px">
                @for (i of g.items; track $index) { <div class="issue" [class]="i.level"><span class="lv">{{ icon(i.level) }}</span>{{ i.message }}</div> }
              </div>
            </div>
          }
        </div>

        <div class="stack">
          <div class="card">
            <h3>Mots-clés suggérés</h3>
            @if (suggestions().length) {
              <p class="small muted" style="margin-top: 0">Fréquences relevées dans vos notes (analyse de concurrents). Cliquez pour ajouter au premier emplacement qui a la place.</p>
              <div class="chips">
                @for (s of suggestions(); track s.word) { <button class="chip" (click)="addKeyword(s.word)">{{ s.word }} <b>{{ s.count }}</b></button> }
              </div>
            } @else {
              <p class="small muted" style="margin: 0">Collez dans « Notes » (onglet Fiche KDP) une liste « mot (nombre) » issue d'un outil d'analyse de mots-clés, ou utilisez l'autocomplétion de la barre de recherche Amazon : les suggestions apparaîtront ici.</p>
            }
          </div>

          <div class="card">
            <h3>Variantes de couleur (même intérieur)</h3>
            <p class="small muted" style="margin-top: 0">Stratégie des carnets à succès : décliner le même produit en plusieurs couleurs pour occuper la page de résultats. Chaque variante est un livre distinct (attention à la limite de création hebdomadaire de KDP).</p>
            <div class="swatches">
              @for (p of palettes; track p.id) {
                <label class="sw" [class.on]="picked().has(p.id)">
                  <input type="checkbox" hidden [checked]="picked().has(p.id)" (change)="toggle(p.id)" />
                  <span class="c" [style.background]="p.bg"></span><span class="c" [style.background]="p.block"></span><span class="name">{{ p.name }}</span>
                </label>
              }
            </div>
            <label class="check small" style="margin-top: 8px"><input type="checkbox" [(ngModel)]="suffix" /> Ajouter le nom de la couleur au titre (ex. « {{ b.metadata.title || 'Carnet' }} - Vert sapin »)</label>
            <div class="row" style="margin-top: 8px">
              <button class="btn primary sm" [disabled]="!picked().size || busy()" (click)="createVariants(b)">Créer {{ picked().size }} variante(s)</button>
              @for (v of created(); track v.id) { <a class="badge blue" [routerLink]="['/livres', v.id]">{{ v.metadata.title }}</a> }
            </div>
          </div>

          <div class="card">
            <h3>Check-list de lancement</h3>
            @for (c of checklist; track $index) {
              <label class="check item"><input type="checkbox" [checked]="done().has($index)" (change)="toggleDone($index)" /> {{ c }}</label>
            }
          </div>

          <div class="card">
            <h3>Calendrier saisonnier (publier 6 à 8 semaines avant)</h3>
            <table class="data small">
              @for (s of seasons; track s[0]) { <tr><td><b>{{ s[0] }}</b></td><td>{{ s[1] }}</td></tr> }
            </table>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .top { align-items: start; }
    .sales { margin-bottom: 14px; display: flex; flex-direction: column; gap: 12px; }
    .sales-grid { display: grid; grid-template-columns: minmax(260px, 0.9fr) 1.6fr; gap: 20px; align-items: start; }
    @media (max-width: 1100px) { .sales-grid { grid-template-columns: 1fr; } }
    .score-card { display: flex; gap: 18px; align-items: center; }
    .gauge { --v: 0; width: 92px; height: 92px; border-radius: 50%; flex-shrink: 0; display: grid; place-content: center; text-align: center;
      background: radial-gradient(closest-side, #fff 78%, transparent 80% 100%), conic-gradient(var(--err) calc(var(--v) * 1%), #eceff6 0); }
    .gauge.mid { background: radial-gradient(closest-side, #fff 78%, transparent 80% 100%), conic-gradient(var(--warn) calc(var(--v) * 1%), #eceff6 0); }
    .gauge.ok { background: radial-gradient(closest-side, #fff 78%, transparent 80% 100%), conic-gradient(var(--ok) calc(var(--v) * 1%), #eceff6 0); }
    .gauge b { font-family: var(--font-head); font-size: 26px; line-height: 1; }
    .gauge span { font-size: 11px; color: var(--muted); }
    .lv { width: 16px; flex-shrink: 0; }
    .swatches { display: flex; flex-wrap: wrap; gap: 6px; }
    .sw { display: inline-flex; align-items: center; gap: 0; border: 1px solid var(--line-2); border-radius: 7px; overflow: hidden; cursor: pointer; font-size: 11.5px; background: #fff; }
    .sw .c { width: 14px; height: 26px; }
    .sw .name { padding: 0 8px; }
    .sw.on { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-2); }
    .item { display: flex; align-items: flex-start; padding: 4px 0; line-height: 1.4; }
  `,
})
export class MarketingTab {
  store = inject(BookStore);
  api = inject(Api);
  /** Ventes et conseils si le livre est relié à un titre KDP présent dans les rapports importés */
  sales = signal<BookInsight | null>(null);
  palettes = PALETTES;
  checklist = CHECKLIST;
  picked = signal(new Set<string>());
  created = signal<Book[]>([]);
  busy = signal(false);
  suffix = true;
  done = signal(new Set<number>(this.loadDone()));
  seasons: [string, string][] = [
    ['Janvier', 'Planners, budget, objectifs, journaux de gratitude'],
    ['Février', 'Saint-Valentin : journaux de couple, « 100 raisons », bons pour'],
    ['Mars – mai', 'Fête des grands-mères / mères / pères : livres à remplir, recettes de famille'],
    ['Juin – juillet', 'Mariages (livres d\'or), cadeaux de fin d\'année scolaire pour les enseignants'],
    ['Août – septembre', 'Rentrée : cahiers Seyès, carnets de liaison nounou, cahiers de devoirs'],
    ['Octobre – décembre', 'Q4 : pic des ventes, cadeaux de Noël (dégustation, mots de passe, journaux)'],
  ];

  grouped = computed(() => {
    const order: Record<string, number> = { error: 0, warning: 1, info: 2 };
    const map = new Map<Area, Issue[]>();
    for (const i of [...this.store.issues()].sort((a, b) => order[a.level] - order[b.level])) map.set(i.area, [...(map.get(i.area) ?? []), i]);
    return [...map].map(([area, items]) => ({ area, label: AREA_LABELS[area], items }));
  });

  suggestions = computed(() => {
    const b = this.store.book()!;
    const used = new Set(words([b.metadata.title, b.metadata.subtitle, ...b.metadata.keywords].join(' ')));
    return parseKeywordCounts(b.metadata.notes).filter((s) => !s.word.split(' ').every((w) => used.has(w))).slice(0, 40);
  });

  private titleId = computed(() => this.store.book()?.kdp?.titleId ?? null);

  constructor() {
    effect(() => {
      const titleId = this.titleId();
      untracked(() => (titleId ? this.loadSales() : this.sales.set(null)));
    });
  }

  private async loadSales() {
    const b = this.store.book();
    if (!b) return;
    const s = await this.api.kdp().catch(() => null);
    this.sales.set(s ? (kdpInsights(s.snapshots, s.titles, [b]).byBook.get(b.id) ?? null) : null);
  }

  bars = (s: BookInsight) => s.perf.months.map((m) => ({ month: m.month, value: m.units }));
  n = (v: number) => v.toLocaleString('fr-FR');
  money = money;
  monthLabel = monthLabel;

  count = (level: string) => this.store.issues().filter((i) => i.level === level).length;
  icon = (level: string) => (level === 'error' ? '⛔' : level === 'warning' ? '⚠' : 'ℹ');

  addKeyword(word: string) {
    this.store.update((b) => {
      const i = b.metadata.keywords.findIndex((k) => (k ? k.length + 1 + word.length : word.length) <= LISTING.keywordMax);
      if (i >= 0) b.metadata.keywords[i] = b.metadata.keywords[i] ? `${b.metadata.keywords[i]} ${word}` : word;
    });
  }

  toggle(id: string) {
    const s = new Set(this.picked());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.picked.set(s);
  }

  async createVariants(b: Book) {
    this.busy.set(true);
    await this.store.flush();
    const out: Book[] = [];
    for (const p of PALETTES.filter((x) => this.picked().has(x.id))) {
      const title = this.suffix ? `${b.metadata.title.replace(/\s+-\s+[^-]+$/, '')} - ${p.name}` : undefined;
      out.push(await this.api.duplicate(b.id, { cover: applyPalette(b.cover, p), title }));
    }
    this.created.set(out);
    this.picked.set(new Set());
    this.busy.set(false);
  }

  private key() {
    return `checklist:${this.store.book()?.id}`;
  }

  private loadDone(): number[] {
    try {
      return JSON.parse(localStorage.getItem(this.key()) ?? '[]') as number[];
    } catch {
      return [];
    }
  }

  toggleDone(i: number) {
    const s = new Set(this.done());
    if (s.has(i)) s.delete(i);
    else s.add(i);
    this.done.set(s);
    try {
      localStorage.setItem(this.key(), JSON.stringify([...s]));
    } catch {
      /* stockage indisponible : la coche reste en mémoire */
    }
  }
}
