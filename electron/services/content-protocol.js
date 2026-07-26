import { pathToFileURL } from 'node:url';

function response(message, status) {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' }
  });
}

export function createContentProtocolHandler({ net, resolveFile, onError } = {}) {
  if (typeof net?.fetch !== 'function' || typeof resolveFile !== 'function') {
    throw new Error('Content protocol dependencies are unavailable.');
  }
  return async request => {
    try {
      const requestUrl = new URL(request.url);
      if (requestUrl.hostname !== 'content') return response('Not found', 404);
      const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
      const filePath = await resolveFile(relativePath);
      if (!filePath) return response('Not found', 404);
      const range = request.headers?.get?.('range');
      const options = range ? { headers: { Range: range } } : undefined;
      return net.fetch(pathToFileURL(filePath).toString(), options);
    } catch (error) {
      onError?.(error);
      return response('Could not read installed content', 500);
    }
  };
}

export function registerContentProtocol({ protocol, ...options }) {
  protocol.handle('toefl-content', createContentProtocolHandler(options));
}
