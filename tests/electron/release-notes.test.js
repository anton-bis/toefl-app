import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createReleaseNotes, extractChangelogEntry } from '../../scripts/prepare-release-notes.js';

const fixture = `# Changelog

## [Unreleased]

## [1.2.3] - 2026-07-18

### Fixes

- Fixed a release issue.

[Unreleased]: https://example.com/compare/v1.2.3...HEAD
[1.2.3]: https://example.com/compare/v1.2.2...v1.2.3
`;

test('changelog extraction accepts a tag and stops before comparison links', () => {
  assert.equal(extractChangelogEntry(fixture, 'v1.2.3'), '### Fixes\n\n- Fixed a release issue.');
  assert.throws(() => extractChangelogEntry(fixture, 'v9.9.9'), /has no entry/);
});

test('current release notes contain the changelog and artifact hashes', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url)));
  const changelog = fs.readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8');
  const hash = 'a'.repeat(64);
  const notes = createReleaseNotes(
    changelog,
    packageJson.version,
    `${hash}  TOEFL-iBT-Practice-${packageJson.version}-linux-x64.AppImage\n`
  );

  assert.match(notes, new RegExp(`^## ${packageJson.version}$`, 'm'));
  assert.match(notes, /### SHA256 Hashes of the release artifacts/);
  assert.match(notes, /### macOS manual installation/);
  assert.match(notes, new RegExp(`\\* ${hash.toUpperCase()}`));
  assert.doesNotMatch(notes, /compare\/v|## Downloads|## Verify downloads/);
});

test('macOS releases support manual unsigned installation without partial credentials', () => {
  const workflow = fs.readFileSync(
    new URL('../../.github/workflows/release.yml', import.meta.url),
    'utf8'
  );
  assert.match(workflow, /configured=0/);
  assert.match(workflow, /"\$configured" -ne 0 && "\$configured" -ne 5/);
  assert.match(workflow, /Building an unsigned macOS package for manual installation/);
  assert.match(workflow, /CSC_IDENTITY_AUTO_DISCOVERY=false/);
  assert.match(workflow, /export CSC_LINK="\$MAC_CERTIFICATE"/);
  assert.match(workflow, /codesign --verify --deep --strict/);
  assert.match(workflow, /xcrun stapler validate/);
  assert.match(workflow, /macos-x64\.dmg/);
  assert.match(workflow, /macos-arm64\.dmg/);
  assert.doesNotMatch(workflow, /--universal/);
  assert.doesNotMatch(workflow, /workflow_dispatch/);
  assert.doesNotMatch(workflow, /--generate-notes/);
});

test('the packaged user interface does not expose repository navigation', () => {
  const main = fs.readFileSync(new URL('../../electron/main.js', import.meta.url), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url)));

  assert.doesNotMatch(main, /github\.com/);
  assert.equal(packageJson.repository, undefined);
  assert.equal(packageJson.homepage, undefined);
  assert.equal(packageJson.bugs, undefined);
});
