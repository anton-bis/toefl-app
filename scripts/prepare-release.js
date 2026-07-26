import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const packageJson = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);

export function expectedReleaseFiles(version = packageJson.version) {
  const prefix = `TOEFL-iBT-Practice-${version}`;
  return [
    `${prefix}-windows-x64-setup.exe`,
    `${prefix}-windows-x64-setup.exe.blockmap`,
    `${prefix}-linux-x64.AppImage`,
    `${prefix}-macos-x64.dmg`,
    `${prefix}-macos-x64.zip`,
    `${prefix}-macos-x64.zip.blockmap`,
    `${prefix}-macos-arm64.dmg`,
    `${prefix}-macos-arm64.zip`,
    `${prefix}-macos-arm64.zip.blockmap`,
    'latest.yml',
    'latest-linux.yml',
    'latest-mac.yml'
  ];
}

async function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest('hex');
}

export async function prepareRelease(directory, version = packageJson.version) {
  const expected = expectedReleaseFiles(version).sort();
  const actual = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name !== 'hashes.sha256')
    .map(entry => entry.name)
    .sort();

  if (actual.join('\n') !== expected.join('\n')) {
    const missing = expected.filter(file => !actual.includes(file));
    const unexpected = actual.filter(file => !expected.includes(file));
    throw new Error(
      [
        'Invalid release file set.',
        `Missing: ${missing.join(', ') || 'none'}`,
        `Unexpected: ${unexpected.join(', ') || 'none'}`
      ].join('\n')
    );
  }

  const updateTargets = new Map([
    ['latest.yml', `${expected.find(file => file.endsWith('-setup.exe'))}`],
    ['latest-linux.yml', `${expected.find(file => file.endsWith('.AppImage'))}`],
    ['latest-mac.yml', `${expected.find(file => file.endsWith('-macos-arm64.zip'))}`]
  ]);
  for (const [metadata, artifact] of updateTargets) {
    const content = fs.readFileSync(path.join(directory, metadata), 'utf8');
    if (!content.includes(artifact)) {
      throw new Error(`${metadata} does not reference ${artifact}.`);
    }
  }

  const manifest = [];
  for (const file of actual) {
    manifest.push(`${await sha256(path.join(directory, file))}  ${file}`);
  }
  const manifestPath = path.join(directory, 'hashes.sha256');
  await fs.promises.writeFile(manifestPath, `${manifest.join('\n')}\n`);
  return manifestPath;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const directory = path.resolve(process.argv[2] || 'release-files');
  prepareRelease(directory)
    .then(manifestPath => console.log(`Release files validated; wrote ${manifestPath}`))
    .catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
