import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { applyPalette, applyStyle, contrastRatio, COVER_STYLES, coverTexts, FONTS, PALETTES, PATTERNS, renderCover, type Palette } from '@shared';
import { Api } from '../../core/api';
import { SvgView } from '../../ui/svg-view';
import { BookStore } from './book-store';

type TextKey = 'title' | 'subtitle' | 'author' | 'back';

@Component({
  selector: 'app-cover-tab',
  imports: [FormsModule, SvgView, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.book(); as b) {
      @let c = b.cover;
      <div class="split">
        <div class="side stack">
          <div class="card">
            <h3>Style de départ</h3>
            <div class="styles">
              @for (s of styles; track s.id) { <button class="chip" (click)="style(s.id)" [title]="s.description">{{ s.name }}</button> }
            </div>
            <h3 style="margin-top: 14px">Palette</h3>
            <div class="swatches">
              @for (p of palettes; track p.id) {
                <button class="sw" [title]="p.name" (click)="palette(p)"><span [style.background]="p.bg"></span><span [style.background]="p.block"></span><span [style.background]="p.light"></span></button>
              }
            </div>
          </div>

          <div class="card">
            <h3>Textes de couverture</h3>
            <p class="small muted" style="margin-top: 0">Laissez vide pour reprendre la fiche KDP : le titre et l'auteur doivent correspondre à ceux saisis dans KDP.</p>
            <div class="stack">
              <label class="field">Titre<input type="text" [ngModel]="c.texts.title" (ngModelChange)="set('texts.title', $event)" [placeholder]="b.metadata.title || 'Titre de la fiche KDP'" /></label>
              <label class="field">Sous-titre<input type="text" [ngModel]="c.texts.subtitle" (ngModelChange)="set('texts.subtitle', $event)" [placeholder]="b.metadata.subtitle || '(aucun)'" /></label>
              <label class="field">Auteur / marque<input type="text" [ngModel]="c.texts.author" (ngModelChange)="set('texts.author', $event)" [placeholder]="b.metadata.author || 'Auteur de la fiche KDP'" /></label>
              <div class="row">
                <label class="check"><input type="checkbox" [ngModel]="c.subtitle.show" (ngModelChange)="set('subtitle.show', $event)" /> Afficher le sous-titre</label>
                <label class="check"><input type="checkbox" [ngModel]="c.author.show" (ngModelChange)="set('author.show', $event)" /> Afficher l'auteur</label>
                <select [ngModel]="c.author.position" (ngModelChange)="set('author.position', $event)" style="width: 110px"><option value="bottom">en bas</option><option value="top">en haut</option></select>
              </div>
            </div>
          </div>

          <div class="card">
            <h3>Fond</h3>
            <div class="row">
              <select [ngModel]="c.background.type" (ngModelChange)="set('background.type', $event)" style="width: 130px">
                <option value="solid">Uni</option><option value="gradient">Dégradé</option><option value="image">Image</option>
              </select>
              <input type="color" [ngModel]="c.background.color" (ngModelChange)="set('background.color', $event)" />
              @if (c.background.type === 'gradient') {
                <input type="color" [ngModel]="c.background.color2" (ngModelChange)="set('background.color2', $event)" />
                <label class="field" style="flex: 1">Angle {{ c.background.gradientAngle }}°<input type="range" min="0" max="360" step="15" [ngModel]="c.background.gradientAngle" (ngModelChange)="set('background.gradientAngle', +$event)" /></label>
              }
              @if (c.background.type === 'image') {
                <label class="btn sm">Choisir une image<input type="file" accept="image/png,image/jpeg" hidden (change)="upload($event, 'background.imageId')" /></label>
              }
            </div>
            @if (c.background.type === 'image') { <p class="small muted">Image pleine page (4e + dos + 1re) : {{ needPx() }} px minimum pour 300 DPI.</p> }

            <h3 style="margin-top: 14px">Motif</h3>
            <div class="row">
              <select [ngModel]="c.pattern.id" (ngModelChange)="set('pattern.id', $event)" style="width: 170px">@for (p of patterns; track p.id) { <option [value]="p.id">{{ p.label }}</option> }</select>
              <input type="color" [ngModel]="c.pattern.color" (ngModelChange)="set('pattern.color', $event)" />
              <label class="check small"><input type="checkbox" [ngModel]="c.pattern.frontOnly" (ngModelChange)="set('pattern.frontOnly', $event)" /> 1re de couv. seulement</label>
            </div>
            @if (c.pattern.id !== 'none') {
              <div class="grid-2" style="margin-top: 6px">
                <label class="field">Échelle {{ c.pattern.scale | number: '1.1-1' }}<input type="range" min="0.4" max="3" step="0.1" [ngModel]="c.pattern.scale" (ngModelChange)="set('pattern.scale', +$event)" /></label>
                <label class="field">Intensité {{ c.pattern.opacity * 100 | number: '1.0-0' }} %<input type="range" min="0.05" max="1" step="0.05" [ngModel]="c.pattern.opacity" (ngModelChange)="set('pattern.opacity', +$event)" /></label>
              </div>
            }
            <div class="row" style="margin-top: 8px">
              <label class="check"><input type="checkbox" [ngModel]="c.stitch.show" (ngModelChange)="set('stitch.show', $event)" /> Surpiqûre (effet carnet cuir)</label>
              <input type="color" [ngModel]="c.stitch.color" (ngModelChange)="set('stitch.color', $event)" />
            </div>
          </div>

          <div class="card">
            <h3>Bloc titre</h3>
            <div class="row">
              <select [ngModel]="c.titleBlock.style" (ngModelChange)="set('titleBlock.style', $event)" style="width: 160px">
                <option value="label">Étiquette</option><option value="band">Bandeau</option><option value="frame">Cadre</option><option value="circle">Médaillon</option><option value="plain">Texte seul</option>
              </select>
              <span class="small">Fond</span><input type="color" [ngModel]="c.titleBlock.fill" (ngModelChange)="set('titleBlock.fill', $event)" />
              <span class="small">Bordure</span><input type="color" [ngModel]="c.titleBlock.border" (ngModelChange)="set('titleBlock.border', $event)" />
            </div>
            <div class="grid-2" style="margin-top: 6px">
              <label class="field">Position verticale<input type="range" min="0.1" max="0.9" step="0.01" [ngModel]="c.titleBlock.position" (ngModelChange)="set('titleBlock.position', +$event)" /></label>
              <label class="field">Largeur<input type="range" min="0.4" max="1" step="0.02" [ngModel]="c.titleBlock.width" (ngModelChange)="set('titleBlock.width', +$event)" /></label>
            </div>
            @if (contrast() < 3) { <div class="issue warning">Contraste faible entre le titre et son fond ({{ contrast() | number: '1.1-1' }}:1) : illisible en vignette.</div> }

            <h3 style="margin-top: 14px">Typographie</h3>
            @for (k of textKeys; track k[0]) {
              @let s = c[k[0]];
              <div class="typo">
                <b class="small">{{ k[1] }}</b>
                <select [ngModel]="s.font" (ngModelChange)="set(k[0] + '.font', $event)">@for (f of fonts; track f.family) { <option [value]="f.family">{{ f.family }}</option> }</select>
                <input type="number" min="6" max="120" [ngModel]="s.size" (ngModelChange)="set(k[0] + '.size', +$event)" title="Taille (pt)" />
                <select [ngModel]="s.weight" (ngModelChange)="set(k[0] + '.weight', +$event)" title="Graisse">
                  <option [ngValue]="400">Normal</option><option [ngValue]="600">Demi-gras</option><option [ngValue]="700">Gras</option><option [ngValue]="800">Extra-gras</option><option [ngValue]="900">Black</option>
                </select>
                <input type="color" [ngModel]="s.color" (ngModelChange)="set(k[0] + '.color', $event)" />
                <label class="check small" title="Capitales"><input type="checkbox" [ngModel]="!!s.uppercase" (ngModelChange)="set(k[0] + '.uppercase', $event)" />AA</label>
              </div>
            }
          </div>

          <div class="card">
            <h3>Dos</h3>
            @if (!store.coverGeo()?.spineTextAllowed) { <div class="issue info">Moins de 80 pages : KDP interdit le texte sur le dos (il est masqué automatiquement).</div> }
            <div class="row" style="margin-top: 6px">
              <label class="check"><input type="checkbox" [ngModel]="c.spine.show" (ngModelChange)="set('spine.show', $event)" /> Texte sur le dos</label>
              <select [ngModel]="c.spine.direction" (ngModelChange)="set('spine.direction', $event)" style="width: 190px">
                <option value="top-bottom">Haut → bas (usage US/KDP)</option><option value="bottom-top">Bas → haut (usage FR)</option>
              </select>
            </div>
            <div class="row" style="margin-top: 6px">
              <input type="text" [ngModel]="c.spine.text" (ngModelChange)="set('spine.text', $event)" [placeholder]="texts().spine" style="flex: 1" />
              <input type="number" min="5" max="30" [ngModel]="c.spine.size" (ngModelChange)="set('spine.size', +$event)" style="width: 64px" title="Taille max (pt)" />
              <input type="color" [ngModel]="c.spine.color" (ngModelChange)="set('spine.color', $event)" />
              <label class="check small"><input type="checkbox" [ngModel]="!!c.spine.background" (ngModelChange)="set('spine.background', $event ? '#000000' : null)" /> Fond</label>
              @if (c.spine.background) { <input type="color" [ngModel]="c.spine.background" (ngModelChange)="set('spine.background', $event)" /> }
            </div>
          </div>

          <div class="card">
            <h3>4e de couverture</h3>
            <label class="check"><input type="checkbox" [ngModel]="c.back.show" (ngModelChange)="set('back.show', $event)" /> Afficher un texte au dos</label>
            @if (c.back.show) {
              <textarea style="margin-top: 6px" rows="4" [ngModel]="c.texts.back" (ngModelChange)="set('texts.back', $event)" placeholder="Accroche courte, sans prix ni avis clients. La zone code-barres (en bas à droite) reste libre."></textarea>
              <div class="row" style="margin-top: 6px">
                <select [ngModel]="c.back.align" (ngModelChange)="set('back.align', $event)" style="width: 120px"><option value="left">À gauche</option><option value="center">Centré</option></select>
              </div>
            }
          </div>

          <div class="card">
            <h3>Illustration (1re de couverture)</h3>
            <div class="row">
              <label class="btn sm">{{ c.frontImage.imageId ? 'Remplacer' : 'Ajouter' }} une image<input type="file" accept="image/png,image/jpeg" hidden (change)="upload($event, 'frontImage.imageId')" /></label>
              @if (c.frontImage.imageId) {
                <button class="btn sm ghost danger" (click)="set('frontImage.imageId', null)">Retirer</button>
                <select [ngModel]="c.frontImage.fit" (ngModelChange)="set('frontImage.fit', $event)" style="width: 140px"><option value="contain">Contenir</option><option value="cover">Remplir (rogner)</option></select>
              }
            </div>
            @if (c.frontImage.imageId) {
              <div class="grid-2" style="margin-top: 6px">
                @for (k of imgKeys; track k[0]) {
                  <label class="field">{{ k[1] }}<input type="range" min="0" max="1" step="0.01" [ngModel]="c.frontImage[k[0]]" (ngModelChange)="set('frontImage.' + k[0], +$event)" /></label>
                }
              </div>
            }
            <p class="small muted">PNG ou JPEG uniquement. Si l'image est générée par IA, cochez la déclaration IA dans la fiche KDP.</p>
          </div>

          <div class="card">
            <h3>Gabarit officiel KDP (calque de contrôle)</h3>
            <p class="small muted" style="margin-top: 0">Téléchargez le modèle PNG sur <a [href]="calculatorUrl" target="_blank" rel="noopener">le calculateur KDP</a> puis importez-le ici : il se superpose à l'aperçu pour vérifier dos et marges. Il n'est jamais imprimé.</p>
            <div class="row">
              <label class="btn sm">Importer le gabarit<input type="file" accept="image/png,image/jpeg" hidden (change)="upload($event, 'overlay.imageId')" /></label>
              @if (c.overlay.imageId) {
                <label class="check small"><input type="checkbox" [ngModel]="c.overlay.show" (ngModelChange)="set('overlay.show', $event)" /> Afficher</label>
                <label class="field" style="flex: 1">Opacité<input type="range" min="0.1" max="1" step="0.05" [ngModel]="c.overlay.opacity" (ngModelChange)="set('overlay.opacity', +$event)" /></label>
                <button class="btn sm ghost danger" (click)="set('overlay.imageId', null)">Retirer</button>
              }
            </div>
            <a class="btn sm" style="margin-top: 8px" [href]="templateUrl()">⬇ Gabarit généré par l'app (PDF)</a>
          </div>
        </div>

        <div class="preview card">
          @if (rendered(); as r) {
            <div class="row">
              <h3 style="margin: 0">Couverture complète</h3>
              <span class="muted small">{{ r.geo.widthIn | number: '1.3-3' }} × {{ r.geo.heightIn | number: '1.3-3' }} in · dos {{ r.geo.spineIn | number: '1.3-3' }} in</span>
              <span class="spacer"></span>
              <label class="check small"><input type="checkbox" [ngModel]="guides()" (ngModelChange)="guides.set($event)" /> Repères KDP</label>
            </div>
            <div class="stage"><div class="paper"><app-svg [prims]="r.prims" [width]="r.geo.width" [height]="r.geo.height" [guides]="guides()" /></div></div>
            <div class="legend small muted"><span class="l red"></span>Fond perdu (coupé) <span class="l blue"></span>Zone de sécurité du texte <span class="l orange"></span>Code-barres KDP</div>
            <div class="thumbs">
              <div>
                <div class="section-title">Vignette Amazon (≈ 160 px)</div>
                <div class="paper" style="width: 110px"><app-svg [prims]="r.prims" [width]="r.geo.width" [height]="r.geo.height" [guides]="false" [viewBox]="r.geo.front" /></div>
              </div>
              <div>
                <div class="section-title">Page produit</div>
                <div class="paper" style="width: 230px"><app-svg [prims]="r.prims" [width]="r.geo.width" [height]="r.geo.height" [guides]="false" [viewBox]="r.geo.front" /></div>
              </div>
              <div class="stack small" style="max-width: 280px">
                <div class="section-title">Exports</div>
                <a class="btn primary" [href]="api.coverUrl(b.id, { download: true })" (click)="store.flush()">⬇ PDF couverture (KDP)</a>
                <a class="btn" [href]="api.coverUrl(b.id, { guides: true })" target="_blank" (click)="store.flush()">Aperçu PDF avec repères</a>
                <p class="muted">Le titre doit rester lisible sur la petite vignette : c'est elle qui fait cliquer dans les résultats de recherche.</p>
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .split { display: grid; grid-template-columns: minmax(360px, 460px) minmax(0, 1fr); gap: 16px; align-items: start; }
    .side { gap: 12px; }
    .styles { display: flex; flex-wrap: wrap; gap: 6px; }
    .swatches { display: flex; flex-wrap: wrap; gap: 6px; }
    .sw { display: flex; border: 1px solid var(--line-2); border-radius: 7px; overflow: hidden; padding: 0; cursor: pointer; height: 26px; }
    .sw span { width: 14px; }
    .sw:hover { box-shadow: 0 0 0 2px var(--accent); }
    .typo { display: grid; grid-template-columns: 74px 1fr 58px 104px 38px 44px; gap: 4px; align-items: center; margin-bottom: 4px; }
    .preview { position: sticky; top: 12px; }
    .stage { background: #e9ecf3; border-radius: 8px; padding: 18px; margin-top: 10px; }
    .legend { margin-top: 8px; display: flex; gap: 10px; align-items: center; }
    .l { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: -6px; }
    .l.red { background: #ff6b6b; } .l.blue { border: 2px dashed #4c6ef5; } .l.orange { border: 2px solid #e8590c; }
    .thumbs { display: flex; gap: 22px; align-items: flex-start; margin-top: 10px; flex-wrap: wrap; }
    @media (max-width: 1100px) { .split { grid-template-columns: 1fr; } .preview { position: static; } }
  `,
})
export class CoverTab {
  store = inject(BookStore);
  api = inject(Api);
  guides = signal(true);
  styles = COVER_STYLES;
  palettes = PALETTES;
  patterns = PATTERNS;
  fonts = FONTS;
  calculatorUrl = 'https://kdp.amazon.com/cover-calculator';
  textKeys: [TextKey, string][] = [['title', 'Titre'], ['subtitle', 'Sous-titre'], ['author', 'Auteur'], ['back', '4e de couv.']];
  imgKeys: ['x' | 'y' | 'w' | 'h', string][] = [['x', 'Gauche'], ['y', 'Haut'], ['w', 'Largeur'], ['h', 'Hauteur']];

  rendered = computed(() => (this.store.book() ? renderCover(this.store.book()!, this.store.pages(), { guides: true, overlay: true }) : null));
  texts = computed(() => coverTexts(this.store.book()!));
  contrast = computed(() => {
    const c = this.store.book()!.cover;
    const bg = ['label', 'band', 'circle'].includes(c.titleBlock.style) ? c.titleBlock.fill : c.background.color;
    return contrastRatio(c.title.color, bg);
  });
  needPx = computed(() => {
    const g = this.store.coverGeo();
    return g ? `${Math.ceil(g.widthIn * 300)} × ${Math.ceil(g.heightIn * 300)}` : '';
  });
  templateUrl = computed(() => {
    const b = this.store.book()!;
    return this.api.templateUrl({ ...b.format }, this.store.pages());
  });

  set(path: string, value: unknown) {
    this.store.update((b) => {
      const keys = path.split('.');
      let o = b.cover as unknown as Record<string, unknown>;
      for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
      o[keys[keys.length - 1]] = value;
    });
  }

  style(id: string) {
    this.store.update((b) => (b.cover = applyStyle(b.cover, id)));
  }

  palette(p: Palette) {
    this.store.update((b) => (b.cover = applyPalette(b.cover, p)));
  }

  async upload(ev: Event, path: string) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const a = await this.store.upload(file);
    input.value = '';
    this.set(path, a.id);
    if (path === 'background.imageId') this.set('background.type', 'image');
  }
}
