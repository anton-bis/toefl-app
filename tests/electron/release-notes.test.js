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
  const releaseVersion = packageJson.version.split('-')[0];
  const changelog = fs.readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8');
  const hash = 'a'.repeat(64);
  const notes = createReleaseNotes(
    changelog,
    releaseVersion,
    `${hash}  TOEFL-iBT-Practice-${releaseVersion}-linux-x64.AppImage\n`
  );

  assert.match(notes, new RegExp(`^## ${releaseVersion}$`, 'm'));
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

test('develop pushes create isolated automatic prereleases', () => {
  const workflow = fs.readFileSync(
    new URL('../../.github/workflows/release.yml', import.meta.url),
    'utf8'
  );
  assert.match(workflow, /branches: \[develop\]/);
  assert.match(workflow, /cancel-in-progress:.*refs\/heads\/develop/);
  assert.match(workflow, /-dev\.\$\{GITHUB_RUN_NUMBER\}/);
  assert.match(workflow, /release_tag="v\$\{version\}"/);
  assert.match(workflow, /release_flags=\(--target "\$GITHUB_SHA" --prerelease\)/);
  assert.match(workflow, /release_title="\$release_tag"/);
  assert.match(workflow, /release_notes=\(--notes ""\)/);
  assert.doesNotMatch(workflow, /Prepare develop prerelease notes/);
  assert.match(workflow, /release_flags=\(--verify-tag --fail-on-no-commits\)/);
});

test('the packaged user interface does not expose repository navigation', () => {
  const main = fs.readFileSync(new URL('../../electron/main.js', import.meta.url), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url)));

  assert.doesNotMatch(main, /github\.com/);
  assert.equal(packageJson.repository, undefined);
  assert.equal(packageJson.homepage, undefined);
  assert.equal(packageJson.bugs, undefined);
});
