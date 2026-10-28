// Génère des PDF d'exemple (intérieur + couverture) pour chaque préréglage : npm run samples -- <dossier>
import { createWriteStream, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { COVER_STYLES, createBook, PRESETS } from '@shared';
import { buildCoverPdf, buildInteriorPdf } from '../pdf/documents';

const out = resolve(process.argv[2] ?? 'samples');
mkdirSync(out, { recursive: true });
const write = (doc: PDFKit.PDFDocument, file: string) =>
  new Promise<void>((ok) => doc.pipe(createWriteStream(join(out, file))).on('finish', () => ok()));

let i = 0;
for (const preset of PRESETS) {
  const style = COVER_STYLES[i++ % COVER_STYLES.length];
  const book = createBook({ presetId: preset.id, styleId: style.id });
  book.metadata.title = preset.name;
  book.metadata.subtitle = preset.description;
  book.metadata.author = 'Éditions Exemple';
  await write(buildInteriorPdf(book, { to: 8 }), `${preset.id}-interieur.pdf`);
  await write(buildCoverPdf(book, { guides: process.argv.includes('--guides') }), `${preset.id}-couverture-${style.id}.pdf`);
}
console.log(`Exemples écrits dans ${out}`);
