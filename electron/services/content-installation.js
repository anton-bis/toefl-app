import fs from 'node:fs';
import path from 'node:path';
import { assertContentManifest } from './runtime-content.js';
import { resolveContentFile } from './content-paths.js';

const { access, mkdir, readFile, rename, rm, writeFile } = fs.promises;
export const CONTENT_DIR_NAME = 'tpo-content';

export function getContentRoot(userDataPath) {
  return path.join(userDataPath, CONTENT_DIR_NAME);
}

export function getPackDirectory(contentRoot, pack) {
  return path.join(contentRoot, 'packs', pack.id, pack.contentHash);
}

async function readManifestFile(filePath) {
  try {
    return assertContentManifest(JSON.parse(await readFile(filePath, 'utf8')));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    if (!error?.code) return null;
    throw error;
  }
}

export async function readInstalledManifest(contentRoot) {
  const currentPath = path.join(contentRoot, 'current.json');
  const current = await readManifestFile(currentPath);
  if (current) return current;
  const recovered = await readManifestFile(path.join(contentRoot, 'current.previous.json'));
  if (recovered) await activateManifest(contentRoot, recovered);
  return recovered;
}

export async function readPendingManifest(contentRoot) {
  return readManifestFile(path.join(contentRoot, 'pending.json'));
}

async function replaceManifestFile(contentRoot, name, manifest) {
  await mkdir(contentRoot, { recursive: true });
  const target = path.join(contentRoot, name);
  const temporary = path.join(contentRoot, `${name}.${process.pid}.${Date.now()}.tmp`);
  const previous = path.join(contentRoot, `${path.basename(name, '.json')}.previous.json`);
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  await rm(previous, { force: true });
  let backedUp = false;
  try {
    await rename(target, previous);
    backedUp = true;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  try {
    await rename(temporary, target);
    await rm(previous, { force: true });
  } catch (error) {
    if (backedUp) await rename(previous, target).catch(() => {});
    await rm(temporary, { force: true });
    throw error;
  }
}

export async function activateManifest(contentRoot, manifest) {
  assertContentManifest(manifest);
  await replaceManifestFile(contentRoot, 'current.json', manifest);
  await rm(path.join(contentRoot, 'pending.json'), { force: true });
}

export async function savePendingManifest(contentRoot, manifest) {
  assertContentManifest(manifest);
  await replaceManifestFile(contentRoot, 'pending.json', manifest);
}

export function activePackRoots(contentRoot, manifest) {
  return manifest ? manifest.packs.map(pack => getPackDirectory(contentRoot, pack)) : [];
}

export async function isInstalledManifestReady(contentRoot, manifest) {
  if (!manifest) return false;
  try {
    for (const pack of manifest.packs) {
      await access(resolveContentFile(getPackDirectory(contentRoot, pack), 'pack.json'));
    }
    const catalog = manifest.packs.find(pack => pack.id === 'catalog');
    if (!catalog) return false;
    await access(
      resolveContentFile(
        getPackDirectory(contentRoot, catalog),
        'assets/questions/compiled/manifest.json'
      )
    );
    return true;
  } catch {
    return false;
  }
}

export async function hasLegacyContent(contentRoot) {
  try {
    await access(resolveContentFile(contentRoot, 'assets/questions/compiled/manifest.json'));
    return true;
  } catch {
    return false;
  }
}

export async function removeUnusedPacks(contentRoot, manifests) {
  const keep = new Set(
    manifests
      .filter(Boolean)
      .flatMap(manifest =>
        manifest.packs.map(pack => path.resolve(getPackDirectory(contentRoot, pack)))
      )
  );
  const packsRoot = path.join(contentRoot, 'packs');
  let ids;
  try {
    ids = await fs.promises.readdir(packsRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  for (const id of ids) {
    if (!id.isDirectory()) continue;
    const idRoot = path.join(packsRoot, id.name);
    for (const version of await fs.promises.readdir(idRoot, { withFileTypes: true })) {
      if (!version.isDirectory()) continue;
      const candidate = path.resolve(idRoot, version.name);
      if (!keep.has(candidate)) await rm(candidate, { recursive: true, force: true });
    }
  }
}
