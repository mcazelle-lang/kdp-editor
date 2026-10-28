import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { api } from './api';
import { CLIENT_DIST, CORS_ORIGINS, FONTSOURCE_DIR, PORT, UPLOADS_DIR } from './config';
import { db } from './db';
import { importLocalIdeas } from './ideas';

const app = express();
app.use(express.json({ limit: '10mb' }));

// CORS : l'interface hébergée sur Firebase (ou ng serve) peut appeler cette API locale.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    // Accès d'une page publique (https) à un serveur local : Chrome exige cette autorisation
    if (req.headers['access-control-request-private-network']) res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.use('/api', api);
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

// Polices @fontsource servies au navigateur pour un aperçu fidèle au PDF
app.get('/fonts/:pkg/:file', (req, res) => {
  const pkg = basename(String(req.params.pkg));
  const file = basename(String(req.params.file));
  const path = join(FONTSOURCE_DIR, pkg, 'files', file);
  if (!/^[a-z0-9-]+$/.test(pkg) || !existsSync(path)) return res.status(404).end();
  res.setHeader('Cache-Control', 'public, max-age=604800');
  res.sendFile(path);
});

// Application Angular compilée (npm run build)
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^(?!\/(api|uploads|fonts)\/).*/, (_req, res) => res.sendFile(join(CLIENT_DIST, 'index.html')));
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

if (db.isNew) {
  importLocalIdeas()
    .then((r) => console.log(`Idées importées depuis ${r.files.join(', ') || '(aucun fichier .xlsx)'} : ${r.created} nouvelles`))
    .catch((e) => console.error('Import initial des idées impossible :', e));
}

app.listen(PORT, () => console.log(`Book Creator API : http://localhost:${PORT} (CORS : ${CORS_ORIGINS.join(', ') || 'aucun'})`));
