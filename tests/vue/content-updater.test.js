import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  plans: [],
  request: vi.fn(),
  userData: ''
}));

vi.mock('electron', () => ({
  app: { getPath: () => electron.userData },
  net: { request: electron.request }
}));

import {
  checkForContentUpdates,
  runContentUpdate
} from '../../electron/services/content-updater.js';
import { canonicalQuestionEntries } from '../../electron/services/runtime-content.js';

const sha256 = value => createHash('sha256').update(value).digest('hex');

async function prepareCompiledRelease({ includeImage }) {
  const contentRoot = path.join(electron.userData, 'tpo-content');
  const sourcePath = 'assets/questions/speaking/TPO-10/speaking-TPO-10.md';
  const documentPath = 'assets/questions/compiled/tpo-10-speaking.json';
  const compiled = {
    source: { path: sourcePath, sha256: '1'.repeat(64) },
    document: {
      id: 'tpo-10-speaking',
      tpoId: '10',
      section: 'speaking',
      modules: [{ scenario: { image: 'avatar.svg' } }],
      pages: []
    }
  };
  const serialized = Buffer.from(JSON.stringify(compiled));
  const entries = [
    {
      id: compiled.document.id,
      tpoId: compiled.document.tpoId,
      section: compiled.document.section,
      sourcePath,
      documentPath,
      sourceHash: compiled.source.sha256,
      documentHash: sha256(serialized)
    }
  ];
  const manifest = Buffer.from(
    JSON.stringify({ entries, contentHash: sha256(canonicalQuestionEntries(entries)) })
  );
  await fs.mkdir(path.join(contentRoot, path.dirname(documentPath)), { recursive: true });
  await fs.writeFile(path.join(contentRoot, documentPath), serialized);
  if (includeImage) {
    await fs.mkdir(path.join(contentRoot, path.dirname(sourcePath)), { recursive: true });
    await fs.writeFile(
      path.join(contentRoot, path.dirname(sourcePath), 'avatar.svg'),
      '<svg></svg>'
    );
  }
  return { contentRoot, manifest };
}

function response(plan) {
  const stream = new EventEmitter();
  stream.statusCode = plan.statusCode ?? 200;
  stream.headers = plan.headers || {};
  queueMicrotask(() => {
    if (plan.data) stream.emit('data', plan.data);
    stream.emit('end');
  });
  return stream;
}

beforeEach(async () => {
  electron.userData = await fs.mkdtemp(path.join(os.tmpdir(), 'toefl-content-updater-'));
  electron.plans.length = 0;
  electron.request.mockReset();
  electron.request.mockImplementation(() => {
    const request = new EventEmitter();
    request.abort = vi.fn();
    request.end = () => {
      const plan = electron.plans.shift();
      queueMicrotask(() => request.emit('response', response(plan)));
    };
    return request;
  });
});

afterEach(async () => {
  await fs.rm(electron.userData, { recursive: true, force: true });
});

describe('content updater downloads', () => {
  it('follows trusted redirects and reads a bounded manifest', async () => {
    electron.plans.push(
      {
        statusCode: 302,
        headers: { location: 'https://raw.githubusercontent.com/example/manifest.json' }
      },
      {
        data: Buffer.from(JSON.stringify({ content_version: 1, updates: [] }))
      }
    );

    await expect(checkForContentUpdates()).resolves.toMatchObject({
      hasUpdate: true,
      remoteVersion: 1,
      updateCount: 0
    });
    expect(electron.request).toHaveBeenCalledTimes(2);
  });

  it('rejects untrusted redirect targets', async () => {
    electron.plans.push({
      statusCode: 302,
      headers: { location: 'https://example.com/manifest.json' }
    });

    await expect(checkForContentUpdates()).resolves.toMatchObject({
      hasUpdate: false,
      error: expect.stringContaining('Untrusted content host')
    });
  });

  it('aborts a manifest that exceeds the byte limit', async () => {
    electron.plans.push({ data: Buffer.alloc(2 * 1024 * 1024 + 1) });

    await expect(checkForContentUpdates()).resolves.toMatchObject({
      hasUpdate: false,
      error: expect.stringContaining('byte limit')
    });
  });

  it('applies current incremental media updates without format version labels', async () => {
    const contentRoot = path.join(electron.userData, 'tpo-content');
    await fs.mkdir(contentRoot, { recursive: true });
    await fs.writeFile(path.join(contentRoot, 'installed.txt'), 'keep me');
    const image = Buffer.from('image bytes');
    electron.plans.push(
      {
        data: Buffer.from(
          JSON.stringify({
            content_version: 4,
            updates: [
              {
                path: 'speaking/TPO-03/0.png',
                url: 'https://raw.githubusercontent.com/example/0.png'
              }
            ]
          })
        )
      },
      { data: image }
    );

    await expect(runContentUpdate()).resolves.toMatchObject({ version: 4 });
    await expect(
      fs.readFile(path.join(contentRoot, 'assets/questions/speaking/TPO-03/0.png'))
    ).resolves.toEqual(image);
    await expect(fs.readFile(path.join(contentRoot, 'installed.txt'), 'utf8')).resolves.toBe(
      'keep me'
    );
    await expect(fs.readFile(path.join(contentRoot, '.version'), 'utf8')).resolves.toBe('4');
  });

  it('rejects a checksum mismatch without replacing installed content', async () => {
    const contentRoot = path.join(electron.userData, 'tpo-content');
    await fs.mkdir(contentRoot, { recursive: true });
    await fs.writeFile(path.join(contentRoot, 'installed.txt'), 'current');
    electron.plans.push(
      {
        data: Buffer.from(
          JSON.stringify({
            content_version: 5,
            updates: [
              {
                path: 'listening/TPO-03/audio.mp3',
                url: 'https://raw.githubusercontent.com/example/audio.mp3',
                sha256: '0'.repeat(64)
              }
            ]
          })
        )
      },
      { data: Buffer.from('unexpected bytes') }
    );

    await expect(runContentUpdate()).rejects.toThrow('Content update failed');
    await expect(fs.readFile(path.join(contentRoot, 'installed.txt'), 'utf8')).resolves.toBe(
      'current'
    );
    await expect(fs.access(path.join(contentRoot, '.version'))).rejects.toThrow();
  });

  it('leaves installed content untouched when staged content is invalid', async () => {
    const contentRoot = path.join(electron.userData, 'tpo-content');
    await fs.mkdir(contentRoot, { recursive: true });
    await fs.writeFile(path.join(contentRoot, 'installed.txt'), 'current');
    const invalidContent = Buffer.from('{}');
    const sha256 = createHash('sha256').update(invalidContent).digest('hex');
    electron.plans.push(
      {
        data: Buffer.from(
          JSON.stringify({
            content_version: 2,
            updates: [
              {
                path: 'assets/questions/compiled/manifest.json',
                url: 'https://raw.githubusercontent.com/example/manifest.json',
                sha256
              }
            ]
          })
        )
      },
      { data: invalidContent }
    );

    await expect(runContentUpdate()).rejects.toThrow('Content update failed');
    await expect(fs.readFile(path.join(contentRoot, 'installed.txt'), 'utf8')).resolves.toBe(
      'current'
    );
  });

  it('validates images referenced by a complete compiled release', async () => {
    const { contentRoot, manifest } = await prepareCompiledRelease({ includeImage: false });
    await fs.writeFile(path.join(contentRoot, 'installed.txt'), 'current');
    electron.plans.push(
      {
        data: Buffer.from(
          JSON.stringify({
            content_version: 6,
            updates: [
              {
                path: 'assets/questions/compiled/manifest.json',
                url: 'https://raw.githubusercontent.com/example/manifest.json',
                sha256: sha256(manifest)
              }
            ]
          })
        )
      },
      { data: manifest }
    );

    await expect(runContentUpdate()).rejects.toThrow('Content update failed');
    await expect(fs.readFile(path.join(contentRoot, 'installed.txt'), 'utf8')).resolves.toBe(
      'current'
    );
  });

  it('accepts a complete compiled release when every referenced asset exists', async () => {
    const { contentRoot, manifest } = await prepareCompiledRelease({ includeImage: true });
    electron.plans.push(
      {
        data: Buffer.from(
          JSON.stringify({
            content_version: 7,
            updates: [
              {
                path: 'assets/questions/compiled/manifest.json',
                url: 'https://raw.githubusercontent.com/example/manifest.json',
                sha256: sha256(manifest)
              }
            ]
          })
        )
      },
      { data: manifest }
    );

    await expect(runContentUpdate()).resolves.toMatchObject({ version: 7 });
    await expect(
      fs.readFile(path.join(contentRoot, 'assets/questions/speaking/TPO-10/avatar.svg'), 'utf8')
    ).resolves.toBe('<svg></svg>');
  });
});
