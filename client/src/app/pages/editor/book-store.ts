import { Injectable, computed, inject, signal } from '@angular/core';
import { coverGeometry, estimateRoyalty, lintBook, score, totalPages, type Asset, type Book } from '@shared';
import { Api } from '../../core/api';

/** État de l'éditeur : copie de travail du livre, sauvegarde automatique (anti-rebond). */
@Injectable()
export class BookStore {
  private api = inject(Api);
  private timer: ReturnType<typeof setTimeout> | null = null;

  book = signal<Book | null>(null);
  assets = signal<Asset[]>([]);
  saveState = signal<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');

  assetMap = computed(() => Object.fromEntries(this.assets().map((a) => [a.id, a])));
  pages = computed(() => (this.book() ? totalPages(this.book()!) : 0));
  issues = computed(() => (this.book() ? lintBook(this.book()!, this.assetMap()) : []));
  score = computed(() => score(this.issues()));
  coverGeo = computed(() => (this.book() ? coverGeometry(this.book()!.format, this.pages()) : null));
  royalty = computed(() => {
    const b = this.book();
    return b ? estimateRoyalty(b.metadata.marketplace, b.format.ink, this.pages(), b.format.trimId, b.metadata.price) : null;
  });

  async load(id: string) {
    const [book, assets] = await Promise.all([this.api.book(id), this.api.assets()]);
    this.book.set(book);
    this.assets.set(assets);
  }

  /** Applique une modification sur une copie et programme la sauvegarde. */
  update(fn: (b: Book) => void) {
    const b = structuredClone(this.book());
    if (!b) return;
    fn(b);
    this.book.set(b);
    this.saveState.set('pending');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 700);
  }

  async flush() {
    const b = this.book();
    if (!b) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.saveState.set('saving');
    try {
      await this.api.saveBook(b);
      this.saveState.set('saved');
    } catch {
      this.saveState.set('error');
    }
  }

  async upload(file: File): Promise<Asset> {
    const a = await this.api.uploadAsset(file);
    this.assets.update((list) => [...list, a]);
    return a;
  }
}
