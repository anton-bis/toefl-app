#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  contentManifestUrl,
  DEFAULT_CONTENT_BRANCH,
  DEFAULT_CONTENT_REPOSITORY,
  assertPublishedContentManifest
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
  try {
    const prepared = prepareContentPacks(rootDir);
    const remoteById = new Map((remote?.packs || []).map(pack => [pack.id, pack]));
    const manifestId = contentSetId(prepared);
    if (remote?.manifestId === manifestId) {
      console.log('Content is already up to date. Nothing to publish.');
      return remote;
    }

    const changed = prepared.filter(
      item => remoteById.get(item.manifest.id)?.contentHash !== item.manifest.contentHash
    );
    const archives = [];
    for (const item of changed) {
      archives.push(await writePackArchive(rootDir, temporaryDirectory, item));
    }
    const tag = `content-${manifestId.slice(0, 12)}`;
    publishRelease(tag, archives);
    const changedById = new Map(archives.map(item => [item.id, item]));
    const packs = prepared.map(item => {
      const generated = changedById.get(item.manifest.id);
      if (!generated) return remoteById.get(item.manifest.id);
      return {
        id: generated.id,
        contentHash: generated.contentHash,
        archiveHash: generated.archiveHash,
        size: generated.size,
        url: `https://github.com/${repository}/releases/download/${tag}/${generated.fileName}`
      };
    });
    const manifest = {
      schemaVersion: CONTENT_SCHEMA_VERSION,
      manifestId,
      publishedAt: new Date().toISOString(),
      minAppVersion: CONTENT_SCHEMA_MIN_APP_VERSION,
      packs
    };
    assertPublishedContentManifest(manifest);
    publishManifest(manifest, temporaryDirectory);
    writeContentLocalState(rootDir, manifest);
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
