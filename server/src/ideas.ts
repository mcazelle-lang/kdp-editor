import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Idea } from '@shared';
import { IDEAS_DIR } from './config';
import { db } from './db';
import { parseIdeasWorkbook } from './import/xlsx';

/** Fusionne les idées importées (clé stable : fichier + feuille + colonne). */
export async function upsertIdeas(ideas: Idea[]): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  for (const idea of ideas) {
    const i = db.data.ideas.findIndex((x) => x.id === idea.id);
    if (i === -1) {
      db.data.ideas.push(idea);
      created++;
    } else {
      db.data.ideas[i] = idea;
      updated++;
    }
  }
  await db.save();
  return { created, updated };
}

export async function importLocalIdeas(dir = IDEAS_DIR) {
  const files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'));
  const result = { files, created: 0, updated: 0 };
  for (const f of files) {
    const ideas = await parseIdeasWorkbook(await readFile(join(dir, f)), f);
    const r = await upsertIdeas(ideas);
    result.created += r.created;
    result.updated += r.updated;
  }
  return result;
}
