import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CATEGORY_LABELS, defaultParams, expandPages, findTemplate, FONTS, grayPercent, instantiateSections, minGutter, PRESETS, renderInteriorPage,
  TEMPLATES, uid, type ParamValue, type Section, type TemplateCategory,
} from '@shared';
import { SvgView } from '../../ui/svg-view';
import { ParamEditor } from '../../ui/param-editor';
import { BookStore } from './book-store';

@Component({
  selector: 'app-interior-tab',
  imports: [FormsModule, SvgView, ParamEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.book(); as b) {
      <div class="split">
        <div class="side">
          <div class="card">
            <div class="row">
              <h2 style="margin: 0">Sections</h2>
              <span class="badge">{{ store.pages() }} pages</span>
              <span class="spacer"></span>
              <select [(ngModel)]="presetToApply" style="width: 170px">
                <option value="">Appliquer un préréglage…</option>
                @for (p of presets; track p.id) { <option [value]="p.id">{{ p.name }}</option> }
              </select>
              <button class="btn sm" [disabled]="!presetToApply" (click)="applyPreset()">OK</button>
            </div>

            <div class="sections">
              @for (s of b.interior.sections; track s.id; let i = $index) {
                <div class="sec" [class.on]="selectedId() === s.id">
                  <div class="sec-head" (click)="select(s, i)">
                    <span class="num">{{ i + 1 }}</span>
                    <div class="grow">
                      <b>{{ s.name || tplName(s.templateId) }}</b>
                      <div class="muted small">{{ tplName(s.templateId) }}{{ s.alt ? ' / ' + tplName(s.alt.templateId) + ' à gauche' : '' }} · p. {{ ranges()[i][0] }}–{{ ranges()[i][1] }}</div>
                    </div>
                    <input type="number" min="0" max="828" class="pages" [ngModel]="s.pages" (ngModelChange)="edit(i, 'pages', +$event)" (click)="$event.stopPropagation()" title="Nombre de pages" />
                    <button class="icon-btn" (click)="moveSection(i, -1); $event.stopPropagation()" title="Monter">↑</button>
                    <button class="icon-btn" (click)="moveSection(i, 1); $event.stopPropagation()" title="Descendre">↓</button>
                    <button class="icon-btn" (click)="duplicateSection(i); $event.stopPropagation()" title="Dupliquer">⧉</button>
                    <button class="icon-btn" (click)="removeSection(i); $event.stopPropagation()" title="Supprimer">✕</button>
                  </div>
                  @if (selectedId() === s.id) {
                    <div class="sec-body">
                      <div class="grid-2">
                        <label class="field">Nom de la section<input type="text" [ngModel]="s.name ?? ''" (ngModelChange)="edit(i, 'name', $event)" placeholder="(facultatif)" /></label>
                        <label class="field">Modèle de page
                          <select [ngModel]="s.templateId" (ngModelChange)="changeTemplate(i, $event)">
                            @for (g of groups; track g.cat) { <optgroup [label]="g.label">@for (t of g.items; track t.id) { <option [value]="t.id">{{ t.name }}</option> }</optgroup> }
                          </select>
                        </label>
                      </div>
                      <p class="small muted">{{ tplDesc(s.templateId) }}</p>
                      <app-param-editor [defs]="defsOf(s.templateId)" [values]="resolved(s.templateId, s.params)" (paramChange)="editParam(i, $event.key, $event.value, false)" />
                      <div class="alt">
                        <label class="check"><input type="checkbox" [ngModel]="!!s.alt" (ngModelChange)="toggleAlt(i, $event)" /> Page de gauche différente (double page)</label>
                        @if (s.alt) {
                          <label class="field" style="margin-top: 8px">Modèle des pages de gauche
                            <select [ngModel]="s.alt.templateId" (ngModelChange)="changeAltTemplate(i, $event)">
                              @for (g of groups; track g.cat) { <optgroup [label]="g.label">@for (t of g.items; track t.id) { <option [value]="t.id">{{ t.name }}</option> }</optgroup> }
                            </select>
                          </label>
                          <div style="margin-top: 8px"><app-param-editor [defs]="defsOf(s.alt.templateId)" [values]="resolved(s.alt.templateId, s.alt.params)" (paramChange)="editParam(i, $event.key, $event.value, true)" /></div>
                        }
                      </div>
                    </div>
                  }
                </div>
              } @empty {
                <div class="empty small">Aucune section : ajoutez un modèle de page ou appliquez un préréglage.</div>
              }
            </div>
            <div class="row" style="margin-top: 10px">
              <select [(ngModel)]="templateToAdd" style="flex: 1">
                @for (g of groups; track g.cat) { <optgroup [label]="g.label">@for (t of g.items; track t.id) { <option [value]="t.id">{{ t.name }}</option> }</optgroup> }
              </select>
              <button class="btn primary sm" (click)="addSection()">+ Ajouter la section</button>
            </div>
          </div>

          <div class="card" style="margin-top: 14px">
            <h2>Réglages d'impression</h2>
            <div class="grid-2">
              <label class="field">Couleur des lignes
                <span class="row" style="gap: 6px"><input type="color" [ngModel]="b.interior.lineColor" (ngModelChange)="setInterior('lineColor', $event)" />
                <span class="small" [style.color]="gray() < 10 ? 'var(--err)' : 'var(--muted)'">{{ gray() }} % de gris (≥ 10 %)</span></span>
              </label>
              <label class="field">Épaisseur des traits (pt)
                <input type="number" step="0.05" min="0.75" [ngModel]="b.interior.lineWidth" (ngModelChange)="setInterior('lineWidth', +$event)" />
                <span class="hint">Minimum KDP : 0,75 pt</span>
              </label>
              <label class="field">Police des libellés
                <select [ngModel]="b.interior.font" (ngModelChange)="setInterior('font', $event)">@for (f of fonts; track f.family) { <option [value]="f.family">{{ f.family }}</option> }</select>
              </label>
              <div class="stack" style="gap: 6px; padding-top: 18px">
                <label class="check"><input type="checkbox" [ngModel]="b.interior.pageNumbers" (ngModelChange)="setInterior('pageNumbers', $event)" /> Numéros de page</label>
                <label class="check"><input type="checkbox" [ngModel]="b.interior.padToEven" (ngModelChange)="setInterior('padToEven', $event)" /> Compléter à un nombre pair</label>
              </div>
            </div>
            <div class="section-title">Marges (pouces) — intérieure minimale pour {{ store.pages() }} p. : {{ gutter() }} in</div>
            <div class="grid-4">
              @for (m of marginKeys; track m[0]) {
                <label class="field">{{ m[1] }}<input type="number" step="0.05" min="0.25" [ngModel]="b.interior.margins[m[0]]" (ngModelChange)="setMargin(m[0], +$event)" /></label>
              }
            </div>
          </div>
        </div>

        <div class="preview card">
          <div class="row">
            <button class="btn sm" (click)="go(page() - (spread() ? 2 : 1))" [disabled]="page() <= 1">←</button>
            <span class="small">Page <input type="number" class="pn" [min]="1" [max]="total()" [ngModel]="page()" (ngModelChange)="go(+$event)" /> / {{ total() }}</span>
            <button class="btn sm" (click)="go(page() + (spread() ? 2 : 1))" [disabled]="page() >= total()">→</button>
            <span class="spacer"></span>
            <label class="check small"><input type="checkbox" [ngModel]="spread()" (ngModelChange)="spread.set($event)" /> Double page</label>
            <label class="check small"><input type="checkbox" [ngModel]="guides()" (ngModelChange)="guides.set($event)" /> Repères (marges, coupe)</label>
          </div>
          <div class="pages-view" [class.spread]="spread()">
            @for (p of shown(); track $index) {
              @if (p) {
                <div class="pg">
                  <div class="paper"><app-svg [prims]="p.prims" [width]="p.geo.width" [height]="p.geo.height" [guides]="guides()" /></div>
                  <div class="cap small muted">p. {{ p.ref.pageNumber }} · {{ p.geo.isRecto ? 'droite (recto)' : 'gauche (verso)' }}{{ p.ref.padding ? ' · page blanche ajoutée' : '' }}</div>
                </div>
              } @else { <div class="pg ghost"></div> }
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .split { display: grid; grid-template-columns: minmax(380px, 520px) minmax(0, 1fr); gap: 16px; align-items: start; }
    .sections { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
    .sec { border: 1px solid var(--line); border-radius: 9px; background: #fff; }
    .sec.on { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-2); }
    .sec-head { display: flex; align-items: center; gap: 6px; padding: 8px 8px 8px 10px; cursor: pointer; }
    .num { width: 22px; height: 22px; border-radius: 6px; background: #eef0f6; display: grid; place-items: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
    .grow { flex: 1; min-width: 0; }
    .grow b { font-size: 13px; }
    .pages { width: 64px; }
    .sec-body { padding: 4px 12px 12px; border-top: 1px solid var(--line); }
    .alt { margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--line-2); }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .preview { position: sticky; top: 12px; }
    .pn { width: 64px; display: inline-block; }
    .pages-view { display: flex; gap: 0; justify-content: center; margin-top: 14px; background: #e9ecf3; border-radius: 8px; padding: 18px; min-height: 300px; }
    .pg { width: min(100%, 520px); }
    .pages-view.spread .pg { width: 50%; max-width: 460px; }
    .pg.ghost { visibility: hidden; }
    .cap { text-align: center; margin-top: 6px; }
    @media (max-width: 1100px) { .split { grid-template-columns: 1fr; } .preview { position: static; } }
  `,
})
export class InteriorTab {
  store = inject(BookStore);
  page = signal(1);
  spread = signal(false);
  guides = signal(true);
  selectedId = signal<string | null>(null);
  presetToApply = '';
  templateToAdd = 'lined';
  presets = PRESETS;
  fonts = FONTS;
  marginKeys: ['top' | 'bottom' | 'outside' | 'inside', string][] = [['top', 'Haut'], ['bottom', 'Bas'], ['outside', 'Extérieure'], ['inside', 'Intérieure']];
  groups = (Object.keys(CATEGORY_LABELS) as TemplateCategory[]).map((cat) => ({ cat, label: CATEGORY_LABELS[cat], items: TEMPLATES.filter((t) => t.category === cat) }));

  refs = computed(() => (this.store.book() ? expandPages(this.store.book()!) : []));
  total = computed(() => this.refs().length);
  gutter = computed(() => minGutter(this.store.pages()));
  gray = computed(() => grayPercent(this.store.book()?.interior.lineColor ?? '#888888'));
  ranges = computed(() => {
    let start = 1;
    return (this.store.book()?.interior.sections ?? []).map((s) => {
      const r: [number, number] = [start, start + Math.max(0, s.pages) - 1];
      start += Math.max(0, s.pages);
      return r;
    });
  });
  shown = computed(() => {
    const b = this.store.book();
    const refs = this.refs();
    if (!b || !refs.length) return [];
    const p = Math.min(Math.max(1, this.page()), refs.length);
    const render = (n: number) => (n >= 1 && n <= refs.length ? renderInteriorPage(b, refs[n - 1], refs.length, { guides: true }) : null);
    if (!this.spread()) return [render(p)];
    const left = p % 2 === 0 ? p : p - 1;
    return [render(left), render(left + 1)];
  });

  tplName = (id: string) => findTemplate(id).name;
  tplDesc = (id: string) => findTemplate(id).description;
  defsOf = (id: string) => findTemplate(id).params;
  resolved = (id: string, params: Record<string, ParamValue>) => ({ ...defaultParams(findTemplate(id), this.store.book()!.metadata.language), ...params });

  go(n: number) {
    this.page.set(Math.min(Math.max(1, Math.round(n) || 1), Math.max(1, this.total())));
  }

  select(s: Section, i: number) {
    this.selectedId.set(this.selectedId() === s.id ? null : s.id);
    this.go(this.ranges()[i][0]);
  }

  private sections(fn: (list: Section[]) => void) {
    this.store.update((b) => fn(b.interior.sections));
  }

  edit(i: number, key: 'pages' | 'name', value: string | number) {
    this.sections((l) => ((l[i] as unknown as Record<string, unknown>)[key] = key === 'pages' ? Math.max(0, Math.round(Number(value) || 0)) : value));
  }

  editParam(i: number, key: string, value: ParamValue, alt: boolean) {
    this.sections((l) => {
      const target = alt ? l[i].alt!.params : l[i].params;
      target[key] = value;
    });
  }

  changeTemplate(i: number, id: string) {
    this.sections((l) => {
      l[i].templateId = id;
      l[i].params = {};
    });
  }

  changeAltTemplate(i: number, id: string) {
    this.sections((l) => (l[i].alt = { templateId: id, params: {} }));
  }

  toggleAlt(i: number, on: boolean) {
    this.sections((l) => (l[i].alt = on ? { templateId: 'blank', params: { frame: 'rounded' } } : null));
  }

  moveSection(i: number, d: number) {
    this.sections((l) => {
      const j = i + d;
      if (j >= 0 && j < l.length) [l[i], l[j]] = [l[j], l[i]];
    });
  }

  duplicateSection(i: number) {
    this.sections((l) => l.splice(i + 1, 0, { ...structuredClone(l[i]), id: uid('s') }));
  }

  removeSection(i: number) {
    this.sections((l) => l.splice(i, 1));
  }

  addSection() {
    const id = uid('s');
    this.sections((l) => l.push({ id, templateId: this.templateToAdd, pages: 10, params: {}, alt: null }));
    this.selectedId.set(id);
    this.go(this.store.pages() - 9);
  }

  applyPreset() {
    const p = PRESETS.find((x) => x.id === this.presetToApply);
    if (!p || !confirm(`Remplacer l'intérieur par « ${p.name} » ?`)) return;
    this.store.update((b) => {
      b.interior.sections = instantiateSections(p, b.metadata.language);
      b.presetId = p.id;
      Object.assign(b.format, p.format);
    });
    this.presetToApply = '';
    this.go(1);
  }

  setInterior(key: 'lineColor' | 'lineWidth' | 'font' | 'pageNumbers' | 'padToEven', v: unknown) {
    this.store.update((b) => ((b.interior as unknown as Record<string, unknown>)[key] = v));
  }

  setMargin(k: 'top' | 'bottom' | 'outside' | 'inside', v: number) {
    this.store.update((b) => (b.interior.margins[k] = Number(v) || 0));
  }
}
