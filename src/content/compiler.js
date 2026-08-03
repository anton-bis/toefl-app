import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { canonicalQuestionEntries } from '../../electron/services/runtime-content.js';
import { parseExamDocument } from '../../content-core/parsers/index.js';
import { assertValidExamDocument } from '../../content-core/validate.js';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function compileQuestionDocument(entry, markdown) {
  const sourceHash = sha256(markdown);
  const document = parseExamDocument(entry.section, markdown, {
    ...entry,
    sourcePath: entry.sourcePath
  });
  assertValidExamDocument(document);
  return {
    source: { path: entry.sourcePath, sha256: sourceHash },
    document
  };
}

export function compileQuestionContent(rootDir, manifest) {
  const documents = new Map();
  const entries = manifest.entries.map(entry => {
    const markdown = fs.readFileSync(path.join(rootDir, entry.sourcePath), 'utf8');
    const compiled = compileQuestionDocument(entry, markdown);
    const serialized = `${JSON.stringify(compiled)}\n`;
    documents.set(entry.documentPath, serialized);
    return {
      ...entry,
      sourceHash: compiled.source.sha256,
      documentHash: sha256(serialized)
    };
  });
  const contentHash = sha256(canonicalQuestionEntries(entries));
  return { manifest: { ...manifest, contentHash, entries }, documents };
}

export function writeCompiledQuestionContent(rootDir, compiled) {
  for (const [relativePath, contents] of compiled.documents) {
    const output = path.join(rootDir, relativePath);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, contents);
  }
  fs.writeFileSync(
    path.join(rootDir, 'assets/questions/compiled/manifest.json'),
    `${JSON.stringify(compiled.manifest)}\n`
  );
}
