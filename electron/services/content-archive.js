import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import yauzl from 'yauzl';
import { normalizeContentPath, resolveContentFile } from './content-paths.js';
import { CONTENT_SCHEMA_VERSION, RUNTIME_CONTENT_EXTENSIONS } from './runtime-content.js';

const { mkdir, readFile, rename, rm, stat } = fs.promises;
const MAX_ARCHIVE_FILES = 10_000;
const MAX_EXTRACTED_BYTES = 1024 * 1024 * 1024;

function openZip(filePath) {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true, autoClose: true }, (error, zip) =>
      error ? reject(error) : resolve(zip)
    );
  });
}

function openEntry(zip, entry) {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => (error ? reject(error) : resolve(stream)));
  });
}

function pipeFile(input, outputPath, maxBytes) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath, { flags: 'wx', mode: 0o600 });
    let bytes = 0;
    const fail = error => {
      input.destroy();
      output.destroy();
      reject(error);
    };
    input.on('error', fail);
    input.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) fail(new Error('Content archive entry exceeds its declared size.'));
    });
    output.on('error', fail);
    output.on('finish', resolve);
    input.pipe(output);
  });
}

export async function extractContentArchive(archivePath, destination) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  const zip = await openZip(archivePath);
  let fileCount = 0;
  let extractedBytes = 0;

  try {
    await new Promise((resolve, reject) => {
      let settled = false;
      const fail = error => {
        if (settled) return;
        settled = true;
        zip.close();
        reject(error);
      };
      zip.on('error', fail);
      zip.on('end', () => {
        if (settled) return;
        settled = true;
        resolve();
      });
      zip.on('entry', async entry => {
        try {
          const rawName = entry.fileName.replaceAll('\\', '/');
          if (rawName.endsWith('/')) {
            zip.readEntry();
            return;
          }
          const relativePath = normalizeContentPath(rawName);
          fileCount += 1;
          extractedBytes += entry.uncompressedSize;
          if (fileCount > MAX_ARCHIVE_FILES || extractedBytes > MAX_EXTRACTED_BYTES) {
            throw new Error('Content archive exceeds the extraction limit.');
          }
          const outputPath = resolveContentFile(destination, relativePath);
          await mkdir(path.dirname(outputPath), { recursive: true });
          await pipeFile(await openEntry(zip, entry), outputPath, entry.uncompressedSize);
          zip.readEntry();
        } catch (error) {
          fail(error);
        }
      });
      zip.readEntry();
    });
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
}

export async function validateExtractedPack(directory, expected) {
  const packPath = resolveContentFile(directory, 'pack.json');
  const manifest = JSON.parse(await readFile(packPath, 'utf8'));
  if (
    manifest?.schemaVersion !== CONTENT_SCHEMA_VERSION ||
    manifest.id !== expected.id ||
    manifest.contentHash !== expected.contentHash ||
    !Array.isArray(manifest.files) ||
    manifest.files.length > MAX_ARCHIVE_FILES
  ) {
    throw new Error(`Invalid content pack manifest: ${expected.id}`);
  }
  const seen = new Set();
  const records = [];
  for (const file of manifest.files) {
    const relativePath = normalizeContentPath(file?.path);
    if (
      !relativePath.startsWith('assets/') ||
      !RUNTIME_CONTENT_EXTENSIONS.has(path.extname(relativePath).toLowerCase()) ||
      seen.has(relativePath)
    ) {
      throw new Error(`Invalid content pack file: ${relativePath}`);
    }
    if (!Number.isSafeInteger(file.size) || file.size < 0 || !/^[a-f\d]{64}$/i.test(file.sha256)) {
      throw new Error(`Invalid content pack metadata: ${relativePath}`);
    }
    seen.add(relativePath);
    records.push([relativePath, file.size, file.sha256.toLowerCase()]);
    const target = resolveContentFile(directory, relativePath);
    const info = await stat(target);
    if (!info.isFile() || info.size !== file.size) {
      throw new Error(`Content pack size mismatch: ${relativePath}`);
    }
    const hash = crypto.createHash('sha256');
    await new Promise((resolve, reject) => {
      const input = fs.createReadStream(target);
      input.on('data', chunk => hash.update(chunk));
      input.on('error', reject);
      input.on('end', resolve);
    });
    if (hash.digest('hex') !== file.sha256.toLowerCase()) {
      throw new Error(`Content pack hash mismatch: ${relativePath}`);
    }
  }
  const sortedPaths = [...seen].sort();
  if (JSON.stringify([...seen]) !== JSON.stringify(sortedPaths)) {
    throw new Error(`Content pack files are not canonical: ${expected.id}`);
  }
  const contentHash = crypto.createHash('sha256').update(JSON.stringify(records)).digest('hex');
  if (contentHash !== expected.contentHash) {
    throw new Error(`Content pack identity mismatch: ${expected.id}`);
  }
  const extractedFiles = [];
  async function walk(current) {
    for (const entry of await fs.promises.readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile())
        extractedFiles.push(normalizeContentPath(path.relative(directory, absolute)));
      else throw new Error(`Unsupported content archive entry: ${entry.name}`);
    }
  }
  await walk(directory);
  const allowed = new Set(['pack.json', ...seen]);
  if (extractedFiles.some(file => !allowed.has(file)) || extractedFiles.length !== allowed.size) {
    throw new Error(`Content pack contains unexpected files: ${expected.id}`);
  }
  return manifest;
}

export async function installExtractedPack(staging, destination) {
  await mkdir(path.dirname(destination), { recursive: true });
  await rm(destination, { recursive: true, force: true });
  await rename(staging, destination);
}
