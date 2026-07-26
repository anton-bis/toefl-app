import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageJson = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeVersion(value) {
  const version = String(value || '')
    .trim()
    .replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid release version: ${value || 'empty'}`);
  }
  return version;
}

export function extractChangelogEntry(changelog, releaseVersion) {
  const version = normalizeVersion(releaseVersion);
  const heading = new RegExp(
    `^## \\[${escapeRegExp(version)}\\](?: - \\d{4}-\\d{2}-\\d{2})?$`,
    'm'
  );
  const match = heading.exec(changelog);
  if (!match) throw new Error(`CHANGELOG.md has no entry for ${version}.`);

  const remainder = changelog.slice(match.index + match[0].length);
  const boundary = /^(?:## \[|\[[^\]]+\]:\s)/m.exec(remainder);
  const entry = remainder.slice(0, boundary?.index ?? remainder.length).trim();
  if (!entry) throw new Error(`CHANGELOG.md entry for ${version} is empty.`);
  return entry;
}

function formatHashes(value) {
  const hashes = value.trim();
  if (!hashes) return '';
  const entries = hashes.split('\n').map(line => {
    const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);
    if (!match) throw new Error(`Invalid SHA-256 manifest line: ${line}`);
    return `  * ${match[2]}\n    * ${match[1].toUpperCase()}`;
  });
  return `\n\n### SHA256 Hashes of the release artifacts\n\n${entries.join('\n')}`;
}

export function createReleaseNotes(changelog, releaseVersion, hashes = '') {
  const version = normalizeVersion(releaseVersion);
  const entry = extractChangelogEntry(changelog, version);
  const macInstructions = `### macOS manual installation

The macOS package is not Apple-notarized. Download the arm64 DMG for Apple Silicon or the x64 DMG for an Intel Mac, drag the app into Applications and replace the previous version. On first launch, right-click the app and choose **Open**; if macOS still blocks it, allow it in **System Settings → Privacy & Security**.`;
  return `## ${version}\n\n${entry}\n\n${macInstructions}${formatHashes(hashes)}\n`;
}

function writeReleaseNotes({ changelogPath, hashesPath, outputPath, version }) {
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  const hashes = hashesPath ? fs.readFileSync(hashesPath, 'utf8') : '';
  const notes = createReleaseNotes(changelog, version, hashes);
  fs.writeFileSync(outputPath, notes);
  return outputPath;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const version = process.argv[2] || packageJson.version;
  const outputPath = path.resolve(process.argv[3] || 'release-notes.md');
  const hashesPath = process.argv[4] ? path.resolve(process.argv[4]) : undefined;
  try {
    writeReleaseNotes({
      changelogPath: path.resolve('CHANGELOG.md'),
      hashesPath,
      outputPath,
      version
    });
    console.log(`Release notes written to ${outputPath}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
