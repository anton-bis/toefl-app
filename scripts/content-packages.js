import fs from 'node:fs';
import path from 'node:path';
import { ZipFile } from 'yazl';
import { generateQuestionContent } from './generate-question-manifest.js';
import { writeCompiledQuestionContent } from '../src/content/compiler.js';
import {
  createManifestId,
  createPackManifest,
  discoverContentPacks,
  sha256
} from '../src/content/packs.js';

const FIXED_ARCHIVE_DATE = new Date('1980-01-01T00:00:00.000Z');

export function prepareContentPacks(rootDir) {
  const compiled = generateQuestionContent(rootDir);
  const compiledDirectory = path.join(rootDir, 'assets/questions/compiled');
  fs.rmSync(compiledDirectory, { recursive: true, force: true });
  fs.mkdirSync(compiledDirectory, { recursive: true });
  writeCompiledQuestionContent(rootDir, compiled);
  return discoverContentPacks(rootDir, compiled.manifest).map(definition => ({
    definition,
    manifest: createPackManifest(rootDir, definition)
  }));
}

export async function writePackArchive(rootDir, outputDir, prepared) {
  fs.mkdirSync(outputDir, { recursive: true });
  const shortHash = prepared.manifest.contentHash.slice(0, 12);
  const fileName = `${prepared.manifest.id}-${shortHash}.zip`;
  const outputPath = path.join(outputDir, fileName);
  const output = fs.createWriteStream(outputPath, { flags: 'w', mode: 0o600 });
  const archive = new ZipFile();
  const completed = new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
  });
  archive.outputStream.pipe(output);
  archive.addBuffer(Buffer.from(`${JSON.stringify(prepared.manifest)}\n`, 'utf8'), 'pack.json', {
    mtime: FIXED_ARCHIVE_DATE,
    mode: 0o600
  });
  for (const relativePath of prepared.definition.files) {
    archive.addFile(path.join(rootDir, relativePath), relativePath, {
      mtime: FIXED_ARCHIVE_DATE,
      mode: 0o600
    });
  }
  archive.end();
  await completed;
  const data = fs.readFileSync(outputPath);
  return {
    id: prepared.manifest.id,
    contentHash: prepared.manifest.contentHash,
    archiveHash: sha256(data),
    size: data.length,
    fileName,
    outputPath
  };
}

export function contentSetId(prepared) {
  return createManifestId(
    prepared.map(item => ({ id: item.manifest.id, contentHash: item.manifest.contentHash }))
  );
}
