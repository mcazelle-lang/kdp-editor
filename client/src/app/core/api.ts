import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  AgentEvent, AgentRequest, AgentStatus, Asset, Book, BookFormat, CoverDesign, Idea, Lang, MarketId, Niche, NicheAgentEvent, NicheAnalyzeRequest,
  NicheDiscoverRequest, NicheStatus, RawCapture, Suggestion, KdpCaptureLog, KdpFillPayload, KdpRawCapture, KdpState, KdpTitle,
} from '@shared';
import { apiUrl } from './api-base';

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  private get = <T>(url: string) => firstValueFrom(this.http.get<T>(apiUrl(url)));
  private post = <T>(url: string, body: unknown = {}) => firstValueFrom(this.http.post<T>(apiUrl(url), body));

  ideas = () => this.get<Idea[]>('/api/ideas');
  importIdeas(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    return this.post<{ created: number; updated: number; total: number }>('/api/ideas/import', fd);
  }
  importLocalIdeas = () => this.post<{ files: string[]; created: number; updated: number }>('/api/ideas/import-local');
  deleteIdea = (id: string) => firstValueFrom(this.http.delete(apiUrl(`/api/ideas/${id}`)));
  bookFromIdea = (id: string, titleIndex: number, presetId?: string) => this.post<Book>(`/api/ideas/${id}/book`, { titleIndex, presetId });

  books = () => this.get<Book[]>('/api/books');
  book = (id: string) => this.get<Book>(`/api/books/${id}`);
  createBook = (body: { lang: Lang; presetId: string; title: string; styleId?: string }) => this.post<Book>('/api/books', body);
  saveBook = (b: Book) => firstValueFrom(this.http.put<Book>(apiUrl(`/api/books/${b.id}`), b));
  deleteBook = (id: string) => firstValueFrom(this.http.delete(apiUrl(`/api/books/${id}`)));
  duplicate = (id: string, body: { cover?: CoverDesign; title?: string } = {}) => this.post<Book>(`/api/books/${id}/duplicate`, body);

  assets = () => this.get<Asset[]>('/api/assets');
  uploadAsset(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    return this.post<Asset>('/api/assets', fd);
  }

  agentStatus = () => this.get<AgentStatus>('/api/agent/status');

  /** Lance l'assistant et relaie ses événements (flux SSE) au fil de l'eau. */
  runAgent = (bookId: string, body: AgentRequest, signal: AbortSignal) => this.sse<AgentEvent>(`/api/books/${bookId}/agent`, body, signal);

  // ---------------------------------------------------------------- Niches
  niches = () => this.get<Niche[]>('/api/niches');
  suggest = (body: { seeds: string[]; markets: MarketId[]; alphabet: boolean }) => this.post<{ suggestions: (Suggestion & { inRadar: boolean })[]; errors: string[] }>('/api/niches/suggest', body);
  addNiches = (items: Partial<Suggestion>[]) => this.post<Niche[]>('/api/niches', { items });
  updateNiche = (id: string, patch: { status?: NicheStatus; notes?: string; tags?: string[] }) => firstValueFrom(this.http.put<Niche>(apiUrl(`/api/niches/${id}`), patch));
  deleteNiche = (id: string) => firstValueFrom(this.http.delete(apiUrl(`/api/niches/${id}`)));
  capture = (raw: RawCapture) => this.post<{ message: string; niches: Niche[]; kind: 'serp' | 'product'; marketplace: MarketId }>('/api/niches/capture', raw);
  nicheBook = (id: string) => this.post<Book>(`/api/niches/${id}/book`);
  discoverNiches = (body: NicheDiscoverRequest, signal: AbortSignal) => this.sse<NicheAgentEvent>('/api/niches/agent', body, signal);
  analyzeNiche = (id: string, body: NicheAnalyzeRequest, signal: AbortSignal) => this.sse<NicheAgentEvent>(`/api/niches/${id}/agent`, body, signal);

  // ---------------------------------------------------------------- Compte KDP (captures, publication assistée)
  kdp = () => this.get<Omit<KdpState, 'captures'> & { captures: (Omit<KdpCaptureLog, 'text'> & { size: number })[] }>('/api/kdp');
  kdpCapture = (raw: KdpRawCapture) => this.post<{ page: 'bookshelf' | 'reports' | 'autre'; message: string }>('/api/kdp/capture', raw);
  kdpCaptureText = (index: number) => firstValueFrom(this.http.get(apiUrl(`/api/kdp/captures/${index}/text`), { responseType: 'text' }));
  kdpLink = (titleId: string, bookId: string | null) => this.post<KdpTitle>(`/api/kdp/titles/${encodeURIComponent(titleId)}/link`, { bookId });
  kdpImport = (titleId: string) => this.post<Book>(`/api/kdp/titles/${encodeURIComponent(titleId)}/import`);
  kdpDeleteTitle = (titleId: string) => firstValueFrom(this.http.delete(apiUrl(`/api/kdp/titles/${encodeURIComponent(titleId)}`)));
  kdpDeleteSnapshot = (id: string) => firstValueFrom(this.http.delete(apiUrl(`/api/kdp/snapshots/${id}`)));
  kdpPublish = (bookId: string) => this.post<KdpFillPayload>(`/api/kdp/publish/${bookId}`);
  kdpPublishCurrent = () => this.get<KdpFillPayload>('/api/kdp/publish/current');
  kdpPublishClear = () => firstValueFrom(this.http.delete(apiUrl('/api/kdp/publish/current')));
  kdpReportsLocal = () => this.get<{ dir: string; files: string[] }>('/api/kdp/reports/local');
  kdpImportLocalReports = (createBooks = true) => this.post<KdpReportImport>('/api/kdp/reports/import-local', { createBooks });
  kdpUploadReports(files: File[], createBooks = true) {
    const fd = new FormData();
    for (const f of files) fd.append('files', f, f.name);
    fd.append('createBooks', String(createBooks));
    return this.post<KdpReportImport>('/api/kdp/reports', fd);
  }

  /** Requête POST dont la réponse est un flux Server-Sent Events. */
  private async *sse<T extends { type: string }>(path: string, body: unknown, signal: AbortSignal): AsyncGenerator<T | { type: 'error'; message: string }> {
    const res = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      yield { type: 'error', message: (err as { error?: string }).error ?? `Erreur ${res.status}` };
      return;
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const chunk = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const data = chunk.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n');
        if (data) yield JSON.parse(data) as T;
      }
    }
  }

  interiorUrl = (id: string, o: { guides?: boolean; download?: boolean } = {}) => apiUrl(`/api/books/${id}/interior.pdf?guides=${o.guides ? 1 : 0}&download=${o.download ? 1 : 0}`);
  coverUrl = (id: string, o: { guides?: boolean; download?: boolean } = {}) => apiUrl(`/api/books/${id}/cover.pdf?guides=${o.guides ? 1 : 0}&download=${o.download ? 1 : 0}`);
  listingUrl = (id: string) => apiUrl(`/api/books/${id}/listing.txt`);
  templateUrl(f: Pick<BookFormat, 'binding' | 'trimId' | 'ink'> & { spineOverride?: number | null }, pages: number, download = true) {
    const q = new URLSearchParams({ binding: f.binding, trim: f.trimId, ink: f.ink, pages: String(pages), download: download ? '1' : '0' });
    if (f.spineOverride) q.set('spine', String(f.spineOverride));
    return apiUrl(`/api/cover-template.pdf?${q}`);
  }
}

export interface KdpReportImport {
  files: { file: string; period: string; rows: number; error?: string }[];
  months: string[];
  titles: { added: number; updated: number; total: number };
  books: number;
}

export const assetUrl = (id: string) => apiUrl(`/uploads/${id}`);
