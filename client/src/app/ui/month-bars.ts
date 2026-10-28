import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface MonthBar {
  month: string;
  value: number;
}

const SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const short = (m: string) => `${SHORT[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;

/**
 * Colonnes par mois de rapport importé (une seule série, bleue). Les mois ne sont pas forcément consécutifs :
 * chaque colonne porte son mois. `mini` : version compacte sans libellés, pour une ligne de tableau.
 */
@Component({
  selector: 'app-month-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart" [class.mini]="mini()" role="img" [attr.aria-label]="aria()">
      @for (b of bars(); track b.month) {
        <div class="col" tabindex="0">
          @if (!mini()) { <span class="val">{{ b.text }}</span> }
          <span class="bar" [style.height.%]="b.h" [class.zero]="!b.value"></span>
          @if (!mini()) { <span class="lab">{{ b.mon }}<br />{{ b.yy }}</span> }
          <span class="tip">{{ b.label }} : {{ b.text }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    .chart { display: flex; align-items: flex-end; gap: 4px; height: 150px; padding-top: 4px; }
    .chart.mini { height: 30px; gap: 2px; width: 132px; }
    .col { position: relative; flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; outline: none; }
    .bar { width: 100%; max-width: 26px; background: var(--blue); border-radius: 4px 4px 0 0; min-height: 1px; }
    .mini .bar { border-radius: 2px 2px 0 0; }
    .bar.zero { background: var(--line-2); }
    .val { font-size: 11px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; margin-bottom: 2px; white-space: nowrap; }
    .lab { font-size: 10.5px; line-height: 1.2; text-align: center; color: var(--muted); margin-top: 4px; white-space: nowrap; }
    .tip { display: none; position: absolute; bottom: calc(100% + 4px); left: 50%; transform: translateX(-50%); z-index: 5; background: var(--ink); color: #fff; font-size: 12px; padding: 4px 8px; border-radius: 6px; white-space: nowrap; box-shadow: var(--shadow); }
    .col:hover .tip, .col:focus .tip { display: block; }
    .col:hover .bar, .col:focus .bar { filter: brightness(0.9); }
  `,
})
export class MonthBars {
  data = input.required<MonthBar[]>();
  format = input<(v: number) => string>((v) => v.toLocaleString('fr-FR'));
  mini = input(false);
  label = input('');
  bars = computed(() => {
    const max = Math.max(1, ...this.data().map((d) => d.value));
    // Hauteur réservée aux libellés dans la version complète
    const room = this.mini() ? 100 : 66;
    return this.data().map((d) => ({
      ...d, label: short(d.month), mon: SHORT[Number(d.month.slice(5, 7)) - 1], yy: d.month.slice(0, 4),
      text: this.format()(d.value), h: Math.max(d.value > 0 ? 3 : 1, (d.value / max) * room),
    }));
  });
  aria = computed(() => `${this.label()} ${this.bars().map((b) => `${b.label} ${b.text}`).join(', ')}`);
}
