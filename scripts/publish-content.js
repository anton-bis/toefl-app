#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import {
  assertPublishedContentManifest,
  contentDownloadUrl,
  contentManifestUrl,
  contentOssBase,
  contentOssPackUrl,
  DEFAULT_CONTENT_BRANCH,
  DEFAULT_CONTENT_REPOSITORY
} from '../electron/services/content-config.js';
import {
  CONTENT_SCHEMA_MIN_APP_VERSION,
  CONTENT_SCHEMA_VERSION
} from '../electron/services/runtime-content.js';
import { contentSetId, prepareContentPacks, writePackArchive } from './content-packages.js';
import { readContentLocalState, writeContentLocalState } from './content-local-state.js';

const rootDir = path.resolve(import.meta.dirname, '..');
const repository = process.env.TOEFL_CONTENT_REPOSITORY || DEFAULT_CONTENT_REPOSITORY;
const contentBranch = process.env.TOEFL_CONTENT_BRANCH || DEFAULT_CONTENT_BRANCH;
const manifestUrl = contentManifestUrl(repository, contentBranch);
const ossBucket = process.env.OSS_BUCKET || 'justtofu-downloads';
const ossContentPrefix = new URL(contentOssBase()).pathname.replace(/^\/+|\/+$/g, '');

export function contentPackFileName(packId, contentHash) {
  return `${packId}-${contentHash.slice(0, 12)}.zip`;
}

function ossUrlMatchesPack(pack) {
  if (!pack?.ossUrl) return false;
  try {
    const name = decodeURIComponent(new URL(pack.ossUrl).pathname.split('/').pop() || '');
    return name === contentPackFileName(pack.id, pack.contentHash);
  } catch {
    return false;
  }
}

function command(commandName, args, options = {}) {
  return execFileSync(commandName, args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: options.input ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    ...options
  }).trim();
}

function assertPublishableCheckout() {
  if (command('git', ['status', '--porcelain', '--untracked-files=no'])) {
    throw new Error('Commit tracked question-bank changes before publishing content.');
  }
  const branch = command('git', ['branch', '--show-current']);
  if (!branch || branch === contentBranch) {
    throw new Error(
      'Publish content from a normal development branch, not the generated content branch.'
    );
  }
  command('git', ['fetch', '--no-tags', 'origin', `refs/heads/${branch}`]);
  if (command('git', ['rev-parse', 'HEAD']) !== command('git', ['rev-parse', 'FETCH_HEAD'])) {
    throw new Error(`Push ${branch} and make sure it is current before publishing content.`);
  }
}

async function readRemoteManifest() {
  const response = await fetch(`${manifestUrl}?t=${Date.now()}`, {
    headers: { 'user-agent': 'toefl-content-publisher' }
  });
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`Could not read the published manifest: HTTP ${response.status}`);
  return assertPublishedContentManifest(await response.json());
}

function releaseExists(tag) {
  return (
    spawnSync('gh', ['release', 'view', tag, '--repo', repository], {
      cwd: rootDir,
      stdio: 'ignore'
    }).status === 0
  );
}

function assertGitHubCli() {
  const result = spawnSync('gh', ['--version'], { cwd: rootDir, encoding: 'utf8' });
  if (result.error?.code === 'ENOENT') {
    throw new Error('Install GitHub CLI from https://cli.github.com/ before publishing content.');
  }
  if (result.status !== 0) throw new Error(result.stderr?.trim() || 'GitHub CLI is unavailable.');
}

function publishRelease(tag, archives) {
  if (!releaseExists(tag)) {
    command('gh', [
      'release',
      'create',
      tag,
      ...archives.map(item => item.outputPath),
      '--repo',
      repository,
      '--target',
      command('git', ['rev-parse', 'HEAD']),
      '--title',
      `Content ${tag.slice('content-'.length)}`,
      '--notes',
      'Automatically generated, content-addressed TOEFL content packs.',
      '--prerelease'
    ]);
    return;
  }
  if (archives.length) {
    command('gh', [
      'release',
      'upload',
      tag,
      ...archives.map(item => item.outputPath),
      '--repo',
      repository,
      '--clobber'
    ]);
  }
}

function publishManifest(manifest, temporaryDirectory) {
  const manifestPath = path.join(temporaryDirectory, 'manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const remote = command('git', ['ls-remote', '--heads', 'origin', `refs/heads/${contentBranch}`]);
  let parent = '';
  if (remote) {
    command('git', ['fetch', '--no-tags', 'origin', `refs/heads/${contentBranch}`]);
    parent = command('git', ['rev-parse', 'FETCH_HEAD']);
  }
  const blob = command('git', ['hash-object', '-w', manifestPath]);
  const tree = command('git', ['mktree'], { input: `100644 blob ${blob}\tmanifest.json\n` });
  const commitArgs = ['commit-tree', tree];
  if (parent) commitArgs.push('-p', parent);
  const commit = command('git', commitArgs, {
    input: `Publish content ${manifest.manifestId.slice(0, 12)}\n`
  });
  command('git', ['push', 'origin', `${commit}:refs/heads/${contentBranch}`]);
}

function ossutilAvailable() {
  if (process.env.TOEFL_CONTENT_SKIP_OSS_MIRROR === '1') return false;
  const result = spawnSync('ossutil', ['--version'], { cwd: rootDir, encoding: 'utf8' });
  return !result.error && result.status === 0;
}

function ossutilCopy(args) {
  const result = spawnSync('ossutil', ['cp', ...args], {
    cwd: rootDir,
    encoding: 'utf8',
    env: process.env
  });
  if (result.error) return result.error.message;
  if (result.status !== 0)
    return (result.stderr || result.stdout || '').trim() || `ossutil exited with ${result.status}`;
  return null;
}

function uploadDirectoryContents(directory, manifestShort) {
  const error = ossutilCopy([
    '-r',
    '-f',
    `${directory}${path.sep}`,
    `oss://${ossBucket}/${ossContentPrefix}${manifestShort}/`,
    '--update',
    '--acl',
    'public-read'
  ]);
  return error ? { ok: false, message: error } : { ok: true, message: '' };
}

function uploadManifestCopies(manifestPath, manifestShort) {
  const directoryError = ossutilCopy([
    '-f',
    manifestPath,
    `oss://${ossBucket}/${ossContentPrefix}${manifestShort}/manifest.json`,
    '--acl',
    'public-read'
  ]);
  if (directoryError) return { ok: false, message: directoryError };
  const pointerError = ossutilCopy([
    '-f',
    manifestPath,
    `oss://${ossBucket}/${ossContentPrefix}manifest.json`,
    '--acl',
    'public-read'
  ]);
  return { ok: !pointerError, message: pointerError || '' };
}

async function downloadPublishedArchive(pack, destination) {
  const response = await fetch(pack.url, { headers: { 'user-agent': 'toefl-content-publisher' } });
  if (!response.ok || !response.body)
    throw new Error(`Could not download ${pack.id}: HTTP ${response.status}`);
  const hash = crypto.createHash('sha256');
  let total = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      total += chunk.length;
      if (total > pack.size) {
        callback(new Error(`${pack.id} exceeds its declared archive size.`));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    }
  });
  await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(destination));
  if (total !== pack.size || hash.digest('hex') !== pack.archiveHash.toLowerCase()) {
    throw new Error(`${pack.id} failed its archive integrity check.`);
  }
}

export async function publishContent() {
  assertGitHubCli();
  command('gh', ['auth', 'status']);
  assertPublishableCheckout();
  const remote = await readRemoteManifest();
  const localState = readContentLocalState(rootDir);
  if (remote && localState?.manifestId !== remote.manifestId) {
    throw new Error('Run npm run content:pull before publishing from this checkout.');
  }
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'toefl-content-publish-'));
  const mirrorDirectory = path.join(temporaryDirectory, 'content-oss');
  fs.mkdirSync(mirrorDirectory, { recursive: true });
  const mirrorEnabled = ossutilAvailable();
  try {
    const prepared = prepareContentPacks(rootDir);
    const remoteById = new Map((remote?.packs || []).map(pack => [pack.id, pack]));
    const manifestId = contentSetId(prepared);
    const manifestShort = manifestId.slice(0, 12);
    const missingOssUrl = remote ? remote.packs.some(pack => !ossUrlMatchesPack(pack)) : true;
    if (remote?.manifestId === manifestId && !missingOssUrl) {
      console.log('Content is already up to date. Nothing to publish.');
      if (mirrorEnabled) {
        const manifestPath = path.join(mirrorDirectory, 'manifest.json');
        fs.writeFileSync(manifestPath, `${JSON.stringify(remote, null, 2)}\n`);
        const copies = uploadManifestCopies(manifestPath, manifestShort);
        if (!copies.ok) {
          console.warn(`OSS manifest pointer refresh failed: ${copies.message}`);
        }
      }
      return remote;
    }

    const changed = prepared.filter(
      item => remoteById.get(item.manifest.id)?.contentHash !== item.manifest.contentHash
    );
    const archives = [];
    for (const item of changed) {
      archives.push(await writePackArchive(rootDir, temporaryDirectory, item));
    }
    const changedById = new Map(archives.map(item => [item.id, item]));
    const tag = `content-${manifestShort}`;
    if (changed.length) publishRelease(tag, archives);

    const warnings = [];
    const stagedFiles = [];
    for (const item of prepared) {
      const archive = changedById.get(item.manifest.id);
      const remotePack = remoteById.get(item.manifest.id);
      const fileName = contentPackFileName(item.manifest.id, item.manifest.contentHash);
      if (archive) {
        fs.copyFileSync(archive.outputPath, path.join(mirrorDirectory, fileName));
        stagedFiles.push(fileName);
      } else if (mirrorEnabled && remotePack && !ossUrlMatchesPack(remotePack)) {
        try {
          await downloadPublishedArchive(remotePack, path.join(mirrorDirectory, fileName));
          stagedFiles.push(fileName);
        } catch (error) {
          warnings.push(`${item.manifest.id}: ${error.message}`);
        }
      }
    }

    let mirrorResult = { ok: false, message: '' };
    if (stagedFiles.length) {
      if (mirrorEnabled) {
        mirrorResult = uploadDirectoryContents(mirrorDirectory, manifestShort);
      } else {
        mirrorResult = {
          ok: false,
          message: 'ossutil is unavailable or TOEFL_CONTENT_SKIP_OSS_MIRROR is set'
        };
      }
    }
    const mirroredFiles = mirrorResult.ok ? new Set(stagedFiles) : new Set();

    const packs = prepared.map(item => {
      const generated = changedById.get(item.manifest.id);
      const remotePack = remoteById.get(item.manifest.id);
      const fileName = contentPackFileName(item.manifest.id, item.manifest.contentHash);
      const pack = generated
        ? {
            id: generated.id,
            contentHash: generated.contentHash,
            archiveHash: generated.archiveHash,
            size: generated.size,
            url: contentDownloadUrl(
              `https://github.com/${repository}/releases/download/${tag}/${generated.fileName}`
            )
          }
        : {
            id: remotePack.id,
            contentHash: remotePack.contentHash,
            archiveHash: remotePack.archiveHash,
            size: remotePack.size,
            url: remotePack.url
          };
      if (!generated && ossUrlMatchesPack(remotePack)) {
        pack.ossUrl = remotePack.ossUrl;
      } else if (mirroredFiles.has(fileName)) {
        pack.ossUrl = contentOssPackUrl(manifestShort, fileName);
      }
      return pack;
    });
    const manifest = {
      schemaVersion: CONTENT_SCHEMA_VERSION,
      manifestId,
      publishedAt: new Date().toISOString(),
      minAppVersion: CONTENT_SCHEMA_MIN_APP_VERSION,
      packs
    };
    assertPublishedContentManifest(manifest);

    const manifestChanged =
      changed.length > 0 || JSON.stringify(packs) !== JSON.stringify(remote?.packs || []);
    if (manifestChanged) {
      publishManifest(manifest, temporaryDirectory);
      writeContentLocalState(rootDir, manifest);
    }

    const manifestPath = path.join(mirrorDirectory, 'manifest.json');
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    if (mirrorEnabled && (stagedFiles.length || manifestChanged)) {
      const copies = uploadManifestCopies(manifestPath, manifestShort);
      if (!copies.ok) warnings.push(`OSS manifest copy/pointer upload failed: ${copies.message}`);
    }
    if (stagedFiles.length && !mirrorResult.ok) {
      warnings.push(
        `OSS archive mirror failed (GitHub publish unaffected): ${mirrorResult.message}`
      );
    }

    for (const warning of warnings) console.warn(warning);
    if (!mirrorResult.ok && stagedFiles.length) {
      console.warn('Rerun npm run content:publish after fixing the OSS setup to heal the mirror.');
    }
    console.log(`Published ${changed.length} changed pack(s) as ${tag}.`);
    return manifest;
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  publishContent().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
