import { stat } from 'node:fs/promises';
import { readPhotoMetadata } from './exif.js';

export async function readPhotoDate(filePath) {
  try {
    const { date } = await readPhotoMetadata(filePath);
    if (date) {
      return { date, source: 'exif' };
    }
  } catch {
    // fall through to mtime
  }

  const fileStat = await stat(filePath);
  return { date: fileStat.mtime, source: 'mtime' };
}
