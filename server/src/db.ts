import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { emptyKdpState, type Asset, type Book, type Idea, type KdpState, type Niche } from '@shared';
import { DATA_DIR, DB_FILE, UPLOADS_DIR } from './config';

export interface DbShape {
  version: 1;
  books: Book[];
  ideas: Idea[];
  assets: Asset[];
  niches: Niche[];
  kdp: KdpState;
}

// Stockage JSON local : suffisant pour un usage mono-utilisateur, lisible et versionnable.
class Store {
  data: DbShape;
  private queue: Promise<void> = Promise.resolve();
  readonly isNew: boolean;

  constructor() {
    mkdirSync(UPLOADS_DIR, { recursive: true });
    this.isNew = !existsSync(DB_FILE);
    this.data = this.isNew ? { version: 1, books: [], ideas: [], assets: [], niches: [], kdp: emptyKdpState() } : (JSON.parse(readFileSync(DB_FILE, 'utf-8')) as DbShape);
    this.data.assets ??= [];
    this.data.niches ??= [];
    this.data.kdp ??= emptyKdpState();
  }

  /** Écriture atomique sérialisée (fichier temporaire puis renommage). */
  save(): Promise<void> {
    this.queue = this.queue.then(async () => {
      const tmp = `${DB_FILE}.tmp`;
      await writeFile(tmp, JSON.stringify(this.data, null, 1), 'utf-8');
      await rename(tmp, DB_FILE);
    });
    return this.queue;
  }

  book(id: string) {
    return this.data.books.find((b) => b.id === id);
  }

  assetMap(): Record<string, Asset> {
    return Object.fromEntries(this.data.assets.map((a) => [a.id, a]));
  }
}

export const db = new Store();
export { DATA_DIR };
