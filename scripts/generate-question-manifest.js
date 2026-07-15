#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildQuestionManifest, SECTIONS } from '../src/content/manifest.js';

export function scanQuestionFiles(rootDir) {
  const base = path.resolve(rootDir, 'assets/questions');
  const paths = [];
  for (const section of SECTIONS) {
    const sectionDir = path.join(base, section);
    if (!fs.existsSync(sectionDir)) continue;
    for (const tpoDir of fs.readdirSync(sectionDir, { withFileTypes: true })) {
      if (!tpoDir.isDirectory()) continue;
      for (const file of fs.readdirSync(path.join(sectionDir, tpoDir.name), { withFileTypes: true })) {
        if (file.isFile() && file.name.endsWith('.md')) paths.push(path.relative(rootDir, path.join(sectionDir, tpoDir.name, file.name)));
      }
    }
  }
  return paths;
}

export function generateQuestionManifest(rootDir) {
  const manifest = buildQuestionManifest(scanQuestionFiles(rootDir));
  for (const entry of manifest.entries) {
    const markdown = fs.readFileSync(path.join(rootDir, entry.path), 'utf8');
    const titleTpo = markdown.match(/^#.*?TPO-(\d+)/im)?.[1];
    if (titleTpo && titleTpo.padStart(2, '0') !== entry.tpoId) {
      manifest.warnings.push(`${entry.path}: title says TPO-${titleTpo.padStart(2, '0')}, folder says TPO-${entry.tpoId}`);
    }
  }
  return manifest;
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const rootDir = path.resolve(process.cwd());
  const outputArg = process.argv.find(value => value.startsWith('--output='))?.slice(9);
  const output = path.resolve(rootDir, outputArg || 'src/content/question-manifest.json');
  const manifest = generateQuestionManifest(rootDir);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Question manifest: ${manifest.entries.length} documents -> ${path.relative(rootDir, output)}`);
  for (const warning of manifest.warnings) console.warn(`Warning: ${warning}`);
}
