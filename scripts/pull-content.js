#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import {
  assertPublishedContentManifest,
  contentManifestUrl,
  DEFAULT_CONTENT_BRANCH,
  DEFAULT_CONTENT_REPOSITORY,
  validateContentUrl
} from '../electron/services/content-config.js';
import {
  extractContentArchive,
  validateExtractedPack
} from '../electron/services/content-archive.js';
import { isMediaPath } from '../src/content/packs.js';
import { readContentLocalState, writeContentLocalState } from './content-local-state.js';

const rootDir = path.resolve(import.meta.dirname, '..');
const repository = process.env.TOEFL_CONTENT_REPOSITORY || DEFAULT_CONTENT_REPOSITORY;
const contentBranch = process.env.TOEFL_CONTENT_BRANCH || DEFAULT_CONTENT_BRANCH;

async function download(url, outputPath, expectedHash, maxBytes) {
  validateContentUrl(url);
  const response = await fetch(url, { headers: { 'user-agent': 'toefl-content-puller' } });
  validateContentUrl(response.url);
  if (!response.ok || !response.body)
    throw new Error(`Content download failed: HTTP ${response.status}`);
  const hash = crypto.createHash('sha256');
  let total = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      total += chunk.length;
      if (total > maxBytes) {
        callback(new Error('Content download exceeds its declared size.'));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    }
  });
  await pipeline(
    Readable.fromWeb(response.body),
    meter,
    fs.createWriteStream(outputPath, { flags: 'wx', mode: 0o600 })
  );
  if (total !== maxBytes || hash.digest('hex') !== expectedHash) {
    throw new Error('Downloaded content failed its integrity check.');
  }
}

export async function pullContent() {
  const manifestUrl = `${contentManifestUrl(repository, contentBranch)}?t=${Date.now()}`;
  const response = await fetch(manifestUrl, { headers: { 'user-agent': 'toefl-content-puller' } });
  if (!response.ok) throw new Error(`Could not read the content manifest: HTTP ${response.status}`);
  const manifest = assertPublishedContentManifest(await response.json());
  const localState = readContentLocalState(rootDir);
  const force = process.argv.includes('--force');
  if (!force && localState?.manifestId === manifest.manifestId) {
    console.log('Local content media is already up to date.');
    return;
  }
  const temporaryDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'toefl-content-pull-')
  );
  let restored = 0;
  try {
    for (const pack of manifest.packs) {
      if (!force && localState?.packs?.[pack.id] === pack.contentHash) continue;
      const archivePath = path.join(temporaryDirectory, `${pack.id}.zip`);
      const extractedPath = path.join(temporaryDirectory, pack.id);
      await download(pack.url, archivePath, pack.archiveHash, pack.size);
      await extractContentArchive(archivePath, extractedPath);
      const packManifest = await validateExtractedPack(extractedPath, pack);
      for (const file of packManifest.files.filter(item => isMediaPath(item.path))) {
        const source = path.join(extractedPath, file.path);
        const destination = path.join(rootDir, file.path);
        await fs.promises.mkdir(path.dirname(destination), { recursive: true });
        await fs.promises.copyFile(source, destination);
        restored += 1;
      }
    }
    writeContentLocalState(rootDir, manifest);
    console.log(`Restored ${restored} media file(s) from published content.`);
  } finally {
    await fs.promises.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  pullContent().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
