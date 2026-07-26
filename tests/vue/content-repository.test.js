import { createHash, webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listCatalog,
  readCatalogManifest,
  readQuestionDocument
} from '../../src/vue/platform/contentRepository.js';
import { canonicalQuestionEntries } from '../../electron/services/runtime-content.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const sourcePath = 'assets/questions/reading/TPO-99/reading-TPO-99.md';
const documentPath = 'assets/questions/compiled/tpo-99-reading.json';
const sourceHash = hash('# fixture');
const compiledDocument = {
  id: 'tpo-99-reading',
  tpoId: '99',
  section: 'reading',
  sourcePath
};
const compiledText = `${JSON.stringify({
  source: { path: sourcePath, sha256: sourceHash },
  document: compiledDocument
})}\n`;
const entry = {
  ...compiledDocument,
  documentPath,
  sourceHash,
  documentHash: hash(compiledText)
};
const catalog = {
  entries: [entry],
  contentHash: hash(canonicalQuestionEntries([entry]))
};

beforeEach(() => vi.stubGlobal('crypto', webcrypto));

describe('compiled question content', () => {
  it('validates the runtime manifest and compiled document hashes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async url => ({
        ok: true,
        text: async () => (url.endsWith('/manifest.json') ? JSON.stringify(catalog) : compiledText)
      }))
    );

    await expect(readCatalogManifest()).resolves.toEqual(catalog);
    const catalogEntry = listCatalog(catalog)[0].sections.reading;
    expect(catalogEntry).toMatchObject({
      id: entry.id,
      tpoId: entry.tpoId,
      section: entry.section
    });
    await expect(readQuestionDocument(catalogEntry)).resolves.toEqual(compiledDocument);
  });

  it('rejects duplicate manifest entries before trusting its hash', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () => JSON.stringify({ entries: [entry, entry], contentHash: hash('unused') })
      }))
    );
    await expect(readCatalogManifest()).rejects.toThrow('Duplicate question content entry');
  });

  it('rejects a compiled document whose contents do not match the manifest', async () => {
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, text: async () => '{"tampered":true}' }))
    );
    await expect(
      readQuestionDocument({
        id: 'tpo-99-reading',
        documentPath: 'assets/questions/compiled/tpo-99-reading.json',
        documentHash: hash('expected')
      })
    ).rejects.toThrow('Content integrity check failed');
  });
});
