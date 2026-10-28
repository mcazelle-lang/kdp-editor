import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { renderCover, totalPages, type Book } from '@shared';
import { SvgView } from './svg-view';

/** Vignette de la 1re de couverture (comme sur la page produit Amazon). */
@Component({
  selector: 'app-cover-thumb',
  imports: [SvgView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let r = rendered();
    <div class="thumb paper"><app-svg [prims]="r.prims" [width]="r.geo.width" [height]="r.geo.height" [guides]="false" [viewBox]="r.geo.front" /></div>
  `,
  styles: `.thumb { overflow: hidden; border-radius: 2px 6px 6px 2px; }`,
})
export class CoverThumb {
  book = input.required<Book>();
  rendered = computed(() => renderCover(this.book(), totalPages(this.book())));
}
