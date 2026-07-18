import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { expectedReleaseFiles, prepareRelease } from '../../scripts/prepare-release.js';

function createReleaseDirectory(version = '9.8.7') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'toefl-release-'));
  for (const file of expectedReleaseFiles(version)) {
    let content = file;
    if (file === 'latest.yml')
      content = `path: TOEFL-iBT-Practice-${version}-windows-x64-setup.exe`;
    if (file === 'latest-linux.yml')
      content = `path: TOEFL-iBT-Practice-${version}-linux-x64.AppImage`;
    if (file === 'latest-mac.yml')
      content = `path: TOEFL-iBT-Practice-${version}-macos-universal.zip`;
    fs.writeFileSync(path.join(directory, file), content);
  }
  return directory;
}

test('prepareRelease accepts only the public release file set and hashes it', t => {
  const directory = createReleaseDirectory();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const manifestPath = prepareRelease(directory, '9.8.7');
  const manifest = fs.readFileSync(manifestPath, 'utf8').trim().split('\n');

  assert.equal(manifest.length, expectedReleaseFiles('9.8.7').length);
  assert.match(manifest[0], /^[a-f0-9]{64} {2}/);
});

test('prepareRelease rejects incomplete or unexpected output', t => {
  const directory = createReleaseDirectory();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, 'builder-debug.yml'), 'internal');

  assert.throws(() => prepareRelease(directory, '9.8.7'), /Unexpected: builder-debug.yml/);
});
