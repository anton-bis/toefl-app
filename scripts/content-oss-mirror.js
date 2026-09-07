#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { contentOssBase, contentOssPackUrl } from '../electron/services/content-config.js';

const rootDir = path.resolve('.');
const repository = process.env.TOEFL_CONTENT_REPOSITORY || 'anton-bis/toefl-app';
const contentBranch = process.env.TOEFL_CONTENT_BRANCH || 'content';
const GITHUB_HOSTS = new Set([
  'github.com',
  'raw.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com'
]);
const PROXY_HOSTS = new Set(['v6.gh-proxy.org', 'gh-proxy.org']);

export function contentPackFileName(packId, contentHash) {
  return `${packId}-${contentHash.slice(0, 12)}.zip`;
}

export function ossBucket() {
  if (process.env.OSS_BUCKET) return process.env.OSS_BUCKET;
  return new URL(contentOssBase()).hostname.split('.')[0];
}

export function ossContentPrefix() {
  return new URL(contentOssBase()).pathname.replace(/^\/+|\/+$/g, '');
}

export function directPackUrl(packUrl) {
  const url = new URL(packUrl);
  if (PROXY_HOSTS.has(url.hostname)) {
    const target = new URL(`${url.pathname.slice(1)}${url.search}`);
    if (!GITHUB_HOSTS.has(target.hostname)) {
      throw new Error(`Untrusted pack URL target: ${target.hostname}`);
    }
    return target.toString();
  }
  if (!GITHUB_HOSTS.has(url.hostname)) {
    throw new Error(`Untrusted pack URL host: ${url.hostname}`);
  }
  return url.toString();
}

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: options.input ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    ...options
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || '').trim() || `${commandName} failed.`);
  }
  return String(result.stdout || '').trim();
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

async function downloadArchive(pack, destination) {
  const response = await fetch(directPackUrl(pack.url), {
    headers: { 'user-agent': 'toefl-content-oss-mirror' }
  });
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

function publishBranchManifest(manifestPath, manifestId) {
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
    input: `Publish content ${manifestId.slice(0, 12)}\n`
  });
  command('git', ['push', 'origin', `${commit}:refs/heads/${contentBranch}`]);
}

export async function contentOssMirror() {
  const manifestResponse = await fetch(
    `https://raw.githubusercontent.com/${repository}/${contentBranch}/manifest.json?t=${Date.now()}`,
    { headers: { 'user-agent': 'toefl-content-oss-mirror' } }
  );
  if (!manifestResponse.ok)
    throw new Error(`Could not read the content manifest: HTTP ${manifestResponse.status}`);
  const manifest = await manifestResponse.json();
  if (!Array.isArray(manifest?.packs) || !manifest.packs.length) {
    throw new Error('The published content manifest is invalid.');
  }
  const manifestShort = manifest.manifestId.slice(0, 12);
  const missing = manifest.packs.filter(pack => !pack.ossUrl);

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'toefl-content-oss-'));
  try {
    const staging = path.join(temporaryDirectory, 'archives');
    fs.mkdirSync(staging, { recursive: true });
    for (const pack of missing) {
      await downloadArchive(
        pack,
        path.join(staging, contentPackFileName(pack.id, pack.contentHash))
      );
    }

    const stagedManifest = missing.length
      ? {
          ...manifest,
          packs: manifest.packs.map(pack =>
            pack.ossUrl
              ? pack
              : {
                  ...pack,
                  ossUrl: contentOssPackUrl(
                    manifestShort,
                    contentPackFileName(pack.id, pack.contentHash)
                  )
                }
          )
        }
      : manifest;
    const manifestPath = path.join(temporaryDirectory, 'manifest.json');
    fs.writeFileSync(manifestPath, `${JSON.stringify(stagedManifest, null, 2)}\n`);

    if (missing.length) {
      const archiveError = ossutilCopy([
        '-r',
        '-f',
        `${staging}${path.sep}`,
        `oss://${ossBucket()}/${ossContentPrefix()}/${manifestShort}/`,
        '--update',
        '--acl',
        'public-read'
      ]);
      if (archiveError) throw new Error(`OSS archive upload failed: ${archiveError}`);
    }
    if (missing.length) {
      publishBranchManifest(manifestPath, manifest.manifestId);
    }

    const directoryError = ossutilCopy([
      '-f',
      manifestPath,
      `oss://${ossBucket()}/${ossContentPrefix()}/${manifestShort}/manifest.json`,
      '--acl',
      'public-read'
    ]);
    if (directoryError) throw new Error(`OSS manifest upload failed: ${directoryError}`);
    const pointerError = ossutilCopy([
      '-f',
      manifestPath,
      `oss://${ossBucket()}/${ossContentPrefix()}/manifest.json`,
      '--acl',
      'public-read'
    ]);
    if (pointerError) throw new Error(`OSS pointer upload failed: ${pointerError}`);

    if (missing.length) {
      console.log(`Mirrored ${missing.length} pack(s) with ossUrl to ${manifestShort}.`);
    } else {
      console.log('Content OSS mirror is already up to date.');
    }
    return stagedManifest;
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  contentOssMirror().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
