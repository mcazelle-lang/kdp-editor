import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  COVER_STYLES, findTrim, LANGS, lintBook, PRESETS, score, STATUS_LABELS, totalPages, type Book, type BookStatus, type Lang,
} from '@shared';
import { Api } from '../../core/api';
import { CoverThumb } from '../../ui/cover-thumb';
import { PublishedList } from './published-list';

@Component({
  selector: 'app-books-page',
  imports: [FormsModule, RouterLink, DatePipe, CoverThumb, PublishedList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <h1>Mes carnets</h1>
        <span class="badge">{{ books().length }}</span>
        <span class="spacer"></span>
        <input type="search" placeholder="Rechercher un titre, une niche…" [ngModel]="q()" (ngModelChange)="q.set($event)" style="width: 260px" />
        @if (view() === 'atelier') {
          <select [ngModel]="status()" (ngModelChange)="status.set($event)" style="width: 160px">
            <option value="">Tous les statuts</option>
            @for (s of statuses; track s[0]) { <option [value]="s[0]">{{ s[1] }}</option> }
          </select>
        }
        <button class="btn primary" (click)="creating.set(!creating())">+ Nouveau carnet</button>
      </div>

      <div class="tabs">
        <button [class.active]="view() === 'atelier'" (click)="view.set('atelier')">En cours<span class="badge">{{ workshop().length }}</span></button>
        <button [class.active]="view() === 'publies'" (click)="view.set('publies')">Mes carnets publiés<span class="badge">{{ published().length }}</span></button>
      </div>

      @if (creating()) {
        <div class="card create">
          <h2>Nouveau carnet</h2>
          <div class="grid-3">
            <label class="field">Titre<input type="text" [(ngModel)]="draft.title" placeholder="Ex. Carnet de recettes de grand-mère" /></label>
            <label class="field">Langue / marché
              <select [(ngModel)]="draft.lang">@for (l of langs; track l.value) { <option [value]="l.value">{{ l.label }}</option> }</select>
            </label>
            <label class="field">Style de couverture
              <select [(ngModel)]="draft.styleId">@for (s of styles; track s.id) { <option [value]="s.id">{{ s.name }}</option> }</select>
            </label>
          </div>
          <div class="section-title">Type d'intérieur</div>
          <div class="presets">
            @for (p of presets; track p.id) {
              <button class="preset" [class.on]="draft.presetId === p.id" (click)="draft.presetId = p.id">
                <b>{{ p.name }}</b><span>{{ p.description }}</span><em>{{ trimLabel(p.format.trimId) }}</em>
              </button>
            }
          </div>
          <div class="row" style="margin-top: 14px">
            <button class="btn primary" (click)="create()">Créer et ouvrir l'éditeur</button>
            <button class="btn ghost" (click)="creating.set(false)">Annuler</button>
            <span class="muted small">Astuce : partez d'une idée importée depuis vos fichiers Excel (menu Idées) pour pré-remplir titre, description et mots-clés.</span>
          </div>
        </div>
      }

      @if (loading()) {
        <div class="empty">Chargement…</div>
      } @else if (view() === 'publies') {
        <app-published-list [books]="publishedFiltered()" (changed)="load()" />
      } @else if (!workshop().length) {
        <div class="empty card">
          <h2>Aucun carnet en cours</h2>
          <p>Créez un carnet à partir d'un préréglage, ou transformez une de vos idées importées en livre.</p>
          <div class="row" style="justify-content: center">
            <button class="btn primary" (click)="creating.set(true)">+ Nouveau carnet</button>
            <a class="btn" routerLink="/idees">Voir mes idées</a>
          </div>
        </div>
      } @else {
        <div class="books">
          @for (b of filtered(); track b.id) {
            <div class="book card">
              <a [routerLink]="['/livres', b.id]" class="cover"><app-cover-thumb [book]="b" /></a>
              <div class="meta">
                <a [routerLink]="['/livres', b.id]" class="title">{{ b.metadata.title || 'Sans titre' }}</a>
                <div class="muted small">{{ b.metadata.niche || '—' }}</div>
                <div class="row small" style="gap: 6px; margin-top: 6px">
                  <span class="badge" [class.ok]="b.status === 'publie'" [class.blue]="b.status === 'pret'">{{ statusLabel(b.status) }}</span>
                  <span class="badge">{{ trimLabel(b.format.trimId) }}</span>
                  <span class="badge">{{ pages(b) }} p.</span>
                  <span class="badge" [class.ok]="scoreOf(b) >= 80" [class.warn]="scoreOf(b) < 80 && scoreOf(b) >= 50" [class.err]="scoreOf(b) < 50">score {{ scoreOf(b) }}</span>
                </div>
                <div class="row small muted" style="margin-top: auto">
                  <span>Modifié {{ b.updatedAt | date: 'dd/MM/yy HH:mm' }}</span>
                  <span class="spacer"></span>
                  <button class="icon-btn" title="Dupliquer (variante)" (click)="duplicate(b)">⧉</button>
                  <button class="icon-btn" title="Supprimer" (click)="remove(b)">🗑</button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .create { margin-bottom: 20px; }
    .presets { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; max-height: 340px; overflow: auto; padding: 2px; }
    .preset { text-align: left; font: inherit; border: 1px solid var(--line-2); background: #fff; border-radius: 8px; padding: 10px; cursor: pointer; display: flex; flex-direction: column; gap: 3px; }
    .preset b { font-size: 13px; }
    .preset span { font-size: 11.5px; color: var(--muted); line-height: 1.35; }
    .preset em { font-size: 11px; font-style: normal; color: var(--blue); font-weight: 600; }
    .preset.on { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-2); }
    .books { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 14px; }
    .book { display: flex; gap: 14px; padding: 12px; }
    .cover { width: 104px; flex-shrink: 0; }
    .meta { display: flex; flex-direction: column; min-width: 0; flex: 1; gap: 2px; }
    .title { font-family: var(--font-head); font-weight: 700; color: var(--ink); text-decoration: none; font-size: 14px; line-height: 1.3; }
    .title:hover { color: var(--accent); }
  `,
})
export class BooksPage {
  private api = inject(Api);
  private router = inject(Router);
  books = signal<Book[]>([]);
  loading = signal(true);
  creating = signal(false);
  q = signal('');
  status = signal<'' | BookStatus>('');
  presets = PRESETS;
  styles = COVER_STYLES;
  langs = LANGS;
  statuses = (Object.entries(STATUS_LABELS) as [BookStatus, string][]).filter(([s]) => s !== 'publie');
  draft = { title: '', lang: 'fr' as Lang, presetId: 'notebook-lined', styleId: 'classic-label' };

  /** ?vue=publies ouvre directement « Mes carnets publiés » */
  vue = input<string | undefined>(undefined);
  view = signal<'atelier' | 'publies'>('atelier');
  workshop = computed(() => this.books().filter((b) => b.status !== 'publie'));
  published = computed(() => this.books().filter((b) => b.status === 'publie'));
  private matches = (b: Book) => {
    const q = this.q().toLowerCase();
    return !q || `${b.metadata.title} ${b.metadata.niche} ${b.metadata.subtitle} ${b.metadata.author}`.toLowerCase().includes(q);
  };
  filtered = computed(() => this.workshop().filter((b) => (!this.status() || b.status === this.status()) && this.matches(b)));
  publishedFiltered = computed(() => this.published().filter(this.matches));

  constructor() {
    this.load();
    effect(() => {
      if (this.vue() === 'publies') this.view.set('publies');
    });
  }

  async load() {
    this.books.set(await this.api.books());
    this.loading.set(false);
  }

  pages = (b: Book) => totalPages(b);
  scoreOf = (b: Book) => score(lintBook(b));
  statusLabel = (s: BookStatus) => STATUS_LABELS[s];
  trimLabel = (id?: string) => (id ? findTrim(id).label : '');

  async create() {
    const b = await this.api.createBook(this.draft);
    this.router.navigate(['/livres', b.id]);
  }

  async duplicate(b: Book) {
    const copy = await this.api.duplicate(b.id);
    this.books.update((list) => [copy, ...list]);
  }

  async remove(b: Book) {
    if (!confirm(`Supprimer « ${b.metadata.title || 'Sans titre'} » ?`)) return;
    await this.api.deleteBook(b.id);
    this.books.update((list) => list.filter((x) => x.id !== b.id));
  }
}
