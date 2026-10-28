import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { generateDescription, LANGS, LISTING, MARKETPLACES, sanitizeDescription, unsupportedTags, type Issue, type ListingMetadata } from '@shared';
import { Api } from '../../core/api';
import { BookStore } from './book-store';

@Component({
  selector: 'app-listing-tab',
  imports: [FormsModule, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.book(); as b) {
      @let m = b.metadata;
      <div class="grid-2 top">
        <div class="stack">
          <div class="card stack">
            <div class="row"><h2 style="margin: 0">Titre</h2><span class="spacer"></span>
              <span class="counter" [class.over]="titleLen() > limits.titleSubtitleMax">titre + sous-titre : {{ titleLen() }} / {{ limits.titleSubtitleMax }}</span></div>
            <label class="field">Titre<input type="text" [ngModel]="m.title" (ngModelChange)="set('title', $event)" /></label>
            <label class="field">Sous-titre <span class="hint">Décrit le produit en langage naturel (pas une liste de mots-clés).</span><input type="text" [ngModel]="m.subtitle" (ngModelChange)="set('subtitle', $event)" /></label>
            <div class="grid-2">
              <label class="field">Auteur / pseudonyme / marque<input type="text" [ngModel]="m.author" (ngModelChange)="set('author', $event)" /></label>
              <label class="field">Série @if (m.lowContent) { <span class="hint">interdit en low-content</span> }<input type="text" [ngModel]="m.series" (ngModelChange)="set('series', $event)" [disabled]="m.lowContent && !m.series" /></label>
            </div>
            <div class="grid-2">
              <label class="field">Langue
                <select [ngModel]="m.language" (ngModelChange)="set('language', $event)">@for (l of langs; track l.value) { <option [value]="l.value">{{ l.label }}</option> }</select>
              </label>
              <label class="field">Place de marché principale
                <select [ngModel]="m.marketplace" (ngModelChange)="set('marketplace', $event)">@for (mk of markets; track mk.id) { <option [value]="mk.id">{{ mk.label }}</option> }</select>
              </label>
            </div>
            @for (i of issuesFor(['title', 'subtitle', 'author', 'series']); track $index) { <div class="issue" [class]="i.level">{{ i.message }}</div> }
          </div>

          <div class="card stack">
            <div class="row"><h2 style="margin: 0">Mots-clés</h2><span class="muted small">7 cases · 50 caractères max · pas de marque, d'auteur, de faute volontaire</span></div>
            @for (k of m.keywords; track $index; let i = $index) {
              <div>
                <div class="kw">
                  <span class="n">{{ i + 1 }}</span>
                  <input type="text" [ngModel]="k" (ngModelChange)="setKeyword(i, $event)" [class.bad]="k.length > limits.keywordMax" />
                  <span class="counter" [class.over]="k.length > limits.keywordMax">{{ k.length }}/{{ limits.keywordMax }}</span>
                </div>
                @for (iss of kwIssues()[i]; track $index) { <div class="issue sub" [class]="iss.level">{{ iss.message.replace('Mot-clé ' + (i + 1) + ' : ', '') }}</div> }
              </div>
            }
          </div>

          <div class="card stack">
            <h2 style="margin: 0">Catégories</h2>
            <p class="small muted" style="margin: 0">Jusqu'à 3 catégories KDP. Visez des sous-catégories précises où un petit volume de ventes suffit à apparaître dans le top 100.</p>
            @for (c of m.categories; track $index; let i = $index) {
              <input type="text" [ngModel]="c" (ngModelChange)="setCategory(i, $event)" [placeholder]="'Catégorie ' + (i + 1) + ' — ex. Livres > Loisirs créatifs > Papeterie'" />
            }
          </div>
        </div>

        <div class="stack">
          <div class="card stack">
            <div class="row">
              <h2 style="margin: 0">Description</h2>
              <span class="spacer"></span>
              <span class="counter" [class.over]="m.descriptionHtml.length > limits.descriptionMax">{{ m.descriptionHtml.length }} / {{ limits.descriptionMax }}</span>
            </div>
            <label class="field">Public visé (pour la génération)<input type="text" [ngModel]="m.audience" (ngModelChange)="set('audience', $event)" placeholder="ex. les amoureux de la nature et les enfants curieux" /></label>
            <div class="toolbar">
              @for (t of tags; track t[0]) { <button class="btn sm" (click)="wrap(t[0])" [title]="'<' + t[0] + '>'">{{ t[1] }}</button> }
              <button class="btn sm" (click)="insert('<br>')">↵</button>
              <span class="spacer"></span>
              <button class="btn sm" (click)="generate()">✨ Générer depuis l'intérieur</button>
              @if (badTags().length) { <button class="btn sm primary" (click)="fix()">Corriger le HTML ({{ badTags().length }})</button> }
            </div>
            <textarea #desc rows="12" class="mono" [ngModel]="m.descriptionHtml" (ngModelChange)="set('descriptionHtml', $event)"></textarea>
            <div class="small muted">Balises acceptées par KDP : {{ limits.allowedHtmlTags.join(', ') }}. Pas d'URL, d'avis, de prix ni d'emoji.</div>
            @for (i of issuesFor(['description']); track $index) { <div class="issue" [class]="i.level">{{ i.message }}</div> }
            <div class="section-title">Aperçu</div>
            <div class="desc-preview" [innerHTML]="m.descriptionHtml"></div>
          </div>

          <div class="card stack">
            <h2 style="margin: 0">Publication</h2>
            <label class="check"><input type="checkbox" [ngModel]="m.lowContent" (ngModelChange)="set('lowContent', $event)" /> <b>Livre low-content</b> (case sous « Catégories » dans KDP)</label>
            <p class="small muted" style="margin: 0">Sans ISBN : pas d'ISBN gratuit, pas de distribution étendue, pas de série ni de précommande, pas de « Feuilleter ».</p>
            <div class="section-title">Déclaration de contenu généré par IA</div>
            <div class="row">
              <label class="check"><input type="checkbox" [ngModel]="m.aiGenerated.text" (ngModelChange)="setAi('text', $event)" /> Texte</label>
              <label class="check"><input type="checkbox" [ngModel]="m.aiGenerated.images" (ngModelChange)="setAi('images', $event)" /> Images (couverture / intérieur)</label>
              <label class="check"><input type="checkbox" [ngModel]="m.aiGenerated.translation" (ngModelChange)="setAi('translation', $event)" /> Traduction</label>
            </div>
            <div class="grid-2">
              <label class="field">Prix public<input type="number" step="0.01" [ngModel]="m.price" (ngModelChange)="set('price', +$event)" /></label>
              @if (store.royalty(); as r) {
                <div class="small" style="padding-top: 18px">Redevance ≈ <b>{{ r.royalty | number: '1.2-2' }} {{ r.currency }}</b> ({{ r.rate * 100 }} %, impression {{ r.printCost | number: '1.2-2' }})</div>
              }
            </div>
            <label class="field">Niche<input type="text" [ngModel]="m.niche" (ngModelChange)="set('niche', $event)" /></label>
            <label class="field">Notes (idée importée, concurrents…)<textarea rows="5" [ngModel]="m.notes" (ngModelChange)="set('notes', $event)"></textarea></label>
            <a class="btn dark" [href]="api.listingUrl(b.id)" (click)="store.flush()">⬇ Exporter la fiche à copier dans KDP (.txt)</a>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .top { align-items: start; }
    .kw { display: flex; gap: 8px; align-items: center; }
    .kw .n { width: 20px; height: 20px; border-radius: 5px; background: #eef0f6; display: grid; place-items: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
    .kw input.bad { border-color: var(--err); }
    .issue.sub { margin: 3px 0 2px 28px; padding: 3px 8px; }
    .toolbar { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
    .desc-preview { border: 1px solid var(--line); border-radius: 8px; padding: 4px 14px; font-size: 13px; background: #fcfcfe; max-height: 360px; overflow: auto; }
  `,
})
export class ListingTab {
  store = inject(BookStore);
  api = inject(Api);
  limits = LISTING;
  langs = LANGS;
  markets = MARKETPLACES;
  tags: [string, string][] = [['b', 'B'], ['i', 'I'], ['u', 'U'], ['h4', 'H4'], ['h5', 'H5'], ['p', '¶'], ['ul', '• liste'], ['li', 'élément']];
  textarea = viewChild<ElementRef<HTMLTextAreaElement>>('desc');

  titleLen = computed(() => {
    const m = this.store.book()!.metadata;
    return m.title.length + m.subtitle.length;
  });
  badTags = computed(() => unsupportedTags(this.store.book()!.metadata.descriptionHtml));
  kwIssues = computed<Issue[][]>(() => {
    const all = this.store.issues();
    return this.store.book()!.metadata.keywords.map((_, i) => all.filter((x) => x.field === `keywords.${i}`));
  });

  issuesFor(fields: string[]) {
    return this.store.issues().filter((i) => i.field && fields.includes(i.field) && i.area !== 'couverture');
  }

  set<K extends keyof ListingMetadata>(key: K, value: ListingMetadata[K]) {
    this.store.update((b) => (b.metadata[key] = value));
  }

  setKeyword(i: number, v: string) {
    this.store.update((b) => (b.metadata.keywords[i] = v));
  }

  setCategory(i: number, v: string) {
    this.store.update((b) => (b.metadata.categories[i] = v));
  }

  setAi(k: 'text' | 'images' | 'translation', v: boolean) {
    this.store.update((b) => (b.metadata.aiGenerated[k] = v));
  }

  generate() {
    const b = this.store.book()!;
    if (b.metadata.descriptionHtml.trim() && !confirm('Remplacer la description actuelle ?')) return;
    this.set('descriptionHtml', generateDescription(b));
  }

  fix() {
    this.set('descriptionHtml', sanitizeDescription(this.store.book()!.metadata.descriptionHtml));
  }

  wrap(tag: string) {
    const ta = this.textarea()?.nativeElement;
    const v = this.store.book()!.metadata.descriptionHtml;
    const s = ta?.selectionStart ?? v.length;
    const e = ta?.selectionEnd ?? v.length;
    this.set('descriptionHtml', `${v.slice(0, s)}<${tag}>${v.slice(s, e)}</${tag}>${v.slice(e)}`);
  }

  insert(str: string) {
    const ta = this.textarea()?.nativeElement;
    const v = this.store.book()!.metadata.descriptionHtml;
    const s = ta?.selectionStart ?? v.length;
    this.set('descriptionHtml', v.slice(0, s) + str + v.slice(s));
  }
}
