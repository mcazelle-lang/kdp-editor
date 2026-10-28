import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { COVER, INKS, INTERIOR, pageRange, renderCoverTemplate, SPECS_CHECKED_ON, TRIM_SIZES, type Binding, type BookFormat, type InkPaper } from '@shared';
import { Api } from '../../core/api';
import { SvgView } from '../../ui/svg-view';

@Component({
  selector: 'app-formats-page',
  imports: [FormsModule, DecimalPipe, SvgView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head"><h1>Formats & gabarits de couverture</h1><span class="badge">specs KDP du {{ checkedOn }}</span></div>

      <div class="split">
        <div class="card">
          <h2>Calculateur de couverture</h2>
          <div class="grid-2">
            <label class="field">Reliure
              <select [ngModel]="binding()" (ngModelChange)="binding.set($event)"><option value="paperback">Broché</option><option value="hardcover">Rigide</option></select>
            </label>
            <label class="field">Format
              <select [ngModel]="trimId()" (ngModelChange)="trimId.set($event)">@for (t of trims(); track t.id) { <option [value]="t.id">{{ t.label }} ({{ t.cm }})</option> }</select>
            </label>
            <label class="field">Papier / encre
              <select [ngModel]="ink()" (ngModelChange)="ink.set($event)">@for (i of inks; track i.id) { <option [value]="i.id">{{ i.label }}</option> }</select>
            </label>
            <label class="field">Nombre de pages<input type="number" min="24" max="828" step="2" [ngModel]="pages()" (ngModelChange)="pages.set(+$event)" /></label>
          </div>
          @if (!range()) { <div class="issue error" style="margin-top: 10px">Cette combinaison format / papier n'existe pas chez KDP.</div> }
          @else if (pages() < range()![0] || pages() > range()![1]) { <div class="issue error" style="margin-top: 10px">Ce format accepte {{ range()![0] }} à {{ range()![1] }} pages.</div> }
          @let g = tpl().geo;
          <table class="data" style="margin-top: 12px">
            <tr><td>Couverture complète</td><td><b>{{ g.widthIn | number: '1.3-3' }} × {{ g.heightIn | number: '1.3-3' }} in</b> — {{ g.widthIn * 25.4 | number: '1.1-1' }} × {{ g.heightIn * 25.4 | number: '1.1-1' }} mm</td></tr>
            <tr><td>Dos</td><td><b>{{ g.spineIn | number: '1.4-4' }} in</b> ({{ g.spineIn * 25.4 | number: '1.2-2' }} mm) @if (g.estimated) { <span class="badge warn">estimation : vérifier sur KDP</span> }</td></tr>
            <tr><td>Texte sur le dos</td><td>{{ g.spineTextAllowed ? 'autorisé' : 'interdit (moins de 80 pages)' }}</td></tr>
            <tr><td>Image pleine couverture à 300 DPI</td><td>{{ g.widthIn * 300 | number: '1.0-0' }} × {{ g.heightIn * 300 | number: '1.0-0' }} px</td></tr>
          </table>
          <div class="row" style="margin-top: 12px">
            <a class="btn primary" [href]="api.templateUrl(format(), pages())">⬇ Gabarit PDF</a>
            <a class="btn" [href]="api.templateUrl(format(), pages(), false)" target="_blank">Ouvrir</a>
            <a class="btn ghost" [href]="calculator" target="_blank" rel="noopener">Calculateur officiel KDP ↗</a>
          </div>
        </div>
        <div class="card">
          <div class="stage"><div class="paper"><app-svg [prims]="tpl().prims" [width]="g.width" [height]="g.height" /></div></div>
        </div>
      </div>

      <div class="card" style="margin-top: 16px">
        <h2>Formats de coupe KDP</h2>
        <table class="data">
          <thead><tr><th>Format</th><th>cm</th><th>Reliure</th><th>N&B blanc</th><th>N&B crème</th><th>Groundwood</th><th>Couleur std</th><th>Couleur premium</th><th>Usage</th></tr></thead>
          <tbody>
            @for (t of allTrims; track t.id) {
              <tr>
                <td><b>{{ t.label }}</b> @if (t.large) { <span class="badge">grand</span> }</td>
                <td>{{ t.cm }}</td>
                <td>{{ t.bindings.includes('paperback') ? 'broché' : '' }}{{ t.bindings.length > 1 ? ' + ' : '' }}{{ t.bindings.includes('hardcover') ? 'rigide' : '' }}</td>
                @for (i of inks; track i.id) { <td class="small">{{ rangeLabel(t.id, i.id) }}</td> }
                <td class="small muted">{{ t.note }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="grid-2" style="margin-top: 16px">
        <div class="card">
          <h2>Intérieur : marges</h2>
          <table class="data">
            <thead><tr><th>Nombre de pages</th><th>Marge intérieure min.</th></tr></thead>
            @for (g of gutters; track g.max; let i = $index) { <tr><td>{{ i === 0 ? 24 : gutters[i - 1].max + 1 }} – {{ g.max }}</td><td>{{ g.inside }} in ({{ g.inside * 25.4 | number: '1.1-1' }} mm)</td></tr> }
          </table>
          <p class="small">Marges extérieures, haute et basse : ≥ {{ interior.minOutsideNoBleed }} in sans fond perdu, ≥ {{ interior.minOutsideBleed }} in avec fond perdu.
            Page avec fond perdu = coupe + 0,125 in en largeur et + 0,25 in en hauteur. Traits ≥ {{ interior.minLineWeightPt }} pt, gris ≥ {{ interior.minGrayPercent }} %, texte ≥ {{ interior.minFontSizePt }} pt, images ≥ 300 DPI, polices embarquées.</p>
        </div>
        <div class="card">
          <h2>Couverture : règles</h2>
          <ul class="small rules">
            <li>Largeur = 0,125 + 4e de couv. + dos + 1re de couv. + 0,125 in ; hauteur = coupe + 0,25 in.</li>
            <li>Dos par page : N&B blanc 0,002252 in · crème 0,0025 in · groundwood 0,00235 in · couleur standard 0,002252 in · couleur premium 0,002347 in.</li>
            <li>Texte sur le dos uniquement à partir de {{ cover.spineTextMinPages }} pages, à {{ cover.spineMargin }} in des bords du dos.</li>
            <li>Texte à au moins 0,125 in de la coupe (0,25 in recommandé).</li>
            <li>Zone code-barres : {{ cover.barcode.w }} × {{ cover.barcode.h }} in en bas à droite de la 4e de couverture, à 0,25 in du dos et du bas, à laisser vide.</li>
            <li>Rigide : rabat de {{ cover.hardcover.wrap }} in, charnière de {{ cover.hardcover.hinge }} in de chaque côté du dos. Épaisseur du dos à reprendre du calculateur KDP.</li>
            <li>PDF d'une seule page, ≤ {{ cover.maxPdfMb }} Mo, images ≥ 300 DPI.</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: `
    .split { display: grid; grid-template-columns: minmax(360px, 480px) minmax(0, 1fr); gap: 16px; align-items: start; }
    .stage { background: #e9ecf3; border-radius: 8px; padding: 18px; }
    .rules { padding-left: 18px; line-height: 1.6; margin: 0; }
    @media (max-width: 1100px) { .split { grid-template-columns: 1fr; } }
  `,
})
export class FormatsPage {
  api = inject(Api);
  checkedOn = SPECS_CHECKED_ON.split('-').reverse().join('/');
  inks = INKS;
  interior = INTERIOR;
  cover = COVER;
  calculator = COVER.calculatorUrl;
  gutters = INTERIOR.gutter;
  allTrims = TRIM_SIZES;
  binding = signal<Binding>('paperback');
  trimId = signal('6x9');
  ink = signal<InkPaper>('bw-white');
  pages = signal(120);
  trims = computed(() => TRIM_SIZES.filter((t) => t.bindings.includes(this.binding())));
  format = computed<BookFormat>(() => ({ binding: this.binding(), trimId: this.trimId(), ink: this.ink(), bleed: true, finish: 'matte' }));
  range = computed(() => pageRange(this.trimId(), this.ink(), this.binding()));
  tpl = computed(() => renderCoverTemplate(this.format(), Math.max(24, this.pages() || 24)));

  rangeLabel(trimId: string, ink: InkPaper) {
    const t = TRIM_SIZES.find((x) => x.id === trimId)!;
    const r = t.pages[ink] ?? (t.bindings.includes('hardcover') && !t.bindings.includes('paperback') ? t.hardcoverPages?.[ink] : undefined);
    return r ? `${r[0]}–${r[1]}` : '—';
  }
}
