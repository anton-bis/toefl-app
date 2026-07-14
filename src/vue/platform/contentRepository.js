import manifest from '../../content/question-manifest.json';

function normalizeRelativePath(path) {
  const normalized = String(path || '')
    .replaceAll('\\', '/')
    .replace(/^\/+/, '');
  if (!normalized || normalized.includes('\0') || normalized.split('/').includes('..')) {
    throw new Error(`Invalid content path: ${path}`);
  }
  return normalized;
}

export function listCatalog() {
  const tests = new Map();
  for (const entry of manifest.entries) {
    if (!tests.has(entry.tpoId)) {
      tests.set(entry.tpoId, { tpoId: entry.tpoId, description: '2026 新托福样题', sections: {} });
    }
    tests.get(entry.tpoId).sections[entry.section] = {
      id: entry.id,
      documentPath: entry.path
    };
  }
  return [...tests.values()].sort((a, b) => a.tpoId.localeCompare(b.tpoId));
}

export async function readText(path) {
  const relativePath = normalizeRelativePath(path);
  if (window.electronAPI?.readContentFile) {
    const external = await window.electronAPI.readContentFile(relativePath);
    if (typeof external === 'string') return external;
  }
  const response = await fetch(`${import.meta.env.BASE_URL}${relativePath}`);
  if (!response.ok) throw new Error(`Content not found: ${relativePath}`);
  return response.text();
}

export function resolveAssetUrl(path) {
  const relativePath = normalizeRelativePath(path);
  if (window.electronAPI?.getContentAssetUrl) {
    return window.electronAPI.getContentAssetUrl(relativePath);
  }
  return `${import.meta.env.BASE_URL}${relativePath}`;
}

export function questionAssetPath(documentPath, filename) {
  const directory = normalizeRelativePath(documentPath).split('/').slice(0, -1).join('/');
  return normalizeRelativePath(`${directory}/${filename}`);
}

export function resolveQuestionAsset(documentOrPath, filename) {
  if (!filename) return '';
  const sourcePath =
    typeof documentOrPath === 'string' ? documentOrPath : documentOrPath?.sourcePath;
  if (!sourcePath) return '';
  try {
    return resolveAssetUrl(questionAssetPath(sourcePath, filename));
  } catch {
    return '';
  }
}
