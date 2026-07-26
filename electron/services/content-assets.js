import path from 'node:path';
import { normalizeContentPath } from './content-paths.js';

export function collectDocumentAssets(value, files, sourceDirectory) {
  if (Array.isArray(value)) {
    value.forEach(item => collectDocumentAssets(item, files, sourceDirectory));
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (typeof value.media?.file === 'string' && value.media.file) {
    files.add(normalizeContentPath(path.posix.join(sourceDirectory, value.media.file)));
  }
  if (typeof value.image === 'string' && value.image) {
    files.add(normalizeContentPath(path.posix.join(sourceDirectory, value.image)));
  }
  Object.values(value).forEach(item => collectDocumentAssets(item, files, sourceDirectory));
}
