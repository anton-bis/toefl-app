import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

const CONTENT_TYPES = new Map([
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.json', 'application/json; charset=utf-8'],
  ['.m4a', 'audio/mp4'],
  ['.mp3', 'audio/mpeg'],
  ['.mp4', 'video/mp4'],
  ['.ogg', 'audio/ogg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.wav', 'audio/wav'],
  ['.webm', 'audio/webm'],
  ['.webp', 'image/webp']
]);

function response(message, status, headers) {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', ...headers }
  });
}

function byteRange(value, size) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!match || (!match[1] && !match[2]) || size === 0) return false;

  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return false;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return false;
    end = Math.min(end, size - 1);
  }
  if (start < 0 || start >= size || end < start) return false;
  return { start, end };
}

export async function createLocalFileResponse(request, filePath) {
  const stats = await fs.promises.stat(filePath);
  if (!stats.isFile()) return response('Not found', 404);

  const range = byteRange(request.headers?.get?.('range'), stats.size);
  if (range === false) {
    return response('Requested range not satisfiable', 416, {
      'accept-ranges': 'bytes',
      'content-range': `bytes */${stats.size}`
    });
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? Math.max(0, stats.size - 1);
  const contentLength = range ? end - start + 1 : stats.size;
  const headers = {
    'accept-ranges': 'bytes',
    'cache-control': 'no-store',
    'content-length': String(contentLength),
    'content-type':
      CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream'
  };
  if (range) headers['content-range'] = `bytes ${start}-${end}/${stats.size}`;

  const body =
    request.method === 'HEAD' || stats.size === 0
      ? null
      : Readable.toWeb(fs.createReadStream(filePath, range ? { start, end } : undefined));
  return new Response(body, { status: range ? 206 : 200, headers });
}

export function createContentProtocolHandler({ resolveFile, onError } = {}) {
  if (typeof resolveFile !== 'function') {
    throw new Error('Content protocol dependencies are unavailable.');
  }
  return async request => {
    try {
      const requestUrl = new URL(request.url);
      if (requestUrl.hostname !== 'content') return response('Not found', 404);
      const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
      const filePath = await resolveFile(relativePath);
      if (!filePath) return response('Not found', 404);
      return await createLocalFileResponse(request, filePath);
    } catch (error) {
      onError?.(error);
      return response('Could not read installed content', 500);
    }
  };
}

export function registerContentProtocol({ protocol, ...options }) {
  protocol.handle('toefl-content', createContentProtocolHandler(options));
}
