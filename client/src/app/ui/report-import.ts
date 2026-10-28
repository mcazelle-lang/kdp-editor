import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, type KdpReportImport } from '../core/api';

/** Import des rapports de redevances KDP (.xlsx) : depuis le dossier du projet ou par téléversement. */
@Component({
  selector: 'app-report-import',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card imp">
      <div>
        <h3 style="margin: 0 0 4px">Rapports de ventes KDP (.xlsx)</h3>
        <p class="small muted" style="margin: 0">Dans KDP › Rapports, exporte les « Redevances du mois précédent » (un fichier par mois). Un mois réimporté remplace le précédent.</p>
      </div>
      <div class="row">
        @if (local().length) {
          <button class="btn primary" [disabled]="busy()" (click)="importLocal()">Importer les {{ local().length }} fichiers du dossier</button>
        }
        <label class="btn" [class.primary]="!local().length">
          Choisir des fichiers…
          <input type="file" accept=".xlsx" multiple hidden (change)="upload($event)" [disabled]="busy()" />
        </label>
        <label class="check small"><input type="checkbox" [(ngModel)]="createBooks" /> Créer les carnets publiés dans « Mes carnets »</label>
      </div>
      @if (busy()) { <div class="small muted">Import en cours…</div> }
      @if (result(); as r) {
        <div class="issue info">
          {{ r.months.length }} mois de ventes au total · {{ r.titles.total }} titres vus dans les rapports ({{ r.titles.added }} nouveaux au catalogue)
          @if (r.books) { · {{ r.books }} carnet(s) publié(s) créé(s) }
        </div>
        @for (f of errors(); track f.file) { <div class="issue error">{{ f.file }} : {{ f.error }}</div> }
      }
      @if (error()) { <div class="issue error">{{ error() }}</div> }
    </div>
  `,
  styles: `
    .imp { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
    .check { display: inline-flex; gap: 6px; align-items: center; }
  `,
})
export class ReportImport {
  private api = inject(Api);
  imported = output<KdpReportImport>();
  local = signal<string[]>([]);
  busy = signal(false);
  result = signal<KdpReportImport | null>(null);
  error = signal('');
  createBooks = true;
  errors = () => (this.result()?.files ?? []).filter((f) => f.error);

  constructor() {
    this.api.kdpReportsLocal().then((r) => this.local.set(r.files)).catch(() => this.local.set([]));
  }

  importLocal() {
    return this.run(() => this.api.kdpImportLocalReports(this.createBooks));
  }

  upload(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (files.length) return this.run(() => this.api.kdpUploadReports(files, this.createBooks));
    return undefined;
  }

  private async run(fn: () => Promise<KdpReportImport>) {
    this.busy.set(true);
    this.error.set('');
    try {
      const r = await fn();
      this.result.set(r);
      this.imported.emit(r);
    } catch (e) {
      this.error.set((e as { error?: { error?: string } })?.error?.error ?? 'Import impossible : le serveur de l\'app est-il démarré ?');
    } finally {
      this.busy.set(false);
    }
  }
}
