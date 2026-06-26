import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { isImageFile } from './image-extensions.js';

export async function walkImages(rootDir) {
  const files = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'EACCES' || err.code === 'ENOENT') return;
      throw err;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (entry.isFile() && isImageFile(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return files;
}
