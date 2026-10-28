import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ColumnDef, FieldDef, ParamDef, Params, ParamValue } from '@shared';

/** Formulaire généré à partir de la définition des paramètres d'un modèle de page. */
@Component({
  selector: 'app-param-editor',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="params">
      @for (d of defs(); track d.key) {
        @switch (d.type) {
          @case ('number') {
            <label class="field">{{ d.label }}{{ d.unit ? ' (' + d.unit + ')' : '' }}
              <input type="number" [min]="d.min ?? null" [max]="d.max ?? null" [step]="d.step ?? 1" [ngModel]="values()[d.key]" (ngModelChange)="emit(d.key, +$event)" />
              @if (d.help) { <span class="hint">{{ d.help }}</span> }
            </label>
          }
          @case ('boolean') {
            <label class="check wide"><input type="checkbox" [ngModel]="values()[d.key]" (ngModelChange)="emit(d.key, $event)" /> {{ d.label }}</label>
          }
          @case ('select') {
            <label class="field">{{ d.label }}
              <select [ngModel]="values()[d.key]" (ngModelChange)="emit(d.key, $event)">
                @for (o of d.options; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </label>
          }
          @case ('text') {
            <label class="field wide">{{ d.label }}
              @if (d.multiline) { <textarea [ngModel]="values()[d.key]" (ngModelChange)="emit(d.key, $event)"></textarea> }
              @else { <input type="text" [ngModel]="values()[d.key]" (ngModelChange)="emit(d.key, $event)" /> }
              @if (d.help) { <span class="hint">{{ d.help }}</span> }
            </label>
          }
          @case ('columns') {
            <div class="wide">
              <div class="sub">{{ d.label }}</div>
              @for (c of columns(d.key); track $index; let i = $index) {
                <div class="line">
                  <input type="text" [ngModel]="c.label" (ngModelChange)="editColumn(d.key, i, 'label', $event)" placeholder="Intitulé" />
                  <input type="number" step="0.1" min="0.2" class="w" [ngModel]="c.width" (ngModelChange)="editColumn(d.key, i, 'width', +$event)" title="Largeur relative" />
                  <button class="icon-btn" (click)="move(d.key, i, -1)" title="Monter">↑</button>
                  <button class="icon-btn" (click)="move(d.key, i, 1)" title="Descendre">↓</button>
                  <button class="icon-btn" (click)="removeAt(d.key, i)" title="Supprimer">✕</button>
                </div>
              }
              <button class="btn sm" (click)="add(d.key, { label: 'Colonne', width: 1 })">+ Colonne</button>
            </div>
          }
          @case ('fields') {
            <div class="wide">
              <div class="sub">{{ d.label }}</div>
              @for (f of fields(d.key); track $index; let i = $index) {
                <div class="line">
                  <input type="text" [ngModel]="f.label" (ngModelChange)="editField(d.key, i, 'label', $event)" placeholder="Libellé" />
                  <select class="t" [ngModel]="f.type" (ngModelChange)="editField(d.key, i, 'type', $event)">
                    <option value="line">Ligne</option><option value="lines">Lignes</option><option value="box">Cadre</option>
                    <option value="rating">Note ★</option><option value="checks">Cases</option>
                  </select>
                  @if (f.type === 'lines' || f.type === 'box') {
                    <input type="number" min="1" max="40" class="w" [ngModel]="f.lines ?? 3" (ngModelChange)="editField(d.key, i, 'lines', +$event)" title="Nombre de lignes" />
                  }
                  @if (f.type === 'checks') {
                    <input type="text" class="o" [ngModel]="f.options ?? ''" (ngModelChange)="editField(d.key, i, 'options', $event)" placeholder="Choix séparés par |" />
                  }
                  <label class="check small" title="Demi-largeur (deux champs côte à côte)"><input type="checkbox" [ngModel]="!!f.half" (ngModelChange)="editField(d.key, i, 'half', $event)" />½</label>
                  <button class="icon-btn" (click)="move(d.key, i, -1)">↑</button>
                  <button class="icon-btn" (click)="move(d.key, i, 1)">↓</button>
                  <button class="icon-btn" (click)="removeAt(d.key, i)">✕</button>
                </div>
              }
              <button class="btn sm" (click)="add(d.key, { label: 'Champ', type: 'line' })">+ Champ</button>
            </div>
          }
        }
      }
    </div>
  `,
  styles: `
    .params { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; align-items: start; }
    .wide { grid-column: 1 / -1; }
    .sub { font-size: 12px; font-weight: 600; color: var(--ink-2); margin-bottom: 6px; }
    .line { display: flex; gap: 4px; align-items: center; margin-bottom: 4px; }
    .line .w { width: 64px; flex-shrink: 0; }
    .line .t { width: 96px; flex-shrink: 0; }
    .line .o { width: 160px; }
  `,
})
export class ParamEditor {
  defs = input.required<ParamDef[]>();
  values = input.required<Params>();
  paramChange = output<{ key: string; value: ParamValue }>();

  emit(key: string, value: ParamValue) {
    this.paramChange.emit({ key, value });
  }

  columns = (k: string) => (this.values()[k] as ColumnDef[] | undefined) ?? [];
  fields = (k: string) => (this.values()[k] as FieldDef[] | undefined) ?? [];
  private list = (k: string) => structuredClone((this.values()[k] as unknown[] | undefined) ?? []) as Record<string, unknown>[];

  editColumn(k: string, i: number, prop: keyof ColumnDef, v: unknown) {
    const l = this.list(k);
    l[i][prop] = v;
    this.emit(k, l);
  }
  editField(k: string, i: number, prop: keyof FieldDef, v: unknown) {
    const l = this.list(k);
    l[i][prop] = v;
    this.emit(k, l);
  }
  move(k: string, i: number, d: number) {
    const l = this.list(k);
    const j = i + d;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    this.emit(k, l);
  }
  removeAt(k: string, i: number) {
    const l = this.list(k);
    l.splice(i, 1);
    this.emit(k, l);
  }
  add(k: string, item: Record<string, unknown>) {
    this.emit(k, [...this.list(k), item]);
  }
}
