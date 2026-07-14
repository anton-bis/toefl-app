import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('dist');
const LIMIT = 100 * 1024;
const FORBIDDEN_RUNTIME_PATHS = [
  'assets/cefr-a1-a2.json',
  'assets/images',
  'assets/questions/vocabulary/alt-examples-backup.json',
  'assets/questions/vocabulary/ex-batches',
  'assets/questions/vocabulary/meta-batches',
  'assets/questions/vocabulary/word-roots.json'
];
const REQUIRED_RUNTIME_PATHS = [
  'assets/icons/icon.png',
  'assets/questions/reading/TPO-01/reading-TPO-01.md',
  'assets/questions/speaking/TPO-04/avatar.svg',
  'assets/questions/typing/corpus.json',
  'assets/questions/vocabulary/manifest.json'
];

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(filePath) : [filePath];
  });
}

const oversized = filesIn(ROOT)
  .filter(filePath => /\.(?:js|css)$/.test(filePath))
  .map(filePath => ({ filePath, size: fs.statSync(filePath).size }))
  .filter(file => file.size > LIMIT);

if (oversized.length) {
  oversized.forEach(file => {
    console.error(`${path.relative(ROOT, file.filePath)}: ${file.size} bytes`);
  });
  throw new Error(`Bundle size limit exceeded (${LIMIT} bytes)`);
}

const leakedBuildInputs = FORBIDDEN_RUNTIME_PATHS.filter(relativePath =>
  fs.existsSync(path.join(ROOT, relativePath))
);
if (leakedBuildInputs.length) {
  throw new Error(`Development assets leaked into dist: ${leakedBuildInputs.join(', ')}`);
}

const missingRuntimeAssets = REQUIRED_RUNTIME_PATHS.filter(
  relativePath => !fs.existsSync(path.join(ROOT, relativePath))
);
if (missingRuntimeAssets.length) {
  throw new Error(`Required runtime assets missing from dist: ${missingRuntimeAssets.join(', ')}`);
}

console.log(
  `Bundle check passed: JS/CSS assets are <= ${LIMIT} bytes and runtime assets are complete.`
);
