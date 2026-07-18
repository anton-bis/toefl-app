import { createHash, webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readCatalogManifest,
  readQuestionDocument
} from '../../src/vue/platform/contentRepository.js';

const hash = value => createHash('sha256').update(value).digest('hex');

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('compiled question content', () => {
  it('validates the runtime manifest and compiled document hashes', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const sourcePath = 'assets/questions/reading/TPO-99/reading-TPO-99.md';
    const documentPath = 'assets/questions/compiled/tpo-99-reading.json';
    const sourceHash = hash('# fixture');
    const compiledText = `${JSON.stringify({
      schemaVersion: 2,
      source: { path: sourcePath, sha256: sourceHash },
      document: { id: 'tpo-99-reading', sourcePath }
    })}\n`;
    const entry = {
      id: 'tpo-99-reading',
      tpoId: '99',
      section: 'reading',
      sourcePath,
      documentPath,
      sourceHash,
      documentHash: hash(compiledText)
    };
    const catalog = {
      schemaVersion: 2,
      entries: [entry],
      contentHash: hash(
        JSON.stringify([
          [
            entry.id,
            entry.tpoId,
            entry.section,
            entry.sourcePath,
            entry.documentPath,
            entry.sourceHash,
            entry.documentHash
          ]
        ])
      )
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async url => ({
        ok: true,
        text: async () =>
          url.endsWith('/manifest.json') ? JSON.stringify(catalog) : compiledText
      }))
    );

    await expect(readCatalogManifest()).resolves.toEqual(catalog);
    await expect(readQuestionDocument(entry)).resolves.toEqual({
      id: entry.id,
      sourcePath
    });
  });

  it('rejects a compiled document whose contents do not match the manifest', async () => {
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => '{"tampered":true}' })));
    await expect(
      readQuestionDocument({
        id: 'tpo-99-reading',
        documentPath: 'assets/questions/compiled/tpo-99-reading.json',
        documentHash: hash('expected')
      })
    ).rejects.toThrow('Content integrity check failed');
  });
});
