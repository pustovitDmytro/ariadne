import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { walkImages } from './walk-images.js';

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function groupBySize(filePaths, sizes) {
  const bySize = new Map();
  for (const filePath of filePaths) {
    const size = sizes.get(filePath);
    if (!bySize.has(size)) bySize.set(size, []);
    bySize.get(size).push(filePath);
  }
  return [...bySize.values()].filter((group) => group.length > 1);
}

export async function findDuplicates(rootDir, { onProgress } = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const rootStat = await stat(absoluteRoot).catch(() => null);
  if (!rootStat?.isDirectory()) {
    throw new Error(`Not a directory: ${absoluteRoot}`);
  }

  const imageFiles = await walkImages(absoluteRoot);
  const sizes = new Map();

  for (let i = 0; i < imageFiles.length; i++) {
    const filePath = imageFiles[i];
    try {
      const fileStat = await stat(filePath);
      sizes.set(filePath, fileStat.size);
    } catch {
      sizes.set(filePath, -1);
    }
    onProgress?.({ phase: 'scan', current: i + 1, total: imageFiles.length });
  }

  const candidates = groupBySize(imageFiles, sizes);
  const byHash = new Map();
  let hashed = 0;
  const hashTotal = candidates.reduce((sum, group) => sum + group.length, 0);

  for (const group of candidates) {
    for (const filePath of group) {
      try {
        const digest = await hashFile(filePath);
        if (!byHash.has(digest)) byHash.set(digest, []);
        byHash.get(digest).push(filePath);
      } catch {
        // skip unreadable files
      }
      hashed += 1;
      onProgress?.({ phase: 'hash', current: hashed, total: hashTotal });
    }
  }

  return [...byHash.values()].filter((group) => group.length > 1);
}
