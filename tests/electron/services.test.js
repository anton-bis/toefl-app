import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  getContentCandidates,
  normalizeContentPath,
  resolveContentFile
} from '../../electron/services/content-paths.js';
import {
  CONTENT_SCHEMA_MIN_APP_VERSION,
  CONTENT_SCHEMA_VERSION,
  RUNTIME_CONTENT_EXTENSIONS,
  RUNTIME_MEDIA_EXTENSIONS
} from '../../electron/services/runtime-content.js';
import {
  assertPublishedContentManifest,
  contentDownloadUrl,
  contentManifestUrl,
  validateContentUrl
} from '../../electron/services/content-config.js';
import {
  GITHUB_PROXY_PREFIX,
  proxyGitHubDownloadUrl
} from '../../electron/services/github-download.js';
import { createContentProtocolHandler } from '../../electron/services/content-protocol.js';

test('content protocol serves installed files and preserves media range requests', async () => {
  const requests = [];
  const handler = createContentProtocolHandler({
    net: {
      fetch: async (url, options) => {
        requests.push({ url, options });
        return new Response('fixture');
      }
    },
    resolveFile: async relativePath =>
      relativePath === 'assets/audio/test.mp3' ? path.resolve('content/test.mp3') : null
  });

  const result = await handler(
    new Request('toefl-content://content/assets/audio/test.mp3', {
      headers: { Range: 'bytes=10-' }
    })
  );
  assert.equal(await result.text(), 'fixture');
  assert.match(requests[0].url, /^file:/);
  assert.deepEqual(requests[0].options, { headers: { Range: 'bytes=10-' } });
  assert.equal(
    (await handler(new Request('toefl-content://content/assets/missing.json'))).status,
    404
  );
  assert.equal((await handler(new Request('toefl-content://other/test.json'))).status, 404);
});

test('content protocol converts resolver failures into a safe response', async () => {
  let reported;
  const handler = createContentProtocolHandler({
    net: { fetch: async () => new Response('unused') },
    resolveFile: async () => {
      throw new Error('private path detail');
    },
    onError: error => {
      reported = error;
    }
  });

  const result = await handler(new Request('toefl-content://content/catalog.json'));
  assert.equal(result.status, 500);
  assert.equal(await result.text(), 'Could not read installed content');
  assert.equal(reported.message, 'private path detail');
});

test('content paths normalize relative assets and reject unsafe paths', () => {
  for (const unsafePath of ['../secret.txt', '/etc/passwd', '']) {
    assert.throws(() => normalizeContentPath(unsafePath));
  }
  assert.equal(
    normalizeContentPath('assets\\questions\\reading\\TPO-01\\test.md'),
    'assets/questions/reading/TPO-01/test.md'
  );
  const contentRoot = path.resolve('tmp/toefl-content');
  assert.equal(
    resolveContentFile(contentRoot, 'reading/TPO-01/test.md'),
    path.join(contentRoot, 'reading/TPO-01/test.md')
  );
  assert.throws(() => resolveContentFile(contentRoot, '../secret.txt'));
});

test('runtime content policy covers packaged and hot-update asset types', () => {
  for (const extension of ['.json', '.svg', '.ico', '.webp', '.gif', '.mp3', '.mp4']) {
    assert.equal(RUNTIME_CONTENT_EXTENSIONS.has(extension), true, extension);
  }
  assert.equal(RUNTIME_CONTENT_EXTENSIONS.has('.md'), false);
  assert.equal(RUNTIME_MEDIA_EXTENSIONS.has('.json'), false);
  assert.equal(RUNTIME_MEDIA_EXTENSIONS.has('.mp3'), true);
  assert.equal(CONTENT_SCHEMA_VERSION, 1);
  assert.match(CONTENT_SCHEMA_MIN_APP_VERSION, /^\d+\.\d+\.\d+$/);
});

test('GitHub-hosted content downloads use the configured HTTPS proxy', () => {
  const direct = 'https://github.com/example/content/releases/download/v1/catalog.zip';
  const proxied = `${GITHUB_PROXY_PREFIX}${direct}`;

  assert.equal(
    contentManifestUrl('example/content', 'published'),
    `${GITHUB_PROXY_PREFIX}https://raw.githubusercontent.com/example/content/published/manifest.json`
  );
  assert.equal(contentDownloadUrl(direct), proxied);
  assert.equal(proxyGitHubDownloadUrl(proxied), proxied);
  assert.equal(validateContentUrl(proxied).toString(), proxied);
  assert.throws(
    () => proxyGitHubDownloadUrl('https://gh-proxy.org/https://example.com/payload.zip'),
    /Untrusted GitHub download host/
  );

  const manifest = assertPublishedContentManifest({
    schemaVersion: CONTENT_SCHEMA_VERSION,
    manifestId: 'b75bd08014e4b982252327a2e57abb2de9f07cf27e841236737440fa549fee36',
    publishedAt: '2026-07-26T00:00:00.000Z',
    minAppVersion: '1.5.0',
    packs: [
      {
        id: 'catalog',
        contentHash: 'a'.repeat(64),
        archiveHash: 'b'.repeat(64),
        size: 10,
        url: direct
      }
    ]
  });
  assert.equal(manifest.packs[0].url, proxied);
});

test('content candidates prefer active packs before development resources', () => {
  assert.deepEqual(
    getContentCandidates({
      relativePath: 'assets/questions/compiled/manifest.json',
      activeRoots: ['/user-data/tpo-content/packs/catalog/hash'],
      appPath: '/app'
    }),
    [
      path.join(
        '/user-data/tpo-content/packs/catalog/hash',
        'assets/questions/compiled/manifest.json'
      ),
      path.join('/app', 'dist/assets/questions/compiled/manifest.json'),
      path.join('/app', 'assets/questions/compiled/manifest.json')
    ]
  );
});
