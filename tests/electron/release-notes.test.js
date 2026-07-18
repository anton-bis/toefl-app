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
  assert.match(notes, new RegExp(`\\* ${hash.toUpperCase()}`));
  assert.doesNotMatch(notes, /compare\/v|## Downloads|## Verify downloads/);
});
