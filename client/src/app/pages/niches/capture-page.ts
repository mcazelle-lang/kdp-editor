import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { findMarket, type KdpRawCapture, type RawCapture } from '@shared';
import { Api } from '../../core/api';
import { apiUrl } from '../../core/api-base';
import { AMAZON_ORIGIN, KDP_ORIGIN } from '../../core/bookmarklet';

interface Received {
  at: string;
  ok: boolean;
  message: string;
  source: string;
  kind: string;
}

/**
 * Page relais ouverte par le favori (onglet « bc-capture ») :
 * - reçoit les captures Amazon (radar de niches) et KDP (catalogue, ventes) et les enregistre ;
 * - répond aux demandes de remplissage d'un formulaire KDP avec le livre préparé et ses PDF.
 */
@Component({
  selector: 'app-capture-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <h1>Relais Book Creator</h1>
        <span class="spacer"></span>
        <a class="btn" routerLink="/niches">Radar de niches</a>
        <a class="btn" routerLink="/kdp">Compte KDP</a>
      </div>
      @if (!received().length) {
        <div class="card empty">
          <h2>En attente…</h2>
          <p>Laisse cet onglet ouvert. Clique sur le favori « Book Creator » depuis une page Amazon (recherche, fiche produit) ou KDP (Bibliothèque, Rapports, formulaire de création).</p>
        </div>
      }
      <div class="stack">
        @for (r of received(); track r.at) {
          <div class="card row">
            <span class="badge" [class.ok]="r.ok" [class.err]="!r.ok">{{ r.ok ? '✓' : '✗' }}</span>
            <span class="badge">{{ r.source }}</span>
            <span class="badge blue">{{ r.kind }}</span>
            <span>{{ r.message }}</span>
          </div>
        }
      </div>
      <p class="small muted" style="margin-top: 16px">Les données viennent des pages que tu as ouvertes ; rien n'est téléchargé en arrière-plan, aucun identifiant n'est demandé.</p>
    </div>
  `,
})
export class CapturePage implements OnDestroy {
  private api = inject(Api);
  received = signal<Received[]>([]);
  private seen = new Set<string>();
  private listener = (e: MessageEvent) => this.onMessage(e);

  constructor() {
    window.addEventListener('message', this.listener);
  }

  ngOnDestroy() {
    window.removeEventListener('message', this.listener);
  }

  private async onMessage(e: MessageEvent) {
    const fromAmazon = AMAZON_ORIGIN.test(e.origin);
    const fromKdp = e.origin === KDP_ORIGIN;
    if (!fromAmazon && !fromKdp) return;
    const source = e.source as Window | null;

    // Demande de remplissage depuis un formulaire KDP
    const fill = (e.data as { bookCreatorFillRequest?: string; files?: boolean }) ?? {};
    if (fromKdp && fill.bookCreatorFillRequest) {
      const nonce = fill.bookCreatorFillRequest;
      if (this.seen.has(`fill-${nonce}`)) return;
      this.seen.add(`fill-${nonce}`);
      try {
        const payload = await this.api.kdpPublishCurrent();
        const files: Record<string, ArrayBuffer> = {};
        if (fill.files) {
          for (const k of ['interior', 'cover'] as const) {
            const res = await fetch(apiUrl(payload.files[k]));
            if (res.ok) files[k] = await res.arrayBuffer();
          }
        }
        source?.postMessage({ nonce, bookCreatorFill: payload, files }, e.origin, Object.values(files));
        this.push({ at: nonce, ok: true, source: 'KDP', kind: 'remplissage', message: `« ${payload.title || 'Sans titre'} » envoyé au formulaire KDP${fill.files ? ' avec les PDF' : ''}. Vérifie la page KDP.` });
      } catch (err) {
        const message = (err as { error?: { error?: string } })?.error?.error ?? 'Aucun livre préparé.';
        source?.postMessage({ nonce, bookCreatorFillError: message }, e.origin);
        this.push({ at: nonce, ok: false, source: 'KDP', kind: 'remplissage', message });
      }
      return;
    }

    // Capture d'une page
    const raw = (e.data as { bookCreator?: RawCapture | KdpRawCapture })?.bookCreator;
    if (!raw || this.seen.has(raw.capturedAt)) return;
    this.seen.add(raw.capturedAt);
    source?.postMessage({ bookCreatorAck: raw.capturedAt }, e.origin);
    try {
      if (raw.kind === 'kdp') {
        const r = await this.api.kdpCapture(raw);
        this.push({ at: raw.capturedAt, ok: r.page !== 'autre', source: 'KDP', kind: r.page === 'bookshelf' ? 'bibliothèque' : r.page === 'reports' ? 'rapports' : 'page', message: r.message });
      } else {
        const r = await this.api.capture(raw);
        this.push({ at: raw.capturedAt, ok: true, source: findMarket(r.marketplace).label, kind: r.kind === 'serp' ? 'résultats' : 'fiche produit', message: r.message });
      }
    } catch (err) {
      const message = (err as { error?: { error?: string } })?.error?.error ?? (err instanceof Error ? err.message : 'Capture impossible');
      this.push({ at: raw.capturedAt, ok: false, source: fromKdp ? 'KDP' : e.origin.replace('https://www.', ''), kind: raw.kind, message });
    }
  }

  private push(r: Received) {
    this.received.update((list) => [r, ...list]);
  }
}
