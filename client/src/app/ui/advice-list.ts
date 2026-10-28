import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ADVICE_LEVEL_LABELS, type Advice, type AdviceArea } from '@shared';

const AREA_LABELS: Record<AdviceArea, string> = {
  prix: 'Prix', tendance: 'Tendance', variantes: 'Variantes', fiche: 'Fiche', marches: 'Marchés', saison: 'Saison', publicite: 'Publicité', niche: 'Niche',
};

/** Conseils classés par priorité : le niveau est écrit en toutes lettres, pas seulement en couleur. */
@Component({
  selector: 'app-advice-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (a of shown(); track $index) {
      <div class="adv" [class]="a.level">
        <div class="head">
          <span class="badge" [class.err]="a.level === 'urgent'" [class.warn]="a.level === 'important'" [class.blue]="a.level === 'idee'">{{ levelLabel(a) }}</span>
          @if (showArea()) { <span class="area">{{ areaLabel(a) }}</span> }
          <b>{{ a.title }}</b>
        </div>
        @if (!compact()) { <div class="detail">{{ a.detail }}</div> }
      </div>
    } @empty {
      <div class="muted small">Aucun conseil particulier.</div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 6px; }
    .adv { border-left: 3px solid var(--line-2); padding: 4px 0 4px 10px; }
    .adv.urgent { border-left-color: var(--err); }
    .adv.important { border-left-color: var(--warn); }
    .adv.idee { border-left-color: var(--blue); }
    .head { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; font-size: 12.5px; color: var(--ink); }
    .area { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 700; }
    .detail { font-size: 12.5px; color: var(--ink-2); line-height: 1.45; margin-top: 2px; }
  `,
})
export class AdviceList {
  advice = input.required<Advice[]>();
  limit = input<number>(0);
  compact = input(false);
  showArea = input(true);
  shown = computed(() => (this.limit() ? this.advice().slice(0, this.limit()) : this.advice()));
  levelLabel = (a: Advice) => ADVICE_LEVEL_LABELS[a.level];
  areaLabel = (a: Advice) => AREA_LABELS[a.area];
}
