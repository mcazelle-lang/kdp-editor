import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const SERVER_DIR = resolve(here, '..');
export const ROOT_DIR = resolve(SERVER_DIR, '..');

// Clés d'API et réglages locaux (server/.env, jamais versionné)
const envFile = join(SERVER_DIR, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

export const DATA_DIR = process.env.BOOK_CREATOR_DATA ?? join(SERVER_DIR, 'data');
export const UPLOADS_DIR = join(DATA_DIR, 'uploads');
export const DB_FILE = join(DATA_DIR, 'db.json');
/** Dossier contenant les fichiers d'idées .xlsx (racine du projet par défaut) */
export const IDEAS_DIR = process.env.BOOK_CREATOR_IDEAS ?? ROOT_DIR;
export const FONTSOURCE_DIR = join(SERVER_DIR, 'node_modules', '@fontsource');
export const CLIENT_DIST = join(ROOT_DIR, 'client', 'dist', 'client', 'browser');
export const PORT = Number(process.env.PORT ?? 3000);

/** Projet Firebase par défaut (.firebaserc) : son interface hébergée peut appeler cette API. */
function firebaseProject(): string | null {
  try {
    const rc = JSON.parse(readFileSync(join(ROOT_DIR, '.firebaserc'), 'utf-8')) as { projects?: { default?: string } };
    return rc.projects?.default ?? null;
  } catch {
    return null;
  }
}

export const FIREBASE_PROJECT = firebaseProject();

export const CORS_ORIGINS: string[] = (process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : [
      'http://localhost:4200',
      ...(FIREBASE_PROJECT ? [`https://${FIREBASE_PROJECT}.web.app`, `https://${FIREBASE_PROJECT}.firebaseapp.com`] : []),
    ]
).map((o) => o.trim()).filter(Boolean);

export const AGENT = {
  model: process.env.AGENT_MODEL ?? 'claude-opus-5-5',
  effort: (process.env.AGENT_EFFORT ?? 'high') as 'low' | 'medium' | 'high' | 'xhigh' | 'max',
  maxIterations: Number(process.env.AGENT_MAX_ITERATIONS ?? 24),
  imageModel: process.env.GEMINI_IMAGE_MODEL ?? 'gemini-nano-banana-2.1',
};
