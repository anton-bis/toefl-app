import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const packageJson = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);
const ARCHITECTURES = ['x64', 'arm64'];
const EXTENSIONS = ['zip', 'dmg'];

async function sha512(filePath) {
  const hash = crypto.createHash('sha512');
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest('base64');
}

export async function prepareMacUpdateMetadata(
  directory,
  version = packageJson.version,
  releaseDate = new Date().toISOString()
) {
  const files = [];
  for (const architecture of ARCHITECTURES) {
    for (const extension of EXTENSIONS) {
      const url = `TOEFL-iBT-Practice-${version}-macos-${architecture}.${extension}`;
      const filePath = path.join(directory, url);
      const stats = await fs.promises.stat(filePath);
      files.push({ url, sha512: await sha512(filePath), size: stats.size });
    }
  }

  const preferred = files.find(file => file.url.endsWith('-arm64.zip'));
  const lines = [
    `version: ${version}`,
    'files:',
    ...files.flatMap(file => [
      `  - url: ${file.url}`,
      `    sha512: ${file.sha512}`,
      `    size: ${file.size}`
    ]),
    `path: ${preferred.url}`,
    `sha512: ${preferred.sha512}`,
    `releaseDate: '${releaseDate}'`,
    ''
  ];
  const output = path.join(directory, 'latest-mac.yml');
  await fs.promises.writeFile(output, lines.join('\n'));
  return output;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  prepareMacUpdateMetadata(path.resolve(process.argv[2] || 'release'))
    .then(output => console.log(`macOS update metadata written to ${output}`))
    .catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
