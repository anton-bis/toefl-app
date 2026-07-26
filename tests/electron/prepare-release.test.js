import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { prepareMacUpdateMetadata } from '../../scripts/prepare-mac-update-metadata.js';
import { expectedReleaseFiles, prepareRelease } from '../../scripts/prepare-release.js';
import {
  proxiedReleaseAssetUrl,
  proxyUpdateMetadata
} from '../../scripts/proxy-update-metadata.js';

function createReleaseDirectory(version = '9.8.7') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'toefl-release-'));
  for (const file of expectedReleaseFiles(version)) {
    let content = file;
    if (file === 'latest.yml')
      content = `version: ${version}\npath: TOEFL-iBT-Practice-${version}-windows-x64-setup.exe`;
    if (file === 'latest-linux.yml')
      content = `version: ${version}\npath: TOEFL-iBT-Practice-${version}-linux-x64.AppImage`;
    if (file === 'latest-mac.yml')
      content = `version: ${version}\npath: TOEFL-iBT-Practice-${version}-macos-arm64.zip`;
    fs.writeFileSync(path.join(directory, file), content);
  }
  return directory;
}

test('prepareRelease accepts only the public release file set and hashes it', async t => {
  const directory = createReleaseDirectory();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const manifestPath = await prepareRelease(directory, '9.8.7');
  const manifest = fs.readFileSync(manifestPath, 'utf8').trim().split('\n');

  assert.equal(manifest.length, expectedReleaseFiles('9.8.7').length);
  assert.match(manifest[0], /^[a-f0-9]{64} {2}/);
  for (const metadata of ['latest.yml', 'latest-linux.yml', 'latest-mac.yml']) {
    const contents = fs.readFileSync(path.join(directory, metadata), 'utf8');
    assert.match(contents, /https:\/\/v6\.gh-proxy\.org\/https:\/\/github\.com\//);
  }
});

test('prepareRelease rejects incomplete or unexpected output', async t => {
  const directory = createReleaseDirectory();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, 'builder-debug.yml'), 'internal');

  await assert.rejects(prepareRelease(directory, '9.8.7'), /Unexpected: builder-debug.yml/);
});

test('macOS update metadata covers both architectures with integrity hashes', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'toefl-mac-metadata-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const architecture of ['x64', 'arm64']) {
    for (const extension of ['zip', 'dmg']) {
      fs.writeFileSync(
        path.join(directory, `TOEFL-iBT-Practice-9.8.7-macos-${architecture}.${extension}`),
        `${architecture}-${extension}`
      );
    }
  }

  const output = await prepareMacUpdateMetadata(directory, '9.8.7', '2026-07-26T00:00:00.000Z');
  const metadata = fs.readFileSync(output, 'utf8');

  assert.equal((metadata.match(/^ {2}- url:/gm) || []).length, 4);
  assert.match(metadata, /TOEFL-iBT-Practice-9\.8\.7-macos-x64\.dmg/);
  assert.match(metadata, /TOEFL-iBT-Practice-9\.8\.7-macos-arm64\.dmg/);
  assert.match(metadata, /^path: TOEFL-iBT-Practice-9\.8\.7-macos-arm64\.zip$/m);
  assert.equal((metadata.match(/^ {4}sha512: [A-Za-z0-9+/]+=*$/gm) || []).length, 4);
});

test('release metadata proxying is version-specific and idempotent', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'toefl-proxy-metadata-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const metadataPath = path.join(directory, 'latest.yml');
  fs.writeFileSync(
    metadataPath,
    'version: 9.8.7\nfiles:\n  - url: TOEFL-iBT-Practice-9.8.7-windows-x64-setup.exe\npath: TOEFL-iBT-Practice-9.8.7-windows-x64-setup.exe\n'
  );

  await proxyUpdateMetadata(metadataPath);
  const once = fs.readFileSync(metadataPath, 'utf8');
  await proxyUpdateMetadata(metadataPath);
  assert.equal(fs.readFileSync(metadataPath, 'utf8'), once);
  assert.equal(
    (once.match(/https:\/\/v6\.gh-proxy\.org\/https:\/\/github\.com\//g) || []).length,
    2
  );
  assert.equal(
    proxiedReleaseAssetUrl('9.8.7', 'installer.exe'),
    'https://v6.gh-proxy.org/https://github.com/anton-bis/toefl-app/releases/download/v9.8.7/installer.exe'
  );

  fs.writeFileSync(metadataPath, once.replaceAll('v6.gh-proxy.org', 'gh-proxy.org'));
  await proxyUpdateMetadata(metadataPath);
  const migrated = fs.readFileSync(metadataPath, 'utf8');
  assert.doesNotMatch(migrated, /https:\/\/gh-proxy\.org\//);
  assert.equal((migrated.match(/https:\/\/v6\.gh-proxy\.org\//g) || []).length, 2);
});
