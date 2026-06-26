export const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.tiff',
  '.tif',
  '.heic',
  '.heif',
  '.avif',
  '.cr2',
  '.nef',
  '.orf',
  '.arw',
  '.dng',
  '.raf',
]);

export function isImageFile(filePath) {
  const dot = filePath.lastIndexOf('.');
  if (dot === -1) return false;
  return IMAGE_EXTENSIONS.has(filePath.slice(dot).toLowerCase());
}
