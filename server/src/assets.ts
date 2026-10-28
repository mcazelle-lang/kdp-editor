import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { imageSize } from 'image-size';
import type { Asset } from '@shared';
import { UPLOADS_DIR } from './config';
import { db } from './db';

/** Enregistre une image PNG/JPEG dans data/uploads et la référence dans la base. */
export async function saveAsset(buffer: Buffer, ext: '.png' | '.jpg', originalName: string): Promise<Asset> {
  const dim = imageSize(buffer);
  const id = `${randomUUID().replace(/-/g, '').slice(0, 16)}${ext}`;
  await writeFile(join(UPLOADS_DIR, id), buffer);
  const asset: Asset = { id, file: id, mime: ext === '.png' ? 'image/png' : 'image/jpeg', width: dim.width ?? 0, height: dim.height ?? 0, originalName };
  db.data.assets.push(asset);
  await db.save();
  return asset;
}
