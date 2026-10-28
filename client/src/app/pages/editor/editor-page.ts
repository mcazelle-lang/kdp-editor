import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { STATUS_LABELS, findTrim, type BookStatus } from '@shared';
import { Api } from '../../core/api';
import { AgentSession } from './agent-session';
import { AgentTab } from './agent-tab';
import { BookStore } from './book-store';
import { CoverTab } from './cover-tab';
import { FormatTab } from './format-tab';
import { InteriorTab } from './interior-tab';
import { ListingTab } from './listing-tab';
import { MarketingTab } from './marketing-tab';

type Tab = 'agent' | 'format' | 'interior' | 'cover' | 'listing' | 'marketing';

@Component({
  selector: 'app-editor-page',
  imports: [FormsModule, RouterLink, AgentTab, FormatTab, InteriorTab, CoverTab, ListingTab, MarketingTab],
  providers: [BookStore, AgentSession],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.book(); as b) {
      <div class="page">
        <div class="page-head">
          <a routerLink="/" class="btn ghost sm">← Carnets</a>
          <div class="title-block">
            <h1>{{ b.metadata.title || 'Sans titre' }}</h1>
            <div class="muted small">{{ trim().label }} · {{ store.pages() }} pages · dos {{ (store.coverGeo()?.spineIn ?? 0).toFixed(3) }} in · {{ b.metadata.niche || 'niche non renseignée' }}</div>
          </div>
          <span class="spacer"></span>
          <span class="save" [class]="store.saveState()">{{ saveLabel() }}</span>
          <select [ngModel]="b.status" (ngModelChange)="setStatus($event)" style="width: 150px">
            @for (s of statuses; track s[0]) { <option [value]="s[0]">{{ s[1] }}</option> }
          </select>
          <a class="btn" [href]="api.interiorUrl(b.id, { download: true })" (click)="store.flush()">⬇ PDF intérieur</a>
          <a class="btn" [href]="api.coverUrl(b.id, { download: true })" (click)="store.flush()">⬇ PDF couverture</a>
          <a class="btn dark" [href]="api.listingUrl(b.id)" (click)="store.flush()">⬇ Fiche KDP</a>
          <button class="btn primary" (click)="publish()" title="Prépare la publication assistée sur KDP">Publier sur KDP →</button>
        </div>

        <div class="tabs">
          @for (t of tabs; track t.id) {
            <button [class.active]="tab() === t.id" (click)="tab.set(t.id)">
              {{ t.label }}
              @if (t.id === 'agent' && agent.running()) { <span class="badge blue">en cours</span> }
              @if (t.id === 'agent' && agent.draft()) { <span class="badge accent">proposition</span> }
              @if (t.id === 'marketing') {
                <span class="badge" [class.ok]="store.score() >= 80" [class.warn]="store.score() < 80 && store.score() >= 50" [class.err]="store.score() < 50">score {{ store.score() }}</span>
              }
              @if (countFor(t.id); as n) { <span class="badge err">{{ n }}</span> }
            </button>
          }
        </div>

        @switch (tab()) {
          @case ('agent') { <app-agent-tab /> }
          @case ('format') { <app-format-tab /> }
          @case ('interior') { <app-interior-tab /> }
          @case ('cover') { <app-cover-tab /> }
          @case ('listing') { <app-listing-tab /> }
          @case ('marketing') { <app-marketing-tab /> }
        }
      </div>
    } @else {
      <div class="empty">Chargement du livre…</div>
    }
  `,
  styles: `
    .title-block h1 { margin: 0; font-size: 19px; }
    .save { font-size: 12px; color: var(--muted); min-width: 90px; text-align: right; }
    .save.error { color: var(--err); font-weight: 600; }
    .save.saved { color: var(--ok); }
  `,
})
export class EditorPage implements OnDestroy {
  api = inject(Api);
  store = inject(BookStore);
  agent = inject(AgentSession);
  id = input.required<string>();
  /** Onglet initial via ?onglet=agent|format|interior|cover|listing|marketing */
  onglet = input<string | undefined>(undefined);
  tab = signal<Tab>('interior');
  statuses = Object.entries(STATUS_LABELS) as [BookStatus, string][];
  tabs: { id: Tab; label: string }[] = [
    { id: 'agent', label: '✨ Assistant IA' },
    { id: 'format', label: 'Format' },
    { id: 'interior', label: 'Intérieur' },
    { id: 'cover', label: 'Couverture' },
    { id: 'listing', label: 'Fiche KDP' },
    { id: 'marketing', label: 'Marketing & contrôle' },
  ];
  trim = computed(() => findTrim(this.store.book()?.format.trimId ?? '6x9'));
  saveLabel = computed(() => ({ idle: '', pending: 'Modifications…', saving: 'Enregistrement…', saved: '✓ Enregistré', error: '⚠ Échec de l\'enregistrement' })[this.store.saveState()]);

  private areaToTab: Record<string, Tab> = {
    interieur: 'interior', couverture: 'cover', titre: 'listing', 'mots-cles': 'listing', description: 'listing', categories: 'listing', prix: 'listing', conformite: 'marketing',
  };

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) this.store.load(id);
    });
    effect(() => {
      const o = this.onglet();
      if (o && this.tabs.some((t) => t.id === o)) this.tab.set(o as Tab);
    });
  }

  countFor(tab: Tab): number {
    if (tab === 'marketing') return 0;
    return this.store.issues().filter((i) => i.level === 'error' && (this.areaToTab[i.area] === tab || (tab === 'format' && ['format', 'pages'].includes(i.field ?? '')))).length;
  }

  private router = inject(Router);

  async publish() {
    await this.store.flush();
    await this.api.kdpPublish(this.store.book()!.id);
    this.router.navigate(['/kdp'], { queryParams: { onglet: 'publication' } });
  }

  setStatus(s: BookStatus) {
    this.store.update((b) => (b.status = s));
  }

  ngOnDestroy() {
    if (this.store.saveState() === 'pending') this.store.flush();
  }
}
