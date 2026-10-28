import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { lintKeyword, matchPreset, parseKeywordCounts, PRESETS, type Idea, type Issue } from '@shared';
import { Api } from '../../core/api';

@Component({
  selector: 'app-ideas-page',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <h1>Idées</h1>
        <span class="badge">{{ filtered().length }} / {{ ideas().length }}</span>
        <span class="spacer"></span>
        <input type="search" placeholder="Rechercher niche, titre, mot-clé…" [ngModel]="q()" (ngModelChange)="q.set($event)" style="width: 260px" />
        <select [ngModel]="cat()" (ngModelChange)="cat.set($event)" style="width: 180px">
          <option value="">Toutes les catégories</option>
          @for (c of categories(); track c) { <option [value]="c">{{ c }}</option> }
        </select>
        <label class="check"><input type="checkbox" [ngModel]="withTitles()" (ngModelChange)="withTitles.set($event)" /> Avec titres</label>
        <label class="btn">Importer un .xlsx<input type="file" accept=".xlsx" hidden (change)="importFile($event)" /></label>
        <button class="btn" (click)="importLocal()" title="Relit les fichiers .xlsx à la racine du projet">↻ Réimporter le dossier</button>
      </div>
      @if (message()) { <div class="toast" (click)="message.set('')">{{ message() }}</div> }

      <div class="layout" [class.with-detail]="!!selected()">
        <div class="list">
          @for (group of grouped(); track group.cat) {
            <div class="section-title">{{ group.cat }} <span class="badge">{{ group.items.length }}</span></div>
            <div class="cards">
              @for (i of group.items; track i.id) {
                <button class="idea" [class.on]="selected()?.id === i.id" (click)="select(i)">
                  <b>{{ i.niche }}</b>
                  <span class="muted small">{{ i.titles[0] || i.subtitle || i.notes.join(' ').slice(0, 80) || 'Niche à explorer' }}</span>
                  <span class="row small" style="gap: 4px; margin-top: 4px">
                    @if (i.titles.length) { <span class="badge blue">{{ i.titles.length }} titres</span> }
                    @if (i.keywords.length) { <span class="badge">{{ i.keywords.length }} mots-clés</span> }
                    @if (i.description) { <span class="badge">description</span> }
                    @if (i.language) { <span class="badge accent">{{ i.language.toUpperCase() }}</span> }
                  </span>
                </button>
              }
            </div>
          } @empty {
            <div class="empty card">
              <h2>Aucune idée</h2>
              <p>Importez vos fichiers « Low content » (.xlsx) : une feuille par catégorie, une colonne par niche.</p>
            </div>
          }
        </div>

        @if (selected(); as s) {
          <aside class="detail card">
            <div class="row">
              <div>
                <div class="muted small">{{ s.category }} · {{ s.source.file }} › {{ s.source.sheet }} › col. {{ s.source.column }}</div>
                <h2 style="margin: 2px 0 0">{{ s.niche }}</h2>
              </div>
              <span class="spacer"></span>
              <button class="icon-btn" (click)="selected.set(null)">✕</button>
            </div>

            <div class="create card">
              <div class="grid-2">
                <label class="field">Titre retenu
                  <select [ngModel]="titleIndex()" (ngModelChange)="titleIndex.set(+$event)">
                    @for (t of s.titles; track $index) { <option [value]="$index">{{ t }}</option> }
                    @if (!s.titles.length) { <option [value]="0">{{ s.niche }}</option> }
                  </select>
                </label>
                <label class="field">Intérieur proposé
                  <select [ngModel]="presetId()" (ngModelChange)="presetId.set($event)">
                    @for (p of presets; track p.id) { <option [value]="p.id">{{ p.name }}</option> }
                  </select>
                </label>
              </div>
              <div class="row" style="margin-top: 10px">
                <button class="btn primary" (click)="createBook(s, 'agent')">✨ Créer et ouvrir l'assistant IA</button>
                <button class="btn" (click)="createBook(s)">Créer le carnet</button>
              </div>
            </div>

            @if (s.titles.length) {
              <div class="section-title">Titres ({{ s.titles.length }}) — une variante de couverture par titre</div>
              <ol class="titles">@for (t of s.titles; track $index) { <li>{{ t }}</li> }</ol>
            }
            @if (s.subtitle) { <div class="section-title">Sous-titre</div><p>{{ s.subtitle }}</p> }
            @if (s.keywords.length) {
              <div class="section-title">Mots-clés</div>
              @for (k of s.keywords; track $index) {
                <div class="kw"><span class="counter" [class.over]="k.length > 50">{{ k.length }}</span> {{ k }}</div>
                @for (iss of kwIssues()[$index]; track $index) { <div class="issue" [class]="iss.level">{{ iss.message }}</div> }
              }
            }
            @if (s.description) {
              <div class="section-title">Description</div>
              <div class="desc" [innerHTML]="s.description"></div>
            }
            @if (s.categories.length) {
              <div class="section-title">Catégories / accroches</div>
              <ul>@for (c of s.categories; track $index) { <li>{{ c }}</li> }</ul>
            }
            @if (counts().length) {
              <div class="section-title">Fréquence des mots chez les concurrents</div>
              <div class="chips">@for (c of counts().slice(0, 40); track c.word) { <span class="chip">{{ c.word }} <b>{{ c.count }}</b></span> }</div>
            }
            @if (s.links.length) {
              <div class="section-title">Concurrents / références</div>
              @for (l of s.links; track $index) { <div class="small"><a [href]="l" target="_blank" rel="noopener">{{ shortUrl(l) }}</a></div> }
            }
            @if (s.notes.length) {
              <div class="section-title">Notes</div>
              @for (n of s.notes; track $index) { <div class="note">{{ n }}</div> }
            }
            @if (translationKeys().length) {
              <div class="section-title">Traductions</div>
              @for (k of translationKeys(); track k) { <div class="small"><b>{{ k.toUpperCase() }}</b> : {{ s.translations[k] }}</div> }
            }
          </aside>
        }
      </div>
    </div>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: 1fr; gap: 16px; align-items: start; }
    .layout.with-detail { grid-template-columns: minmax(0, 1fr) 480px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; }
    .idea { font: inherit; text-align: left; background: #fff; border: 1px solid var(--line); border-radius: 9px; padding: 10px 12px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
    .idea:hover { border-color: var(--line-2); box-shadow: var(--shadow); }
    .idea.on { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-2); }
    .idea b { font-size: 13.5px; }
    .detail { position: sticky; top: 16px; max-height: calc(100vh - 32px); overflow: auto; }
    .create { background: #fafbfe; box-shadow: none; margin-top: 12px; }
    .titles { margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6; }
    .kw { font-size: 13px; padding: 3px 0; display: flex; gap: 8px; align-items: baseline; }
    .desc { font-size: 13px; border: 1px solid var(--line); border-radius: 8px; padding: 4px 12px; background: #fcfcfe; }
    .note { font-size: 12px; white-space: pre-wrap; background: #f6f7fb; border-radius: 6px; padding: 8px; margin-bottom: 6px; max-height: 160px; overflow: auto; }
    .issue { margin: 2px 0 4px 28px; }
    @media (max-width: 1100px) { .layout.with-detail { grid-template-columns: 1fr; } .detail { position: static; max-height: none; } }
  `,
})
export class IdeasPage {
  private api = inject(Api);
  private router = inject(Router);
  ideas = signal<Idea[]>([]);
  q = signal('');
  cat = signal('');
  withTitles = signal(false);
  selected = signal<Idea | null>(null);
  titleIndex = signal(0);
  presetId = signal('notebook-lined');
  message = signal('');
  presets = PRESETS;

  categories = computed(() => [...new Set(this.ideas().map((i) => i.category))]);
  filtered = computed(() => {
    const q = this.q().toLowerCase();
    return this.ideas().filter((i) =>
      (!this.cat() || i.category === this.cat()) && (!this.withTitles() || i.titles.length > 0) &&
      (!q || [i.niche, ...i.titles, i.subtitle, ...i.keywords].join(' ').toLowerCase().includes(q)));
  });
  grouped = computed(() => {
    const map = new Map<string, Idea[]>();
    for (const i of this.filtered()) map.set(i.category, [...(map.get(i.category) ?? []), i]);
    return [...map].map(([cat, items]) => ({ cat, items }));
  });
  kwIssues = computed<Issue[][]>(() => {
    const s = this.selected();
    if (!s) return [];
    const tw = new Set((s.titles[this.titleIndex()] ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/));
    return s.keywords.map((k, i) => lintKeyword(k, i, tw).filter((x) => x.level !== 'info'));
  });
  counts = computed(() => parseKeywordCounts((this.selected()?.notes ?? []).join(' ')));
  translationKeys = computed(() => Object.keys(this.selected()?.translations ?? {}));

  constructor() {
    this.load();
  }

  async load() {
    this.ideas.set(await this.api.ideas());
  }

  select(i: Idea) {
    this.selected.set(i);
    this.titleIndex.set(0);
    this.presetId.set(matchPreset(i.niche, ...i.titles, i.subtitle, i.category)?.id ?? 'notebook-lined');
  }

  async createBook(i: Idea, onglet?: string) {
    const b = await this.api.bookFromIdea(i.id, this.titleIndex(), this.presetId());
    this.router.navigate(['/livres', b.id], onglet ? { queryParams: { onglet } } : {});
  }

  async importFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const r = await this.api.importIdeas(file);
    input.value = '';
    this.message.set(`${file.name} : ${r.created} nouvelles idées, ${r.updated} mises à jour.`);
    await this.load();
  }

  async importLocal() {
    const r = await this.api.importLocalIdeas();
    this.message.set(`${r.files.length} fichier(s) relu(s) : ${r.created} nouvelles idées, ${r.updated} mises à jour.`);
    await this.load();
  }

  shortUrl(u: string) {
    try {
      const url = new URL(u);
      return url.hostname + url.pathname.slice(0, 50);
    } catch {
      return u.slice(0, 60);
    }
  }
}
