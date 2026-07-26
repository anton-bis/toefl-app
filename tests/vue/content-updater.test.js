import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  headers: [],
  plans: [],
  request: vi.fn(),
  userData: ''
}));

vi.mock('electron', () => ({
  app: {
    getPath: () => electron.userData,
    getVersion: () => '9.0.0'
  },
  net: { request: electron.request }
}));

import {
  configureContentUpdater,
  initializeContent,
  setContentBusy,
  synchronizeContent
} from '../../electron/services/content-updater.js';
import {
  readInstalledManifest,
  readPendingManifest
} from '../../electron/services/content-installation.js';
import {
  canonicalContentPacks,
  canonicalQuestionEntries,
  CONTENT_SCHEMA_VERSION
} from '../../electron/services/runtime-content.js';
import { createPackManifest, sha256 } from '../../src/content/packs.js';
import { writePackArchive } from '../../scripts/content-packages.js';

function queueResponse(data, statusCode = 200) {
  electron.plans.push({ data: Buffer.from(data), statusCode });
}

function installNetworkMock() {
  electron.request.mockImplementation(() => {
    const request = new EventEmitter();
    request.setHeader = vi.fn((name, value) => electron.headers.push([name, value]));
    request.end = () => {
      const plan = electron.plans.shift();
      if (!plan) throw new Error('Unexpected content request.');
      const response = Readable.from([plan.data]);
      response.statusCode = plan.statusCode;
      response.headers = {};
      queueMicrotask(() => request.emit('response', response));
    };
    return request;
  });
}

async function createRelease(root, marker) {
  const sourcePath = 'assets/questions/reading/TPO-99/reading-TPO-99.md';
  const documentPath = 'assets/questions/compiled/tpo-99-reading.json';
  const sourceHash = sha256(`# ${marker}`);
  const compiled = {
    source: { path: sourcePath, sha256: sourceHash },
    document: {
      id: 'tpo-99-reading',
      tpoId: '99',
      section: 'reading',
      marker,
      modules: [],
      pages: []
    }
  };
  const serialized = `${JSON.stringify(compiled)}\n`;
  const entry = {
    id: compiled.document.id,
    tpoId: compiled.document.tpoId,
    section: compiled.document.section,
    sourcePath,
    documentPath,
    sourceHash,
    documentHash: sha256(serialized)
  };
  const catalog = {
    entries: [entry],
    contentHash: sha256(canonicalQuestionEntries([entry]))
  };
  await fs.mkdir(path.join(root, path.dirname(documentPath)), { recursive: true });
  await fs.writeFile(path.join(root, documentPath), serialized);
  await fs.writeFile(
    path.join(root, 'assets/questions/compiled/manifest.json'),
    JSON.stringify(catalog)
  );
  const definitions = [
    { id: 'catalog', files: ['assets/questions/compiled/manifest.json'] },
    { id: 'tpo-99', files: [documentPath] }
  ];
  const output = path.join(root, 'output');
  const archives = [];
  for (const definition of definitions) {
    archives.push(
      await writePackArchive(root, output, {
        definition,
        manifest: createPackManifest(root, definition)
      })
    );
  }
  const packs = archives.map(archive => ({
    id: archive.id,
    contentHash: archive.contentHash,
    archiveHash: archive.archiveHash,
    size: archive.size,
    url: `https://github.com/example/content/${archive.fileName}`,
    outputPath: archive.outputPath
  }));
  const publicPacks = packs.map(pack => ({
    id: pack.id,
    contentHash: pack.contentHash,
    archiveHash: pack.archiveHash,
    size: pack.size,
    url: pack.url
  }));
  const manifest = {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    manifestId: sha256(canonicalContentPacks(publicPacks)),
    publishedAt: '2026-07-26T00:00:00.000Z',
    minAppVersion: '1.0.0',
    packs: publicPacks
  };
  return { manifest, packs };
}

async function queueRelease(release) {
  queueResponse(JSON.stringify(release.manifest));
  for (const pack of release.packs) queueResponse(await fs.readFile(pack.outputPath));
}

beforeEach(async () => {
  electron.userData = await fs.mkdtemp(path.join(os.tmpdir(), 'toefl-content-updater-'));
  electron.plans.length = 0;
  electron.headers.length = 0;
  electron.request.mockReset();
  installNetworkMock();
  configureContentUpdater();
  await setContentBusy(false);
});

afterEach(async () => {
  await fs.rm(electron.userData, { recursive: true, force: true });
});

describe('content-addressed runtime updates', () => {
  it('installs a complete manifest automatically on first launch', async () => {
    const release = await createRelease(electron.userData, 'first');
    await queueRelease(release);

    await expect(initializeContent()).resolves.toMatchObject({ status: 'ready', ready: true });
    const current = await readInstalledManifest(path.join(electron.userData, 'tpo-content'));
    expect(current.manifestId).toBe(release.manifest.manifestId);
    expect(electron.request).toHaveBeenCalledTimes(3);
  });

  it('resumes a partial pack download without re-fetching completed bytes', async () => {
    const release = await createRelease(electron.userData, 'resume');
    const [firstPack, secondPack] = release.packs;
    const archive = await fs.readFile(firstPack.outputPath);
    const split = Math.floor(archive.length / 2);
    const partialPath = path.join(
      electron.userData,
      'tpo-content',
      'downloads',
      `${firstPack.id}-${firstPack.contentHash}.zip.part`
    );
    await fs.mkdir(path.dirname(partialPath), { recursive: true });
    await fs.writeFile(partialPath, archive.subarray(0, split));
    queueResponse(JSON.stringify(release.manifest));
    queueResponse(archive.subarray(split), 206);
    queueResponse(await fs.readFile(secondPack.outputPath));

    await expect(initializeContent()).resolves.toMatchObject({ status: 'ready', ready: true });
    expect(electron.headers).toContainEqual(['Range', `bytes=${split}-`]);
  });

  it('builds byte-identical archives for unchanged pack contents', async () => {
    const first = await createRelease(path.join(electron.userData, 'deterministic-1'), 'same');
    const second = await createRelease(path.join(electron.userData, 'deterministic-2'), 'same');

    expect(first.packs.map(pack => pack.archiveHash)).toEqual(
      second.packs.map(pack => pack.archiveHash)
    );
  });

  it('stages a background update while an exam is active and activates it afterwards', async () => {
    const first = await createRelease(path.join(electron.userData, 'first'), 'first');
    await queueRelease(first);
    await initializeContent();

    const second = await createRelease(path.join(electron.userData, 'second'), 'second');
    await setContentBusy(true);
    await queueRelease(second);
    await expect(synchronizeContent()).resolves.toMatchObject({ status: 'pending', ready: true });
    const contentRoot = path.join(electron.userData, 'tpo-content');
    expect((await readInstalledManifest(contentRoot)).manifestId).toBe(first.manifest.manifestId);
    expect((await readPendingManifest(contentRoot)).manifestId).toBe(second.manifest.manifestId);

    await setContentBusy(false);
    expect((await readInstalledManifest(contentRoot)).manifestId).toBe(second.manifest.manifestId);
    expect(await readPendingManifest(contentRoot)).toBeNull();
  });

  it('keeps valid installed content available when a later check fails', async () => {
    const first = await createRelease(electron.userData, 'stable');
    await queueRelease(first);
    await initializeContent();
    queueResponse('not json');

    await expect(synchronizeContent()).resolves.toMatchObject({
      status: 'ready',
      ready: true,
      warning: expect.stringContaining('JSON')
    });
  });

  it('repairs a damaged installed pack even when the manifest id is unchanged', async () => {
    const release = await createRelease(electron.userData, 'repair');
    await queueRelease(release);
    await initializeContent();
    const damaged = release.packs[1];
    const installedFile = path.join(
      electron.userData,
      'tpo-content',
      'packs',
      damaged.id,
      damaged.contentHash,
      'assets/questions/compiled/tpo-99-reading.json'
    );
    await fs.writeFile(installedFile, 'damaged');
    queueResponse(JSON.stringify(release.manifest));
    queueResponse(await fs.readFile(damaged.outputPath));

    await expect(synchronizeContent()).resolves.toMatchObject({ status: 'ready', ready: true });
    expect(await fs.readFile(installedFile, 'utf8')).toContain('"marker":"repair"');
  });

  it('defers replacement of a damaged active pack until the exam closes', async () => {
    const release = await createRelease(electron.userData, 'deferred-repair');
    await queueRelease(release);
    await initializeContent();
    const damaged = release.packs[1];
    const installedFile = path.join(
      electron.userData,
      'tpo-content',
      'packs',
      damaged.id,
      damaged.contentHash,
      'assets/questions/compiled/tpo-99-reading.json'
    );
    await fs.writeFile(installedFile, 'damaged');
    await setContentBusy(true);
    queueResponse(JSON.stringify(release.manifest));

    await expect(synchronizeContent()).resolves.toMatchObject({ status: 'ready', ready: true });
    expect(await fs.readFile(installedFile, 'utf8')).toBe('damaged');

    queueResponse(JSON.stringify(release.manifest));
    queueResponse(await fs.readFile(damaged.outputPath));
    await setContentBusy(false);
    expect(await fs.readFile(installedFile, 'utf8')).toContain('"marker":"deferred-repair"');
  });

  it('rejects a manifest whose content identity was tampered with', async () => {
    const release = await createRelease(electron.userData, 'tampered');
    queueResponse(JSON.stringify({ ...release.manifest, manifestId: '0'.repeat(64) }));

    await expect(initializeContent()).resolves.toMatchObject({
      status: 'error',
      ready: false,
      error: expect.stringContaining('manifest id')
    });
    expect(await readInstalledManifest(path.join(electron.userData, 'tpo-content'))).toBeNull();
  });

  it('does not activate an archive that fails its mandatory SHA-256 check', async () => {
    const release = await createRelease(electron.userData, 'corrupt');
    queueResponse(JSON.stringify(release.manifest));
    const archive = await fs.readFile(release.packs[0].outputPath);
    archive[10] ^= 1;
    queueResponse(archive);

    await expect(initializeContent()).resolves.toMatchObject({
      status: 'error',
      ready: false,
      error: expect.stringContaining('integrity check')
    });
    expect(await readInstalledManifest(path.join(electron.userData, 'tpo-content'))).toBeNull();
  });
});
