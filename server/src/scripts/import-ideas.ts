import { IDEAS_DIR } from '../config';
import { importLocalIdeas } from '../ideas';

const dir = process.argv[2] ?? IDEAS_DIR;
const r = await importLocalIdeas(dir);
console.log(`Fichiers : ${r.files.join(', ') || 'aucun'}\nIdées créées : ${r.created} · mises à jour : ${r.updated}`);
