import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { primsToSvg, type Prim } from '@shared';
import { assetUrl } from '../core/api';

let seq = 0;

/** Affiche des primitives partagées en SVG (même géométrie que le PDF). */
@Component({
  selector: 'app-svg',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="svg-host" [class.hide-guides]="!guides()" [innerHTML]="html()"></div>`,
})
export class SvgView {
  private san = inject(DomSanitizer);
  private readonly prefix = `s${seq++}_`;
  prims = input.required<Prim[]>();
  width = input.required<number>();
  height = input.required<number>();
  guides = input(true);
  viewBox = input<{ x: number; y: number; w: number; h: number } | undefined>(undefined);

  html = computed(() =>
    this.san.bypassSecurityTrustHtml(
      primsToSvg(this.prims(), { width: this.width(), height: this.height(), resolveImage: assetUrl, idPrefix: this.prefix, viewBox: this.viewBox() }),
    ),
  );
}
