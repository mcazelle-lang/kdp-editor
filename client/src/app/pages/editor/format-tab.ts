import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { COVER, INKS, INTERIOR, minGutter, pageRange, TRIM_SIZES, type Binding, type InkPaper } from '@shared';
import { Api } from '../../core/api';
import { BookStore } from './book-store';

@Component({
  selector: 'app-format-tab',
  imports: [FormsModule, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.book(); as b) {
      <div class="grid-2">
        <div class="card stack">
          <h2>Impression</h2>
          <div class="row">
            <label class="check"><input type="radio" name="binding" [checked]="b.format.binding === 'paperback'" (change)="setBinding('paperback')" /> Broché (paperback)</label>
            <label class="check"><input type="radio" name="binding" [checked]="b.format.binding === 'hardcover'" (change)="setBinding('hardcover')" /> Relié rigide (hardcover)</label>
          </div>
          <label class="field">Format de coupe (trim size)
            <select [ngModel]="b.format.trimId" (ngModelChange)="set('trimId', $event)">
              @for (t of trims(); track t.id) { <option [value]="t.id">{{ t.label }} — {{ t.cm }}{{ t.large ? ' · grand format' : '' }}{{ t.note ? ' · ' + t.note : '' }}</option> }
            </select>
          </label>
          <label class="field">Encre et papier
            <select [ngModel]="b.format.ink" (ngModelChange)="set('ink', $event)">
              @for (i of inks; track i.id) { <option [value]="i.id" [disabled]="!available(i.id)">{{ i.label }}{{ available(i.id) ? '' : ' (indisponible pour ce format)' }}</option> }
            </select>
          </label>
          <div class="row">
            <label class="check"><input type="checkbox" [ngModel]="b.format.bleed" (ngModelChange)="set('bleed', $event)" /> Fond perdu (bleed) à l'intérieur</label>
            <span class="muted small">Utile si un motif ou un aplat touche le bord de la page.</span>
          </div>
          <div class="row">
            <span class="small"><b>Finition</b></span>
            <label class="check"><input type="radio" name="finish" [checked]="b.format.finish === 'matte'" (change)="set('finish', 'matte')" /> Mate</label>
            <label class="check"><input type="radio" name="finish" [checked]="b.format.finish === 'glossy'" (change)="set('finish', 'glossy')" /> Brillante</label>
          </div>

          <div class="section-title">Valeurs du calculateur KDP (facultatif)</div>
          <p class="small muted" style="margin: 0">Pour la reliure rigide, KDP ne publie pas de formule : reportez ici les dimensions affichées par
            <a [href]="calculator" target="_blank" rel="noopener">le calculateur de couverture KDP</a> (ou importez son gabarit en calque dans l'onglet Couverture).</p>
          <div class="grid-3">
            <label class="field">Épaisseur du dos (in)<input type="number" step="0.001" [ngModel]="b.format.spineOverride" (ngModelChange)="set('spineOverride', $event || null)" placeholder="auto" /></label>
            <label class="field">Largeur totale (in)<input type="number" step="0.001" [ngModel]="b.format.coverSizeOverride?.w" (ngModelChange)="setCoverSize('w', $event)" placeholder="auto" /></label>
            <label class="field">Hauteur totale (in)<input type="number" step="0.001" [ngModel]="b.format.coverSizeOverride?.h" (ngModelChange)="setCoverSize('h', $event)" placeholder="auto" /></label>
          </div>
        </div>

        <div class="stack">
          <div class="card">
            <h2>Calculs</h2>
            @if (store.coverGeo(); as g) {
              <table class="data">
                <tr><td>Nombre de pages</td><td><b>{{ store.pages() }}</b>&nbsp;@if (range(); as r) { <span class="muted">(autorisé : {{ r[0] }} – {{ r[1] }})</span> } @else { <span class="badge err">combinaison indisponible</span> }</td></tr>
                <tr><td>Épaisseur du dos</td><td><b>{{ g.spineIn | number: '1.3-4' }} in</b> ({{ g.spineIn * 25.4 | number: '1.1-2' }} mm) @if (g.estimated) { <span class="badge warn">estimée</span> }</td></tr>
                <tr><td>Couverture complète</td><td><b>{{ g.widthIn | number: '1.3-3' }} × {{ g.heightIn | number: '1.3-3' }} in</b> ({{ g.widthIn * 25.4 | number: '1.1-1' }} × {{ g.heightIn * 25.4 | number: '1.1-1' }} mm)</td></tr>
                <tr><td>Texte sur le dos</td><td>@if (g.spineTextAllowed) { <span class="badge ok">autorisé</span> } @else { <span class="badge warn">interdit (&lt; {{ cover.spineTextMinPages }} pages)</span> }</td></tr>
                <tr><td>Marge intérieure minimale</td><td>{{ gutter() }} in · marges extérieures ≥ {{ b.format.bleed ? interior.minOutsideBleed : interior.minOutsideNoBleed }} in</td></tr>
                <tr><td>Page intérieure PDF</td><td>{{ pageSize() }}</td></tr>
              </table>
            }
          </div>
          @if (store.royalty(); as r) {
            <div class="card">
              <h2>Prix & redevance (estimation)</h2>
              <div class="grid-2">
                <label class="field">Prix public ({{ r.currency }})<input type="number" step="0.01" [ngModel]="b.metadata.price" (ngModelChange)="setPrice($event)" /></label>
                <div class="stack small">
                  <div>Coût d'impression : <b>{{ r.printCost | number: '1.2-2' }} {{ r.currency }}</b></div>
                  <div>Taux : <b>{{ r.rate * 100 }} %</b> @if (r.rate < 0.6) { &nbsp;<span class="muted">(60 % dès {{ r.highRatePrice }})</span> }</div>
                  <div>Redevance par vente : <b [style.color]="r.royalty > 0 ? 'var(--ok)' : 'var(--err)'">{{ r.royalty | number: '1.2-2' }} {{ r.currency }}</b></div>
                  <div class="muted">Prix minimum ≈ {{ r.minPrice | number: '1.2-2' }} {{ r.currency }}</div>
                </div>
              </div>
              <p class="small muted" style="margin-bottom: 0">Marketplace {{ b.metadata.marketplace }} — redevance calculée hors TVA en Europe. Barème KDP relevé le 14/10/2026 : à revérifier dans KDP avant publication.</p>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class FormatTab {
  store = inject(BookStore);
  api = inject(Api);
  inks = INKS;
  cover = COVER;
  interior = INTERIOR;
  calculator = COVER.calculatorUrl;
  trims = computed(() => TRIM_SIZES.filter((t) => t.bindings.includes(this.store.book()?.format.binding ?? 'paperback')));
  range = computed(() => {
    const f = this.store.book()?.format;
    return f ? pageRange(f.trimId, f.ink, f.binding) : null;
  });
  gutter = computed(() => minGutter(this.store.pages()));
  pageSize = computed(() => {
    const b = this.store.book();
    if (!b) return '';
    const t = TRIM_SIZES.find((x) => x.id === b.format.trimId)!;
    const w = t.w + (b.format.bleed ? 0.125 : 0);
    const h = t.h + (b.format.bleed ? 0.25 : 0);
    return `${w.toFixed(3)} × ${h.toFixed(3)} in${b.format.bleed ? ' (avec fond perdu)' : ''}`;
  });

  available(ink: InkPaper) {
    const f = this.store.book()!.format;
    return !!pageRange(f.trimId, ink, f.binding);
  }

  set<K extends 'trimId' | 'ink' | 'bleed' | 'finish' | 'spineOverride'>(key: K, value: unknown) {
    this.store.update((b) => ((b.format as unknown as Record<string, unknown>)[key] = value));
  }

  setBinding(binding: Binding) {
    this.store.update((b) => {
      b.format.binding = binding;
      const ok = TRIM_SIZES.find((t) => t.id === b.format.trimId)?.bindings.includes(binding);
      if (!ok) b.format.trimId = '6x9';
      if (binding === 'hardcover' && b.format.ink === 'std-color') b.format.ink = 'premium-color';
      if (binding === 'hardcover' && b.format.ink === 'bw-groundwood') b.format.ink = 'bw-white';
    });
  }

  setCoverSize(k: 'w' | 'h', v: number | null) {
    this.store.update((b) => {
      const cur = b.format.coverSizeOverride ?? { w: 0, h: 0 };
      cur[k] = Number(v) || 0;
      b.format.coverSizeOverride = cur.w || cur.h ? cur : null;
    });
  }

  setPrice(v: number) {
    this.store.update((b) => (b.metadata.price = Number(v) || 0));
  }
}
