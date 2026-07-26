#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileQuestionContent, writeCompiledQuestionContent } from '../src/content/compiler.js';
import { buildQuestionManifest, SECTIONS } from '../src/content/manifest.js';

export function scanQuestionFiles(rootDir) {
  const base = path.resolve(rootDir, 'assets/questions');
  const paths = [];
  for (const section of SECTIONS) {
    const sectionDir = path.join(base, section);
    if (!fs.existsSync(sectionDir)) continue;
    for (const tpoDir of fs.readdirSync(sectionDir, { withFileTypes: true })) {
      if (!tpoDir.isDirectory()) continue;
      for (const file of fs.readdirSync(path.join(sectionDir, tpoDir.name), {
        withFileTypes: true
      })) {
        if (file.isFile() && file.name.endsWith('.md')) {
          paths.push(path.relative(rootDir, path.join(sectionDir, tpoDir.name, file.name)));
        }
      }
    }
  }
  return paths;
}

function discoverQuestionManifest(rootDir) {
  const manifest = buildQuestionManifest(scanQuestionFiles(rootDir));
  for (const entry of manifest.entries) {
    const markdown = fs.readFileSync(path.join(rootDir, entry.sourcePath), 'utf8');
    const titleTpo = markdown.match(/^#.*?TPO-(\d+)/im)?.[1];
    if (titleTpo && titleTpo.padStart(2, '0') !== entry.tpoId) {
      manifest.warnings.push(
        `${entry.sourcePath}: title says TPO-${titleTpo.padStart(2, '0')}, folder says TPO-${entry.tpoId}`
      );
    }
  }
  return manifest;
}

export function generateQuestionContent(rootDir) {
  return compileQuestionContent(rootDir, discoverQuestionManifest(rootDir));
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const rootDir = path.resolve(process.cwd());
  const compiled = generateQuestionContent(rootDir);
  const { manifest } = compiled;
  const compiledDirectory = path.join(rootDir, 'assets/questions/compiled');
  fs.rmSync(compiledDirectory, { recursive: true, force: true });
  writeCompiledQuestionContent(rootDir, compiled);
  console.log(
    `Question manifest: ${manifest.entries.length} documents -> assets/questions/compiled/manifest.json`
  );
  for (const warning of manifest.warnings) console.warn(`Warning: ${warning}`);
}
